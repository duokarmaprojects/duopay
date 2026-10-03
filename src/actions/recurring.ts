"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { sanitizeTextInput, validateId, validateInrAmount } from "@/lib/security"
import { sendNotification } from "@/services/notification"
import {
  calculateNextOccurrence,
  getRecurringExpenseIdempotencyKey,
  RECURRING_FREQUENCIES,
  RecurringFrequency,
} from "@/domain/recurring"
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateExactSplit,
  calculateSharesSplit,
} from "@/domain/money"

const createRecurringExpenseSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  description: z.string().min(1, "Description is required").max(100),
  amount: z.number().positive("Amount must be positive").max(10000000),
  category: z.string().max(30).optional().default("OTHER"),
  frequency: z.enum(RECURRING_FREQUENCIES),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  splitMethod: z.enum(["EQUAL", "PERCENTAGE", "EXACT", "SHARES"]).default("EQUAL"),
  participantIds: z.array(z.string()).min(1, "At least one participant required"),
  splitData: z.string().optional(),
})

/**
 * Creates a recurring expense schedule for an authorized group.
 */
export async function createRecurringExpense(input: unknown) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "createRecurringExpense" },
    })
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  const rateLimit = checkActionRateLimit("EXPENSE_CREATION", userId)
  if (!rateLimit.allowed) {
    throw new Error("Too many recurring expenses created recently. Please wait a moment.")
  }

  const parsed = createRecurringExpenseSchema.safeParse(input)
  if (!parsed.success) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "createRecurringExpense_invalid", errors: parsed.error.issues },
    })
    throw new Error(parsed.error.issues[0]?.message || "Invalid input")
  }

  const data = parsed.data
  validateId(data.groupId, "groupId")

  // Verify group membership
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: data.groupId, userId } },
  })
  if (!isMember) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "createRecurringExpense_not_member", groupId: data.groupId },
    })
    throw new Error("You must be an active member of this group to create a recurring expense")
  }

  // Verify all participants are group members
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: data.groupId },
    select: { userId: true },
  })
  const memberSet = new Set(groupMembers.map((m) => m.userId))
  for (const pid of data.participantIds) {
    validateId(pid, "participantId")
    if (!memberSet.has(pid)) {
      throw new Error(`Participant ${pid} is not a member of this group`)
    }
  }

  const amountPaise = Math.round(data.amount * 100)
  if (amountPaise <= 0 || !Number.isInteger(amountPaise)) {
    throw new Error("Amount must be a positive integer in paise")
  }

  const startDate = new Date(data.startDate)
  const endDate = data.endDate ? new Date(data.endDate) : null

  if (endDate && endDate <= startDate) {
    throw new Error("End date must be after start date")
  }

  // Initial nextOccurrence is the startDate (or next occurrence if start date is in the past)
  const nextOccurrence = new Date(startDate.getTime())

  // Store split configuration safely as JSON
  const splitConfig = JSON.stringify({
    participantIds: data.participantIds,
    splitData: data.splitData || "{}",
  })

  const recurringExpense = await prisma.recurringExpense.create({
    data: {
      groupId: data.groupId,
      description: sanitizeTextInput(data.description, 100),
      amount: amountPaise,
      category: sanitizeTextInput(data.category, 30),
      payerId: userId,
      splitMethod: data.splitMethod,
      splitData: splitConfig,
      frequency: data.frequency,
      startDate,
      endDate,
      nextOccurrence,
      status: "ACTIVE",
    },
  })

  await logSecurityEvent({
    type: "RECURRING_EXPENSE_CREATED",
    userId,
    details: {
      recurringExpenseId: recurringExpense.id,
      groupId: data.groupId,
      frequency: data.frequency,
      amountPaise,
    },
  })

  revalidatePath(`/groups/${data.groupId}`)
  return { success: true, recurringExpenseId: recurringExpense.id }
}

/**
 * Pause, resume, or cancel a recurring expense schedule.
 * Only the creator or group creator can manage it.
 */
export async function updateRecurringExpenseStatus(
  recurringExpenseId: string,
  newStatus: "ACTIVE" | "PAUSED" | "CANCELLED"
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id
  validateId(recurringExpenseId, "recurringExpenseId")

  const recurring = await prisma.recurringExpense.findUnique({
    where: { id: recurringExpenseId },
    include: {
      group: {
        include: { members: { orderBy: { joinedAt: "asc" }, take: 1 } },
      },
    },
  })

  if (!recurring) throw new Error("Recurring expense schedule not found")

  const isOwner = recurring.payerId === userId
  const isGroupCreator = recurring.group.members[0]?.userId === userId

  if (!isOwner && !isGroupCreator) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "updateRecurringExpenseStatus_unauthorized", recurringExpenseId },
    })
    throw new Error("You are not authorized to update this recurring expense")
  }

  await prisma.recurringExpense.update({
    where: { id: recurringExpenseId },
    data: { status: newStatus },
  })

  await logSecurityEvent({
    type: "RECURRING_EXPENSE_UPDATED",
    userId,
    details: { recurringExpenseId, newStatus },
  })

  revalidatePath(`/groups/${recurring.groupId}`)
  return { success: true }
}

/**
 * Permanently deletes a recurring expense schedule.
 */
export async function deleteRecurringExpense(recurringExpenseId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id
  validateId(recurringExpenseId, "recurringExpenseId")

  const recurring = await prisma.recurringExpense.findUnique({
    where: { id: recurringExpenseId },
    include: {
      group: {
        include: { members: { orderBy: { joinedAt: "asc" }, take: 1 } },
      },
    },
  })

  if (!recurring) throw new Error("Recurring expense not found")

  const isOwner = recurring.payerId === userId
  const isGroupCreator = recurring.group.members[0]?.userId === userId

  if (!isOwner && !isGroupCreator) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "deleteRecurringExpense_unauthorized", recurringExpenseId },
    })
    throw new Error("You are not authorized to delete this recurring expense")
  }

  await prisma.recurringExpense.delete({
    where: { id: recurringExpenseId },
  })

  await logSecurityEvent({
    type: "RECURRING_EXPENSE_DELETED",
    userId,
    details: { recurringExpenseId },
  })

  revalidatePath(`/groups/${recurring.groupId}`)
  return { success: true }
}

/**
 * Fetches all recurring expense schedules for a group.
 */
export async function getGroupRecurringExpenses(groupId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  validateId(groupId, "groupId")

  // Membership validation
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } },
  })
  if (!isMember) throw new Error("Unauthorized")

  return prisma.recurringExpense.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    include: {
      payer: { select: { id: true, name: true } },
    },
  })
}

/**
 * Idempotent generator function: checks due recurring expenses and converts them
 * into immutable Expense and ExpenseParticipant records.
 * Can be safely called upon group load or via a cron/serverless trigger.
 */
export async function generateDueRecurringExpenses(groupId?: string) {
  const now = new Date()

  // Find active recurring expenses where nextOccurrence <= now
  const dueList = await prisma.recurringExpense.findMany({
    where: {
      status: "ACTIVE",
      nextOccurrence: { lte: now },
      ...(groupId ? { groupId } : {}),
    },
    include: {
      group: { include: { members: { select: { userId: true } } } },
    },
  })

  let generatedCount = 0

  for (const item of dueList) {
    // If end date passed, mark COMPLETED and stop
    if (item.endDate && item.nextOccurrence > item.endDate) {
      await prisma.recurringExpense.update({
        where: { id: item.id },
        data: { status: "COMPLETED" },
      })
      continue
    }

    const idempotencyKey = getRecurringExpenseIdempotencyKey(item.id, item.nextOccurrence)

    // Check if expense already generated
    const existing = await prisma.expense.findUnique({
      where: { idempotencyKey },
    })

    if (!existing) {
      // Decode split configuration
      let splitConfig: { participantIds: string[]; splitData: string } = {
        participantIds: [item.payerId],
        splitData: "{}",
      }
      try {
        if (item.splitData) {
          splitConfig = JSON.parse(item.splitData)
        }
      } catch {
        splitConfig.participantIds = item.group.members.map((m) => m.userId)
      }

      // Filter participants to current active group members
      const activeMemberIds = new Set(item.group.members.map((m) => m.userId))
      const validParticipants = splitConfig.participantIds.filter((pid) => activeMemberIds.has(pid))
      if (validParticipants.length === 0) {
        validParticipants.push(item.payerId)
      }

      let splitDataObj: Record<string, number> = {}
      try {
        splitDataObj = JSON.parse(splitConfig.splitData || "{}")
      } catch {
        splitDataObj = {}
      }

      // Compute exact shares
      let shares: Record<string, number>
      if (item.splitMethod === "PERCENTAGE") {
        shares = calculatePercentageSplit(item.amount, splitDataObj)
      } else if (item.splitMethod === "EXACT") {
        shares = calculateExactSplit(item.amount, splitDataObj)
      } else if (item.splitMethod === "SHARES") {
        shares = calculateSharesSplit(item.amount, splitDataObj)
      } else {
        shares = calculateEqualSplit(item.amount, validParticipants)
      }

      // Create transactionally
      try {
        await prisma.$transaction(async (tx) => {
          const expense = await tx.expense.create({
            data: {
              groupId: item.groupId,
              description: item.description,
              amount: item.amount,
              payerId: item.payerId,
              splitMethod: item.splitMethod,
              category: item.category,
              idempotencyKey,
              date: item.nextOccurrence,
            },
          })

          const participantsData = validParticipants.map((pid) => ({
            expenseId: expense.id,
            userId: pid,
            share: shares[pid] || 0,
          }))

          await tx.expenseParticipant.createMany({
            data: participantsData,
          })
        })

        generatedCount++

        // Dispatch notifications to participants
        for (const pid of validParticipants) {
          if (pid !== item.payerId) {
            sendNotification({
              userId: pid,
              type: "RECURRING_EXPENSE_REMINDER",
              title: `Recurring Expense: ${item.description}`,
              body: `Scheduled expense of ₹${(item.amount / 100).toFixed(2)} generated for ${item.group.name}`,
              url: `/groups/${item.groupId}`,
              data: { groupId: item.groupId, amountPaise: shares[pid] },
              dedupKey: `push:recurring:${item.id}:${item.nextOccurrence.toISOString().slice(0, 10)}:${pid}`,
            }).catch(() => {})
          }
        }
      } catch (err: any) {
        if (err?.code !== "P2002") {
          console.error("[RecurringExpense] Generation error:", err)
        }
      }
    }

    // Advance next occurrence
    const nextDate = calculateNextOccurrence(item.nextOccurrence, item.frequency as RecurringFrequency)
    const isNowCompleted = item.endDate && nextDate > item.endDate

    await prisma.recurringExpense.update({
      where: { id: item.id },
      data: {
        nextOccurrence: nextDate,
        lastGeneratedAt: now,
        status: isNowCompleted ? "COMPLETED" : item.status,
      },
    })
  }

  return { success: true, generatedCount }
}
