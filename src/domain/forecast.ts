/**
 * Deterministic Spending Forecast Engine
 * Pure mathematical projection model combining daily run-rate,
 * historical monthly spending, and scheduled recurring obligations.
 */

export interface ForecastInput {
  currentSpendPaise: number
  daysElapsed: number
  daysInMonth: number
  historicalMonthlySpendsPaise: number[] // Past months (e.g. [1400000, 1350000])
  upcomingObligationsPaise: number // Scheduled recurring obligations for remainder of month
}

export interface ForecastResult {
  projectedTotalPaise: number
  currentSpendPaise: number
  projectedRemainingPaise: number
  upcomingObligationsPaise: number
  confidence: "HIGH" | "MEDIUM" | "LOW"
  methodology: string
  comparisonWithLastMonthPaise: number | null
}

export function calculateSpendForecast(input: ForecastInput): ForecastResult {
  const {
    currentSpendPaise,
    daysElapsed,
    daysInMonth,
    historicalMonthlySpendsPaise,
    upcomingObligationsPaise,
  } = input

  const safeElapsed = Math.max(1, daysElapsed)
  const remainingDays = Math.max(0, daysInMonth - safeElapsed)

  // 1. Calculate Daily Run-Rate Trajectory
  const dailyRatePaise = currentSpendPaise / safeElapsed
  const runRateRemaining = Math.round(dailyRatePaise * remainingDays)

  // 2. Calculate Historical Average
  const hasHistory = historicalMonthlySpendsPaise.length > 0
  const historicalAvgPaise = hasHistory
    ? Math.round(
        historicalMonthlySpendsPaise.reduce((sum, v) => sum + v, 0) /
          historicalMonthlySpendsPaise.length
      )
    : 0

  let projectedRemainingPaise = 0
  let methodology = "Daily Run-Rate + Scheduled Obligations"
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW"

  if (safeElapsed <= 3 && hasHistory) {
    // Early in the month (< 4 days elapsed): daily run-rate is noisy, rely heavily on historical average
    const baselineRemaining = Math.max(0, historicalAvgPaise - currentSpendPaise)
    projectedRemainingPaise = Math.round(
      baselineRemaining * 0.7 + runRateRemaining * 0.3 + upcomingObligationsPaise
    )
    methodology = "Historical Baseline Blended with Early Run-Rate"
    confidence = historicalMonthlySpendsPaise.length >= 2 ? "MEDIUM" : "LOW"
  } else if (safeElapsed >= 15 && hasHistory) {
    // Late in the month (>= 15 days): run-rate is highly predictive
    projectedRemainingPaise = runRateRemaining + upcomingObligationsPaise
    methodology = "Mature Run-Rate with Scheduled Obligations"
    confidence = "HIGH"
  } else if (hasHistory) {
    // Mid-month: 80% run-rate + 20% historical adjustment
    const histProjectionRemaining = Math.max(0, historicalAvgPaise - currentSpendPaise)
    projectedRemainingPaise = Math.round(
      runRateRemaining * 0.8 + histProjectionRemaining * 0.2 + upcomingObligationsPaise
    )
    methodology = "Hybrid Run-Rate and Historical Trajectory"
    confidence = "MEDIUM"
  } else {
    // No history available: pure run-rate
    projectedRemainingPaise = runRateRemaining + upcomingObligationsPaise
    methodology = "Daily Run-Rate (Limited History)"
    confidence = safeElapsed >= 10 ? "MEDIUM" : "LOW"
  }

  const projectedTotalPaise = currentSpendPaise + projectedRemainingPaise

  const lastMonthPaise = hasHistory ? historicalMonthlySpendsPaise[0] : null
  const comparisonWithLastMonthPaise =
    lastMonthPaise !== null ? projectedTotalPaise - lastMonthPaise : null

  return {
    projectedTotalPaise,
    currentSpendPaise,
    projectedRemainingPaise,
    upcomingObligationsPaise,
    confidence,
    methodology,
    comparisonWithLastMonthPaise,
  }
}
