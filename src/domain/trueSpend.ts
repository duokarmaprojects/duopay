/**
 * True Spend Domain Engine
 * Authoritative financial intelligence calculating the user's actual consumed share.
 * Strictly integer paise. Zero floats. Deterministic arithmetic.
 */

export interface TrueSpendExpenseInput {
  id: string
  groupId: string | null
  description: string
  category: string | null
  amount: number // in paise
  payerId: string
  date: Date
  source: string // MANUAL, CASH, RECEIPT, SCREENSHOT, IMPORT, SHARE
  status: string // FINAL, UPCOMING, SKIPPED
  isPoolExpense?: boolean
  priority?: string
  metadata?: string | null
  participants: Array<{
    userId: string
    share: number // in paise
  }>
}

export interface TrueSpendSettlementInput {
  id: string
  payerId: string
  receiverId: string
  amount: number // in paise
  status?: string | null
}

export interface TrueSpendSummary {
  totalTrueSpendPaise: number
  grossSpendPaidPaise: number
  settlementPaidPaise: number
  settlementReceivedPaise: number
  cashOutPaise: number
  moneyReceivedPaise: number
  netSpendPaise: number
  groupSharePaise: number
  personalExpensesPaise: number
  recurringFinalizedPaise: number
  cashSpendPaise: number
  digitalSpendPaise: number
  categorySpendPaise: Record<string, number>
  merchantSpendPaise: Record<string, number>
  expenseCount: number
  upcomingObligationsPaise: number
}

/**
 * Calculates the authenticated user's actual consumed share for a single expense.
 *
 * CRITICAL FINANCIAL INVARIANT:
 * If an expense is ₹3,000 and user's share is ₹750: True Spend = ₹750.
 * If user paid ₹3,000 but their share is 0 (paid on behalf of others): True Spend = 0.
 * If expense is UPCOMING or SKIPPED: True Spend = 0 (never counted as historical spend).
 */
export function calculateExpenseTrueSpend(
  expense: TrueSpendExpenseInput,
  userId: string
): number {
  if (expense.status === "UPCOMING" || expense.status === "SKIPPED") {
    return 0
  }

  const participant = expense.participants.find((p) => p.userId === userId)
  if (!participant) {
    return 0
  }

  return Math.round(participant.share)
}

/**
 * Calculates upcoming financial obligations (from UPCOMING expenses).
 * Strictly isolated from historical True Spend.
 */
export function calculateUpcomingObligation(
  expense: TrueSpendExpenseInput,
  userId: string
): number {
  if (expense.status !== "UPCOMING") {
    return 0
  }

  const participant = expense.participants.find((p) => p.userId === userId)
  if (!participant) {
    return 0
  }

  return Math.round(participant.share)
}

/**
 * Aggregates all True Spend metrics for a user across a set of finalized expenses and settlements.
 */
export function aggregateTrueSpend(
  expenses: TrueSpendExpenseInput[],
  settlements: TrueSpendSettlementInput[],
  userId: string
): TrueSpendSummary {
  let totalTrueSpendPaise = 0
  let grossSpendPaidPaise = 0
  let settlementPaidPaise = 0
  let settlementReceivedPaise = 0
  let groupSharePaise = 0
  let personalExpensesPaise = 0
  let recurringFinalizedPaise = 0
  let cashSpendPaise = 0
  let digitalSpendPaise = 0
  let expenseCount = 0
  let upcomingObligationsPaise = 0

  const categorySpendPaise: Record<string, number> = {}
  const merchantSpendPaise: Record<string, number> = {}

  for (const exp of expenses) {
    if (exp.status === "UPCOMING") {
      const upcoming = calculateUpcomingObligation(exp, userId)
      upcomingObligationsPaise += upcoming
    } else if (exp.status !== "SKIPPED") {
      const userShare = calculateExpenseTrueSpend(exp, userId)

      // Cash Out as payer for this expense
      if (exp.payerId === userId) {
        grossSpendPaidPaise += Math.round(exp.amount)
      }

      if (userShare > 0) {
        totalTrueSpendPaise += userShare
        expenseCount += 1

        // Group vs Personal breakdown
        if (exp.groupId) {
          groupSharePaise += userShare
        } else {
          personalExpensesPaise += userShare
        }

        // Cash vs Digital breakdown
        if (exp.source === "CASH") {
          cashSpendPaise += userShare
        } else {
          digitalSpendPaise += userShare
        }

        // Recurring finalized spend
        const isRecurring =
          exp.priority === "RECURRING" ||
          (exp.metadata && exp.metadata.includes('"recurringScheduleId"'))
        if (isRecurring) {
          recurringFinalizedPaise += userShare
        }

        // Category Breakdown
        const categoryKey = exp.category?.trim() || "Uncategorized"
        categorySpendPaise[categoryKey] =
          (categorySpendPaise[categoryKey] || 0) + userShare

        // Merchant Breakdown
        const merchantKey = exp.description?.trim() || "Uncategorized"
        merchantSpendPaise[merchantKey] =
          (merchantSpendPaise[merchantKey] || 0) + userShare
      }
    }
  }

  // Settlements: cash in and cash out
  for (const s of settlements) {
    // Only completed settlements count (or where status is null/COMPLETED)
    if (s.status === "FAILED" || s.status === "CANCELLED") continue

    if (s.payerId === userId) {
      settlementPaidPaise += Math.round(s.amount)
    }
    if (s.receiverId === userId) {
      settlementReceivedPaise += Math.round(s.amount)
    }
  }

  const cashOutPaise = grossSpendPaidPaise + settlementPaidPaise
  const moneyReceivedPaise = settlementReceivedPaise

  return {
    totalTrueSpendPaise,
    grossSpendPaidPaise,
    settlementPaidPaise,
    settlementReceivedPaise,
    cashOutPaise,
    moneyReceivedPaise,
    netSpendPaise: totalTrueSpendPaise,
    groupSharePaise,
    personalExpensesPaise,
    recurringFinalizedPaise,
    cashSpendPaise,
    digitalSpendPaise,
    categorySpendPaise,
    merchantSpendPaise,
    expenseCount,
    upcomingObligationsPaise,
  }
}
