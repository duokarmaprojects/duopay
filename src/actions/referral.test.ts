import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  SIGNUP_REWARD_PAISE,
  COMPLETION_REWARD_PAISE,
  QUALIFYING_PAYMENTS_REQUIRED,
  TOTAL_REFERRAL_REWARD_PAISE,
  isSelfReferral,
  isValidReferralCode,
  generateUserReferralCode,
  calculateReferralStats,
  formatPaiseToRupees,
} from "@/domain/referral"
import { getReferralSummary, applyReferralCode } from "@/actions/referral"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { resetAllRateLimitsForTesting } from "@/lib/rateLimit"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  return {
    prisma: {
    receiptScan: { create: async () => ({ id: 'scan-1', status: 'PENDING' }), findUnique: async () => null, update: async () => null, findMany: async () => [] },
    orderImport: { create: async () => null, findUnique: async () => null, update: async () => null, findMany: async () => [] },
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      referral: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      cashbackLedger: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(prisma)
      }),
    },
  }
})

describe("REFERRAL & REWARDS DOMAIN & SECURITY SUITE", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAllRateLimitsForTesting()
  })

  // 1. Referral Domain Rules
  it("Domain: constants should match ₹11 signup + ₹10 completion = ₹21 total", () => {
    expect(SIGNUP_REWARD_PAISE).toBe(1100)
    expect(COMPLETION_REWARD_PAISE).toBe(1000)
    expect(TOTAL_REFERRAL_REWARD_PAISE).toBe(2100)
    expect(QUALIFYING_PAYMENTS_REQUIRED).toBe(10)
  })

  it("Domain: isSelfReferral correctly catches identical IDs", () => {
    expect(isSelfReferral("user_123", "user_123")).toBe(true)
    expect(isSelfReferral("USER_123", "user_123")).toBe(true)
    expect(isSelfReferral(" user_123 ", "user_123")).toBe(true)
    expect(isSelfReferral("user_123", "user_456")).toBe(false)
  })

  it("Domain: isValidReferralCode validates code format", () => {
    expect(isValidReferralCode("DUO1234")).toBe(true)
    expect(isValidReferralCode("DUO-ABC123")).toBe(true)
    expect(isValidReferralCode("")).toBe(false)
    expect(isValidReferralCode("A".repeat(20))).toBe(false)
    expect(isValidReferralCode("DUO<script>")).toBe(false)
  })

  it("Domain: calculateReferralStats sums strictly server-authoritative numbers", () => {
    const mockRecords = [
      {
        id: "ref-1",
        referrerId: "user_a",
        refereeId: "user_b",
        status: "COMPLETED",
        signupRewardPaidPaise: 1100,
        signupRewardStatus: "EARNED",
        qualifyingPaymentCount: 10,
        completionRewardPaidPaise: 1000,
        completionRewardStatus: "EARNED",
        createdAt: new Date(),
      },
      {
        id: "ref-2",
        referrerId: "user_a",
        refereeId: "user_c",
        status: "ACTIVE",
        signupRewardPaidPaise: 1100,
        signupRewardStatus: "EARNED",
        qualifyingPaymentCount: 6,
        completionRewardPaidPaise: 1000,
        completionRewardStatus: "PENDING",
        createdAt: new Date(),
      },
      {
        id: "ref-3",
        referrerId: "user_a",
        refereeId: "user_d",
        status: "FRAUD_FLAGGED", // Should not count towards rewards
        signupRewardPaidPaise: 1100,
        signupRewardStatus: "EARNED",
        qualifyingPaymentCount: 10,
        completionRewardPaidPaise: 1000,
        completionRewardStatus: "EARNED",
        createdAt: new Date(),
      },
    ]

    const stats = calculateReferralStats(mockRecords as any)
    // ref-1: 1100 + 1000 = 2100; ref-2: 1100; ref-3: excluded -> total = 3200
    expect(stats.totalEarnedPaise).toBe(3200)
    expect(stats.pendingRewardPaise).toBe(1000) // ref-2 has 1000 pending
    expect(stats.completedReferrals).toBe(1)
    expect(stats.activeReferrals).toBe(1)
    expect(stats.totalReferrals).toBe(3)
  })

  it("Domain: formatPaiseToRupees formats correctly without displaying raw cents when integer", () => {
    expect(formatPaiseToRupees(2100)).toBe("₹21")
    expect(formatPaiseToRupees(1100)).toBe("₹11")
    expect(formatPaiseToRupees(1000)).toBe("₹10")
    expect(formatPaiseToRupees(2150)).toBe("₹21.50")
  })

  // 2. getReferralSummary Security & Data Integrity
  it("getReferralSummary: rejects unauthenticated caller", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    await expect(getReferralSummary()).rejects.toThrow("Unauthorized")
  })

  it("getReferralSummary: returns server-authoritative data with PII masking", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_alice", name: "Alice" },
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_alice",
      referralCode: "DUOALICE",
    } as any)

    vi.mocked(prisma.referral.findMany).mockResolvedValueOnce([
      {
        id: "ref-1",
        referrerId: "user_alice",
        refereeId: "user_bob",
        status: "ACTIVE",
        signupRewardPaidPaise: 1100,
        signupRewardStatus: "EARNED",
        qualifyingPaymentCount: 3,
        completionRewardPaidPaise: 1000,
        completionRewardStatus: "PENDING",
        createdAt: new Date("2026-09-01"),
        referee: {
          id: "user_bob",
          name: "Bob Smith",
          image: null,
          phone: "+919876543210",
        },
      },
    ] as any)

    const summary = await getReferralSummary()
    expect(summary.referralCode).toBe("DUOALICE")
    expect(summary.totalEarnedPaise).toBe(1100)
    expect(summary.totalEarnedRupees).toBe("₹11")
    expect(summary.pendingRewardPaise).toBe(1000)
    expect(summary.pendingRewardRupees).toBe("₹10")
    expect(summary.totalReferrals).toBe(1)
    expect(summary.history[0].refereeName).toBe("Bob S.") // Masked!
    expect(summary.history[0].qualifyingPaymentCount).toBe(3)
    expect(summary.history[0].targetPaymentCount).toBe(10)
  })

  // 3. applyReferralCode Security & Business Rules
  it("applyReferralCode: rejects unauthenticated user", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const result = await applyReferralCode("DUO123")
    expect(result.success).toBe(false)
    expect(result.error).toContain("Authentication required")
  })

  it("applyReferralCode: blocks self-referral attempts", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_alice", name: "Alice" },
    } as any)

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: "user_alice", referredById: null } as any) // referee check
      .mockResolvedValueOnce({ id: "user_alice", name: "Alice" } as any) // referrer lookup by code

    const result = await applyReferralCode("DUOALICE")
    expect(result.success).toBe(false)
    expect(result.error).toContain("cannot use your own referral code")
  })

  it("applyReferralCode: enforces single referral attribution (rejects duplicate referral)", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_bob", name: "Bob" },
    } as any)

    // User already has referredById
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_bob",
      referredById: "user_original_referrer",
    } as any)

    const result = await applyReferralCode("DUOSOMEONE")
    expect(result.success).toBe(false)
    expect(result.error).toContain("already been applied")
  })

  it("applyReferralCode: successfully attributes referral and awards ₹11 signup bonus atomically", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_bob", name: "Bob" },
    } as any)

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: "user_bob", referredById: null } as any) // referee
      .mockResolvedValueOnce({ id: "user_alice", name: "Alice" } as any) // referrer

    vi.mocked(prisma.referral.findUnique).mockResolvedValueOnce(null) // no existing referral
    vi.mocked(prisma.referral.create).mockResolvedValueOnce({
      id: "ref-new",
      referrerId: "user_alice",
      refereeId: "user_bob",
    } as any)

    const result = await applyReferralCode("DUOALICE")
    expect(result.success).toBe(true)

    // Verify referrer received 1100 paise (₹11)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_alice" },
        data: {
          cashbackBalancePaise: { increment: 1100 },
        },
      })
    )

    // Verify cashback ledger entry was created
    expect(prisma.cashbackLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_alice",
          amountPaise: 1100,
          type: "REFERRAL_SIGNUP",
          status: "EARNED",
        }),
      })
    )
  })
})



