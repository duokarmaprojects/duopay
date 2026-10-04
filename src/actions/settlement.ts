"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getUserBalances } from "@/services/balance"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId, validateIntegerPaise } from "@/lib/security"
import { sendNotification } from "@/services/notification"
import { pusherServer } from "@/lib/realtime/pusher"

const recordSettlementSchema = z.object({
  receiverId: z.string().min(1, "Receiver is required"),
  amountPaise: z.number().int().positive("Settlement amount must be positive"),
  groupId: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  isPoolContribution: z.boolean().optional().default(false),
})

export async function recordSettlement(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "recordSettlement" },
    })
    throw new Error("Unauthorized")
  }

  const payerId = session.user.id

  // Rate Limiting: max 10 settlements / minute (in-process + persistent DB checks)
  const rateLimit = checkActionRateLimit("SETTLEMENT", payerId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId: payerId,
      details: { action: "recordSettlement" },
    })
    throw new Error("Too many settlement attempts. Please wait a minute before trying again.")
  }

  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000)
  const dbSettlementCount = await prisma.settlement.count({
    where: {
      payerId,
      createdAt: { gte: sixtySecondsAgo },
    },
  })
  if (dbSettlementCount >= 10) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId: payerId,
      details: { action: "recordSettlement_persistent_limit" },
    })
    throw new Error("Too many settlement attempts. Please wait a minute before trying again.")
  }

  // Block client-side tampering: reject any client attempting to submit verification, provider, or cashback status
  if (
    formData.has("status") ||
    formData.has("paymentStatus") ||
    formData.has("verificationMethod") ||
    formData.has("providerTransactionId") ||
    formData.has("verifiedAt") ||
    formData.has("verifiedAmount") ||
    formData.has("cashback") ||
    formData.has("cashbackAmount") ||
    formData.has("cashbackBalance") ||
    formData.has("reward") ||
    formData.has("role") ||
    formData.has("isAdmin")
  ) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId: payerId,
      details: { action: "recordSettlement_client_claimed_verification_blocked" },
    })
    throw new Error("Client submission of payment verification state is strictly prohibited")
  }

  const rawReceiverId = formData.get("receiverId")
  const rawAmountPaise = formData.get("amountPaise")
  const rawGroupId = formData.get("groupId")
  const rawIdempotencyKey = formData.get("idempotencyKey")

  // Strict integer paise validation (rejects floats, NaN, negative, non-digits, overflow)
  const validatedAmountPaise = validateIntegerPaise(rawAmountPaise, "amountPaise")

  const parsed = recordSettlementSchema.safeParse({
    receiverId: rawReceiverId,
    amountPaise: validatedAmountPaise,
    groupId: rawGroupId ? String(rawGroupId) : null,
    idempotencyKey: rawIdempotencyKey ? String(rawIdempotencyKey) : null,
    isPoolContribution: formData.get("isPoolContribution") === "true",
  })

  if (!parsed.success) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId: payerId,
      details: { errors: parsed.error.issues },
    })
    throw new Error(parsed.error.issues[0].message)
  }

  const { receiverId, amountPaise, groupId, idempotencyKey, isPoolContribution } = parsed.data

  // 1. Prevent payer paying themselves
  if (payerId === receiverId) {
    await logSecurityEvent({
      type: "FINANCIAL_INVALID_TRANSACTION_BLOCKED",
      userId: payerId,
      details: { reason: "Self-settlement attempt" },
    })
    throw new Error("Cannot record a settlement with yourself")
  }

  // 2. Validate receiver exists in DB
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true, name: true, upiId: true },
  })
  if (!receiver) {
    throw new Error("Recipient user does not exist")
  }

  // 3. If groupId is provided, verify both payer and receiver are active members
  if (groupId) {
    validateId(groupId, "groupId")
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        userId: { in: [payerId, receiverId] },
      },
    })
    if (members.length < 2) {
      await logSecurityEvent({
        type: "IDOR_ATTEMPT_BLOCKED",
        userId: payerId,
        details: { action: "settlement_cross_group", groupId, receiverId },
      })
      throw new Error("Both payer and recipient must be active members of the group")
    }
  }

  // 4. Server-Side Financial Verification: verify payer actually owes receiver this money!
  const balances = await getUserBalances(payerId)
  const balanceWithReceiver = balances.detailedBalances.find((b) => b.userId === receiverId)

  if (!balanceWithReceiver || balanceWithReceiver.type !== "USER_OWES" || balanceWithReceiver.amount <= 0) {
    await logSecurityEvent({
      type: "FINANCIAL_INVALID_TRANSACTION_BLOCKED",
      userId: payerId,
      details: {
        reason: "Zero or invalid debt balance",
        receiverId,
        requestedAmount: amountPaise,
      },
    })
    throw new Error("You do not have an outstanding balance to settle with this user")
  }

  // Enforce settlement amount does not exceed owed balance
  if (amountPaise > balanceWithReceiver.amount) {
    await logSecurityEvent({
      type: "FINANCIAL_INVALID_TRANSACTION_BLOCKED",
      userId: payerId,
      details: {
        reason: "Settlement exceeds owed balance",
        receiverId,
        requestedAmount: amountPaise,
        maxOwed: balanceWithReceiver.amount,
      },
    })
    throw new Error(
      `Settlement amount exceeds outstanding balance. Maximum allowed is ₹${(
        balanceWithReceiver.amount / 100
      ).toFixed(2)}`
    )
  }

  // 5. Idempotency & Replay Protection:
  const effectiveIdempotencyKey =
    idempotencyKey ||
    `auto-settle:${payerId}:${receiverId}:${amountPaise}:${groupId || "global"}:${Math.floor(
      Date.now() / 15000
    )}`

  // Check if settlement already exists with this idempotency key
  const existingSettlement = await prisma.settlement.findUnique({
    where: { idempotencyKey: effectiveIdempotencyKey },
  })
  if (existingSettlement) {
    if (groupId) {
      redirect(`/groups/${groupId}`)
    } else {
      redirect("/")
    }
  }

  // 6. Execute settlement transactionally with DB-level unique constraint idempotency protection
  try {
    await prisma.$transaction(async (tx) => {
      await tx.settlement.create({
        data: {
          payerId,
          receiverId,
          amount: amountPaise,
          groupId: groupId || null,
          status: "COMPLETED",
          paymentStatus: "MANUAL_CONFIRMED",
          paymentProvider: "manual_confirmation",
          verificationMethod: "MANUAL_PEER_CONFIRMATION",
          verifiedAt: new Date(),
          verifiedAmount: amountPaise,
          providerTransactionId: null,
          processedEventId: null,
          idempotencyKey: effectiveIdempotencyKey,
          settledAt: new Date(),
          payeeUpiId: receiver.upiId || null,
          isPoolContribution,
        },
      })
    })
  } catch (err: any) {
    // If a concurrent request created the settlement with the exact same idempotency key,
    // handle P2002 as a successful duplicate replay instead of failing
    if (err?.code === "P2002" || String(err?.message || "").includes("idempotencyKey")) {
      await logSecurityEvent({
        type: "FINANCIAL_SETTLEMENT_RECORDED",
        userId: payerId,
        details: { reason: "Idempotent concurrent replay detected via DB unique constraint" },
      })
      if (groupId) {
        redirect(`/groups/${groupId}`)
      } else {
        redirect("/")
      }
    }
    throw err
  }

  await logSecurityEvent({
    type: "FINANCIAL_SETTLEMENT_RECORDED",
    userId: payerId,
    details: {
      receiverId,
      amountPaise,
      groupId: groupId || null,
      paymentProvider: "manual_confirmation",
    },
  })

  // Notify receiver (isolated so failure never breaks settlement)
  const payer = await prisma.user.findUnique({
    where: { id: payerId },
    select: { name: true },
  })
  const payerDisplayName = payer?.name || "Friend"
  const settledRupees = (amountPaise / 100).toFixed(2)

  sendNotification({
    userId: receiverId,
    type: "SETTLEMENT_COMPLETED",
    title: "Payment Received",
    body: `${payerDisplayName} settled ₹${settledRupees} with you.`,
    url: groupId ? `/groups/${groupId}` : "/",
    data: { amountPaise, payerId, groupId },
  }).catch(() => {})

  if (isPoolContribution && groupId) {
    pusherServer.trigger(`group-${groupId}`, 'pool.updated', { groupId, amount: amountPaise, type: 'contribution' }).catch(() => {})
    pusherServer.trigger(`group-${groupId}`, 'pool.contribution_created', { groupId, amount: amountPaise, payerId, receiverId }).catch(() => {})
  }

  revalidatePath("/")
  if (groupId) {
    revalidatePath(`/groups/${groupId}`)
    redirect(`/groups/${groupId}`)
  } else {
    redirect("/")
  }
}

/**
 * Server Action to fetch or verify a smart simplified settlement plan.
 * Returns the optimized transactions and detects staleness.
 */
export async function getSmartSettlementPlanAction(groupId?: string | null) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const { generateSmartSettlementPlan } = await import("@/services/balance")
  return generateSmartSettlementPlan({
    userId: session.user.id,
    groupId: groupId || null,
  })
}

