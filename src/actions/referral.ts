"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { logSecurityEvent } from "@/lib/securityAudit"
import { checkActionRateLimit } from "@/lib/rateLimit"
import {
  SIGNUP_REWARD_PAISE,
  COMPLETION_REWARD_PAISE,
  QUALIFYING_PAYMENTS_REQUIRED,
  TOTAL_REFERRAL_REWARD_PAISE,
  calculateReferralStats,
  generateUserReferralCode,
  isSelfReferral,
  isValidReferralCode,
  formatPaiseToRupees,
  ReferralSummary,
} from "@/domain/referral"
import { sendNotification } from "@/services/notification"

/**
 * Retrieves the authenticated user's referral summary, server-authoritative statistics,
 * and referral history with privacy-masked referee details.
 */
export async function getReferralSummary(): Promise<ReferralSummary> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  // Retrieve user or lazily initialize referralCode
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      referralCode: true,
    },
  })

  if (!user) {
    throw new Error("User not found")
  }

  // Ensure user has a unique referral code
  let referralCode = user.referralCode
  if (!referralCode) {
    referralCode = generateUserReferralCode(user.id)
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode },
      })
    } catch {
      // If collision occurs, retry with another code
      referralCode = generateUserReferralCode(user.id + Date.now().toString())
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode },
      })
    }
  }

  // Query all referrals sent by this user
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      referee: {
        select: {
          id: true,
          name: true,
          image: true,
          phone: true,
          createdAt: true,
        },
      },
    },
  })

  // Calculate stats strictly server-side
  const stats = calculateReferralStats(referrals)

  // Construct absolute or relative share link
  const origin = process.env.NEXTAUTH_URL || "https://duopay.app"
  const referralLink = `${origin}/login?ref=${referralCode}`

  // Map history with privacy masking (no PII exposure)
  const history = referrals.map((ref) => {
    // Mask referee name (e.g., "John D." or "Friend")
    const rawName = ref.referee?.name?.trim() || "Friend"
    const nameParts = rawName.split(" ")
    const maskedName =
      nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[1].charAt(0)}.`
        : rawName

    let earnedPaise = 0
    if (ref.signupRewardStatus === "EARNED") {
      earnedPaise += ref.signupRewardPaidPaise
    }
    if (ref.completionRewardStatus === "EARNED") {
      earnedPaise += ref.completionRewardPaidPaise
    }

    return {
      id: ref.id,
      refereeName: maskedName,
      refereeImage: ref.referee?.image || null,
      status: ref.status,
      joinedDate: new Date(ref.createdAt).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      qualifyingPaymentCount: Math.min(ref.qualifyingPaymentCount, QUALIFYING_PAYMENTS_REQUIRED),
      targetPaymentCount: QUALIFYING_PAYMENTS_REQUIRED,
      earnedAmountRupees: formatPaiseToRupees(earnedPaise),
      isComplete: ref.completionRewardStatus === "EARNED",
    }
  })

  return {
    referralCode,
    referralLink,
    totalEarnedPaise: stats.totalEarnedPaise,
    totalEarnedRupees: formatPaiseToRupees(stats.totalEarnedPaise),
    pendingRewardPaise: stats.pendingRewardPaise,
    pendingRewardRupees: formatPaiseToRupees(stats.pendingRewardPaise),
    totalReferrals: stats.totalReferrals,
    completedReferrals: stats.completedReferrals,
    activeReferrals: stats.activeReferrals,
    history,
  }
}

/**
 * Server-authoritative action to record a referral code attribution for the current user.
 * Enforces:
 * 1. Single attribution (cannot have multiple referrers).
 * 2. Self-referral prohibition.
 * 3. Rate-limiting.
 * 4. Atomic credit of ₹11 signup bonus.
 */
export async function applyReferralCode(rawCode: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" }
  }

  const refereeId = session.user.id

  // Rate limiting to prevent brute force referral scanning
  const rl = checkActionRateLimit("applyReferralCode", refereeId, {
    maxAttempts: 5,
    windowMs: 60000,
  })
  if (!rl.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId: refereeId,
      details: { action: "applyReferralCode" },
    })
    return {
      success: false,
      error: "Too many attempts. Please try again later.",
    }
  }

  const referralCode = rawCode?.trim().toUpperCase()
  if (!isValidReferralCode(referralCode)) {
    return { success: false, error: "Invalid referral code format" }
  }

  // Check referee status
  const referee = await prisma.user.findUnique({
    where: { id: refereeId },
    select: { id: true, referredById: true },
  })

  if (!referee) {
    return { success: false, error: "User not found" }
  }

  if (referee.referredById) {
    return {
      success: false,
      error: "A referral code has already been applied to your account.",
    }
  }

  // Lookup referrer
  const referrer = await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true, name: true },
  })

  if (!referrer) {
    return { success: false, error: "Referral code not found or expired" }
  }

  // Self-referral guard
  if (isSelfReferral(referrer.id, refereeId)) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId: refereeId,
      details: {
        action: "self_referral_attempt",
        referralCode,
      },
    })
    return { success: false, error: "You cannot use your own referral code" }
  }

  // Check existing referral record
  const existingReferral = await prisma.referral.findUnique({
    where: { refereeId },
  })

  if (existingReferral) {
    return {
      success: false,
      error: "A referral has already been recorded for this account.",
    }
  }

  // Atomically apply referral and grant ₹11 signup bonus to referrer
  try {
    await prisma.$transaction(async (tx) => {
      // Link referee to referrer
      await tx.user.update({
        where: { id: refereeId },
        data: { referredById: referrer.id },
      })

      // Create referral tracking record
      const referral = await tx.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId,
          status: "JOINED",
          signupRewardPaidPaise: SIGNUP_REWARD_PAISE,
          signupRewardStatus: "EARNED",
          qualifyingPaymentCount: 0,
          completionRewardPaidPaise: COMPLETION_REWARD_PAISE,
          completionRewardStatus: "PENDING",
        },
      })

      // Credit ₹11 to referrer cashback balance
      await tx.user.update({
        where: { id: referrer.id },
        data: {
          cashbackBalancePaise: { increment: SIGNUP_REWARD_PAISE },
        },
      })

      // Create audit ledger entry
      await tx.cashbackLedger.create({
        data: {
          userId: referrer.id,
          amountPaise: SIGNUP_REWARD_PAISE,
          type: "REFERRAL_SIGNUP",
          status: "EARNED",
          idempotencyKey: `ref_signup:${referral.id}`,
          description: `Referral signup bonus for inviting a friend (₹11)`,
        },
      })
    })

    await logSecurityEvent({
      type: "FINANCIAL_SETTLEMENT_RECORDED",
      userId: refereeId,
      details: {
        action: "referral_applied",
        referrerId: referrer.id,
        rewardPaise: SIGNUP_REWARD_PAISE,
      },
    })

    // Notify referrer of signup bonus
    const refereeUser = await prisma.user.findUnique({
      where: { id: refereeId },
      select: { name: true },
    })
    const refereeName = refereeUser?.name || "A friend"

    sendNotification({
      userId: referrer.id,
      type: "REFERRAL_REWARD_EARNED",
      title: "Referral Bonus Earned! 🎉",
      body: `${refereeName} joined DuoPay — ₹11 has been added to your cashback ledger!`,
      url: "/referrals",
      data: { amountPaise: SIGNUP_REWARD_PAISE, refereeId },
    }).catch(() => {})

    try {
      revalidatePath("/referrals")
      revalidatePath("/")
    } catch {
      // Ignored outside of request context (e.g. testing)
    }

    return {
      success: true,
      message: `Referral code applied! You were invited by ${referrer.name || "a friend"}.`,
    }
  } catch (err: any) {
    console.error("Failed to apply referral code:", err)
    return {
      success: false,
      error: "Failed to apply referral code. Please try again.",
    }
  }
}
