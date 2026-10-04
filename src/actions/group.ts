"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { normalizePhoneNumber } from "@/domain/phone"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { sanitizeTextInput, validateId } from "@/lib/security"
import { getUserBalances } from "@/services/balance"
import { generateGroupInviteToken, verifyGroupInviteToken } from "@/lib/invite"
import { sendNotification } from "@/services/notification"

const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(50, "Group name is too long"),
  image: z.string().optional(),
  type: z.enum(["GROUP", "TRIP", "COLLECTION"]).default("GROUP"),
  destination: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  targetAmount: z.number().int().nonnegative().optional(),
  deadline: z.string().optional(),
})

export async function createGroup(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "createGroup" },
    })
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  // Rate Limiting: max 10 groups / hour
  const rateLimit = checkActionRateLimit("GROUP_CREATION", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "createGroup" },
    })
    throw new Error("Too many groups created. Please try again later.")
  }

  const rawName = formData.get("name") as string
  const rawImage = formData.get("image") as string | undefined
  const idempotencyKey = formData.get("idempotencyKey") as string | undefined
  
  const type = formData.get("type") as "GROUP" | "TRIP" | "COLLECTION" | null
  const destination = formData.get("destination") as string | undefined
  const startDateStr = formData.get("startDate") as string | undefined
  const endDateStr = formData.get("endDate") as string | undefined
  const targetAmountStr = formData.get("targetAmount") as string | undefined
  const deadlineStr = formData.get("deadline") as string | undefined

  const name = sanitizeTextInput(rawName, 50)
  const image = rawImage ? sanitizeTextInput(rawImage, 255) : undefined

  const parsed = createGroupSchema.safeParse({ 
    name, 
    image,
    type: type || "GROUP",
    destination: destination ? sanitizeTextInput(destination, 50) : undefined,
    startDate: startDateStr || undefined,
    endDate: endDateStr || undefined,
    targetAmount: targetAmountStr ? parseInt(targetAmountStr, 10) : undefined,
    deadline: deadlineStr || undefined
  })
  
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  // Idempotency check
  if (idempotencyKey) {
    const existingGroup = await prisma.group.findUnique({
      where: { idempotencyKey },
      include: { members: true }
    })

    if (existingGroup) {
      // Ensure the authenticated user is actually a member of this group
      // (prevents stealing an idempotency key)
      const isMember = existingGroup.members.some(m => m.userId === userId)
      if (!isMember) {
        throw new Error("Unauthorized idempotency key reuse")
      }
      
      // Request is a duplicate, return the existing group safely
      redirect(`/groups/${existingGroup.id}`)
    }
  }

  // Create new group
  let group
  try {
    group = await prisma.group.create({
      data: {
        name: parsed.data.name,
        image: parsed.data.image,
        type: parsed.data.type,
        destination: parsed.data.destination,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        targetAmount: parsed.data.targetAmount,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        poolOwnerId: parsed.data.type === "COLLECTION" || parsed.data.type === "TRIP" ? userId : null,
        idempotencyKey: idempotencyKey || null,
        members: {
          create: {
            userId
          }
        }
      }
    })
  } catch (err: any) {
    // If it fails due to a unique constraint on idempotencyKey, another concurrent request won.
    if ((err.code === "P2002" || err.message?.includes("UNIQUE constraint failed")) && idempotencyKey) {
      const existingGroup = await prisma.group.findUnique({
        where: { idempotencyKey }
      })
      if (existingGroup) {
        redirect(`/groups/${existingGroup.id}`)
      }
    }
    throw err
  }

  await logSecurityEvent({
    type: "GROUP_CREATED",
    userId,
    details: { groupId: group.id, name: group.name },
  })

  revalidatePath('/groups')
  revalidatePath('/')
  redirect(`/groups/${group.id}`)
}

export async function addMemberToGroup(groupId: string, phoneOrUpi: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  validateId(groupId, "groupId")

  // Authorize: is current user an active member of this group?
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } }
  })
  if (!isMember) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId: session.user.id,
      details: { action: "addMember_non_member", groupId },
    })
    return { error: "Unauthorized: You must be a group member to add friends" }
  }

  const cleanInput = sanitizeTextInput(phoneOrUpi, 100)
  if (!cleanInput) {
    return { error: "Phone number or UPI ID is required" }
  }

  // Find user to add with phone normalization
  const normalizedPhone = normalizePhoneNumber(cleanInput)
  const userToAdd = await prisma.user.findFirst({
    where: {
      OR: [
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        { phone: cleanInput },
        { upiId: cleanInput }
      ]
    },
    select: { id: true, name: true, phone: true }
  })

  if (!userToAdd) {
    return { error: "No DuoPay account found. Share an invite link!" }
  }

  // Check if already in group
  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: userToAdd.id } }
  })

  if (existingMember) {
    return { error: "User is already in the group" }
  }

  await prisma.groupMember.create({
    data: {
      groupId,
      userId: userToAdd.id
    }
  })

  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}

export async function leaveGroup(groupId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  validateId(groupId, "groupId")
  const userId = session.user.id

  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  })
  if (!isMember) {
    throw new Error("You are not a member of this group")
  }

  // Debt safety check: check if user has active unsettled debt in this group
  const balances = await getUserBalances(userId)
  const owesInGroup = balances.detailedBalances.some(b => b.type === "USER_OWES" && b.amount > 0)
  
  // If user owes balances, verify they aren't trying to abandon debt
  if (owesInGroup) {
    // Check expenses in this group where user owes shares
    const unpaidSharesInGroup = await prisma.expenseParticipant.findFirst({
      where: {
        userId,
        expense: { groupId }
      }
    })
    if (unpaidSharesInGroup) {
      throw new Error("You have unsettled balances in this group. Please settle up before leaving.")
    }
  }

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId } }
  })

  // If group is now empty, delete it
  const remaining = await prisma.groupMember.count({ where: { groupId } })
  if (remaining === 0) {
    await prisma.group.delete({ where: { id: groupId } })
  }

  revalidatePath('/groups')
  revalidatePath('/')
  redirect('/groups')
}

export async function deleteGroup(groupId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  validateId(groupId, "groupId")

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { joinedAt: 'asc' }
  })

  // Strict authorization: only the creator (first member) can delete
  if (!members.length || members[0].userId !== session.user.id) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId: session.user.id,
      details: { action: "deleteGroup_unauthorized", groupId },
    })
    return { error: "Only the group creator can delete the group" }
  }

  // Delete all dependencies transactionally
  try {
    await prisma.$transaction(async (tx) => {
      const expenses = await tx.expense.findMany({ where: { groupId }, select: { id: true } })
      const expenseIds = expenses.map(e => e.id)
      
      if (expenseIds.length > 0) {
        await tx.expenseParticipant.deleteMany({ where: { expenseId: { in: expenseIds } } })
      }
      
      await tx.expense.deleteMany({ where: { groupId } })
      await tx.settlement.deleteMany({ where: { groupId } })
      await tx.groupMember.deleteMany({ where: { groupId } })
      await tx.group.delete({ where: { id: groupId } })
    })

    await logSecurityEvent({
      type: "GROUP_DELETED",
      userId: session.user.id,
      details: { groupId },
    })

    revalidatePath('/groups')
    revalidatePath('/')
    return { success: true }
  } catch (err: any) {
    return { error: "An unexpected error occurred while deleting the group" }
  }
}

export async function getGroupInviteToken(groupId: string): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  validateId(groupId, "groupId")

  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } }
  })
  if (!isMember) {
    throw new Error("Unauthorized: You must be a group member to invite others")
  }

  return generateGroupInviteToken(groupId, session.user.id)
}

export async function joinGroupWithInviteToken(groupId: string, token: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  validateId(groupId, "groupId")
  const userId = session.user.id

  // Rate Limiting: 10 join attempts per 15 mins
  const rateLimit = checkActionRateLimit("GROUP_JOIN", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "joinGroupWithInviteToken", groupId },
    })
    throw new Error("Too many join attempts. Please try again later.")
  }

  // Cryptographic token verification
  const verification = verifyGroupInviteToken(groupId, token)
  if (!verification.valid) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      userId,
      details: { action: "joinGroup_invalid_token", groupId, error: verification.error },
    })
    throw new Error(verification.error || "Invalid invite link")
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true }
  })
  if (!group) {
    throw new Error("Group not found")
  }

  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } }
  })
  if (existingMember) {
    return { success: true, alreadyMember: true }
  }

  await prisma.groupMember.create({
    data: {
      groupId,
      userId,
    }
  })

  await logSecurityEvent({
    type: "GROUP_JOINED",
    userId,
    details: { groupId, inviterId: verification.inviterId },
  })

  // Notify inviter that new member joined
  if (verification.inviterId && verification.inviterId !== userId) {
    const [joiner, grp] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    ])
    sendNotification({
      userId: verification.inviterId,
      type: "GROUP_MEMBER_JOINED",
      title: "New Group Member",
      body: `${joiner?.name || "A friend"} joined ${grp?.name || "your group"}.`,
      url: `/groups/${groupId}`,
      data: { groupId, joinerId: userId },
    }).catch(() => {})
  }

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  revalidatePath('/')
  return { success: true, alreadyMember: false }
}

