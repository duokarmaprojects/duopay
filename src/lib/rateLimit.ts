/**
 * DuoPay Server-Side In-Memory Rate Limiter
 * Implements sliding-window counter rate limiting for sensitive operations.
 */

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
}

export const RATE_LIMIT_CONFIGS = {
  // Authentication attempts: 10 per 15 mins
  AUTH: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  // UPI Verification: 5 per 10 mins
  UPI_VERIFICATION: { maxAttempts: 5, windowMs: 10 * 60 * 1000 },
  // Settlements: 10 per 1 min
  SETTLEMENT: { maxAttempts: 10, windowMs: 60 * 1000 },
  // Expense creation: 20 per 1 min
  EXPENSE_CREATION: { maxAttempts: 20, windowMs: 60 * 1000 },
  // Group creation: 10 per 1 hour
  GROUP_CREATION: { maxAttempts: 10, windowMs: 60 * 60 * 1000 },
  // Avatar upload: 5 per 5 mins
  AVATAR_UPLOAD: { maxAttempts: 5, windowMs: 5 * 60 * 1000 },
  // Group Join: 10 per 15 mins
  GROUP_JOIN: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
} as const

const bucketMap = new Map<string, number[]>()

/**
 * Checks whether an action by a key (e.g. userId or IP) is within the rate limit.
 * Returns true if allowed, false if limit exceeded.
 */
export function checkActionRateLimit(
  bucketName: string,
  identifier: string,
  customConfig?: RateLimitConfig
): { allowed: boolean; remaining: number; resetMs: number } {
  const config =
    customConfig ||
    (RATE_LIMIT_CONFIGS as Record<string, RateLimitConfig>)[bucketName] || {
      maxAttempts: 10,
      windowMs: 60 * 1000,
    }

  const key = `${bucketName}:${identifier}`
  const now = Date.now()
  const timestamps = bucketMap.get(key) || []
  const validTimestamps = timestamps.filter((t) => now - t < config.windowMs)

  if (validTimestamps.length >= config.maxAttempts) {
    bucketMap.set(key, validTimestamps)
    const oldestTimestamp = validTimestamps[0]
    const resetMs = Math.max(0, config.windowMs - (now - oldestTimestamp))
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    }
  }

  validTimestamps.push(now)
  bucketMap.set(key, validTimestamps)

  return {
    allowed: true,
    remaining: config.maxAttempts - validTimestamps.length,
    resetMs: config.windowMs,
  }
}

/**
 * Resets all rate limit buckets. Used for unit and integration testing.
 */
export function resetAllRateLimitsForTesting(): void {
  bucketMap.clear()
}
