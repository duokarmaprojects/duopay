/**
 * DuoPay Payment Verification & State Model
 * Strictly distinguishes manual peer-to-peer settlements from provider/webhook-verified transactions.
 */

export const PAYMENT_VERIFICATION_STATUSES = [
  "MANUAL_CONFIRMED",
  "PROVIDER_INITIATED",
  "PROVIDER_VERIFIED",
  "WEBHOOK_VERIFIED",
  "PENDING",
  "FAILED",
  "UNKNOWN",
] as const

export type PaymentVerificationStatus = (typeof PAYMENT_VERIFICATION_STATUSES)[number]

export const VERIFICATION_METHODS = [
  "MANUAL_PEER_CONFIRMATION",
  "WEBHOOK_HMAC",
  "SERVER_API_QUERY",
  "NONE",
] as const

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number]

export const PAYMENT_PROVIDERS = [
  "manual_confirmation",
  "upi_intent",
  "razorpay",
  "cashfree",
] as const

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

/**
 * Validates whether a payment status transition is permitted.
 * Terminal states (WEBHOOK_VERIFIED, PROVIDER_VERIFIED) cannot be downgraded or altered by client actions.
 */
export function isAllowedPaymentStatusTransition(
  fromStatus: string,
  toStatus: PaymentVerificationStatus
): boolean {
  if (fromStatus === toStatus) return true

  const allowedTransitions: Record<string, PaymentVerificationStatus[]> = {
    PENDING: ["MANUAL_CONFIRMED", "PROVIDER_INITIATED", "PROVIDER_VERIFIED", "WEBHOOK_VERIFIED", "FAILED"],
    PROVIDER_INITIATED: ["PROVIDER_VERIFIED", "WEBHOOK_VERIFIED", "FAILED"],
    MANUAL_CONFIRMED: ["WEBHOOK_VERIFIED", "PROVIDER_VERIFIED"], // Provider confirmation can upgrade a manual claim
    FAILED: [], // Terminal
    PROVIDER_VERIFIED: [], // Terminal
    WEBHOOK_VERIFIED: [], // Terminal
    UNKNOWN: ["FAILED", "MANUAL_CONFIRMED"],
  }

  const allowed = allowedTransitions[fromStatus] || []
  return allowed.includes(toStatus)
}

/**
 * Checks whether a given status represents verified payment success.
 */
export function isPaymentVerified(status: string): boolean {
  return status === "WEBHOOK_VERIFIED" || status === "PROVIDER_VERIFIED"
}

/**
 * Checks whether a given status represents manual peer-to-peer confirmation.
 */
export function isPaymentManual(status: string): boolean {
  return status === "MANUAL_CONFIRMED"
}
