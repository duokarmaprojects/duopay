import { describe, it, expect } from "vitest"
import { calculateSpendForecast } from "./forecast"

describe("Phase U: Spending Forecast Engine (forecast.ts)", () => {
  it("projects ₹18,000 when current spend is ₹8,000 at day 15/30 with ₹2,000 upcoming obligations", () => {
    const result = calculateSpendForecast({
      currentSpendPaise: 800000, // ₹8,000
      daysElapsed: 15,
      daysInMonth: 30,
      historicalMonthlySpendsPaise: [1600000, 1500000], // Last month was ₹16,000
      upcomingObligationsPaise: 200000, // ₹2,000
    })

    // At day 15/30, run rate is ₹8,000 for 15 remaining days = ₹8,000 + ₹2,000 upcoming = ₹10,000 remaining
    // Total projected = ₹8,000 + ₹10,000 = ₹18,000
    expect(result.projectedTotalPaise).toBe(1800000)
    expect(result.currentSpendPaise).toBe(800000)
    expect(result.projectedRemainingPaise).toBe(1000000)
    expect(result.upcomingObligationsPaise).toBe(200000)
    expect(result.confidence).toBe("HIGH")
    expect(result.comparisonWithLastMonthPaise).toBe(200000) // ₹18,000 - ₹16,000 = +₹2,000
  })

  it("handles early-month projection safely by blending with historical baseline", () => {
    const result = calculateSpendForecast({
      currentSpendPaise: 200000, // ₹2,000 spent in first 2 days
      daysElapsed: 2,
      daysInMonth: 30,
      historicalMonthlySpendsPaise: [1500000, 1400000], // Previous average ₹14,500
      upcomingObligationsPaise: 100000, // ₹1,000 upcoming
    })

    // If pure run rate was used, it would project ₹30,000 (wild overestimation).
    // The blended early model keeps it anchored near historical average.
    expect(result.projectedTotalPaise).toBeLessThan(2500000)
    expect(result.projectedTotalPaise).toBeGreaterThan(1000000)
    expect(result.methodology).toContain("Historical Baseline")
  })

  it("handles zero history gracefully with low confidence indicator", () => {
    const result = calculateSpendForecast({
      currentSpendPaise: 300000, // ₹3,000
      daysElapsed: 5,
      daysInMonth: 30,
      historicalMonthlySpendsPaise: [], // No prior history
      upcomingObligationsPaise: 0,
    })

    expect(result.confidence).toBe("LOW")
    expect(result.methodology).toContain("Daily Run-Rate")
    expect(result.comparisonWithLastMonthPaise).toBeNull()
  })

  it("handles zero spend without division-by-zero errors", () => {
    const result = calculateSpendForecast({
      currentSpendPaise: 0,
      daysElapsed: 10,
      daysInMonth: 31,
      historicalMonthlySpendsPaise: [],
      upcomingObligationsPaise: 50000, // ₹500 upcoming
    })

    expect(result.projectedTotalPaise).toBe(50000)
    expect(result.projectedRemainingPaise).toBe(50000)
  })
})
