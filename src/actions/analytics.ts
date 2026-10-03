"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export type TimeRangeFilter = "WEEK" | "MONTH" | "LAST_MONTH" | "3MONTHS" | "YEAR" | "ALL"

export interface CategorySpending {
  category: string
  amountPaise: number
  percentage: number
  count: number
}

export interface GroupSpending {
  groupId: string
  groupName: string
  amountPaise: number
  percentage: number
  expenseCount: number
}

export interface MonthlySpendingPoint {
  label: string
  amountPaise: number
}

export interface SpendingAnalyticsSummary {
  timeRange: TimeRangeFilter
  totalSpentPaise: number
  userSharePaise: number
  expenseCount: number
  averageExpensePaise: number
  settlementPaidPaise: number
  settlementReceivedPaise: number
  categories: CategorySpending[]
  groupSpendings: GroupSpending[]
  timeline: MonthlySpendingPoint[]
}

function getDateRange(range: TimeRangeFilter): { startDate?: Date; endDate?: Date } {
  const now = new Date()

  if (range === "WEEK") {
    const start = new Date(now)
    start.setDate(now.getDate() - 7)
    return { startDate: start }
  }

  if (range === "MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { startDate: start }
  }

  if (range === "LAST_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    return { startDate: start, endDate: end }
  }

  if (range === "3MONTHS") {
    const start = new Date(now)
    start.setMonth(now.getMonth() - 3)
    return { startDate: start }
  }

  if (range === "YEAR") {
    const start = new Date(now.getFullYear(), 0, 1)
    return { startDate: start }
  }

  return {}
}

/**
 * Server-authoritative analytics engine.
 * Computes strictly derived metrics from immutable database records.
 * Never modifies or hallucinates financial data.
 */
export async function getSpendingAnalytics(
  range: TimeRangeFilter = "MONTH"
): Promise<SpendingAnalyticsSummary> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id
  const { startDate, endDate } = getDateRange(range)

  // Query expenses where the user was either payer or a participant with a share
  const dateFilter = startDate || endDate
    ? {
        createdAt: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      }
    : {}

  const expenses = await prisma.expense.findMany({
    where: {
      AND: [
        {
          OR: [
            { payerId: userId },
            { participants: { some: { userId } } },
          ],
        },
        dateFilter,
      ],
    },
    include: {
      group: { select: { id: true, name: true } },
      participants: { select: { userId: true, share: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  // Settlements in same period
  const settlements = await prisma.settlement.findMany({
    where: {
      AND: [
        {
          OR: [{ payerId: userId }, { receiverId: userId }],
        },
        dateFilter,
      ],
    },
    select: {
      payerId: true,
      receiverId: true,
      amount: true,
      status: true,
    },
  })

  let totalSpentPaise = 0 // Total amount user paid
  let userSharePaise = 0  // Actual consumed share by user
  const categoryMap = new Map<string, { total: number; count: number }>()
  const groupMap = new Map<string, { name: string; total: number; count: number }>()
  const timelineMap = new Map<string, number>()

  for (const exp of expenses) {
    const userParticipant = exp.participants.find((p) => p.userId === userId)
    const effectiveShare = userParticipant?.share ?? (exp.payerId === userId ? exp.amount : 0)

    if (exp.payerId === userId) {
      totalSpentPaise += exp.amount
    }
    userSharePaise += effectiveShare

    // Category aggregation
    const cat = exp.category || "OTHER"
    const currentCat = categoryMap.get(cat) || { total: 0, count: 0 }
    currentCat.total += effectiveShare
    currentCat.count += 1
    categoryMap.set(cat, currentCat)

    // Group aggregation
    const grpId = exp.groupId || "direct"
    const grpName = exp.group?.name || "Direct / No Group"
    const currentGrp = groupMap.get(grpId) || { name: grpName, total: 0, count: 0 }
    currentGrp.total += effectiveShare
    currentGrp.count += 1
    groupMap.set(grpId, currentGrp)

    // Timeline month grouping (e.g. "Sep 2026")
    const monthKey = new Date(exp.createdAt).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    })
    timelineMap.set(monthKey, (timelineMap.get(monthKey) || 0) + effectiveShare)
  }

  // Settlements totals
  let settlementPaidPaise = 0
  let settlementReceivedPaise = 0
  for (const s of settlements) {
    if (s.payerId === userId) settlementPaidPaise += s.amount
    if (s.receiverId === userId) settlementReceivedPaise += s.amount
  }

  // Format categories
  const categories: CategorySpending[] = Array.from(categoryMap.entries())
    .map(([category, val]) => ({
      category,
      amountPaise: val.total,
      percentage: userSharePaise > 0 ? Math.round((val.total / userSharePaise) * 100) : 0,
      count: val.count,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise)

  // Format group spendings
  const groupSpendings: GroupSpending[] = Array.from(groupMap.entries())
    .map(([groupId, val]) => ({
      groupId,
      groupName: val.name,
      amountPaise: val.total,
      percentage: userSharePaise > 0 ? Math.round((val.total / userSharePaise) * 100) : 0,
      expenseCount: val.count,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise)

  // Format timeline
  const timeline: MonthlySpendingPoint[] = Array.from(timelineMap.entries()).map(
    ([label, amountPaise]) => ({
      label,
      amountPaise,
    })
  )

  const expenseCount = expenses.length
  const averageExpensePaise = expenseCount > 0 ? Math.round(userSharePaise / expenseCount) : 0

  return {
    timeRange: range,
    totalSpentPaise,
    userSharePaise,
    expenseCount,
    averageExpensePaise,
    settlementPaidPaise,
    settlementReceivedPaise,
    categories,
    groupSpendings,
    timeline,
  }
}
