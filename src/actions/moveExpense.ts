"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId } from "@/lib/security"
import { pusherServer } from "@/lib/realtime/pusher"
import { sendNotification } from "@/services/notification"
import { revalidatePath } from "next/cache"

export async function previewMoveExpense(
  expenseId: string,
  destinationGroupId: string
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(expenseId, "expenseId")
  validateId(destinationGroupId, "destinationGroupId")

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: true,
      participants: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!expense) throw new Error("Expense not found")
  if (!expense.groupId || !expense.group) {
    throw new Error("Only group expenses can be moved between groups")
  }

  const sourceGroupId = expense.groupId
  if (sourceGroupId === destinationGroupId) {
    throw new Error("Source and destination groups must be different")
  }

  // Verify caller membership in source group
  const sourceMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: sourceGroupId, userId } },
  })
  if (!sourceMember) {
    throw new Error("Unauthorized: You are not a member of the source group")
  }

  // Verify destination group exists and caller is member
  const destGroup = await prisma.group.findUnique({
    where: { id: destinationGroupId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  })
  if (!destGroup) throw new Error("Destination group not found")

  const destMemberIds = new Set(destGroup.members.map((m) => m.userId))
  if (!destMemberIds.has(userId)) {
    throw new Error("Unauthorized: You are not a member of the destination group")
  }

  // Check which participants are missing from the destination group
  const missingParticipants = expense.participants
    .filter((p) => !destMemberIds.has(p.userId))
    .map((p) => p.user?.name || "Member")

  const canMove = missingParticipants.length === 0

  return {
    canMove,
    sourceGroupId,
    sourceGroupName: expense.group.name,
    destinationGroupId,
    destinationGroupName: destGroup.name,
    expenseAmountPaise: expense.amount,
    expenseDescription: expense.description,
    missingParticipants,
    message: canMove
      ? "All expense participants are members of the destination group. Ready to move."
      : `Cannot move: The following participants are not in "${destGroup.name}": ${missingParticipants.join(", ")}. Please add them to the destination group first.`,
  }
}

export async function moveExpense(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "moveExpense" },
    })
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  const expenseId = formData.get("expenseId") as string
  const destinationGroupId = formData.get("destinationGroupId") as string
  const idempotencyKey = (formData.get("idempotencyKey") as string) || null

  validateId(expenseId, "expenseId")
  validateId(destinationGroupId, "destinationGroupId")
  if (idempotencyKey) {
    validateId(idempotencyKey, "idempotencyKey")
  }

  // Rate Limiting
  const rateLimit = checkActionRateLimit("EXPENSE_CREATION", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "moveExpense" },
    })
    throw new Error("Rate limit exceeded. Please wait a moment before moving.")
  }

  // Load expense and participants directly from authoritative DB
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: true,
      participants: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  })

  if (!expense) throw new Error("Expense not found")
  if (!expense.groupId) {
    throw new Error("Expense does not belong to a group and cannot be moved")
  }

  const sourceGroupId = expense.groupId
  if (sourceGroupId === destinationGroupId) {
    throw new Error("Source and destination groups must be different")
  }

  // Verify caller membership in source group
  const sourceMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: sourceGroupId, userId } },
  })
  if (!sourceMember) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "moveExpense_source_not_member", expenseId, sourceGroupId },
    })
    throw new Error("Unauthorized: You are not a member of the source group")
  }

  // Verify destination group exists & caller membership in destination group
  const destGroup = await prisma.group.findUnique({
    where: { id: destinationGroupId },
    include: {
      members: true,
    },
  })
  if (!destGroup) throw new Error("Destination group not found")

  const destMemberIds = new Set(destGroup.members.map((m) => m.userId))
  if (!destMemberIds.has(userId)) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "moveExpense_destination_not_member", expenseId, destinationGroupId },
    })
    throw new Error("Unauthorized: You are not a member of the destination group")
  }

  // Verify ALL participants in the expense are members of destination group
  for (const participant of expense.participants) {
    if (!destMemberIds.has(participant.userId)) {
      const name = participant.user?.name || "Participant"
      throw new Error(`Cannot move expense: ${name} is not a member of ${destGroup.name}`)
    }
  }

  // ATOMIC DATABASE TRANSACTION
  // Test-and-set conditional update ensures that 10 concurrent requests result in EXACTLY ONE move!
  let isDuplicate = false
  await prisma.$transaction(async (tx) => {
    // Check if already moved to destination (idempotency check)
    const current = await tx.expense.findUnique({
      where: { id: expenseId },
    })
    if (current && current.groupId === destinationGroupId) {
      isDuplicate = true
      return
    }

    const updated = await tx.expense.updateMany({
      where: {
        id: expenseId,
        groupId: sourceGroupId, // Conditional condition ensures atomic single execution!
      },
      data: {
        groupId: destinationGroupId,
      },
    })

    if (updated.count === 0) {
      // Race condition check: verify if concurrent request already moved it to destinationGroupId
      const verifyAfter = await tx.expense.findUnique({
        where: { id: expenseId },
      })
      if (verifyAfter && verifyAfter.groupId === destinationGroupId) {
        isDuplicate = true
        return
      }
      throw new Error("Concurrent conflict: Expense has already been moved")
    }

    // Update any group-scoped attachments associated with this expense
    await tx.attachment.updateMany({
      where: { expenseId },
      data: { groupId: destinationGroupId },
    })
  })

  if (isDuplicate) {
    return {
      success: true,
      expenseId,
      sourceGroupId,
      destinationGroupId,
      isDuplicate: true,
    }
  }

  await logSecurityEvent({
    type: "EXPENSE_CREATED", // Logged to existing audit type
    userId,
    details: {
      action: "EXPENSE_MOVED",
      expenseId,
      sourceGroupId,
      destinationGroupId,
      amountPaise: expense.amount,
    },
  })

  // Realtime Pusher broadcast ONLY AFTER DB commit
  try {
    const payload = {
      expenseId,
      sourceGroupId,
      destinationGroupId,
      description: expense.description,
      amount: expense.amount,
      movedBy: session.user.name || "A member",
    }
    await pusherServer.trigger(`group-${sourceGroupId}`, "expense.moved_out", payload)
    await pusherServer.trigger(`group-${destinationGroupId}`, "expense.moved_in", payload)
  } catch (err) {}

  // Notify destination group members
  for (const m of destGroup.members) {
    if (m.userId !== userId) {
      sendNotification({
        userId: m.userId,
        type: "EXPENSE_ADDED",
        title: `Expense moved to ${destGroup.name}`,
        body: `${session.user.name || "A member"} moved "${expense.description}" (₹${(expense.amount / 100).toFixed(2)}) here`,
        url: `/groups/${destinationGroupId}`,
        data: { groupId: destinationGroupId, expenseId },
      }).catch(() => {})
    }
  }

  revalidatePath(`/groups/${sourceGroupId}`)
  revalidatePath(`/groups/${destinationGroupId}`)
  revalidatePath("/activity")

  return {
    success: true,
    expenseId,
    sourceGroupId,
    destinationGroupId,
    isDuplicate: false,
  }
}

export async function getUserGroups() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          image: true,
          type: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  })

  return memberships.map((m) => m.group)
}
