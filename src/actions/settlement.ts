"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getUserBalances } from "@/services/balance"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { logSecurityEvent } from "@/lib/securityAudit"
import { validateId } from "@/lib/security"

const recordSettlementSchema = z.object({
  receiverId: z.string().min(1, "Receiver is required"),
  amountPaise: z.number().int().positive("Settlement amount must be positive"),
  groupId: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
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

  // Rate Limiting: max 10 settlements / minute
  const rateLimit = checkActionRateLimit("SETTLEMENT", payerId)
  if (!rateLimit.allowed) {
    await logSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      userId: payerId,
      details: { action: "recordSettlement" },
    })
    throw new Error("Too many settlement attempts. Please wait a minute before trying again.")
  }

  const rawReceiverId = formData.get("receiverId")
  const rawAmountPaise = formData.get("amountPaise")
  const rawGroupId = formData.get("groupId")
  const rawIdempotencyKey = formData.get("idempotencyKey")

  const parsed = recordSettlementSchema.safeParse({
    receiverId: rawReceiverId,
    amountPaise: rawAmountPaise ? parseInt(String(rawAmountPaise), 10) : NaN,
    groupId: rawGroupId ? String(rawGroupId) : null,
    idempotencyKey: rawIdempotencyKey ? String(rawIdempotencyKey) : null,
  })

  if (!parsed.success) {
    await logSecurityEvent({
      type: "MALICIOUS_INPUT_BLOCKED",
      userId: payerId,
      details: { errors: parsed.error.issues },
    })
    throw new Error(parsed.error.issues[0].message)
  }

  const { receiverId, amountPaise, groupId, idempotencyKey } = parsed.data

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
    select: { id: true, name: true, upiId: true, upiVerified: true },
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

  // 6. Execute settlement transactionally
  await prisma.$transaction(async (tx) => {
    await tx.settlement.create({
      data: {
        payerId,
        receiverId,
        amount: amountPaise,
        groupId: groupId || null,
        status: "COMPLETED",
        paymentStatus: "PAYMENT_SUCCESS",
        idempotencyKey: effectiveIdempotencyKey,
        settledAt: new Date(),
        payeeUpiId: receiver.upiId || null,
      },
    })
  })

  await logSecurityEvent({
    type: "FINANCIAL_SETTLEMENT_RECORDED",
    userId: payerId,
    details: {
      receiverId,
      amountPaise,
      groupId: groupId || null,
    },
  })

  revalidatePath("/")
  if (groupId) {
    revalidatePath(`/groups/${groupId}`)
    redirect(`/groups/${groupId}`)
  } else {
    redirect("/")
  }
}
