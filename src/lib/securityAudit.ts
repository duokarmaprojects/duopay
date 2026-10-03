/**
 * DuoPay Structured Security Event Logger
 * Logs security-relevant actions and rejections without sensitive credential exposure.
 */
import { prisma } from "@/lib/db"

export type SecurityEventType =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_UNAUTHORIZED_ACCESS"
  | "IDOR_ATTEMPT_BLOCKED"
  | "ADMIN_ACCESS_SUCCESS"
  | "ADMIN_ACCESS_DENIED"
  | "UPI_VERIFICATION_ATTEMPT"
  | "UPI_VERIFICATION_SUCCESS"
  | "UPI_VERIFICATION_FAILURE"
  | "FINANCIAL_SETTLEMENT_RECORDED"
  | "FINANCIAL_INVALID_TRANSACTION_BLOCKED"
  | "EXPENSE_CREATED"
  | "EXPENSE_DELETED"
  | "GROUP_CREATED"
  | "GROUP_JOIN_ATTEMPT"
  | "GROUP_JOIN_DENIED"
  | "GROUP_JOINED"
  | "GROUP_DELETED"
  | "RATE_LIMIT_TRIGGERED"
  | "MALICIOUS_INPUT_BLOCKED"

export interface SecurityEventData {
  type: SecurityEventType
  userId?: string | null
  ip?: string | null
  details?: Record<string, unknown>
}

/**
 * Sanitizes details to ensure sensitive secrets, credentials, or keys are never logged.
 */
function sanitizeEventDetails(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details) return {}
  const sanitized: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(details)) {
    const lowerKey = key.toLowerCase()
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("key") ||
      lowerKey.includes("auth") ||
      lowerKey.includes("cookie")
    ) {
      sanitized[key] = "[REDACTED]"
    } else {
      sanitized[key] = val
    }
  }

  return sanitized
}

export async function logSecurityEvent(event: SecurityEventData): Promise<void> {
  const sanitized = sanitizeEventDetails(event.details)

  const logPayload = {
    timestamp: new Date().toISOString(),
    event: event.type,
    userId: event.userId || "anonymous",
    ip: event.ip || "unknown",
    details: sanitized,
  }

  // Server-side stdout logging
  console.info(`[SECURITY AUDIT] ${JSON.stringify(logPayload)}`)

  // Best-effort database recording in AnalyticsEvent table
  try {
    if (prisma?.analyticsEvent?.create) {
      await prisma.analyticsEvent.create({
        data: {
          eventType: event.type,
          userId: event.userId || null,
          metadata: JSON.stringify(sanitized),
        },
      })
    }
  } catch (err) {
    // Audit log failure should never crash the main operation
    console.error("[SECURITY AUDIT ERROR] Failed to record audit event in database:", err)
  }
}
