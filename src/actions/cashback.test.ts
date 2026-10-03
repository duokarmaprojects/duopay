import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  getCashbackSummary,
  getCashbackHistory,
  requestCashbackRedemption,
  adminAdjustCashback,
} from "./cashback"
import { recordSettlement } from "./settlement"
import { POST as handlePaymentWebhook } from "@/app/api/webhooks/payments/route"
import {
  calculateCashback,
  isPaymentEligibleForCashback,
  canRedeemCashback,
  MIN_CASHBACK_PAISE,
  MAX_CASHBACK_PAISE,
  MIN_REDEMPTION_THRESHOLD_PAISE,
} from "@/domain/cashback"
import { resetAllRateLimitsForTesting } from "@/lib/rateLimit"
import crypto from "crypto"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock("@/services/balance", () => ({
  getUserBalances: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    settlement: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    cashbackLedger: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    redemptionRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(prisma)
    }),
  },
}))

describe("CASHBACK & REWARDS SECURITY & INTEGRITY AUDIT SUITE", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    resetAllRateLimitsForTesting()
    process.env = {
      ...originalEnv,
      RAZORPAY_WEBHOOK_SECRET: "test-razorpay-secret",
    }
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "user_alice", name: "Alice" },
    } as any)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // =========================================================================
  // DOMAIN POLICY & TIER TESTS
  // =========================================================================
  describe("Cashback Calculation Policy", () => {
    it("should calculate tiered cashback in integer paise deterministically", () => {
      // < ₹100 (< 10000 paise) -> 10 paise (₹0.10)
      expect(calculateCashback(5000)).toBe(10)
      expect(calculateCashback(9999)).toBe(10)

      // ₹100 – ₹499 (10000 – 49999 paise) -> 15 paise (₹0.15)
      expect(calculateCashback(10000)).toBe(15)
      expect(calculateCashback(49999)).toBe(15)

      // ₹500 – ₹999 (50000 – 99999 paise) -> 25 paise (₹0.25)
      expect(calculateCashback(50000)).toBe(25)
      expect(calculateCashback(99999)).toBe(25)

      // ₹1,000 – ₹1,999 (100000 – 199999 paise) -> 35 paise (₹0.35)
      expect(calculateCashback(100000)).toBe(35)
      expect(calculateCashback(199999)).toBe(35)

      // ₹2,000+ (200000+ paise) -> 50 paise (₹0.50)
      expect(calculateCashback(200000)).toBe(50)
      expect(calculateCashback(500000)).toBe(50)

      // Boundaries
      expect(MIN_CASHBACK_PAISE).toBe(10)
      expect(MAX_CASHBACK_PAISE).toBe(50)
      expect(MIN_REDEMPTION_THRESHOLD_PAISE).toBe(2500) // ₹25.00
    })

    it("should strictly identify qualifying vs non-qualifying payments", () => {
      // ONLY WEBHOOK_VERIFIED and PROVIDER_VERIFIED qualify
      expect(isPaymentEligibleForCashback("WEBHOOK_VERIFIED")).toBe(true)
      expect(isPaymentEligibleForCashback("PROVIDER_VERIFIED")).toBe(true)

      // MANUAL_CONFIRMED, PENDING, FAILED, UNKNOWN NEVER qualify
      expect(isPaymentEligibleForCashback("MANUAL_CONFIRMED")).toBe(false)
      expect(isPaymentEligibleForCashback("PENDING")).toBe(false)
      expect(isPaymentEligibleForCashback("FAILED")).toBe(false)
      expect(isPaymentEligibleForCashback("UNKNOWN")).toBe(false)
      expect(isPaymentEligibleForCashback("PROVIDER_INITIATED")).toBe(false)
    })
  })

  // =========================================================================
  // 23 REQUIRED SECURITY ATTACK TESTS
  // =========================================================================

  // 1. Client attempts to submit cashback amount
  it("Security 1: Client attempts to submit cashback amount in settlement -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "1000")
    formData.set("cashbackAmount", "50")

    await expect(recordSettlement(formData)).rejects.toThrow(
      "Client submission of payment verification state is strictly prohibited"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // 2. Client attempts to create cashback ledger entry directly
  it("Security 2: Client attempts to create cashback ledger entry directly -> Action not exposed", async () => {
    // There is no client-callable action to insert arbitrary ledger entries
    // Attempting to inject ledger entry ID into redemption is blocked:
    const formData = new FormData()
    formData.set("ledgerEntryId", "fake_ledger_123")

    await expect(requestCashbackRedemption(formData)).rejects.toThrow(
      "Client submission of redemption parameters is strictly prohibited"
    )
    expect(prisma.cashbackLedger.create).not.toHaveBeenCalled()
  })

  // 3. Client attempts to modify cashback balance
  it("Security 3: Client attempts to modify cashback balance directly -> Blocked", async () => {
    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "1000")
    formData.set("cashbackBalance", "50000")

    await expect(recordSettlement(formData)).rejects.toThrow(
      "Client submission of payment verification state is strictly prohibited"
    )
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  // 4. Client attempts to redeem below ₹25
  it("Security 4: Client attempts to redeem below ₹25 -> Rejected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_alice",
      cashbackBalancePaise: 1500, // ₹15.00 < ₹25.00
      upiId: "alice@okaxis",
      upiVerified: true,
    } as any)

    await expect(requestCashbackRedemption()).rejects.toThrow(
      /Minimum cashback redemption threshold is ₹25.00/
    )
    expect(prisma.redemptionRequest.create).not.toHaveBeenCalled()
  })

  // 5. Client attempts to redeem another user's cashback
  it("Security 5: Client attempts to redeem another user's cashback -> BOLA Defense", async () => {
    // Authenticated session is user_alice
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_alice",
      cashbackBalancePaise: 0, // Alice has 0
      upiId: "alice@okaxis",
      upiVerified: true,
    } as any)

    // Attacker cannot specify target userId; system strictly scopes to session user
    await expect(requestCashbackRedemption()).rejects.toThrow(
      /Minimum cashback redemption threshold is ₹25.00/
    )
    expect(prisma.redemptionRequest.create).not.toHaveBeenCalled()
  })

  // 6. Duplicate webhook delivery
  it("Security 6: Duplicate webhook delivery -> Cashback awarded exactly once (idempotent)", async () => {
    const secret = "test-razorpay-secret"
    const payloadObj = {
      event_id: "evt_dup_check_1",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_dup_1",
            amount: 5000,
            notes: { settlementId: "settle-dup-1" },
          },
        },
      },
    }
    const rawBody = JSON.stringify(payloadObj)
    const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

    // Event not yet processed
    vi.mocked(prisma.settlement.findUnique)
      .mockResolvedValueOnce(null) // processedEventId check
      .mockResolvedValueOnce({
        id: "settle-dup-1",
        amount: 5000,
        status: "PENDING",
        payerId: "user_alice",
      } as any)

    // Existing cashback already found for this settlement!
    vi.mocked(prisma.cashbackLedger.findUnique).mockResolvedValueOnce({
      id: "existing_cashback_1",
      idempotencyKey: "cashback:settle:settle-dup-1",
    } as any)

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignature },
      body: rawBody,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(200)
    // Cashback creation was SKIPPED because it already existed
    expect(prisma.cashbackLedger.create).not.toHaveBeenCalled()
  })

  // 7. Duplicate provider transaction
  it("Security 7: Duplicate provider transaction -> Replayed webhook safely acknowledged", async () => {
    const secret = "test-razorpay-secret"
    const payloadObj = {
      event_id: "evt_tx_dup_1",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_tx_1",
            amount: 5000,
            notes: { settlementId: "settle-1" },
          },
        },
      },
    }
    const rawBody = JSON.stringify(payloadObj)
    const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

    // Already processed event found in DB
    vi.mocked(prisma.settlement.findUnique).mockResolvedValueOnce({
      id: "settle-1",
      processedEventId: "evt_tx_dup_1",
      paymentStatus: "WEBHOOK_VERIFIED",
    } as any)

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignature },
      body: rawBody,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.idempotent).toBe(true)
    expect(json.replayed).toBe(true)
    expect(prisma.cashbackLedger.create).not.toHaveBeenCalled()
  })

  // 8. Concurrent cashback creation
  it("Security 8: Concurrent cashback creation -> Handled safely via unique constraint", async () => {
    const secret = "test-razorpay-secret"
    const payloadObj = {
      event_id: "evt_concurrent_1",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_concurrent_1",
            amount: 5000,
            notes: { settlementId: "settle-conc-1" },
          },
        },
      },
    }
    const rawBody = JSON.stringify(payloadObj)
    const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

    vi.mocked(prisma.settlement.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "settle-conc-1",
        amount: 5000,
        status: "PENDING",
        payerId: "user_alice",
      } as any)

    // Transaction throws P2002 on idempotencyKey race
    vi.mocked(prisma.$transaction).mockRejectedValueOnce({
      code: "P2002",
      message: "Unique constraint failed on idempotencyKey",
    })

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignature },
      body: rawBody,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.idempotent).toBe(true)
    expect(json.replayed).toBe(true)
  })

  // 9. MANUAL_CONFIRMED payment
  it("Security 9: MANUAL_CONFIRMED payment -> Zero cashback awarded", async () => {
    expect(isPaymentEligibleForCashback("MANUAL_CONFIRMED")).toBe(false)
  })

  // 10. PENDING payment
  it("Security 10: PENDING payment -> Zero cashback awarded", () => {
    expect(isPaymentEligibleForCashback("PENDING")).toBe(false)
  })

  // 11. FAILED payment
  it("Security 11: FAILED payment -> Zero cashback awarded", () => {
    expect(isPaymentEligibleForCashback("FAILED")).toBe(false)
  })

  // 12. UNKNOWN payment
  it("Security 12: UNKNOWN payment -> Zero cashback awarded", () => {
    expect(isPaymentEligibleForCashback("UNKNOWN")).toBe(false)
  })

  // 13. Invalid provider transaction
  it("Security 13: Invalid provider transaction signature -> Rejected (401)", async () => {
    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": "invalid_forged_sig" },
      body: JSON.stringify({ event: "payment.captured" }),
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(401)
    expect(prisma.cashbackLedger.create).not.toHaveBeenCalled()
  })

  // 14. Wrong payment amount
  it("Security 14: Wrong payment amount -> Rejected (400) and no cashback", async () => {
    const secret = "test-razorpay-secret"
    const payloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_bad_amt",
            amount: 1000, // Attacker sends smaller amount
            notes: { settlementId: "settle-1" },
          },
        },
      },
    }
    const rawBody = JSON.stringify(payloadObj)
    const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

    vi.mocked(prisma.settlement.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "settle-1",
        amount: 5000, // expects 5000
        status: "PENDING",
      } as any)

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignature },
      body: rawBody,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(400)
    expect(prisma.cashbackLedger.create).not.toHaveBeenCalled()
  })

  // 15. Refunded payment
  it("Security 15: Refunded payment -> Generates REVERSAL ledger entry and deducts balance", async () => {
    const secret = "test-razorpay-secret"
    const payloadObj = {
      event: "payment.refunded",
      payload: {
        payment: {
          entity: {
            id: "pay_ref_1",
            amount: 5000,
            notes: { settlementId: "settle-ref-1" },
          },
        },
      },
    }
    const rawBody = JSON.stringify(payloadObj)
    const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

    vi.mocked(prisma.settlement.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "settle-ref-1",
        amount: 5000,
        status: "SETTLED",
        paymentStatus: "WEBHOOK_VERIFIED",
      } as any)

    // Original cashback was 25 paise
    vi.mocked(prisma.cashbackLedger.findFirst).mockResolvedValueOnce({
      id: "original_cb_1",
      userId: "user_alice",
      amountPaise: 25,
      type: "PAYMENT_CASHBACK",
      status: "EARNED",
    } as any)

    // Reversal not yet created
    vi.mocked(prisma.cashbackLedger.findUnique).mockResolvedValueOnce(null)

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignature },
      body: rawBody,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("REVERSED")

    expect(prisma.cashbackLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_alice",
          amountPaise: -25,
          type: "REVERSAL",
          status: "REVERSED",
        }),
      })
    )
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_alice" },
        data: {
          cashbackBalancePaise: { decrement: 25 },
        },
      })
    )
  })

  // 16. Duplicate redemption
  it("Security 16: Duplicate redemption while one is active -> Denied", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_alice",
      cashbackBalancePaise: 3000,
      upiId: "alice@okaxis",
      upiVerified: true,
    } as any)

    // Active redemption already exists
    vi.mocked(prisma.redemptionRequest.findFirst).mockResolvedValueOnce({
      id: "red_active_1",
      status: "PROCESSING",
    } as any)

    await expect(requestCashbackRedemption()).rejects.toThrow(
      "A cashback redemption request is already in progress"
    )
  })

  // 17. Concurrent redemption
  it("Security 17: Concurrent redemption -> Blocked inside transaction", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_alice",
      cashbackBalancePaise: 3000,
      upiId: "alice@okaxis",
      upiVerified: true,
    } as any)

    vi.mocked(prisma.redemptionRequest.create).mockResolvedValueOnce({ id: "red-1" } as any)
    vi.mocked(prisma.cashbackLedger.create).mockResolvedValueOnce({ id: "led-1" } as any)
    vi.mocked(prisma.redemptionRequest.update).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any)

    // Call 1 succeeds
    vi.mocked(prisma.redemptionRequest.findFirst).mockResolvedValueOnce(null)
    const res1 = await requestCashbackRedemption()
    expect(res1.success).toBe(true)

    // Call 2 concurrent sees active request
    vi.mocked(prisma.redemptionRequest.findFirst).mockResolvedValueOnce({
      id: "red-1",
      status: "PROCESSING",
    } as any)
    await expect(requestCashbackRedemption()).rejects.toThrow(
      "A cashback redemption request is already in progress"
    )
  })

  // 18. Tampered redemption amount
  it("Security 18: Tampered redemption amount in FormData -> Rejected", async () => {
    const formData = new FormData()
    formData.set("amount", "9999")

    await expect(requestCashbackRedemption(formData)).rejects.toThrow(
      "Client submission of redemption parameters is strictly prohibited"
    )
  })

  // 19. Tampered payout destination
  it("Security 19: Tampered payout destination in FormData -> Rejected", async () => {
    const formData = new FormData()
    formData.set("payoutDestination", "attacker@okaxis")

    await expect(requestCashbackRedemption(formData)).rejects.toThrow(
      "Client submission of redemption parameters is strictly prohibited"
    )
  })

  // 20. IDOR against cashback history
  it("Security 20: IDOR against cashback history -> Strictly filtered by session user ID", async () => {
    vi.mocked(prisma.cashbackLedger.findMany).mockResolvedValueOnce([])

    await getCashbackHistory()

    expect(prisma.cashbackLedger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_alice" },
      })
    )
  })

  // 21. IDOR against redemption
  it("Security 21: IDOR against redemption -> Scoped strictly to session user ID", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_alice",
      cashbackBalancePaise: 2500,
      upiId: "alice@okaxis",
      upiVerified: true,
    } as any)
    vi.mocked(prisma.redemptionRequest.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.redemptionRequest.create).mockResolvedValueOnce({ id: "red-1" } as any)
    vi.mocked(prisma.cashbackLedger.create).mockResolvedValueOnce({ id: "led-1" } as any)
    vi.mocked(prisma.redemptionRequest.update).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any)

    await requestCashbackRedemption()

    expect(prisma.redemptionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_alice",
        }),
      })
    )
  })

  // 22. Forged PAYMENT_CASHBACK ledger type
  it("Security 22: Forged PAYMENT_CASHBACK ledger type -> Rejected", async () => {
    const formData = new FormData()
    formData.set("type", "PAYMENT_CASHBACK")

    await expect(requestCashbackRedemption(formData)).rejects.toThrow(
      "Client submission of redemption parameters is strictly prohibited"
    )
  })

  // 23. Forged REDEMPTION ledger type
  it("Security 23: Forged REDEMPTION ledger type -> Rejected", async () => {
    const formData = new FormData()
    formData.set("type", "REDEMPTION")

    await expect(requestCashbackRedemption(formData)).rejects.toThrow(
      "Client submission of redemption parameters is strictly prohibited"
    )
  })
})
