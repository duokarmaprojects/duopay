import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { logSecurityEvent } from "@/lib/securityAudit"
import { isAllowedSettlementTransition } from "@/lib/security"
import { calculateCashback, formatPaise } from "@/domain/cashback"

/**
 * DuoPay Official Payment Gateway Webhook Receiver
 * Supports Razorpay and Cashfree webhook event verification and idempotent settlement reconciliation.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    if (!rawBody) {
      return NextResponse.json({ error: "Empty payload" }, { status: 400 })
    }

    const razorpaySignature = req.headers.get("x-razorpay-signature")
    const cashfreeSignature = req.headers.get("x-webhook-signature")
    const cashfreeTimestamp = req.headers.get("x-webhook-timestamp")

    let provider: "razorpay" | "cashfree" | null = null
    let isValidSignature = false

    // =========================================================================
    // 1. RAZORPAY SIGNATURE VERIFICATION
    // =========================================================================
    if (razorpaySignature) {
      provider = "razorpay"
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET
      if (!secret) {
        await logSecurityEvent({
          type: "AUTH_UNAUTHORIZED_ACCESS",
          details: { action: "webhook_unconfigured_secret", provider: "razorpay" },
        })
        return NextResponse.json({ error: "Webhook provider secret not configured" }, { status: 500 })
      }

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex")

      const sigBufferA = Buffer.from(razorpaySignature, "utf-8")
      const sigBufferB = Buffer.from(expectedSignature, "utf-8")

      if (sigBufferA.length === sigBufferB.length && crypto.timingSafeEqual(sigBufferA, sigBufferB)) {
        isValidSignature = true
      }
    }
    // =========================================================================
    // 2. CASHFREE SIGNATURE VERIFICATION
    // =========================================================================
    else if (cashfreeSignature && cashfreeTimestamp) {
      provider = "cashfree"
      const secret = process.env.CASHFREE_CLIENT_SECRET
      if (!secret) {
        await logSecurityEvent({
          type: "AUTH_UNAUTHORIZED_ACCESS",
          details: { action: "webhook_unconfigured_secret", provider: "cashfree" },
        })
        return NextResponse.json({ error: "Webhook provider secret not configured" }, { status: 500 })
      }

      // Replay attack prevention: verify timestamp within 5 minutes
      const timestampMs = parseInt(cashfreeTimestamp, 10) * 1000
      if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
        await logSecurityEvent({
          type: "AUTH_UNAUTHORIZED_ACCESS",
          details: { action: "webhook_expired_timestamp", provider: "cashfree" },
        })
        return NextResponse.json({ error: "Webhook timestamp expired" }, { status: 400 })
      }

      const signaturePayload = `${cashfreeTimestamp}${rawBody}`
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(signaturePayload)
        .digest("base64")

      const sigBufferA = Buffer.from(cashfreeSignature, "utf-8")
      const sigBufferB = Buffer.from(expectedSignature, "utf-8")

      if (sigBufferA.length === sigBufferB.length && crypto.timingSafeEqual(sigBufferA, sigBufferB)) {
        isValidSignature = true
      }
    }

    if (!provider || !isValidSignature) {
      await logSecurityEvent({
        type: "AUTH_UNAUTHORIZED_ACCESS",
        details: { action: "webhook_invalid_signature", provider: provider || "unknown" },
      })
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    // =========================================================================
    // 3. PARSE AND EXTRACT TRANSACTION DATA
    // =========================================================================
    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 })
    }

    let transactionId: string | null = null
    let settlementId: string | null = null
    let amountInPaise: number | null = null
    let eventType: string = ""
    let isSuccessEvent = false
    let eventId: string | null = null

    if (provider === "razorpay") {
      eventType = payload.event || ""
      const paymentEntity = payload.payload?.payment?.entity
      transactionId = paymentEntity?.id || null
      settlementId = paymentEntity?.notes?.settlementId || null
      amountInPaise = paymentEntity?.amount || null
      isSuccessEvent = eventType === "payment.captured" || eventType === "order.paid"
      eventId =
        req.headers.get("x-razorpay-event-id") ||
        payload.event_id ||
        payload.eventId ||
        (transactionId ? `rzp_evt_${eventType}_${transactionId}` : null)
    } else if (provider === "cashfree") {
      eventType = payload.type || payload.event || ""
      const order = payload.data?.order || payload.order
      const payment = payload.data?.payment || payload.payment
      transactionId = payment?.payment_id ? String(payment.payment_id) : null
      settlementId = order?.order_tags?.settlementId || order?.order_id || null
      amountInPaise = order?.order_amount ? Math.round(order.order_amount * 100) : null
      isSuccessEvent = eventType === "PAYMENT_SUCCESS_WEBHOOK" || payment?.payment_status === "SUCCESS"
      eventId =
        payload.event_id ||
        payload.eventId ||
        (transactionId ? `cf_evt_${eventType}_${transactionId}` : null)
    }

    if (!settlementId) {
      // Not a settlement-related webhook, acknowledge receipt safely
      return NextResponse.json({ received: true, handled: false })
    }

    // =========================================================================
    // 4. DATABASE TRANSACTION & ATOMIC RECONCILIATION
    // =========================================================================

    // Event replay defense: check if this event ID was already processed
    if (eventId) {
      const alreadyProcessedEvent = await prisma.settlement.findUnique({
        where: { processedEventId: eventId },
      })
      if (alreadyProcessedEvent) {
        return NextResponse.json({
          received: true,
          idempotent: true,
          replayed: true,
          paymentStatus: alreadyProcessedEvent.paymentStatus,
          settlementId: alreadyProcessedEvent.id,
        })
      }
    }

    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
    })

    if (!settlement) {
      return NextResponse.json({ error: "Settlement record not found" }, { status: 404 })
    }

    // Amount verification: prevent underpaid or mismatched callbacks
    if (amountInPaise && settlement.amount !== amountInPaise) {
      await logSecurityEvent({
        type: "FINANCIAL_INVALID_TRANSACTION_BLOCKED",
        details: {
          action: "webhook_amount_mismatch",
          expected: settlement.amount,
          received: amountInPaise,
          settlementId,
        },
      })
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
    }

    // Idempotency: duplicate success webhooks for already provider-verified record
    if (
      isSuccessEvent &&
      (settlement.paymentStatus === "WEBHOOK_VERIFIED" ||
        settlement.paymentStatus === "PROVIDER_VERIFIED")
    ) {
      return NextResponse.json({
        received: true,
        idempotent: true,
        status: settlement.status,
        paymentStatus: settlement.paymentStatus,
      })
    }

    if (isSuccessEvent) {
      if (!isAllowedSettlementTransition(settlement.status, "SETTLED")) {
        return NextResponse.json({ error: "Invalid settlement state transition" }, { status: 409 })
      }

      let awardedCashbackPaise = 0

      try {
        await prisma.$transaction(async (tx) => {
          await tx.settlement.update({
            where: { id: settlementId },
            data: {
              status: "SETTLED",
              paymentStatus: "WEBHOOK_VERIFIED",
              paymentProvider: provider,
              providerTransactionId: transactionId,
              verificationMethod: "WEBHOOK_HMAC",
              verifiedAt: new Date(),
              verifiedAmount: amountInPaise || settlement.amount,
              processedEventId: eventId,
              paymentCompletedAt: new Date(),
              settledAt: settlement.settledAt || new Date(),
            },
          })

          // Idempotent Cashback Allocation: exactly one cashback per qualifying verified payment
          const cashbackIdempotencyKey = `cashback:settle:${settlementId}`
          const existingCashback = await tx.cashbackLedger.findUnique({
            where: { idempotencyKey: cashbackIdempotencyKey },
          })

          if (!existingCashback && settlement.payerId) {
            const verifiedAmt = amountInPaise || settlement.amount
            awardedCashbackPaise = calculateCashback(verifiedAmt)

            if (awardedCashbackPaise > 0) {
              await tx.cashbackLedger.create({
                data: {
                  userId: settlement.payerId,
                  amountPaise: awardedCashbackPaise,
                  type: "PAYMENT_CASHBACK",
                  status: "EARNED",
                  sourcePaymentId: settlement.id,
                  providerTransactionId: transactionId,
                  idempotencyKey: cashbackIdempotencyKey,
                  description: `Instant cashback for payment of ${formatPaise(verifiedAmt)}`,
                },
              })

              await tx.user.update({
                where: { id: settlement.payerId },
                data: {
                  cashbackBalancePaise: { increment: awardedCashbackPaise },
                },
              })
            }
          }

          // Track qualifying referral payments towards 10-payment milestone
          if (settlement.payerId && (tx as any).referral?.findUnique) {
            const referral = await (tx as any).referral.findUnique({
              where: { refereeId: settlement.payerId },
            })

            if (
              referral &&
              referral.status !== "FRAUD_FLAGGED" &&
              referral.completionRewardStatus === "PENDING"
            ) {
              const newCount = referral.qualifyingPaymentCount + 1
              const reachedMilestone = newCount >= 10

              await tx.referral.update({
                where: { id: referral.id },
                data: {
                  qualifyingPaymentCount: newCount,
                  status: reachedMilestone ? "COMPLETED" : "ACTIVE",
                  completionRewardStatus: reachedMilestone ? "EARNED" : "PENDING",
                  completedAt: reachedMilestone ? new Date() : null,
                },
              })

              if (reachedMilestone) {
                const milestoneKey = `ref_milestone:${referral.id}`
                const existingMilestone = await tx.cashbackLedger.findUnique({
                  where: { idempotencyKey: milestoneKey },
                })

                if (!existingMilestone) {
                  await tx.cashbackLedger.create({
                    data: {
                      userId: referral.referrerId,
                      amountPaise: 1000,
                      type: "REFERRAL_MILESTONE",
                      status: "EARNED",
                      idempotencyKey: milestoneKey,
                      description: "Referral milestone bonus: friend completed 10 verified payments (₹10)",
                    },
                  })

                  await tx.user.update({
                    where: { id: referral.referrerId },
                    data: {
                      cashbackBalancePaise: { increment: 1000 },
                    },
                  })
                }
              }
            }
          }
        })
      } catch (dbErr: any) {
        if (
          dbErr?.code === "P2002" ||
          String(dbErr?.message || "").includes("processedEventId") ||
          String(dbErr?.message || "").includes("idempotencyKey")
        ) {
          return NextResponse.json({
            received: true,
            idempotent: true,
            replayed: true,
          })
        }
        throw dbErr
      }

      await logSecurityEvent({
        type: "FINANCIAL_SETTLEMENT_RECORDED",
        userId: settlement.payerId,
        details: {
          action: "webhook_verified",
          settlementId,
          provider,
          amountPaise: settlement.amount,
          verificationMethod: "WEBHOOK_HMAC",
          providerTransactionId: transactionId,
          cashbackAwardedPaise: awardedCashbackPaise,
        },
      })

      return NextResponse.json({
        received: true,
        success: true,
        paymentStatus: "WEBHOOK_VERIFIED",
        cashbackAwardedPaise: awardedCashbackPaise,
      })
    } else if (
      eventType.includes("refund") ||
      eventType.includes("reversed") ||
      eventType === "payment.refunded"
    ) {
      // Reversal: If cashback was awarded for this settlement, create a REVERSAL ledger entry
      await prisma.$transaction(async (tx) => {
        const originalCashback = await tx.cashbackLedger.findFirst({
          where: {
            sourcePaymentId: settlement.id,
            type: "PAYMENT_CASHBACK",
            status: "EARNED",
          },
        })
        if (originalCashback) {
          const reversalKey = `reversal:cashback:${originalCashback.id}`
          const existingReversal = await tx.cashbackLedger.findUnique({
            where: { idempotencyKey: reversalKey },
          })
          if (!existingReversal) {
            await tx.cashbackLedger.create({
              data: {
                userId: originalCashback.userId,
                amountPaise: -originalCashback.amountPaise,
                type: "REVERSAL",
                status: "REVERSED",
                sourcePaymentId: settlement.id,
                providerTransactionId: transactionId,
                idempotencyKey: reversalKey,
                description: `Cashback reversed due to payment refund/reversal`,
              },
            })
            await tx.user.update({
              where: { id: originalCashback.userId },
              data: {
                cashbackBalancePaise: { decrement: originalCashback.amountPaise },
              },
            })
          }
        }
      })
      return NextResponse.json({ received: true, success: false, status: "REVERSED" })
    }

    return NextResponse.json({
      received: true,
      success: false,
      status: "IGNORED",
    })
  } catch (error: any) {
    console.error("[WEBHOOK ERROR] Internal processing failure:", error)
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 })
  }
}
