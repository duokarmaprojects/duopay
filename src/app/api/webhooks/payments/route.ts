import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { logSecurityEvent } from "@/lib/securityAudit"
import { isAllowedSettlementTransition } from "@/lib/security"

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

    if (provider === "razorpay") {
      eventType = payload.event || ""
      const paymentEntity = payload.payload?.payment?.entity
      transactionId = paymentEntity?.id || null
      settlementId = paymentEntity?.notes?.settlementId || null
      amountInPaise = paymentEntity?.amount || null
      isSuccessEvent = eventType === "payment.captured" || eventType === "order.paid"
    } else if (provider === "cashfree") {
      eventType = payload.type || payload.event || ""
      const order = payload.data?.order || payload.order
      const payment = payload.data?.payment || payload.payment
      transactionId = payment?.payment_id ? String(payment.payment_id) : null
      settlementId = order?.order_tags?.settlementId || order?.order_id || null
      amountInPaise = order?.order_amount ? Math.round(order.order_amount * 100) : null
      isSuccessEvent = eventType === "PAYMENT_SUCCESS_WEBHOOK" || payment?.payment_status === "SUCCESS"
    }

    if (!settlementId) {
      // Not a settlement-related webhook, acknowledge receipt safely
      return NextResponse.json({ received: true, handled: false })
    }

    // =========================================================================
    // 4. DATABASE TRANSACTION & ATOMIC RECONCILIATION
    // =========================================================================
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

    // Idempotency: duplicate webhooks must not duplicate or corrupt settlement
    if (settlement.status === "SETTLED" || settlement.status === "COMPLETED") {
      return NextResponse.json({ received: true, idempotent: true, status: settlement.status })
    }

    if (isSuccessEvent) {
      if (!isAllowedSettlementTransition(settlement.status, "SETTLED")) {
        return NextResponse.json({ error: "Invalid settlement state transition" }, { status: 409 })
      }

      await prisma.$transaction(async (tx) => {
        await tx.settlement.update({
          where: { id: settlementId },
          data: {
            status: "SETTLED",
            paymentStatus: "PAYMENT_SUCCESS",
            paymentProvider: provider,
            providerTransactionId: transactionId,
            paymentCompletedAt: new Date(),
            settledAt: new Date(),
          },
        })
      })

      await logSecurityEvent({
        type: "FINANCIAL_SETTLEMENT_RECORDED",
        userId: settlement.payerId,
        details: {
          action: "webhook_reconciled",
          settlementId,
          provider,
          amountPaise: settlement.amount,
        },
      })
    }

    return NextResponse.json({ received: true, success: true })
  } catch (error: any) {
    console.error("[WEBHOOK ERROR] Internal processing failure:", error)
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 })
  }
}
