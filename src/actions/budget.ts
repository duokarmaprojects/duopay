"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId, sanitizeTextInput } from "@/lib/security"
import { getUserTrueSpend } from "@/services/trueSpend"
import { sendNotification } from "@/services/notification"
import { pusherServer } from "@/lib/realtime/pusher"
import { revalidatePath } from "next/cache"

export type BudgetStatus = "ON_TRACK" | "APPROACHING" | "REACHED" | "EXCEEDED"

export interface EnrichedBudget {
  id: string
  userId: string
  category: string | null
  categoryLabel: string
  amountPaise: number
  actualSpendPaise: number
  remainingPaise: number
  percentUsed: number
  status: BudgetStatus
  period: string
  warningPercent: number
  active: boolean
  createdAt: Date
}

function getBudgetPeriodRange(period: string): { startDate: Date; endDate: Date; periodKey: string } {
  const now = new Date()
  if (period === "WEEKLY") {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    const periodKey = `W-${start.toISOString().slice(0, 10)}`
    return { startDate: start, endDate: end, periodKey }
  }

  if (period === "YEARLY") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    const periodKey = `Y-${now.getFullYear()}`
    return { startDate: start, endDate: end, periodKey }
  }

  // Default: MONTHLY
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const periodKey = `M-${now.getFullYear()}-${now.getMonth() + 1}`
  return { startDate: start, endDate: end, periodKey }
}

export async function createBudget(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "createBudget" },
    })
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  const rateLimit = checkActionRateLimit("BUDGET_CREATION", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "createBudget" },
    })
    throw new Error("Rate limit exceeded. Please wait a moment before creating another budget.")
  }

  const rawCategory = formData.get("category") as string | null
  const amountStr = formData.get("amount") as string
  const period = ((formData.get("period") as string) || "MONTHLY").toUpperCase()
  const warningPercentStr = formData.get("warningPercent") as string | null
  const idempotencyKey = (formData.get("idempotencyKey") as string) || null

  if (idempotencyKey) {
    validateId(idempotencyKey, "idempotencyKey")
  }

  // Validate amount
  const amountPaise = Math.round(Number(amountStr) * 100)
  if (isNaN(amountPaise) || amountPaise <= 0) {
    throw new Error("Budget amount must be a positive number")
  }
  if (amountPaise > 1000000000) {
    // Max ₹1 Crore
    throw new Error("Budget amount exceeds maximum limit")
  }

  // Validate warning percentage
  let warningPercent = 80
  if (warningPercentStr) {
    const wp = parseInt(warningPercentStr, 10)
    if (!isNaN(wp) && wp >= 1 && wp <= 100) {
      warningPercent = wp
    }
  }

  const category =
    rawCategory && rawCategory.trim() && rawCategory.trim().toUpperCase() !== "OVERALL"
      ? sanitizeTextInput(rawCategory.trim(), 40)
      : null

  // Idempotency check: if key supplied, check existing
  if (idempotencyKey) {
    const existing = await prisma.budget.findFirst({
      where: {
        userId,
        idempotencyKey,
      },
    })
    if (existing) {
      return { success: true, budget: existing, isDuplicate: true }
    }
  }

  // Deactivate any existing active budget for this exact category and period
  await prisma.budget.updateMany({
    where: {
      userId,
      category,
      period,
      active: true,
    },
    data: {
      active: false,
    },
  })

  let budget: any
  try {
    budget = await prisma.budget.create({
      data: {
        userId,
        category,
        amountPaise,
        period,
        warningPercent,
        active: true,
        idempotencyKey: idempotencyKey || null,
      },
    })
  } catch (err: any) {
    if (
      idempotencyKey &&
      (err?.code === "P2002" ||
        String(err?.message || "").includes("UNIQUE") ||
        String(err?.message || "").includes("Duplicate") ||
        String(err?.message || "").includes("idempotencyKey"))
    ) {
      const existing = await prisma.budget.findFirst({
        where: { userId, idempotencyKey },
      })
      if (existing) {
        return { success: true, budget: existing, isDuplicate: true }
      }
    }
    throw err
  }

  // Trigger evaluation
  await evaluateBudgetAlerts(userId).catch(() => {})

  revalidatePath("/budgets")
  revalidatePath("/analytics")

  return { success: true, budget, isDuplicate: false }
}

export async function getBudgets(): Promise<EnrichedBudget[]> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      active: true,
    },
    orderBy: { createdAt: "desc" },
  })

  if (budgets.length === 0) {
    return []
  }

  const enriched: EnrichedBudget[] = []

  for (const b of budgets) {
    const { startDate, endDate } = getBudgetPeriodRange(b.period)
    const trueSpend = await getUserTrueSpend(userId, { startDate, endDate })

    let actualSpendPaise = 0
    if (b.category) {
      actualSpendPaise = trueSpend.categorySpendPaise[b.category] || 0
    } else {
      actualSpendPaise = trueSpend.totalTrueSpendPaise
    }

    const remainingPaise = Math.max(0, b.amountPaise - actualSpendPaise)
    const percentUsed =
      b.amountPaise > 0 ? Math.round((actualSpendPaise / b.amountPaise) * 100) : 0

    let status: BudgetStatus = "ON_TRACK"
    if (percentUsed > 100) {
      status = "EXCEEDED"
    } else if (percentUsed === 100) {
      status = "REACHED"
    } else if (percentUsed >= b.warningPercent) {
      status = "APPROACHING"
    }

    enriched.push({
      id: b.id,
      userId: b.userId,
      category: b.category,
      categoryLabel: b.category || "Total Monthly Budget",
      amountPaise: b.amountPaise,
      actualSpendPaise,
      remainingPaise,
      percentUsed,
      status,
      period: b.period,
      warningPercent: b.warningPercent,
      active: b.active,
      createdAt: b.createdAt,
    })
  }

  return enriched
}

export async function updateBudget(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const budgetId = formData.get("id") as string
  validateId(budgetId, "budgetId")

  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
  })

  if (!budget) throw new Error("Budget not found")
  if (budget.userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "updateBudget_unauthorized", budgetId },
    })
    throw new Error("Unauthorized: Access denied")
  }

  const amountStr = formData.get("amount") as string
  const warningPercentStr = formData.get("warningPercent") as string | null

  const updateData: any = {}

  if (amountStr) {
    const amountPaise = Math.round(Number(amountStr) * 100)
    if (isNaN(amountPaise) || amountPaise <= 0) {
      throw new Error("Amount must be a positive number")
    }
    updateData.amountPaise = amountPaise
  }

  if (warningPercentStr) {
    const wp = parseInt(warningPercentStr, 10)
    if (!isNaN(wp) && wp >= 1 && wp <= 100) {
      updateData.warningPercent = wp
    }
  }

  const updated = await prisma.budget.update({
    where: { id: budgetId },
    data: updateData,
  })

  await evaluateBudgetAlerts(userId).catch(() => {})

  revalidatePath("/budgets")
  revalidatePath("/analytics")

  return { success: true, budget: updated }
}

export async function deleteBudget(budgetId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  validateId(budgetId, "budgetId")

  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
  })

  if (!budget) throw new Error("Budget not found")
  if (budget.userId !== userId) {
    await logSecurityEvent({
      type: "IDOR_ATTEMPT_BLOCKED",
      userId,
      details: { action: "deleteBudget_unauthorized", budgetId },
    })
    throw new Error("Unauthorized: Access denied")
  }

  await prisma.budget.update({
    where: { id: budgetId },
    data: { active: false },
  })

  revalidatePath("/budgets")
  revalidatePath("/analytics")

  return { success: true }
}

/**
 * Server-authoritative alert evaluator.
 * Evaluates active budgets against True Spend and fires deduplicated notifications.
 */
export async function evaluateBudgetAlerts(userId: string) {
  const budgets = await prisma.budget.findMany({
    where: { userId, active: true },
  })

  for (const b of budgets) {
    const { startDate, endDate, periodKey } = getBudgetPeriodRange(b.period)
    const trueSpend = await getUserTrueSpend(userId, { startDate, endDate })

    const actualSpend = b.category
      ? trueSpend.categorySpendPaise[b.category] || 0
      : trueSpend.totalTrueSpendPaise

    const percentUsed = b.amountPaise > 0 ? (actualSpend / b.amountPaise) * 100 : 0
    const catLabel = b.category || "Monthly"

    if (percentUsed >= 100) {
      // Exceeded alert (deduplicated by dedupKey per period)
      await sendNotification({
        userId,
        type: "BUDGET_EXCEEDED",
        title: `⚠️ ${catLabel} Budget Exceeded!`,
        body: `You have spent ₹${(actualSpend / 100).toFixed(0)} of your ₹${(b.amountPaise / 100).toFixed(0)} budget.`,
        url: "/budgets",
        dedupKey: `budget-exceeded-${b.id}-${periodKey}`,
      }).catch(() => {})
    } else if (percentUsed >= b.warningPercent) {
      // Approaching threshold alert
      await sendNotification({
        userId,
        type: "BUDGET_WARNING",
        title: `🔔 ${catLabel} Budget at ${Math.round(percentUsed)}%`,
        body: `You have spent ₹${(actualSpend / 100).toFixed(0)} of your ₹${(b.amountPaise / 100).toFixed(0)} budget.`,
        url: "/budgets",
        dedupKey: `budget-warn-${b.id}-${periodKey}`,
      }).catch(() => {})
    }
  }

  // Realtime notification to user's private channel
  try {
    await pusherServer.trigger(`user-${userId}`, "budget.updated", {
      timestamp: new Date().toISOString(),
    })
  } catch (err) {}
}
