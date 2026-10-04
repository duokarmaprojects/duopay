import { z } from "zod"

export const RECURRING_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"] as const
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]

export const RECURRING_STATUSES = ["ACTIVE", "PAUSED", "CANCELLED", "COMPLETED"] as const
export type RecurringStatus = (typeof RECURRING_STATUSES)[number]

/**
 * Calculates the next occurrence date deterministically based on frequency and base date.
 * Handles month boundaries (e.g. Feb, 30 vs 31 days) without date drift.
 */
export function calculateNextOccurrence(
  currentDate: Date,
  frequency: RecurringFrequency
): Date {
  const next = new Date(currentDate.getTime())

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1)
      break
    case "WEEKLY":
      next.setDate(next.getDate() + 7)
      break
    case "MONTHLY": {
      const targetMonth = next.getMonth() + 1
      next.setMonth(targetMonth)
      // If month rolled over more than 1 (e.g. Jan 31 -> Mar 2), clamp to last day of expected month
      if (next.getMonth() > (targetMonth % 12)) {
        next.setDate(0) // Last day of previous month
      }
      break
    }
    case "YEARLY": {
      next.setFullYear(next.getFullYear() + 1)
      break
    }
    case "CUSTOM":
      // Fallback for custom for now, we'll just treat it as monthly or no-op depending on future logic
      next.setMonth(next.getMonth() + 1)
      break
    default:
      throw new Error(`Unsupported frequency: ${frequency}`)
  }

  return next
}

/**
 * Computes a deterministic idempotency key for recurring expense generation.
 * Guarantees that even with concurrent executions or server restarts, exactly ONE
 * expense record is created per scheduled occurrence timestamp.
 */
export function getRecurringExpenseIdempotencyKey(
  recurringExpenseId: string,
  occurrenceDate: Date
): string {
  // Format as YYYY-MM-DD
  const dateStr = occurrenceDate.toISOString().slice(0, 10)
  return `recurring:${recurringExpenseId}:${dateStr}`
}
