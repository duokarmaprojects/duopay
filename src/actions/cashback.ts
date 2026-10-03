"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { logSecurityEvent } from "@/lib/securityAudit"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { validateId, sanitizeTextInput } from "@/lib/security"
import {
  MIN_REDEMPTION_THRESHOLD_PAISE,
  canRedeemCashback,
  formatPaise,
  paiseToRupees,
} from "@/domain/cashback"

export interface CashbackSummary {
  balancePaise: number
  balanceRupees: string
  thresholdPaise: number
  remainingPaise: number
  isUnlocked: boolean
  progressPercentage: number
  upiVerified: boolean
  upiId: string | null
  upiVerifiedName: string | null
  canRedeem: boolean
  reason?: string
  activeRedemption: {
    id: string
    amountPaise: number
    status: string
    requestedAt: Date
  } | null
}

/**
 * Retrieves the user's cashback balance, progress towards redemption, and verified payout info.
 */
export async function getCashbackSummary(): Promise<CashbackSummary> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cashbackBalancePaise: true,
      upiId: true,
      upiVerified: true,
      upiVerifiedName: true,
    },
  })

  if (!user) {
    throw new Error("User not found")
  }

  const activeRedemption = await prisma.redemptionRequest.findFirst({
    where: {
      userId,
      status: { in: ["REQUESTED", "PROCESSING"] },
    },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      amountPaise: true,
      status: true,
      requestedAt: true,
    },
  })

  const balancePaise = user.cashbackBalancePaise || 0
  const thresholdPaise = MIN_REDEMPTION_THRESHOLD_PAISE
  const remainingPaise = Math.max(0, thresholdPaise - balancePaise)
  const isUnlocked = balancePaise >= thresholdPaise
  const progressPercentage = Math.min(100, Math.round((balancePaise / thresholdPaise) * 100))

  const redemptionCheck = canRedeemCashback(
    balancePaise,
    user.upiVerified,
    Boolean(activeRedemption)
  )

  return {
    balancePaise,
    balanceRupees: paiseToRupees(balancePaise),
    thresholdPaise,
    remainingPaise,
    isUnlocked,
    progressPercentage,
    upiVerified: user.upiVerified,
    upiId: user.upiId,
    upiVerifiedName: user.upiVerifiedName,
    canRedeem: redemptionCheck.canRedeem,
    reason: redemptionCheck.reason,
    activeRedemption,
  }
}

/**
 * Retrieves the user's auditable cashback ledger history.
 * Strictly IDOR-protected by scoping to session user ID.
 */
export async function getCashbackHistory(limit = 50) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id
  const safeLimit = Math.min(100, Math.max(1, limit))

  const entries = await prisma.cashbackLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
    include: {
      settlement: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentStatus: true,
        },
      },
    },
  })

  return entries.map((e) => ({
    id: e.id,
    amountPaise: e.amountPaise,
    formattedAmount: formatPaise(e.amountPaise),
    type: e.type,
    status: e.status,
    description: e.description,
    sourcePaymentId: e.sourcePaymentId,
    providerTransactionId: e.providerTransactionId,
    createdAt: e.createdAt,
    settlement: e.settlement,
  }))
}

/**
 * Requests server-authorized redemption of the user's available cashback balance.
 * Strictly verifies threshold (₹25), payout destination (verified UPI ID), and ledger integrity.
 * Client submission of arbitrary redemption amounts or statuses is rejected.
 */
export async function requestCashbackRedemption(formData?: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "requestCashbackRedemption" },
    })
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  // Block client-side tampering: reject any client attempting to submit amounts, ledger types, or statuses
  if (
    formData &&
    (formData.has("amount") ||
      formData.has("amountPaise") ||
      formData.has("cashbackAmount") ||
      formData.has("cashback") ||
      formData.has("status") ||
      formData.has("type") ||
      formData.has("payoutDestination") ||
      formData.has("ledgerEntryId") ||
      formData.has("userId"))
  ) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId,
      details: { action: "requestCashbackRedemption_client_tampering" },
    })
    throw new Error("Client submission of redemption parameters is strictly prohibited")
  }

  // Rate Limiting: 5 attempts per 15 minutes
  const rateLimit = checkActionRateLimit("CASHBACK_REDEMPTION", userId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId,
      details: { action: "requestCashbackRedemption" },
    })
    throw new Error("Too many redemption attempts. Please wait a moment.")
  }

  // Transactionally verify balance, active requests, and execute redemption ledger mutation
  let redemptionId = ""
  let redeemedAmountPaise = 0

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        cashbackBalancePaise: true,
        upiId: true,
        upiVerified: true,
      },
    })

    if (!user) {
      throw new Error("User record not found")
    }

    if (!user.upiVerified || !user.upiId) {
      throw new Error("A verified UPI ID is required to receive cashback payouts")
    }

    if (user.cashbackBalancePaise < MIN_REDEMPTION_THRESHOLD_PAISE) {
      throw new Error(
        `Minimum cashback redemption threshold is ₹${(MIN_REDEMPTION_THRESHOLD_PAISE / 100).toFixed(
          2
        )}. Current balance: ₹${(user.cashbackBalancePaise / 100).toFixed(2)}`
      )
    }

    // Check for duplicate concurrent redemption requests
    const activeRedemption = await tx.redemptionRequest.findFirst({
      where: {
        userId,
        status: { in: ["REQUESTED", "PROCESSING"] },
      },
    })

    if (activeRedemption) {
      throw new Error("A cashback redemption request is already in progress")
    }

    redeemedAmountPaise = user.cashbackBalancePaise
    const idempotencyKey = `redeem:${userId}:${Date.now()}`

    // 1. Create Redemption Request
    const redemption = await tx.redemptionRequest.create({
      data: {
        userId,
        amountPaise: redeemedAmountPaise,
        status: "PROCESSING",
        payoutDestination: user.upiId,
        idempotencyKey,
      },
    })

    redemptionId = redemption.id

    // 2. Create Auditable Debit Ledger Entry
    const ledger = await tx.cashbackLedger.create({
      data: {
        userId,
        amountPaise: -redeemedAmountPaise,
        type: "REDEMPTION",
        status: "PENDING",
        idempotencyKey: `ledger_redeem:${redemption.id}`,
        description: `Cashback redemption of ₹${(redeemedAmountPaise / 100).toFixed(2)} to verified UPI ${user.upiId}`,
      },
    })

    // Link ledger ID to redemption request
    await tx.redemptionRequest.update({
      where: { id: redemption.id },
      data: { ledgerEntryId: ledger.id },
    })

    // 3. Update User Balance Transactionally
    await tx.user.update({
      where: { id: userId },
      data: {
        cashbackBalancePaise: { decrement: redeemedAmountPaise },
      },
    })
  })

  await logSecurityEvent({
    type: "FINANCIAL_SETTLEMENT_RECORDED",
    userId,
    details: {
      action: "cashback_redemption_requested",
      redemptionId,
      amountPaise: redeemedAmountPaise,
    },
  })

  revalidatePath("/profile")
  revalidatePath("/rewards")
  revalidatePath("/")

  return {
    success: true,
    redemptionId,
    amountPaise: redeemedAmountPaise,
    formattedAmount: formatPaise(redeemedAmountPaise),
  }
}

/**
 * Admin action to adjust user cashback ledger with required audit metadata.
 * Prohibits silent balance mutation; every adjustment creates an ADJUSTMENT ledger record.
 */
export async function adminAdjustCashback(
  targetUserId: string,
  amountPaise: number,
  reason: string
) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const adminUserId = session.user.id

  const caller = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  })

  if (caller?.role !== "ADMIN") {
    await logSecurityEvent({
      type: "ADMIN_ACCESS_DENIED",
      userId: session.user.id,
      details: { action: "adminAdjustCashback_forbidden", targetUserId },
    })
    throw new Error("Forbidden: Administrator privileges required")
  }

  validateId(targetUserId, "targetUserId")

  if (!Number.isInteger(amountPaise) || amountPaise === 0) {
    throw new Error("Adjustment amount must be a non-zero integer in paise")
  }

  const cleanReason = sanitizeTextInput(reason, 200)
  if (!cleanReason || cleanReason.length < 3) {
    throw new Error("A valid reason for manual adjustment is required")
  }

  let ledgerId = ""
  await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, cashbackBalancePaise: true },
    })

    if (!targetUser) {
      throw new Error("Target user does not exist")
    }

    // Prevent negative balance from debit adjustment
    if (amountPaise < 0 && targetUser.cashbackBalancePaise + amountPaise < 0) {
      throw new Error(
        `Adjustment would result in negative balance. Max deductible: ₹${(
          targetUser.cashbackBalancePaise / 100
        ).toFixed(2)}`
      )
    }

    const ledger = await tx.cashbackLedger.create({
      data: {
        userId: targetUserId,
        amountPaise,
        type: "ADJUSTMENT",
        status: amountPaise >= 0 ? "EARNED" : "REVERSED",
        description: `Admin adjustment: ${cleanReason}`,
        metadata: JSON.stringify({
          adminUserId,
          reason: cleanReason,
          timestamp: new Date().toISOString(),
        }),
      },
    })

    ledgerId = ledger.id

    await tx.user.update({
      where: { id: targetUserId },
      data: {
        cashbackBalancePaise: { increment: amountPaise },
      },
    })
  })

  await logSecurityEvent({
    type: "ADMIN_ACCESS_SUCCESS",
    userId: adminUserId,
    details: {
      action: "adminAdjustCashback",
      targetUserId,
      amountPaise,
      reason: cleanReason,
      ledgerId,
    },
  })

  revalidatePath("/profile")
  revalidatePath("/rewards")
  revalidatePath("/admin")

  return {
    success: true,
    ledgerId,
    targetUserId,
    amountPaise,
  }
}
