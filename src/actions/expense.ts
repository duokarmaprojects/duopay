"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { 
  calculateEqualSplit, 
  calculatePercentageSplit,
  calculateExactSplit,
  calculateSharesSplit,
  inrToPaise 
} from "@/domain/money"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { sanitizeTextInput, validateId } from "@/lib/security"

const addExpenseSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  description: z.string().min(1, "Description is required").max(100, "Description is too long"),
  amount: z.number().positive("Amount must be positive").max(10000000, "Amount exceeds limit"),
  payerId: z.string().min(1, "Payer ID is required"),
  participantIds: z.array(z.string()).min(1, "At least one participant required"),
  splitMethod: z.enum(["EQUAL", "PERCENTAGE", "EXACT", "SHARES"]).default("EQUAL"),
  splitData: z.string().optional(),
  category: z.string().optional()
})

export async function addExpense(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "addExpense" },
    })
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  // Rate Limiting: max 20 expenses / min
  const rateLimit = checkActionRateLimit("EXPENSE_CREATION", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "addExpense" },
    })
    throw new Error("Too many expenses added recently. Please wait a moment.")
  }

  const groupId = formData.get("groupId") as string
  const rawDescription = formData.get("description") as string
  const amountInr = parseFloat(formData.get("amount") as string)
  const payerId = formData.get("payerId") as string
  const participantIds = formData.getAll("participants") as string[]
  const splitMethod = (formData.get("splitMethod") as string || "EQUAL") as "EQUAL" | "PERCENTAGE" | "EXACT" | "SHARES"
  const splitDataStr = formData.get("splitData") as string || "{}"
  const rawCategory = formData.get("category") as string || "OTHER"

  const description = sanitizeTextInput(rawDescription, 100)
  const category = sanitizeTextInput(rawCategory, 30)

  const parsed = addExpenseSchema.safeParse({
    groupId,
    description,
    amount: amountInr,
    payerId,
    participantIds,
    splitMethod,
    splitData: splitDataStr,
    category
  })

  if (!parsed.success) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { errors: parsed.error.issues },
    })
    throw new Error(parsed.error.issues[0].message)
  }

  const { data } = parsed
  validateId(data.groupId, "groupId")
  validateId(data.payerId, "payerId")
  for (const pid of data.participantIds) {
    validateId(pid, "participantId")
  }

  const amountPaise = inrToPaise(data.amount)

  // Validate group access: session user MUST be a member
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: data.groupId },
    select: { userId: true }
  })
  const memberIdSet = new Set(groupMembers.map(m => m.userId))

  if (!memberIdSet.has(userId)) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "addExpense_non_member", groupId: data.groupId },
    })
    throw new Error("Unauthorized: You are not a member of this group")
  }

  // Validate that payer is also a member of the group
  if (!memberIdSet.has(data.payerId)) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "addExpense_invalid_payer", payerId: data.payerId, groupId: data.groupId },
    })
    throw new Error("Specified payer is not a member of this group")
  }

  // Validate that ALL participants are members of the group
  for (const pid of data.participantIds) {
    if (!memberIdSet.has(pid)) {
      await logSecurityEvent({
        type: "IDOR_ATTEMPT_BLOCKED",
        userId,
        details: { action: "addExpense_invalid_participant", participantId: pid, groupId: data.groupId },
      })
      throw new Error(`Participant ${pid} is not a member of this group`)
    }
  }

  // Parse split data safely
  let splitDataObj: Record<string, number> = {}
  try {
    splitDataObj = JSON.parse(data.splitData || "{}")
  } catch {
    throw new Error("Invalid split data format")
  }

  // Calculate split
  let shares: Record<string, number>
  try {
    if (data.splitMethod === "PERCENTAGE") {
      shares = calculatePercentageSplit(amountPaise, splitDataObj)
    } else if (data.splitMethod === "EXACT") {
      shares = calculateExactSplit(amountPaise, splitDataObj)
    } else if (data.splitMethod === "SHARES") {
      shares = calculateSharesSplit(amountPaise, splitDataObj)
    } else {
      shares = calculateEqualSplit(amountPaise, data.participantIds)
    }
    
    // Verify sum of shares equals total amount (preventing money leakage or inflation)
    const sumShares = Object.values(shares).reduce((a, b) => a + b, 0)
    if (sumShares !== amountPaise) {
      throw new Error(`Split sum (${sumShares}) does not match expense amount (${amountPaise})`)
    }

    for (const pid of data.participantIds) {
      if (!(pid in shares)) {
         throw new Error(`Participant ${pid} is missing a computed share`)
      }
    }
  } catch (e: any) {
    throw new Error(e.message)
  }

  const rawIdempotencyKey = formData.get("idempotencyKey")
  const idempotencyKey =
    typeof rawIdempotencyKey === "string" && rawIdempotencyKey.trim()
      ? rawIdempotencyKey.trim()
      : `expense:${userId}:${data.groupId}:${amountPaise}:${data.description}:${Math.floor(Date.now() / 15000)}`

  const existingExpense = await prisma.expense.findUnique({
    where: { idempotencyKey },
    select: { id: true, groupId: true },
  })
  if (existingExpense) {
    redirect(`/groups/${data.groupId}`)
  }

  // Create Expense and Participants transactionally with DB-level idempotency protection
  try {
    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId: data.groupId,
          description: data.description,
          amount: amountPaise,
          payerId: data.payerId,
          splitMethod: data.splitMethod,
          category: data.category,
          idempotencyKey,
        },
      })

      const participantsData = data.participantIds.map(pid => ({
        expenseId: expense.id,
        userId: pid,
        share: shares[pid]
      }))

      await tx.expenseParticipant.createMany({
        data: participantsData
      })
    })
  } catch (err: any) {
    if (err?.code === "P2002" || String(err?.message || "").includes("idempotencyKey")) {
      redirect(`/groups/${data.groupId}`)
    }
    throw err
  }

  await logSecurityEvent({
    type: "EXPENSE_CREATED",
    userId,
    details: {
      groupId: data.groupId,
      amountPaise,
      payerId: data.payerId,
      participantCount: data.participantIds.length,
    },
  })

  revalidatePath(`/groups/${data.groupId}`)
  revalidatePath('/')
  redirect(`/groups/${data.groupId}`)
}

export async function deleteExpense(expenseId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  validateId(expenseId, "expenseId")

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        include: {
          members: {
            orderBy: { joinedAt: "asc" }
          }
        }
      }
    }
  })

  if (!expense) throw new Error("Expense not found")

  // Authorization: Only the payer OR the group creator can delete an expense
  const isPayer = expense.payerId === session.user.id
  const isGroupCreator = expense.group?.members[0]?.userId === session.user.id

  if (!isPayer && !isGroupCreator) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId: session.user.id,
      details: { action: "deleteExpense_unauthorized", expenseId },
    })
    throw new Error("Only the expense payer or group creator can delete this expense")
  }

  // Delete transactionally
  await prisma.$transaction(async (tx) => {
    await tx.expenseParticipant.deleteMany({
      where: { expenseId }
    })
    
    await tx.expense.delete({
      where: { id: expenseId }
    })
  })

  await logSecurityEvent({
    type: "EXPENSE_DELETED",
    userId: session.user.id,
    details: { expenseId, groupId: expense.groupId },
  })

  revalidatePath(`/groups/${expense.groupId}`)
  revalidatePath('/')
  revalidatePath('/activity')
}
