"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { trackEvent } from "@/domain/analytics"
import { normalizePhoneNumber } from "@/domain/phone"

const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(50, "Group name is too long"),
  image: z.string().optional()
})

export async function createGroup(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const name = formData.get("name") as string
  const image = formData.get("image") as string | undefined

  const parsed = createGroupSchema.safeParse({ name, image: image || undefined })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      image: parsed.data.image,
      members: {
        create: {
          userId: session.user.id
        }
      }
    }
  })

  await trackEvent({
    eventType: "GROUP_CREATED",
    userId: session.user.id,
    entityType: "Group",
    entityId: group.id
  })

  revalidatePath('/groups')
  revalidatePath('/')
  redirect(`/groups/${group.id}`)
}

export async function addMemberToGroup(groupId: string, phoneOrUpi: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Authorize: is current user in the group?
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } }
  })
  if (!isMember) throw new Error("Unauthorized access to group")

  // Find user to add with phone normalization
  const normalizedPhone = normalizePhoneNumber(phoneOrUpi)
  const userToAdd = await prisma.user.findFirst({
    where: {
      OR: [
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        { phone: phoneOrUpi.trim() },
        { upiId: phoneOrUpi.trim() }
      ]
    }
  })

  if (!userToAdd) {
    throw new Error("User not found. They need to create a DuoPay account first.")
  }

  // Check if already in group
  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: userToAdd.id } }
  })

  if (existingMember) {
    throw new Error("User is already in the group")
  }

  await prisma.groupMember.create({
    data: {
      groupId,
      userId: userToAdd.id
    }
  })

  revalidatePath(`/groups/${groupId}`)
}

export async function leaveGroup(groupId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Check if they are part of any unresolved expenses or settlements in this group?
  // For V1, we'll just allow them to leave. Real app would prevent leaving if they owe money.
  
  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId: session.user.id } }
  })

  // Check if group is empty
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

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { joinedAt: 'asc' }
  })

  // Basic authorization: must be the creator (first member)
  if (!members.length || members[0].userId !== session.user.id) {
    throw new Error("Only the group creator can delete the group")
  }

  // Delete all dependencies transactionally
  await prisma.$transaction(async (tx) => {
    // Delete all expense participants for expenses in this group
    const expenses = await tx.expense.findMany({ where: { groupId }, select: { id: true } })
    const expenseIds = expenses.map(e => e.id)
    
    if (expenseIds.length > 0) {
      await tx.expenseParticipant.deleteMany({ where: { expenseId: { in: expenseIds } } })
    }
    
    // Delete expenses, settlements, members
    await tx.expense.deleteMany({ where: { groupId } })
    await tx.settlement.deleteMany({ where: { groupId } })
    await tx.groupMember.deleteMany({ where: { groupId } })
    await tx.group.delete({ where: { id: groupId } })
  })

  revalidatePath('/groups')
  revalidatePath('/')
  redirect('/groups')
}
