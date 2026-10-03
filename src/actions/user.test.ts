import { describe, it, expect, vi, beforeEach } from "vitest"
import { updateUpiId } from "./user"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

import { resetRateLimitsForTesting } from "@/services/upiVerification"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    upiVerification: {
      findUnique: vi.fn(),
    },
    upiVerificationAttempt: {
      create: vi.fn().mockResolvedValue({ id: "att-1" }),
    },
  },
}))

describe("Server-Side UPI Enforcement (user.ts)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    resetRateLimitsForTesting()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any)
    vi.mocked(prisma.upiVerificationAttempt.create).mockResolvedValue({ id: "att-1" } as any)
  })

  it("should reject unauthenticated requests", async () => {
    vi.mocked(auth as any).mockResolvedValueOnce(null as any)
    await expect(updateUpiId("moiz@oksbi")).rejects.toThrow("Unauthorized")
  })

  it("should reject malformed UPI IDs", async () => {
    await expect(updateUpiId("not-a-upi")).rejects.toThrow()
    await expect(updateUpiId("moiz@@upi")).rejects.toThrow()
    await expect(updateUpiId("moiz @upi")).rejects.toThrow()
  })

  it("should save unverified UPI ID with upiVerified: false when not verified by provider", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "test-user-id",
      upiId: "old@upi",
      upiVerified: true,
    } as any)

    // No verified cache record
    vi.mocked(prisma.upiVerification.findUnique).mockResolvedValueOnce(null)

    const res = await updateUpiId("newfake@oksbi")

    expect(res.success).toBe(true)
    expect(res.upiVerified).toBe(false)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "test-user-id" },
      data: expect.objectContaining({
        upiId: "newfake@oksbi",
        upiVerified: false,
        upiVerifiedAt: null,
        upiVerificationReference: null,
        upiVerifiedName: null,
      }),
    })
  })

  it("should reset upiVerified: false if a previously verified user changes UPI ID to a new unverified one", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "test-user-id",
      upiId: "moiz@oksbi",
      upiVerified: true,
    } as any)

    vi.mocked(prisma.upiVerification.findUnique).mockResolvedValueOnce(null)

    const res = await updateUpiId("someoneelse@oksbi")

    expect(res.upiVerified).toBe(false)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          upiId: "someoneelse@oksbi",
          upiVerified: false,
        }),
      })
    )
  })

  it("should save as verified only if provider verification proof exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "test-user-id",
      upiId: "old@upi",
      upiVerified: false,
    } as any)

    vi.mocked(prisma.upiVerification.findUnique).mockResolvedValueOnce({
      id: "v-1",
      upiId: "verified@oksbi",
      verifiedName: "VERIFIED NAME",
      status: "VERIFIED",
      provider: "razorpay",
      referenceId: "ref_101",
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    } as any)

    const res = await updateUpiId("verified@oksbi")

    expect(res.success).toBe(true)
    expect(res.upiVerified).toBe(true)
    expect(res.verifiedName).toBe("VERIFIED NAME")
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "test-user-id" },
      data: expect.objectContaining({
        upiId: "verified@oksbi",
        upiVerified: true,
        upiVerifiedName: "VERIFIED NAME",
      }),
    })
  })

  describe("verifyUpiIdAction", () => {
    it("should reject unauthenticated verify actions", async () => {
      const { verifyUpiIdAction } = await import("./user")
      vi.mocked(auth as any).mockResolvedValueOnce(null)
      await expect(verifyUpiIdAction("moiz@oksbi")).rejects.toThrow("Unauthorized")
    })

    it("should only update the authenticated session user and prevent cross-user verification tampering", async () => {
      const { verifyUpiIdAction } = await import("./user")
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: "auth-user-123" },
      } as any)

      // User has current UPI
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "auth-user-123",
        upiId: "myvpa@oksbi",
      } as any)

      // Verified result in cache
      vi.mocked(prisma.upiVerification.findUnique).mockResolvedValueOnce({
        id: "v-2",
        upiId: "myvpa@oksbi",
        verifiedName: "AUTH USER NAME",
        status: "VERIFIED",
        provider: "cashfree",
        referenceId: "ref-999",
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      } as any)

      const result = await verifyUpiIdAction("myvpa@oksbi")
      expect(result.status).toBe("VERIFIED")

      // MUST update ONLY auth-user-123
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "auth-user-123" },
          data: expect.objectContaining({
            upiVerified: true,
            upiVerifiedName: "AUTH USER NAME",
          }),
        })
      )
    })
  })
})
