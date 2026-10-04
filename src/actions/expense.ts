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
import { sanitizeTextInput, validateId, validateInrAmount } from "@/lib/security"
import { sendNotification } from "@/services/notification"

const addExpenseSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  description: z.string().min(1, "Description is required").max(100, "Description is too long"),
  amount: z.number().positive("Amount must be positive").max(10000000, "Amount exceeds limit"),
  payerId: z.string().min(1, "Payer ID is required"),
  participantIds: z.array(z.string()).min(1, "At least one participant required"),
  splitMethod: z.enum(["EQUAL", "PERCENTAGE", "EXACT", "SHARES"]).default("EQUAL"),
  splitData: z.string().optional(),
  category: z.string().optional(),
  source: z.string().optional().default("MANUAL"),
  receiptUrl: z.string().optional(),
  metadata: z.string().optional(),
  receiptItems: z.string().optional(), // JSON string for receipt items array
  isPoolExpense: z.boolean().optional().default(false),
  priority: z.string().optional().default("NORMAL"),
  dueDate: z.date().optional().nullable(),
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

  // Zero-Trust Hardening: Reject forbidden verification, financial, or auth parameters in expense submission
  const FORBIDDEN_EXPENSE_FIELDS = [
    "status",
    "paymentStatus",
    "verificationMethod",
    "verifiedAmount",
    "verifiedAt",
    "providerTransactionId",
    "cashback",
    "cashbackAmount",
    "reward",
    "rewardAmount",
    "role",
    "isAdmin",
  ]
  for (const field of FORBIDDEN_EXPENSE_FIELDS) {
    if (formData.has(field)) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId,
        details: { action: "addExpense_forbidden_field", field },
      })
      throw new Error("Client submission of payment verification state is strictly prohibited")
    }
  }

  const rawGroupId = formData.get("groupId") as string
  const rawDescription = formData.get("description") as string
  const rawAmount = formData.get("amount")
  const rawPayerId = (formData.get("payerId") as string) || userId
  const participantIds = formData.getAll("participants") as string[]
  const splitMethod = (formData.get("splitMethod") as string || "EQUAL") as "EQUAL" | "PERCENTAGE" | "EXACT" | "SHARES"
  const splitDataStr = formData.get("splitData") as string || "{}"
  const rawCategory = formData.get("category") as string || "OTHER"
  const isPoolExpense = formData.get("isPoolExpense") === "true"
  const priority = formData.get("priority") as string || "NORMAL"
  const rawDueDate = formData.get("dueDate") as string
  const dueDate = rawDueDate ? new Date(rawDueDate) : null

  // Payer authorization: user cannot record an expense on behalf of another user as payer
  if (rawPayerId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: {
        action: "addExpense_payer_mismatch",
        claimedPayerId: rawPayerId,
        groupId: rawGroupId,
      },
    })
    throw new Error("Unauthorized: You cannot create an expense on behalf of another user")
  }

  // Strict INR validation (at most 2 decimals, positive, safe bounds)
  const { inr: amountInr, paise: amountPaise } = validateInrAmount(rawAmount, "amount", 10000000)

  let description = sanitizeTextInput(rawDescription, 100)
  let category = sanitizeTextInput(rawCategory, 30)

  // 1. Normalize Merchant & get default category
  const { normalizeMerchantName } = await import('@/actions/merchant')
  const { normalizedName, category: defaultCategory } = await normalizeMerchantName(description)
  description = normalizedName
  if (category === "OTHER" && defaultCategory) {
    category = defaultCategory
  }

  // 2. Fetch User Automation Rules
  const rules = await prisma.automationRule.findMany({
    where: { userId, isActive: true },
    orderBy: { priority: 'desc' }
  })

  // 3. Apply Rules
  const sourceInput = (formData.get("source") as string) || "MANUAL"
  for (const rule of rules) {
    let match = true
    if (rule.merchantName && !description.toLowerCase().includes(rule.merchantName.toLowerCase())) match = false
    if (rule.minAmount && amountPaise < rule.minAmount) match = false
    if (rule.maxAmount && amountPaise > rule.maxAmount) match = false
    if (rule.source && rule.source !== sourceInput) match = false
    if (rule.groupId && rule.groupId !== rawGroupId) match = false

    if (match && rule.setCategory) {
      category = rule.setCategory
      break // Apply highest priority matched rule
    }
  }

  const parsed = addExpenseSchema.safeParse({
    groupId: rawGroupId,
    description,
    amount: amountInr,
    payerId: rawPayerId,
    participantIds,
    splitMethod,
    splitData: splitDataStr,
    category,
    source: (formData.get("source") as string) || "MANUAL",
    receiptUrl: (formData.get("receiptUrl") as string) || undefined,
    metadata: (formData.get("metadata") as string) || undefined,
    receiptItems: (formData.get("receiptItems") as string) || undefined,
    isPoolExpense,
    priority,
    dueDate,
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
          source: data.source,
          receiptUrl: data.receiptUrl,
          metadata: data.metadata,
          isPoolExpense: data.isPoolExpense,
          priority: data.priority,
          dueDate: data.dueDate,
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

      if (data.receiptItems) {
        try {
          const items = JSON.parse(data.receiptItems);
          if (Array.isArray(items) && items.length > 0) {
            await tx.receiptItem.createMany({
              data: items.map((item: any) => ({
                expenseId: expense.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity || 1,
                assignedTo: item.assignedTo ? JSON.stringify(item.assignedTo) : null
              }))
            });
          }
        } catch (e) {
          console.error("Failed to parse receipt items", e);
        }
      }
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

  // Asynchronously notify participants (excluding payer)
  const payerUser = await prisma.user.findUnique({
    where: { id: data.payerId },
    select: { name: true },
  })
  const payerName = payerUser?.name || "Someone"

  for (const pid of data.participantIds) {
    if (pid !== data.payerId) {
      const shareRupees = (shares[pid] / 100).toFixed(2)
      sendNotification({
        userId: pid,
        type: "EXPENSE_ADDED",
        title: `${payerName} added an expense`,
        body: `${data.description} — Your share is ₹${shareRupees}`,
        url: `/groups/${data.groupId}`,
        data: { groupId: data.groupId, amountPaise: shares[pid] },
      }).catch(() => {})
    }
  }

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

export async function confirmUpcomingExpense(expenseId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(expenseId, "expenseId")

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        include: {
          members: true
        }
      }
    }
  })

  if (!expense) throw new Error("Expense not found")

  if (expense.status !== "UPCOMING") {
    throw new Error("Only UPCOMING expenses can be confirmed")
  }

  // Ensure user is payer or group member
  const isPayer = expense.payerId === userId
  const isGroupMember = expense.group?.members.some(m => m.userId === userId)
  
  if (!isPayer && !isGroupMember) {
    throw new Error("Unauthorized to confirm this expense")
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: { status: "FINAL" }
  })

  if (expense.groupId) {
    revalidatePath(`/groups/${expense.groupId}`)
  }
  revalidatePath('/bills')
  return { success: true }
}

export async function skipUpcomingExpense(expenseId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(expenseId, "expenseId")

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        include: {
          members: true
        }
      }
    }
  })

  if (!expense) throw new Error("Expense not found")

  if (expense.status !== "UPCOMING") {
    throw new Error("Only UPCOMING expenses can be skipped")
  }

  // Ensure user is payer or group member
  const isPayer = expense.payerId === userId
  const isGroupMember = expense.group?.members.some(m => m.userId === userId)
  
  if (!isPayer && !isGroupMember) {
    throw new Error("Unauthorized to skip this expense")
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: { status: "SKIPPED" }
  })

  if (expense.groupId) {
    revalidatePath(`/groups/${expense.groupId}`)
  }
  revalidatePath('/bills')
  return { success: true }
}
