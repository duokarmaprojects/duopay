/**
 * DuoPay Zero-Trust Financial Error System
 * Standard controlled error codes for financial manipulation rejections.
 * Prevents leaking database schemas, stack traces, or internal implementation details.
 */

export type FinancialErrorCode =
  | "INVALID_AMOUNT"
  | "INVALID_SPLIT"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "RESOURCE_NOT_FOUND"
  | "PAYMENT_VERIFICATION_FAILED"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "INVALID_PAYMENT_STATE"
  | "INVALID_SETTLEMENT"
  | "DUPLICATE_REQUEST"
  | "REWARD_NOT_ELIGIBLE"
  | "INSUFFICIENT_BALANCE"
  | "INVALID_REFERRAL"
  | "INVALID_REQUEST"
  | "MALICIOUS_INPUT_BLOCKED"

export class FinancialSecurityError extends Error {
  public readonly code: FinancialErrorCode
  public readonly userMessage: string
  public readonly statusCode: number

  constructor(code: FinancialErrorCode, userMessage: string, statusCode: number = 400) {
    super(`[${code}] ${userMessage}`)
    this.code = code
    this.userMessage = userMessage
    this.statusCode = statusCode
    this.name = "FinancialSecurityError"
    Object.setPrototypeOf(this, FinancialSecurityError.prototype)
  }

  toJSON() {
    return {
      error: this.code,
      message: this.userMessage,
    }
  }
}

/**
 * Checks if an error is a FinancialSecurityError.
 */
export function isFinancialSecurityError(err: unknown): err is FinancialSecurityError {
  return err instanceof FinancialSecurityError || (typeof err === "object" && err !== null && "code" in err && "userMessage" in err)
}
