import { describe, it, expect, vi, beforeEach } from "vitest"
import { recordSettlement } from "@/actions/settlement"
import { addExpense } from "@/actions/expense"
import { requestCashbackRedemption, adminAdjustCashback } from "@/actions/cashback"
import { applyReferralCode } from "@/actions/referral"
import { POST as handlePaymentWebhook } from "@/app/api/webhooks/payments/route"
import { updateUserSettings } from "@/actions/settings"
import { getUserBalances } from "@/services/balance"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { resetAllRateLimitsForTesting } from "@/lib/rateLimit"
import crypto from "crypto"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/services/balance", () => ({
  getUserBalances: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      userSettings: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      group: {
        findUnique: vi.fn(),
      },
      groupMember: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      expense: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      expenseParticipant: {
        createMany: vi.fn(),
      },
      settlement: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      cashbackLedger: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      redemptionRequest: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      referral: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      analyticsEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (callback) => {
        return callback(prisma)
      }),
    },
  }
})

describe("DUOPAY ZERO-TRUST FINANCIAL MANIPULATION HARDENING SUITE", () => {
  const SESSION_USER_ID = "user_alice"

  beforeEach(() => {
    vi.clearAllMocks()
    resetAllRateLimitsForTesting()

    // Default authenticated session
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: SESSION_USER_ID, name: "Alice", email: "alice@duopay.test" },
    })

    // Default session user DB lookup
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: SESSION_USER_ID,
      name: "Alice",
      role: "USER",
      upiId: "alice@okaxis",
      cashbackBalancePaise: 5000, // ₹50.00
    } as any)

    // Default settlement count
    vi.mocked(prisma.settlement.count).mockResolvedValue(0)
  })

  // =========================================================================
  // VECTOR A: NORMAL VALID REQUEST
  // =========================================================================
  it("Vector A: Normal valid settlement request -> Succeeds", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_bob",
      name: "Bob",
      upiId: "bob@oksbi",
    } as any)

    vi.mocked(getUserBalances).mockResolvedValueOnce({
      totalOwedToUser: 0,
      totalUserOwes: 10000,
      detailedBalances: [
        {
          userId: "user_bob",
          userName: "Bob",
          amount: 5000,
          type: "USER_OWES",
        },
      ],
    })

    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "5000") // Exact ₹50 debt

    await expect(recordSettlement(formData)).rejects.toThrow("REDIRECT:/")

    expect(prisma.settlement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payerId: SESSION_USER_ID,
          receiverId: "user_bob",
          amount: 5000,
          status: "COMPLETED",
          paymentStatus: "MANUAL_CONFIRMED",
        }),
      })
    )
  })

  // =========================================================================
  // VECTOR B: AMOUNT CHANGED (ZERO AMOUNT)
  // =========================================================================
  it("Vector B: Settlement amount changed to zero -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "0")

    await expect(recordSettlement(formData)).rejects.toThrow("Settlement amount must be positive")
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR C: AMOUNT INFLATED (EXCEEDING ACTUAL DEBT)
  // =========================================================================
  it("Vector C: Settlement amount inflated beyond outstanding balance -> Rejected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_bob",
      name: "Bob",
      upiId: "bob@oksbi",
    } as any)

    vi.mocked(getUserBalances).mockResolvedValueOnce({
      totalOwedToUser: 0,
      totalUserOwes: 1000,
      detailedBalances: [
        {
          userId: "user_bob",
          userName: "Bob",
          amount: 1000, // owes ₹10
          type: "USER_OWES",
        },
      ],
    })

    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "999999") // Attacker requests ₹9,999.99

    await expect(recordSettlement(formData)).rejects.toThrow(/Settlement amount exceeds outstanding balance/)
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR D: AMOUNT REDUCED (ATTEMPTING TO PAY ₹1 TO SETTLE ZERO DEBT)
  // =========================================================================
  it("Vector D: Amount reduced to ₹1 when no debt is owed -> Rejected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_bob",
      name: "Bob",
      upiId: "bob@oksbi",
    } as any)

    vi.mocked(getUserBalances).mockResolvedValueOnce({
      totalOwedToUser: 0,
      totalUserOwes: 0,
      detailedBalances: [],
    })

    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "100") // ₹1

    await expect(recordSettlement(formData)).rejects.toThrow(
      "You do not have an outstanding balance to settle with this user"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR E: PAYER CHANGED (ATTEMPTING TO CREATE EXPENSE AS ANOTHER USER)
  // =========================================================================
  it("Vector E: Expense creation with manipulated payerId -> Rejected", async () => {
    const formData = new FormData()
    formData.set("description", "Fraud Dinner")
    formData.set("amount", "100")
    formData.set("groupId", "group-1")
    formData.set("payerId", "victim_bob") // Claims Bob paid!
    formData.append("participants", "user_alice")
    formData.append("participants", "victim_bob")

    await expect(addExpense(formData)).rejects.toThrow(
      "Unauthorized: You cannot create an expense on behalf of another user"
    )
    expect(prisma.expense.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR F: RECEIVER CHANGED (SETTLING TO UNRELATED USER)
  // =========================================================================
  it("Vector F: Settlement receiver changed to unrelated user without debt -> Rejected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "unrelated_charlie",
      name: "Charlie",
      upiId: "charlie@okaxis",
    } as any)

    vi.mocked(getUserBalances).mockResolvedValueOnce({
      totalOwedToUser: 0,
      totalUserOwes: 5000,
      detailedBalances: [
        {
          userId: "user_bob", // Owes Bob, not Charlie!
          userName: "Bob",
          amount: 5000,
          type: "USER_OWES",
        },
      ],
    })

    const formData = new FormData()
    formData.set("receiverId", "unrelated_charlie")
    formData.set("amountPaise", "5000")

    await expect(recordSettlement(formData)).rejects.toThrow(
      "You do not have an outstanding balance to settle with this user"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR G: GROUP CHANGED (CROSS-GROUP SETTLEMENT BYPASS)
  // =========================================================================
  it("Vector G: Settlement with group where parties are not active members -> Rejected", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_bob",
      name: "Bob",
      upiId: "bob@oksbi",
    } as any)

    // Group member query returns only Alice, Bob is not a member of foreign-group
    vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
      { userId: SESSION_USER_ID, groupId: "foreign-group" } as any,
    ])

    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "5000")
    formData.set("groupId", "foreign-group")

    await expect(recordSettlement(formData)).rejects.toThrow(
      "Both payer and recipient must be active members of the group"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR H: USERID CHANGED (ATTACKER ATTEMPTS TO CLAIM SOMEONE ELSE'S CASHBACK)
  // =========================================================================
  it("Vector H: Attacker attempts to redeem cashback for another user ID -> Isolated strictly to session", async () => {
    // Current user has insufficient balance (1000 paise < 2500 threshold)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: SESSION_USER_ID,
      cashbackBalancePaise: 1000,
      upiId: "alice@okaxis",
    } as any)

    // Attempting to redeem fails because session user has < 2500 paise, even if victim has 100,000 paise
    await expect(requestCashbackRedemption()).rejects.toThrow(/Minimum cashback redemption threshold is/)
    expect(prisma.redemptionRequest.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR I: STATUS FORGED (CLIENT SENDS status: 'SETTLED')
  // =========================================================================
  it("Vector I: Client submits status: 'SETTLED' in settlement FormData -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "1000")
    formData.set("status", "SETTLED") // FORGED

    await expect(recordSettlement(formData)).rejects.toThrow(
      "Client submission of payment verification state is strictly prohibited"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR J: VERIFICATION STATUS FORGED (CLIENT SENDS paymentStatus: 'WEBHOOK_VERIFIED')
  // =========================================================================
  it("Vector J: Client submits paymentStatus: 'WEBHOOK_VERIFIED' in expense -> Rejected", async () => {
    const formData = new FormData()
    formData.set("description", "Forged Payment")
    formData.set("amount", "100")
    formData.set("groupId", "group-1")
    formData.set("paymentStatus", "WEBHOOK_VERIFIED") // FORGED

    await expect(addExpense(formData)).rejects.toThrow(
      "Client submission of payment verification state is strictly prohibited"
    )
    expect(prisma.expense.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR K: PROVIDER TRANSACTION FORGED (CLIENT SENDS providerTransactionId: 'fake')
  // =========================================================================
  it("Vector K: Client submits providerTransactionId in settlement -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "1000")
    formData.set("providerTransactionId", "fake_utr_99999") // FORGED

    await expect(recordSettlement(formData)).rejects.toThrow(
      "Client submission of payment verification state is strictly prohibited"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR L: CASHBACK FORGED (CLIENT ATTEMPTS TO SUBMIT cashbackAmount)
  // =========================================================================
  it("Vector L: Client submits cashbackAmount in redemption FormData -> Rejected", async () => {
    const formData = new FormData()
    formData.set("cashbackAmount", "50000") // FORGED

    await expect(requestCashbackRedemption(formData)).rejects.toThrow(
      "Client submission of redemption parameters is strictly prohibited"
    )
    expect(prisma.redemptionRequest.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR M: REFERRAL REWARD FORGED (SELF-REFERRAL TO UNLOCK REWARD)
  // =========================================================================
  it("Vector M: Client attempts self-referral to claim ₹21 -> Rejected", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: SESSION_USER_ID, referredById: null } as any) // referee check
      .mockResolvedValueOnce({ id: SESSION_USER_ID, name: "Alice" } as any) // referrer lookup

    const res = await applyReferralCode("DUOALICE")
    expect(res.success).toBe(false)
    expect(res.error).toContain("You cannot use your own referral code")
    expect(prisma.referral.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR N: REPLAYED REQUEST (WEBHOOK WITH DUPLICATE EVENT ID)
  // =========================================================================
  it("Vector N: Replaying already-processed webhook event -> Idempotent response, no duplicate balance mutation", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_key_12345"

    const eventId = "evt_replayed_12345"
    const payload = JSON.stringify({
      event: "payment.captured",
      event_id: eventId,
      payload: {
        payment: {
          entity: {
            id: "pay_test_1",
            amount: 5000,
            notes: { settlementId: "settle-1" },
          },
        },
      },
    })

    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex")

    // Event was already processed
    vi.mocked(prisma.settlement.findUnique).mockResolvedValueOnce({
      id: "settle-1",
      paymentStatus: "WEBHOOK_VERIFIED",
      processedEventId: eventId,
    } as any)

    const req = new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      headers: {
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": eventId,
      },
      body: payload,
    })

    const res = await handlePaymentWebhook(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.idempotent).toBe(true)
    expect(json.replayed).toBe(true)

    // Did NOT mutate database settlement or ledger
    expect(prisma.settlement.update).not.toHaveBeenCalled()
    expect(prisma.cashbackLedger.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR O: CONCURRENT REQUEST (CONCURRENT REDEMPTION ATTEMPTS)
  // =========================================================================
  it("Vector O: Concurrent redemption when an active request is in progress -> Blocked", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: SESSION_USER_ID,
      cashbackBalancePaise: 5000,
      upiId: "alice@okaxis",
    } as any)

    // Active redemption already exists
    vi.mocked(prisma.redemptionRequest.findFirst).mockResolvedValueOnce({
      id: "red_existing",
      userId: SESSION_USER_ID,
      status: "PROCESSING",
    } as any)

    await expect(requestCashbackRedemption()).rejects.toThrow(
      "A cashback redemption request is already in progress"
    )
    expect(prisma.redemptionRequest.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR P: UNAUTHORIZED USER (ANONYMOUS CALLER)
  // =========================================================================
  it("Vector P: Unauthenticated caller attempting settlement -> Rejected (401)", async () => {
    vi.mocked(auth as any).mockResolvedValueOnce(null)

    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "1000")

    await expect(recordSettlement(formData)).rejects.toThrow("Unauthorized")
  })

  // =========================================================================
  // VECTOR Q: NON-MEMBER USER (CALLER NOT IN GROUP)
  // =========================================================================
  it("Vector Q: Non-member attempting to add expense to group -> Rejected", async () => {
    // Group members do NOT include user_alice
    vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
      { userId: "victim_bob" },
      { userId: "victim_charlie" },
    ] as any)

    const formData = new FormData()
    formData.set("description", "Secret Meeting")
    formData.set("amount", "100")
    formData.set("groupId", "private-group")
    formData.set("payerId", SESSION_USER_ID)
    formData.append("participants", SESSION_USER_ID)

    await expect(addExpense(formData)).rejects.toThrow(
      "Unauthorized: You are not a member of this group"
    )
    expect(prisma.expense.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR R: MALFORMED AMOUNT (STRINGS WITH CHARACTERS)
  // =========================================================================
  it("Vector R: Malformed non-numeric string amount in settlement -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "1000abc")

    await expect(recordSettlement(formData)).rejects.toThrow(
      "amountPaise must contain strictly numeric digits"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR S: NEGATIVE AMOUNT
  // =========================================================================
  it("Vector S: Negative settlement amount -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "-5000")

    await expect(recordSettlement(formData)).rejects.toThrow(
      "Settlement amount must be positive"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR T: HUGE AMOUNT (UNSAFE INTEGER / OVERFLOW)
  // =========================================================================
  it("Vector T: Huge amount exceeding maximum limits -> Rejected", async () => {
    // 1. Amount exceeding MAX_FINANCIAL_PAISE (₹10,000,000 limit)
    const formDataMax = new FormData()
    formDataMax.set("receiverId", "user_bob")
    formDataMax.set("amountPaise", "2000000000") // ₹20,000,000 in paise

    await expect(recordSettlement(formDataMax)).rejects.toThrow(
      "amountPaise exceeds maximum permitted limit"
    )

    // 2. Unsafe integer exceeding MAX_SAFE_INTEGER
    const formDataOverflow = new FormData()
    formDataOverflow.set("receiverId", "user_bob")
    formDataOverflow.set("amountPaise", "99999999999999999") // Beyond MAX_SAFE_INTEGER

    await expect(recordSettlement(formDataOverflow)).rejects.toThrow(
      "amountPaise exceeds safe integer calculation range"
    )

    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR U: DECIMAL / FLOAT AMOUNT IN PAISE (FLOATING POINT INJECTION)
  // =========================================================================
  it("Vector U: Decimal float amount passed to integer paise parameter -> Rejected", async () => {
    const formData = new FormData()
    formData.set("receiverId", "user_bob")
    formData.set("amountPaise", "100.50") // Decimal in minor unit

    await expect(recordSettlement(formData)).rejects.toThrow(
      "amountPaise must be an integer minor unit (paise), decimal floats rejected"
    )
    expect(prisma.settlement.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR V: UNEXPECTED PRIVILEGE INJECTION (INJECTING role: 'ADMIN')
  // =========================================================================
  it("Vector V: Privilege escalation injection (role: 'ADMIN') in settings update -> Rejected", async () => {
    const maliciousPayload: any = {
      role: "ADMIN",
      currency: "INR",
    }

    await expect(updateUserSettings(maliciousPayload)).rejects.toThrow()
    expect(prisma.userSettings.upsert).not.toHaveBeenCalled()
  })

  // =========================================================================
  // VECTOR W: OCR AMOUNT BYPASS ATTEMPT
  // =========================================================================
  it("Vector W: OCR metadata attempt to bypass mathematical reconciliation -> Rejected", async () => {
    vi.mocked(prisma.groupMember.findMany).mockResolvedValue([
      { userId: "user_alice" },
      { userId: "user_bob" },
    ] as any)

    const formData = new FormData()
    formData.set("groupId", "group-1")
    formData.set("description", "OCR Scam")
    formData.set("amount", "100") // 10,000 paise
    formData.set("payerId", "user_alice")
    formData.append("participants", "user_alice")
    formData.append("participants", "user_bob")
    formData.set("splitMethod", "EXACT")
    formData.set("source", "RECEIPT")
    // Attacker sends splitData that doesn't sum to amount!
    formData.set("splitData", JSON.stringify({ user_alice: 2000, user_bob: 2000 }))

    await expect(addExpense(formData)).rejects.toThrow("Total exact amounts (4000) do not sum up to the total expense amount (10000)")
  })

  // =========================================================================
  // VECTOR X: OCR UNAUTHORIZED PARTICIPANT ATTEMPT
  // =========================================================================
  it("Vector X: OCR extraction specifies user ID not in group -> Rejected", async () => {
    vi.mocked(prisma.groupMember.findMany).mockResolvedValue([
      { userId: "user_alice" },
      { userId: "user_bob" },
    ] as any)

    const formData = new FormData()
    formData.set("groupId", "group-1")
    formData.set("description", "Dinner")
    formData.set("amount", "100") 
    formData.set("payerId", "user_alice")
    formData.append("participants", "user_alice")
    formData.append("participants", "attacker_dave_not_in_group")
    formData.set("splitMethod", "EQUAL")
    formData.set("source", "RECEIPT")

    await expect(addExpense(formData)).rejects.toThrow("Participant attacker_dave_not_in_group is not a member of this group")
  })
})
