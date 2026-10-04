import { getUserMonthlyTrueSpend } from "@/services/trueSpend"
import { calculateSpendForecast, ForecastResult } from "@/domain/forecast"

/**
 * Service to compute explainable spending forecast for a user's current month.
 * Strictly read-only; never mutates ledger or expenses.
 */
export async function getUserSpendingForecast(userId: string): Promise<ForecastResult> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysElapsed = Math.min(daysInMonth, now.getDate())

  // 1. Current month spend so far
  const currentMonthSummary = await getUserMonthlyTrueSpend(userId, year, month)

  // 2. Fetch past 3 months historical spends
  const historicalMonthlySpendsPaise: number[] = []
  for (let i = 1; i <= 3; i++) {
    const prevDate = new Date(year, month - i, 1)
    const prevSummary = await getUserMonthlyTrueSpend(
      userId,
      prevDate.getFullYear(),
      prevDate.getMonth()
    )
    if (prevSummary.totalTrueSpendPaise > 0) {
      historicalMonthlySpendsPaise.push(prevSummary.totalTrueSpendPaise)
    }
  }

  return calculateSpendForecast({
    currentSpendPaise: currentMonthSummary.totalTrueSpendPaise,
    daysElapsed,
    daysInMonth,
    historicalMonthlySpendsPaise,
    upcomingObligationsPaise: currentMonthSummary.upcomingObligationsPaise,
  })
}
