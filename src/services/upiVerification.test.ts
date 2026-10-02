import { describe, it, expect, vi, beforeEach } from "vitest"
import { verifyUpiId, checkRateLimit, UpiVerificationProvider } from "./upiVerification"
import { prisma } from "@/lib/db"

// Mock Prisma for service testing
vi.mock("@/lib/db", () => ({
  prisma: {
    upiVerification: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    upiVerificationAttempt: {
      create: vi.fn().mockResolvedValue({ id: "att-1" }),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe("UPI Verification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Format Validation Guard in verifyUpiId", () => {
    it("should reject invalid VPA formats before calling any provider", async () => {
      const mockProvider: UpiVerificationProvider = {
        name: "mock",
        isConfigured: () => true,
        verifyVpa: vi.fn(),
      }

      // Malformed: no @
      const res1 = await verifyUpiId("invalidvpa", "user-1", { customProvider: mockProvider })
      expect(res1.status).toBe("FAILED")
      expect(res1.message).toContain("@")
      expect(mockProvider.verifyVpa).not.toHaveBeenCalled()

      // Malformed: spaces
      const res2 = await verifyUpiId("moiz @upi", "user-1", { customProvider: mockProvider })
      expect(res2.status).toBe("FAILED")
      expect(res2.message).toContain("spaces")
      expect(mockProvider.verifyVpa).not.toHaveBeenCalled()

      // Malformed: multiple @
      const res3 = await verifyUpiId("moiz@@upi", "user-1", { customProvider: mockProvider })
      expect(res3.status).toBe("FAILED")
      expect(res3.message).toContain("multiple '@'")
      expect(mockProvider.verifyVpa).not.toHaveBeenCalled()
    })
  })

  describe("Provider Unavailability & NoneProvider (NEVER FAKE VERIFICATION)", () => {
    it("should return UNAVAILABLE with explicit warning when no provider is configured", async () => {
      // Calling verifyUpiId without customProvider falls back to NoneProvider if env vars are unset
      const res = await verifyUpiId("moiz@oksbi", "user-1")
      
      expect(res.success).toBe(false)
      expect(res.exists).toBe(false)
      expect(res.status).toBe("UNAVAILABLE")
      expect(res.provider).toBe("none")
      expect(res.message).toBe(
        "Actual UPI existence verification requires a supported verification provider/API; format validation alone cannot establish that a UPI ID exists."
      )
    })

    it("should handle provider timeout gracefully", async () => {
      const timeoutProvider: UpiVerificationProvider = {
        name: "mock-timeout",
        isConfigured: () => true,
        verifyVpa: vi.fn().mockResolvedValue({
          success: false,
          exists: false,
          status: "UNAVAILABLE",
          vpa: "moiz@oksbi",
          provider: "mock-timeout",
          message: "Verification provider timed out. Please try again later.",
        }),
      }

      const res = await verifyUpiId("moiz@oksbi", "user-1", { customProvider: timeoutProvider })
      expect(res.status).toBe("UNAVAILABLE")
      expect(res.exists).toBe(false)
      expect(res.message).toContain("timed out")
    })
  })

  describe("Real Provider Responses & Name Verification", () => {
    it("should handle valid verified VPA with account holder name from provider", async () => {
      const successProvider: UpiVerificationProvider = {
        name: "razorpay",
        isConfigured: () => true,
        verifyVpa: vi.fn().mockResolvedValue({
          success: true,
          exists: true,
          status: "VERIFIED",
          vpa: "moiz@oksbi",
          verifiedName: "MOIZ DHEELA",
          provider: "razorpay",
          referenceId: "ref_123456",
          message: "UPI ID verified successfully.",
        }),
      }

      const res = await verifyUpiId("moiz@oksbi", "user-1", { customProvider: successProvider })
      expect(res.success).toBe(true)
      expect(res.exists).toBe(true)
      expect(res.status).toBe("VERIFIED")
      expect(res.verifiedName).toBe("MOIZ DHEELA")
      expect(res.provider).toBe("razorpay")

      // Should save to cache
      expect(prisma.upiVerification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { upiId: "moiz@oksbi" },
          create: expect.objectContaining({
            upiId: "moiz@oksbi",
            verifiedName: "MOIZ DHEELA",
            status: "VERIFIED",
          }),
        })
      )
    })

    it("should handle non-existent VPA rejection from provider", async () => {
      const rejectProvider: UpiVerificationProvider = {
        name: "cashfree",
        isConfigured: () => true,
        verifyVpa: vi.fn().mockResolvedValue({
          success: true,
          exists: false,
          status: "FAILED",
          vpa: "fake999@oksbi",
          provider: "cashfree",
          referenceId: "ref_999",
          message: "UPI ID could not be confirmed. Please check the UPI ID and try again.",
        }),
      }

      const res = await verifyUpiId("fake999@oksbi", "user-1", { customProvider: rejectProvider })
      expect(res.exists).toBe(false)
      expect(res.status).toBe("FAILED")
      expect(res.message).toContain("could not be confirmed")

      // Must NOT cache non-existent VPAs
      expect(prisma.upiVerification.upsert).not.toHaveBeenCalled()
    })
  })

  describe("Caching Policy", () => {
    it("should return cached result if valid and unexpired without calling provider", async () => {
      vi.mocked(prisma.upiVerification.findUnique).mockResolvedValueOnce({
        id: "v-1",
        upiId: "cached@okhdfcbank",
        verifiedName: "CACHED USER",
        status: "VERIFIED",
        provider: "cashfree",
        referenceId: "ref_cache_1",
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // unexpired
      })

      const mockProvider: UpiVerificationProvider = {
        name: "mock",
        isConfigured: () => true,
        verifyVpa: vi.fn(),
      }

      const res = await verifyUpiId("cached@okhdfcbank", "user-1", { customProvider: mockProvider })
      expect(res.status).toBe("VERIFIED")
      expect(res.verifiedName).toBe("CACHED USER")
      expect(mockProvider.verifyVpa).not.toHaveBeenCalled()
    })
  })

  describe("Rate Limiting", () => {
    it("should block requests after exceeding maximum attempts within window", () => {
      const testUser = "rate-limit-user-" + Date.now()
      
      // 5 attempts allowed
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit(testUser, 5, 60000)).toBe(true)
      }

      // 6th attempt blocked
      expect(checkRateLimit(testUser, 5, 60000)).toBe(false)
    })
  })
})
