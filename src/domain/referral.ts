/**
 * DuoPay Referral & Rewards Domain Rules
 * 
 * Rules:
 * - ₹11 awarded when a friend joins (signup reward).
 * - ₹10 awarded after the referred friend completes 10 verified payments.
 * - Total: up to ₹21* per successful referral.
 * - Server-authoritative: all reward calculations, counts, and states are strictly evaluated server-side.
 * - Only WEBHOOK_VERIFIED and PROVIDER_VERIFIED payments qualify.
 * - Self-referrals and duplicate attributions are strictly blocked.
 */

export const SIGNUP_REWARD_PAISE = 1100 // ₹11.00
export const COMPLETION_REWARD_PAISE = 1000 // ₹10.00
export const QUALIFYING_PAYMENTS_REQUIRED = 10
export const TOTAL_REFERRAL_REWARD_PAISE = 2100 // ₹21.00 (₹11 + ₹10)

export interface ReferralStatRecord {
  id: string
  referrerId: string
  refereeId: string
  status: string
  signupRewardPaidPaise: number
  signupRewardStatus: string
  qualifyingPaymentCount: number
  completionRewardPaidPaise: number
  completionRewardStatus: string
  createdAt: Date | string
  completedAt?: Date | string | null
}

export interface ReferralSummary {
  referralCode: string
  referralLink: string
  totalEarnedPaise: number
  totalEarnedRupees: string
  pendingRewardPaise: number
  pendingRewardRupees: string
  totalReferrals: number
  completedReferrals: number
  activeReferrals: number
  history: Array<{
    id: string
    refereeName: string
    refereeImage?: string | null
    status: string
    joinedDate: string
    qualifyingPaymentCount: number
    targetPaymentCount: number
    earnedAmountRupees: string
    isComplete: boolean
  }>
}

/**
 * Checks if a proposed referral is a self-referral attempt.
 */
export function isSelfReferral(referrerId: string, refereeId: string): boolean {
  if (!referrerId || !refereeId) return false
  return referrerId.trim().toLowerCase() === refereeId.trim().toLowerCase()
}

/**
 * Validates a referral code format.
 * Format: DUO-XXXXXX or alphanumeric 6-12 characters.
 */
export function isValidReferralCode(code: string | null | undefined): boolean {
  if (!code || typeof code !== "string") return false
  const trimmed = code.trim().toUpperCase()
  return /^[A-Z0-9_-]{4,16}$/.test(trimmed)
}

/**
 * Generates a clean, unique referral code for a user.
 */
export function generateUserReferralCode(userId: string): string {
  // Use a clean prefix and deterministic slice or random characters
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `DUO${cleanId}${randomChars}`
}

/**
 * Formats paise to INR string e.g. 1100 -> "₹11" or "₹11.00"
 */
export function formatPaiseToRupees(paise: number, fixedDecimal = false): string {
  const rupees = paise / 100
  if (fixedDecimal || rupees % 1 !== 0) {
    return `₹${rupees.toFixed(2)}`
  }
  return `₹${rupees}`
}

/**
 * Evaluates server-authoritative aggregate stats for a list of referrals.
 */
export function calculateReferralStats(referrals: ReferralStatRecord[]): {
  totalEarnedPaise: number
  pendingRewardPaise: number
  totalReferrals: number
  completedReferrals: number
  activeReferrals: number
} {
  let totalEarnedPaise = 0
  let pendingRewardPaise = 0
  let completedReferrals = 0
  let activeReferrals = 0

  for (const ref of referrals) {
    // If flagged for fraud, do not count
    if (ref.status === "FRAUD_FLAGGED") continue

    // Signup reward
    if (ref.signupRewardStatus === "EARNED") {
      totalEarnedPaise += ref.signupRewardPaidPaise
    }

    // Completion reward
    if (ref.completionRewardStatus === "EARNED") {
      totalEarnedPaise += ref.completionRewardPaidPaise
      completedReferrals++
    } else if (ref.completionRewardStatus === "PENDING") {
      pendingRewardPaise += ref.completionRewardPaidPaise
      activeReferrals++
    }
  }

  return {
    totalEarnedPaise,
    pendingRewardPaise,
    totalReferrals: referrals.length,
    completedReferrals,
    activeReferrals,
  }
}
