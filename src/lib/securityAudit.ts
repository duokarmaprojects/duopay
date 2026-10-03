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
 * Sanitizes details to ensure sensitive secrets, credentials, or PII are never logged or persisted.
 * Redacts tokens, keys, passwords, webhook signatures, and masks phone numbers, emails, and UPI VPAs.
 */
export function sanitizeEventDetails(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details || typeof details !== "object") return {}
  const sanitized: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(details)) {
    const lowerKey = key.toLowerCase()

    if (
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("key") ||
      lowerKey.includes("auth") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("signature") ||
      lowerKey.includes("credential") ||
      lowerKey.includes("cvv") ||
      lowerKey.includes("card") ||
      lowerKey.includes("webhook") ||
      lowerKey.includes("session")
    ) {
      sanitized[key] = "[REDACTED]"
    } else if (lowerKey.includes("phone") || lowerKey.includes("mobile")) {
      if (typeof val === "string" && val.length > 4) {
        sanitized[key] = `***${val.slice(-4)}`
      } else {
        sanitized[key] = "[REDACTED_PHONE]"
      }
    } else if (lowerKey.includes("email")) {
      if (typeof val === "string" && val.includes("@")) {
        const [u, d] = val.split("@")
        sanitized[key] = `${u.charAt(0)}***@${d}`
      } else {
        sanitized[key] = "[REDACTED_EMAIL]"
      }
    } else if (lowerKey.includes("upi") || lowerKey.includes("vpa")) {
      if (typeof val === "string" && val.includes("@")) {
        const [u, h] = val.split("@")
        sanitized[key] = `${u.charAt(0)}***@${h}`
      } else {
        sanitized[key] = "[REDACTED_UPI]"
      }
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      sanitized[key] = sanitizeEventDetails(val as Record<string, unknown>)
    } else if (Array.isArray(val)) {
      sanitized[key] = val.map((item) =>
        item && typeof item === "object"
          ? sanitizeEventDetails(item as Record<string, unknown>)
          : item
      )
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
