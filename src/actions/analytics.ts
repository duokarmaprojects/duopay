"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUserTrueSpend, TrueSpendDateRange } from "@/services/trueSpend"

export type TimeRangeFilter =
  | "WEEK"
  | "MONTH"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "3MONTHS"
  | "6MONTHS"
  | "YEAR"
  | "CUSTOM"
  | "ALL"

export interface CategorySpending {
  category: string
  amountPaise: number
  percentage: number
  count: number
  previousAmountPaise?: number
  changePercent?: number | null
}

export interface MerchantSpending {
  merchant: string
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

export interface SpendingPoint {
  label: string
  amountPaise: number
  date?: string
}

export interface MonthOverMonthComparison {
  currentPeriodPaise: number
  previousPeriodPaise: number
  changeAmountPaise: number
  changePercent: number | null // null when previous is 0 to avoid misleading division
  isIncrease: boolean
  hasPreviousData: boolean
}

export interface SpendingAnalyticsSummary {
  timeRange: TimeRangeFilter
  totalSpentPaise: number // Cash physically disbursed out of pocket
  userSharePaise: number // True Spend (what user actually consumed)
  totalTrueSpendPaise: number // Alias for True Spend
  expenseCount: number
  averageExpensePaise: number
  largestExpensePaise: number
  settlementPaidPaise: number
  settlementReceivedPaise: number
  netSpendPaise: number
  groupSharePaise: number
  personalExpensesPaise: number
  cashSpendPaise: number
  digitalSpendPaise: number
  recurringFinalizedPaise: number
  upcomingObligationsPaise: number
  categories: CategorySpending[]
  merchants: MerchantSpending[]
  groupSpendings: GroupSpending[]
  timeline: SpendingPoint[]
  monthOverMonth: MonthOverMonthComparison
  insights: string[]
}

function resolveDateRange(
  range: TimeRangeFilter,
  customStart?: Date | string,
  customEnd?: Date | string
): { current: TrueSpendDateRange; previous: TrueSpendDateRange } {
  const now = new Date()

  if (range === "CUSTOM" && customStart && customEnd) {
    const s = new Date(customStart)
    const e = new Date(customEnd)
    const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)))
    const prevS = new Date(s)
    prevS.setDate(prevS.getDate() - diffDays)
    const prevE = new Date(s)
    prevE.setMilliseconds(-1)
    return {
      current: { startDate: s, endDate: e },
      previous: { startDate: prevS, endDate: prevE },
    }
  }

  if (range === "WEEK") {
    const s = new Date(now)
    s.setDate(now.getDate() - 7)
    s.setHours(0, 0, 0, 0)
    const prevS = new Date(s)
    prevS.setDate(prevS.getDate() - 7)
    const prevE = new Date(s)
    prevE.setMilliseconds(-1)
    return {
      current: { startDate: s, endDate: now },
      previous: { startDate: prevS, endDate: prevE },
    }
  }

  if (range === "LAST_MONTH") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    const prevS = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0)
    const prevE = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999)
    return {
      current: { startDate: s, endDate: e },
      previous: { startDate: prevS, endDate: prevE },
    }
  }

  if (range === "3MONTHS") {
    const s = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0)
    const prevS = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0)
    const prevE = new Date(s)
    prevE.setMilliseconds(-1)
    return {
      current: { startDate: s, endDate: now },
      previous: { startDate: prevS, endDate: prevE },
    }
  }

  if (range === "6MONTHS") {
    const s = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0)
    const prevS = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0)
    const prevE = new Date(s)
    prevE.setMilliseconds(-1)
    return {
      current: { startDate: s, endDate: now },
      previous: { startDate: prevS, endDate: prevE },
    }
  }

  if (range === "YEAR") {
    const s = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    const prevS = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    const prevE = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
    return {
      current: { startDate: s, endDate: now },
      previous: { startDate: prevS, endDate: prevE },
    }
  }

  if (range === "ALL") {
    return {
      current: {},
      previous: {},
    }
  }

  // Default: THIS_MONTH / MONTH
  const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const prevS = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
  const prevE = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  return {
    current: { startDate: s, endDate: now },
    previous: { startDate: prevS, endDate: prevE },
  }
}

/**
 * Server-authoritative analytics engine.
 * Computes strictly derived metrics from immutable database records.
 * Never modifies or hallucinates financial data.
 */
export async function getSpendingAnalytics(
  range: TimeRangeFilter = "MONTH",
  customStart?: string,
  customEnd?: string
): Promise<SpendingAnalyticsSummary> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  const userId = session.user.id

  const { current, previous } = resolveDateRange(range, customStart, customEnd)

  // 1. Authoritative True Spend for current period
  const currentSummary = await getUserTrueSpend(userId, current)

  // 2. Authoritative True Spend for comparison period (MoM)
  let previousSummary = { totalTrueSpendPaise: 0, categorySpendPaise: {} as Record<string, number> }
  if (previous.startDate) {
    previousSummary = await getUserTrueSpend(userId, previous)
  }

  // 3. Query group and individual expense details in the period for groups breakdown and timeline
  const dateFilter =
    current.startDate || current.endDate
      ? {
          date: {
            ...(current.startDate ? { gte: current.startDate } : {}),
            ...(current.endDate ? { lte: current.endDate } : {}),
          },
        }
      : {}

  const rawExpenses = await prisma.expense.findMany({
    where: {
      AND: [
        { status: "FINAL" },
        {
          OR: [{ payerId: userId }, { participants: { some: { userId } } }],
        },
        dateFilter,
      ],
    },
    include: {
      group: { select: { id: true, name: true } },
      participants: { select: { userId: true, share: true } },
    },
    orderBy: { date: "asc" },
  })

  // Track largest expense
  let largestExpensePaise = 0
  const groupMap = new Map<string, { name: string; total: number; count: number }>()
  const timelineMap = new Map<string, number>()

  for (const exp of (rawExpenses || [])) {
    const userPart = exp.participants.find((p) => p.userId === userId)
    if (!userPart || userPart.share <= 0) continue

    const share = userPart.share
    if (share > largestExpensePaise) {
      largestExpensePaise = share
    }

    // Group breakdown
    const grpId = exp.groupId || "personal"
    const grpName = exp.group?.name || "Personal / Non-Group"
    const currGrp = groupMap.get(grpId) || { name: grpName, total: 0, count: 0 }
    currGrp.total += share
    currGrp.count += 1
    groupMap.set(grpId, currGrp)

    // Timeline grouping (Daily if range is WEEK, Monthly otherwise)
    const d = new Date(exp.date)
    let timeKey = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
    if (range === "YEAR" || range === "3MONTHS" || range === "6MONTHS" || range === "ALL") {
      timeKey = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
    }
    timelineMap.set(timeKey, (timelineMap.get(timeKey) || 0) + share)
  }

  // Format Categories with MoM comparison
  const totalTrueSpend = currentSummary.totalTrueSpendPaise
  const categories: CategorySpending[] = Object.entries(currentSummary.categorySpendPaise)
    .map(([category, amountPaise]) => {
      const prevAmt = previousSummary.categorySpendPaise[category] || 0
      let changePercent: number | null = null
      if (prevAmt > 0) {
        changePercent = Math.round(((amountPaise - prevAmt) / prevAmt) * 1000) / 10
      }
      return {
        category,
        amountPaise,
        percentage: totalTrueSpend > 0 ? Math.round((amountPaise / totalTrueSpend) * 100) : 0,
        count: 1, // Aggregated by category
        previousAmountPaise: prevAmt,
        changePercent,
      }
    })
    .sort((a, b) => b.amountPaise - a.amountPaise)

  // Format Top Merchants
  const merchants: MerchantSpending[] = Object.entries(currentSummary.merchantSpendPaise)
    .map(([merchant, amountPaise]) => ({
      merchant,
      amountPaise,
      percentage: totalTrueSpend > 0 ? Math.round((amountPaise / totalTrueSpend) * 100) : 0,
      count: 1,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise)
    .slice(0, 10)

  // Format Groups
  const groupSpendings: GroupSpending[] = Array.from(groupMap.entries())
    .map(([groupId, val]) => ({
      groupId,
      groupName: val.name,
      amountPaise: val.total,
      percentage: totalTrueSpend > 0 ? Math.round((val.total / totalTrueSpend) * 100) : 0,
      expenseCount: val.count,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise)

  // Format Timeline points
  const timeline: SpendingPoint[] = Array.from(timelineMap.entries()).map(([label, amountPaise]) => ({
    label,
    amountPaise,
  }))

  // Month-over-Month calculation
  const currAmt = currentSummary.totalTrueSpendPaise
  const prevAmt = previousSummary.totalTrueSpendPaise
  const changeAmountPaise = currAmt - prevAmt
  let changePercent: number | null = null
  if (prevAmt > 0) {
    changePercent = Math.round(((currAmt - prevAmt) / prevAmt) * 1000) / 10
  }

  const monthOverMonth: MonthOverMonthComparison = {
    currentPeriodPaise: currAmt,
    previousPeriodPaise: prevAmt,
    changeAmountPaise,
    changePercent,
    isIncrease: changeAmountPaise > 0,
    hasPreviousData: prevAmt > 0,
  }

  // Deterministic Insights
  const insights: string[] = []
  if (categories.length > 0) {
    const topCat = categories[0]
    insights.push(
      `${topCat.category} is your largest spending category at ₹${(topCat.amountPaise / 100).toLocaleString("en-IN")} (${topCat.percentage}% of total spend).`
    )
  }

  if (monthOverMonth.hasPreviousData && changePercent !== null) {
    if (changePercent > 0) {
      insights.push(
        `Your True Spend is ${changePercent}% higher than the previous period (+₹${(changeAmountPaise / 100).toLocaleString("en-IN")}).`
      )
    } else if (changePercent < 0) {
      insights.push(
        `Your True Spend is ${Math.abs(changePercent)}% lower than the previous period (-₹${(Math.abs(changeAmountPaise) / 100).toLocaleString("en-IN")}).`
      )
    } else {
      insights.push(`Your spending is identical to the previous period.`)
    }
  }

  if (currentSummary.recurringFinalizedPaise > 0) {
    insights.push(
      `Recurring commitments account for ₹${(currentSummary.recurringFinalizedPaise / 100).toLocaleString("en-IN")} of your expenses.`
    )
  }

  if (currentSummary.cashSpendPaise > 0 && totalTrueSpend > 0) {
    const cashPct = Math.round((currentSummary.cashSpendPaise / totalTrueSpend) * 100)
    if (cashPct >= 20) {
      insights.push(`Cash transactions represent ${cashPct}% of your total spending.`)
    }
  }

  if (currentSummary.upcomingObligationsPaise > 0) {
    insights.push(
      `You have ₹${(currentSummary.upcomingObligationsPaise / 100).toLocaleString("en-IN")} in upcoming scheduled obligations.`
    )
  }

  if (insights.length === 0) {
    insights.push("No spending recorded in this time period yet.")
  }

  const averageExpensePaise =
    currentSummary.expenseCount > 0
      ? Math.round(totalTrueSpend / currentSummary.expenseCount)
      : 0

  return {
    timeRange: range,
    totalSpentPaise: currentSummary.grossSpendPaidPaise,
    userSharePaise: totalTrueSpend,
    totalTrueSpendPaise: totalTrueSpend,
    expenseCount: currentSummary.expenseCount,
    averageExpensePaise,
    largestExpensePaise,
    settlementPaidPaise: currentSummary.settlementPaidPaise,
    settlementReceivedPaise: currentSummary.settlementReceivedPaise,
    netSpendPaise: totalTrueSpend,
    groupSharePaise: currentSummary.groupSharePaise,
    personalExpensesPaise: currentSummary.personalExpensesPaise,
    cashSpendPaise: currentSummary.cashSpendPaise,
    digitalSpendPaise: currentSummary.digitalSpendPaise,
    recurringFinalizedPaise: currentSummary.recurringFinalizedPaise,
    upcomingObligationsPaise: currentSummary.upcomingObligationsPaise,
    categories,
    merchants,
    groupSpendings,
    timeline,
    monthOverMonth,
    insights,
  }
}
