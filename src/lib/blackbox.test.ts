import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { auth } from "./auth"
import { prisma } from "./db"
import { recordSettlement } from "@/actions/settlement"
import { addExpense } from "@/actions/expense"
import { joinGroupWithInviteToken } from "@/actions/group"
import { updateUserSettings } from "@/actions/settings"
import { updateUpiId } from "@/actions/user"
import { getUserBalances } from "@/services/balance"
import { POST as handlePaymentWebhook } from "@/app/api/webhooks/payments/route"
import { generateGroupInviteToken } from "./invite"
import { isPaymentVerified, isPaymentManual } from "@/domain/payment"
import { resetAllRateLimitsForTesting } from "./rateLimit"
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
    receiptScan: { create: async () => ({ id: 'scan-1', status: 'PENDING' }), findUnique: async () => null, update: async () => null, findMany: async () => [] },
    orderImport: { create: async () => null, findUnique: async () => null, update: async () => null, findMany: async () => [] },
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    settlement: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    expenseParticipant: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(prisma)
    }),
  },
}))

describe("DUOPAY BLACK-BOX PAYMENT & ACCESS SECURITY ATTACK SUITE", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    resetAllRateLimitsForTesting()
    process.env = {
      ...originalEnv,
      RAZORPAY_WEBHOOK_SECRET: "test-razorpay-secret",
      CASHFREE_CLIENT_SECRET: "test-cashfree-secret",
    }
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "attacker_alice", name: "Alice Attacker" },
    } as any)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // =========================================================================
  // ATTACK 1: Mark a payment SUCCESS from the browser
  // =========================================================================
  it("Attack 1: Mark a payment SUCCESS from the browser -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "victim_bob")
    formData.set("amountPaise", "1000")
    formData.set("status", "SUCCESS")

    let errorThrown: any = null
    try {
      await recordSettlement(formData)
    } catch (err: any) {
      errorThrown = err
    }

    expect(errorThrown).not.toBeNull()
    expect(errorThrown.message).toContain("Client submission of payment verification state is strictly prohibited")
    expect(prisma.settlement.create).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MALICIOUS_INPUT_BLOCKED",
          userId: "attacker_alice",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 2: Submit WEBHOOK_VERIFIED manually
  // =========================================================================
  it("Attack 2: Submit WEBHOOK_VERIFIED manually -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "victim_bob")
    formData.set("amountPaise", "1000")
    formData.set("paymentStatus", "WEBHOOK_VERIFIED")

    let errorThrown: any = null
    try {
      await recordSettlement(formData)
    } catch (err: any) {
      errorThrown = err
    }

    expect(errorThrown).not.toBeNull()
    expect(errorThrown.message).toContain("Client submission of payment verification state is strictly prohibited")
    expect(prisma.settlement.create).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MALICIOUS_INPUT_BLOCKED",
          userId: "attacker_alice",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 3: Change verifiedAmount
  // =========================================================================
  it("Attack 3: Change verifiedAmount -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "victim_bob")
    formData.set("amountPaise", "1000")
    formData.set("verifiedAmount", "999999")

    let errorThrown: any = null
    try {
      await recordSettlement(formData)
    } catch (err: any) {
      errorThrown = err
    }

    expect(errorThrown).not.toBeNull()
    expect(errorThrown.message).toContain("Client submission of payment verification state is strictly prohibited")
    expect(prisma.settlement.create).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MALICIOUS_INPUT_BLOCKED",
          userId: "attacker_alice",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 4: Change providerTransactionId
  // =========================================================================
  it("Attack 4: Change providerTransactionId -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "victim_bob")
    formData.set("amountPaise", "1000")
    formData.set("providerTransactionId", "fake_utr_tx_9999")

    let errorThrown: any = null
    try {
      await recordSettlement(formData)
    } catch (err: any) {
      errorThrown = err
    }

    expect(errorThrown).not.toBeNull()
    expect(errorThrown.message).toContain("Client submission of payment verification state is strictly prohibited")
    expect(prisma.settlement.create).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MALICIOUS_INPUT_BLOCKED",
          userId: "attacker_alice",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 5: Change payerId
  // =========================================================================
  it("Attack 5: Change payerId to victim -> Ignored/Bound strictly to session", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "victim_bob",
      name: "Bob",
      upiId: "bob@oksbi",
    } as any)

    // Attacker does NOT owe victim_bob anything
    vi.mocked(getUserBalances).mockResolvedValueOnce({
      totalOwedToUser: 0,
      totalUserOwes: 0,
      detailedBalances: [],
    })

    const formData = new FormData()
    formData.set("payerId", "victim_charlie") // Attempting to debit Charlie
    formData.set("receiverId", "victim_bob")
    formData.set("amountPaise", "1000")

    // The system evaluates session user (attacker_alice) instead of victim_charlie
    await expect(recordSettlement(formData)).rejects.toThrow(
      "You do not have an outstanding balance to settle with this user"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // ATTACK 6: Change receiverId
  // =========================================================================
  it("Attack 6: Change receiverId to user without outstanding balance -> Rejected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "unrelated_user_dave",
      name: "Dave",
      upiId: "dave@okhdfc",
    } as any)

    vi.mocked(getUserBalances).mockResolvedValueOnce({
      totalOwedToUser: 0,
      totalUserOwes: 5000,
      detailedBalances: [
        {
          userId: "victim_bob", // Attacker owes Bob, not Dave
          userName: "Bob",
          amount: 5000,
          type: "USER_OWES",
        },
      ],
    })

    const formData = new FormData()
    formData.set("receiverId", "unrelated_user_dave")
    formData.set("amountPaise", "1000")

    await expect(recordSettlement(formData)).rejects.toThrow(
      "You do not have an outstanding balance to settle with this user"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "FINANCIAL_INVALID_TRANSACTION_BLOCKED",
          userId: "attacker_alice",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 7: Change settlement amount
  // =========================================================================
  it("Attack 7: Change settlement amount exceeding owed debt -> Rejected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "victim_bob",
      name: "Bob",
      upiId: "bob@oksbi",
    } as any)

    // Attacker only owes 500 paise (₹5.00)
    vi.mocked(getUserBalances).mockResolvedValueOnce({
      totalOwedToUser: 0,
      totalUserOwes: 500,
      detailedBalances: [
        {
          userId: "victim_bob",
          userName: "Bob",
          amount: 500,
          type: "USER_OWES",
        },
      ],
    })

    const formData = new FormData()
    formData.set("receiverId", "victim_bob")
    formData.set("amountPaise", "5000") // Attacker submits 5000 paise (₹50.00)

    await expect(recordSettlement(formData)).rejects.toThrow(
      /Settlement amount exceeds outstanding balance/
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "FINANCIAL_INVALID_TRANSACTION_BLOCKED",
          userId: "attacker_alice",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 8: Replay a valid webhook
  // =========================================================================
  it("Attack 8: Replay a valid webhook -> Idempotent Replay Handled Safely", async () => {
    const secret = "test-razorpay-secret"
    const payloadObj = {
      event_id: "evt_legit_replay_100",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_legit_100",
            amount: 5000,
            notes: { settlementId: "settle-100" },
          },
        },
      },
    }
    const rawBody = JSON.stringify(payloadObj)
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex")

    // The event was ALREADY processed in the database
    vi.mocked(prisma.settlement.findUnique).mockResolvedValueOnce({
      id: "settle-100",
      processedEventId: "evt_legit_replay_100",
      paymentStatus: "WEBHOOK_VERIFIED",
      status: "SETTLED",
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
    expect(prisma.settlement.update).not.toHaveBeenCalled() // DB NOT modified again
  })

  // =========================================================================
  // ATTACK 9: Send a valid webhook with a different amount
  // =========================================================================
  it("Attack 9: Send a valid webhook with a different amount -> Rejected (400)", async () => {
    const secret = "test-razorpay-secret"
    const payloadObj = {
      event_id: "evt_underpay_200",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_underpay_200",
            amount: 2000, // Attacker paid 2000 paise instead of 5000
            notes: { settlementId: "settle-200" },
          },
        },
      },
    }
    const rawBody = JSON.stringify(payloadObj)
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex")

    vi.mocked(prisma.settlement.findUnique)
      .mockResolvedValueOnce(null) // processedEventId check
      .mockResolvedValueOnce({
        id: "settle-200",
        amount: 5000, // Settlement expected 5000
        status: "PENDING",
      } as any)

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignature },
      body: rawBody,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Amount mismatch")
    expect(prisma.settlement.update).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "FINANCIAL_INVALID_TRANSACTION_BLOCKED",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 10: Send a valid webhook for another settlement
  // =========================================================================
  it("Attack 10: Send a valid webhook for non-existent settlement -> Rejected (404)", async () => {
    const secret = "test-razorpay-secret"
    const payloadObj = {
      event_id: "evt_fake_settle_300",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_fake_300",
            amount: 5000,
            notes: { settlementId: "nonexistent_settle_999" },
          },
        },
      },
    }
    const rawBody = JSON.stringify(payloadObj)
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex")

    vi.mocked(prisma.settlement.findUnique)
      .mockResolvedValueOnce(null) // processedEventId check
      .mockResolvedValueOnce(null) // settlement record not found

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignature },
      body: rawBody,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe("Settlement record not found")
    expect(prisma.settlement.update).not.toHaveBeenCalled()
  })

  // =========================================================================
  // ATTACK 11: Send an expired webhook
  // =========================================================================
  it("Attack 11: Send an expired webhook -> Rejected (400)", async () => {
    const secret = "test-cashfree-secret"
    // Timestamp from 10 minutes ago (> 5 min limit)
    const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 600)
    const rawBody = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK" })
    const signaturePayload = `${expiredTimestamp}${rawBody}`
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(signaturePayload)
      .digest("base64")

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: {
        "x-webhook-signature": validSignature,
        "x-webhook-timestamp": expiredTimestamp,
      },
      body: rawBody,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Webhook timestamp expired")
    expect(prisma.settlement.update).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "AUTH_UNAUTHORIZED_ACCESS",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 12: Send an invalid HMAC
  // =========================================================================
  it("Attack 12: Send an invalid HMAC -> Rejected (401)", async () => {
    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": "forged_deadbeef_signature" },
      body: JSON.stringify({ event: "payment.captured" }),
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Invalid webhook signature")
    expect(prisma.settlement.update).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "AUTH_UNAUTHORIZED_ACCESS",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 13: Send a webhook with modified payload
  // =========================================================================
  it("Attack 13: Send a webhook with modified payload -> Rejected (401)", async () => {
    const secret = "test-razorpay-secret"
    const originalPayload = JSON.stringify({ event: "payment.captured", amount: 1000 })
    const validSignatureForOriginal = crypto
      .createHmac("sha256", secret)
      .update(originalPayload)
      .digest("hex")

    // Attacker modifies payload to amount: 999999 but keeps original signature
    const tamperedPayload = JSON.stringify({ event: "payment.captured", amount: 999999 })

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: { "x-razorpay-signature": validSignatureForOriginal },
      body: tamperedPayload,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Invalid webhook signature")
    expect(prisma.settlement.update).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "AUTH_UNAUTHORIZED_ACCESS",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 14: Submit duplicate settlement requests concurrently
  // =========================================================================
  it("Attack 14: Submit duplicate settlement requests concurrently -> Exactly 1 Created", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "victim_bob",
      name: "Bob",
      upiId: "bob@oksbi",
    } as any)

    vi.mocked(getUserBalances).mockResolvedValue({
      totalOwedToUser: 0,
      totalUserOwes: 1000,
      detailedBalances: [
        {
          userId: "victim_bob",
          userName: "Bob",
          amount: 1000,
          type: "USER_OWES",
        },
      ],
    })

    const sharedIdempotencyKey = "concurrent-settle-key-555"

    // Request 1: settlement does not exist yet -> creates it
    vi.mocked(prisma.settlement.findUnique).mockResolvedValueOnce(null)

    // Request 2 (concurrent / immediate replay): settlement already found with this key
    vi.mocked(prisma.settlement.findUnique).mockResolvedValueOnce({
      id: "settle-already-created",
      idempotencyKey: sharedIdempotencyKey,
    } as any)

    const form1 = new FormData()
    form1.set("receiverId", "victim_bob")
    form1.set("amountPaise", "1000")
    form1.set("idempotencyKey", sharedIdempotencyKey)

    const form2 = new FormData()
    form2.set("receiverId", "victim_bob")
    form2.set("amountPaise", "1000")
    form2.set("idempotencyKey", sharedIdempotencyKey)

    // Run both calls
    await expect(recordSettlement(form1)).rejects.toThrow("REDIRECT:/")
    await expect(recordSettlement(form2)).rejects.toThrow("REDIRECT:/")

    // Database create was called EXACTLY ONCE
    expect(prisma.settlement.create).toHaveBeenCalledTimes(1)
  })

  // =========================================================================
  // ATTACK 15: Submit duplicate expense requests concurrently
  // =========================================================================
  it("Attack 15: Submit duplicate expense requests concurrently -> Exactly 1 Created", async () => {
    vi.mocked(prisma.groupMember.findMany).mockResolvedValue([
      { userId: "attacker_alice" },
      { userId: "victim_bob" },
    ] as any)

    const sharedIdempotencyKey = "concurrent-expense-key-777"

    // Request 1: expense does not exist -> creates it
    vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.expense.create).mockResolvedValueOnce({
      id: "exp-1",
      groupId: "group-1",
    } as any)

    // Request 2 (concurrent replay): expense already found with key
    vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
      id: "expense-already-created",
      idempotencyKey: sharedIdempotencyKey,
      groupId: "group-1",
    } as any)

    const form1 = new FormData()
    form1.set("groupId", "group-1")
    form1.set("description", "Team Dinner")
    form1.set("amount", "100")
    form1.set("payerId", "attacker_alice")
    form1.append("participants", "attacker_alice")
    form1.append("participants", "victim_bob")
    form1.set("idempotencyKey", sharedIdempotencyKey)

    const form2 = new FormData()
    form2.set("groupId", "group-1")
    form2.set("description", "Team Dinner")
    form2.set("amount", "100")
    form2.set("payerId", "attacker_alice")
    form2.append("participants", "attacker_alice")
    form2.append("participants", "victim_bob")
    form2.set("idempotencyKey", sharedIdempotencyKey)

    await expect(addExpense(form1)).rejects.toThrow("REDIRECT:/groups/group-1")
    await expect(addExpense(form2)).rejects.toThrow("REDIRECT:/groups/group-1")

    expect(prisma.expense.create).toHaveBeenCalledTimes(1)
  })

  // =========================================================================
  // ATTACK 16: Change another user's settings
  // =========================================================================
  it("Attack 16: Change another user's settings -> Blocked (BOLA/IDOR Defense)", async () => {
    vi.mocked(prisma.userSettings.upsert).mockResolvedValueOnce({
      userId: "attacker_alice",
      currency: "EUR",
      defaultSplitMethod: "EQUAL",
      simplifyDebts: true,
      expenseAlerts: true,
      paymentReminders: true,
      groupActivityAlerts: true,
      pushNotifications: false,
      discoverableByPhone: true,
      shareActivityInGroup: true,
      showUpiOnProfile: true,
    } as any)

    // Attacker attempts to mutate victim_bob's settings by sending victim_bob as target
    const maliciousInput: any = {
      userId: "victim_bob",
      currency: "EUR",
    }

    const res = await updateUserSettings(maliciousInput)
    expect(res.success).toBe(true)

    // The database upsert strictly applies to session user (attacker_alice), NOT victim_bob
    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "attacker_alice" },
        create: expect.objectContaining({ userId: "attacker_alice" }),
      })
    )
  })

  // =========================================================================
  // ATTACK 17: Change another user's UPI ID
  // =========================================================================
  it("Attack 17: Change another user's UPI ID -> Strictly Isolated", async () => {
    // Current user in DB is attacker_alice
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "attacker_alice",
      upiId: "alice@okaxis",
    } as any)

    await updateUpiId("alice@okaxis")

    // The update strictly targets session user, cannot touch victim
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attacker_alice" },
        data: {
          upiId: "alice@okaxis",
        },
      })
    )
  })

  // =========================================================================
  // ATTACK 18: Redeem an invite after expiry
  // =========================================================================
  it("Attack 18: Redeem an invite after expiry -> Rejected", async () => {
    // Token expired in the past (-1 hour)
    const expiredToken = generateGroupInviteToken("group-target", "inviter_user", -1)

    await expect(
      joinGroupWithInviteToken("group-target", expiredToken)
    ).rejects.toThrow("Invite link has expired")

    expect(prisma.groupMember.create).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "AUTH_UNAUTHORIZED_ACCESS",
          userId: "attacker_alice",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 19: Modify groupId during invite redemption
  // =========================================================================
  it("Attack 19: Modify groupId during invite redemption -> Rejected", async () => {
    // Token generated for group-public-1
    const validTokenForGroup1 = generateGroupInviteToken("group-public-1", "inviter_user", 7 * 24)

    // Attacker attempts to redeem token for secret group-private-99
    await expect(
      joinGroupWithInviteToken("group-private-99", validTokenForGroup1)
    ).rejects.toThrow(/Invite token does not match this group|Invalid invite token/)

    expect(prisma.groupMember.create).not.toHaveBeenCalled()
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "AUTH_UNAUTHORIZED_ACCESS",
          userId: "attacker_alice",
        }),
      })
    )
  })

  // =========================================================================
  // ATTACK 20: Attempt to count MANUAL_CONFIRMED as a qualifying referral payment
  // =========================================================================
  it("Attack 20: Attempt to count MANUAL_CONFIRMED as qualifying referral payment -> Evaluates False", () => {
    // A manual peer-to-peer confirmation ("Yes, Mark as Paid")
    const manualStatus = "MANUAL_CONFIRMED"

    // Qualifying checks must return false
    expect(isPaymentVerified(manualStatus)).toBe(false)
    expect(isPaymentManual(manualStatus)).toBe(true)

    // Only provider-verified payments qualify
    expect(isPaymentVerified("WEBHOOK_VERIFIED")).toBe(true)
    expect(isPaymentVerified("PROVIDER_VERIFIED")).toBe(true)
  })
})



