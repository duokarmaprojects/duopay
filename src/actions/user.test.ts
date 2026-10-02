import { describe, it, expect, vi, beforeEach } from "vitest"
import { updateUpiId } from "./user"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

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
  },
}))

describe("Server-Side UPI Enforcement (user.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any)
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
})
