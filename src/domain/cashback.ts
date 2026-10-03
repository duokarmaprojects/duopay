/**
 * DuoPay Central Cashback & Rewards Policy
 * Deterministic, server-controlled cashback calculation and redemption policy.
 * All amounts are strictly integer paise to eliminate floating-point money errors.
 */

import { isPaymentVerified } from "./payment"

export const MIN_CASHBACK_PAISE = 10 // ₹0.10
export const MAX_CASHBACK_PAISE = 50 // ₹0.50
export const MIN_REDEMPTION_THRESHOLD_PAISE = 2500 // ₹25.00

export const CASHBACK_LEDGER_TYPES = [
  "PAYMENT_CASHBACK",
  "REDEMPTION",
  "REVERSAL",
  "ADJUSTMENT",
] as const

export type CashbackLedgerType = (typeof CASHBACK_LEDGER_TYPES)[number]

export const CASHBACK_LEDGER_STATUSES = [
  "EARNED",
  "REDEEMED",
  "REVERSED",
  "PENDING",
  "CANCELLED",
] as const

export type CashbackLedgerStatus = (typeof CASHBACK_LEDGER_STATUSES)[number]

export const REDEMPTION_STATUSES = [
  "REQUESTED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REVERSED",
] as const

export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number]

/**
 * Deterministic cashback calculation policy based on verified payment amount in paise.
 * Tiered scaling:
 * - Payment < ₹100: ₹0.10 (10 paise)
 * - ₹100 – ₹499: ₹0.15 (15 paise)
 * - ₹500 – ₹999: ₹0.25 (25 paise)
 * - ₹1,000 – ₹1,999: ₹0.35 (35 paise)
 * - ₹2,000+: ₹0.50 (50 paise)
 */
export function calculateCashback(paymentAmountPaise: number): number {
  if (typeof paymentAmountPaise !== "number" || isNaN(paymentAmountPaise) || paymentAmountPaise <= 0) {
    return 0
  }

  // < ₹100 (10,000 paise)
  if (paymentAmountPaise < 10000) {
    return 10
  }
  // ₹100 – ₹499.99 (10,000 – 49,999 paise)
  if (paymentAmountPaise < 50000) {
    return 15
  }
  // ₹500 – ₹999.99 (50,000 – 99,999 paise)
  if (paymentAmountPaise < 100000) {
    return 25
  }
  // ₹1,000 – ₹1,999.99 (100,000 – 199,999 paise)
  if (paymentAmountPaise < 200000) {
    return 35
  }
  // ₹2,000+ (200,000+ paise)
  return 50
}

/**
 * Determines whether a payment qualifies for cashback.
 * Strictly reuses the core payment verification model:
 * ONLY WEBHOOK_VERIFIED and PROVIDER_VERIFIED payments qualify.
 * Never awards cashback for MANUAL_CONFIRMED, PENDING, FAILED, or UNKNOWN.
 */
export function isPaymentEligibleForCashback(paymentStatus: string): boolean {
  if (!paymentStatus) return false
  return isPaymentVerified(paymentStatus)
}

/**
 * Formats integer paise into Indian Rupee display (e.g., 2540 -> "₹25.40", 25 -> "₹0.25").
 */
export function formatPaise(paise: number): string {
  const safePaise = typeof paise === "number" && !isNaN(paise) ? paise : 0
  const isNegative = safePaise < 0
  const abs = Math.abs(safePaise)
  const rupees = (abs / 100).toFixed(2)
  return `${isNegative ? "-" : ""}₹${rupees}`
}

/**
 * Returns plain decimal string for rupee values (e.g., 2500 -> "25.00").
 */
export function paiseToRupees(paise: number): string {
  const safePaise = typeof paise === "number" && !isNaN(paise) ? paise : 0
  return (safePaise / 100).toFixed(2)
}

/**
 * Validates eligibility for cashback balance redemption.
 */
export function canRedeemCashback(
  balancePaise: number,
  hasUpiId: boolean,
  hasPendingRedemption = false
): { canRedeem: boolean; reason?: string } {
  if (hasPendingRedemption) {
    return {
      canRedeem: false,
      reason: "A redemption request is already processing",
    }
  }

  if (balancePaise < MIN_REDEMPTION_THRESHOLD_PAISE) {
    const remaining = MIN_REDEMPTION_THRESHOLD_PAISE - balancePaise
    return {
      canRedeem: false,
      reason: `${formatPaise(remaining)} more to unlock redemption`,
    }
  }

  if (!hasUpiId) {
    return {
      canRedeem: false,
      reason: "UPI ID required for payout destination",
    }
  }

  return { canRedeem: true }
}
