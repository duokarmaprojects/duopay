import { describe, it, expect, vi, beforeEach } from "vitest"
import { updateUpiId, updateUserProfile } from "./user"
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
    receiptScan: { create: async () => ({ id: 'scan-1', status: 'PENDING' }), findUnique: async () => null, update: async () => null, findMany: async () => [] },
    orderImport: { create: async () => null, findUnique: async () => null, update: async () => null, findMany: async () => [] },
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe("Server-Side UPI ID Management (user.ts)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any)
  })

  it("1. should reject unauthenticated requests", async () => {
    vi.mocked(auth as any).mockResolvedValueOnce(null as any)
    await expect(updateUpiId("moiz@oksbi")).rejects.toThrow("Unauthorized")
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("2. should reject malformed UPI IDs", async () => {
    await expect(updateUpiId("not-a-upi")).rejects.toThrow()
    await expect(updateUpiId("moiz@@upi")).rejects.toThrow()
    await expect(updateUpiId("moiz @upi")).rejects.toThrow()
    await expect(updateUpiId("")).rejects.toThrow()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("3. should save user's original/real valid UPI ID without requiring verification", async () => {
    const res = await updateUpiId("moizdhilawala99@oksbi")

    expect(res.success).toBe(true)
    expect(res.upiId).toBe("moizdhilawala99@oksbi")
    // Verification fields should not exist on response
    expect((res as any).upiVerified).toBeUndefined()
    expect((res as any).verifiedName).toBeUndefined()

    // Strictly saves against session user
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "test-user-id" },
      data: {
        upiId: "moizdhilawala99@oksbi",
      },
    })
  })

  it("4. should support editing UPI ID to a new valid UPI ID", async () => {
    const res1 = await updateUpiId("first@oksbi")
    expect(res1.upiId).toBe("first@oksbi")

    const res2 = await updateUpiId("second@ybl")
    expect(res2.upiId).toBe("second@ybl")

    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: "test-user-id" },
      data: {
        upiId: "second@ybl",
      },
    })
  })

  it("5. should normalize UPI IDs to lowercase", async () => {
    const res = await updateUpiId("MoizDhilawala99@OKSBI")

    expect(res.success).toBe(true)
    expect(res.upiId).toBe("moizdhilawala99@oksbi")
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "test-user-id" },
      data: {
        upiId: "moizdhilawala99@oksbi",
      },
    })
  })

  it("6. should strictly isolate updates to session user ID (BOLA/IDOR protection)", async () => {
    vi.mocked(auth as any).mockResolvedValueOnce({
      user: { id: "victim-alice" },
    } as any)

    await updateUpiId("alice@okhdfc")

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "victim-alice" },
        data: {
          upiId: "alice@okhdfc",
        },
      })
    )
  })
})

describe("updateUserProfile (user.ts)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any)
  })

  it("should reject unauthenticated profile update", async () => {
    vi.mocked(auth as any).mockResolvedValueOnce(null as any)
    await expect(
      updateUserProfile({ name: "Moiz D", upiId: "moiz@okhdfc" })
    ).rejects.toThrow("Unauthorized")
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("should reject invalid name (less than 2 chars)", async () => {
    await expect(
      updateUserProfile({ name: "M", upiId: "moiz@okhdfc" })
    ).rejects.toThrow("Name must be at least 2 characters")
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("should reject invalid UPI format", async () => {
    await expect(
      updateUserProfile({ name: "Moiz", upiId: "invalid-upi" })
    ).rejects.toThrow("UPI ID must contain an '@' symbol")
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("should update profile successfully for authenticated user", async () => {
    vi.mocked(prisma.user.update as any).mockResolvedValueOnce({
      id: "test-user-id",
      name: "Moiz Dhilawala",
      upiId: "moiz@okhdfc",
      email: "moiz@example.com",
    })

    const result = await updateUserProfile({
      name: "Moiz Dhilawala",
      upiId: "MOIZ@OKHDFC",
      email: "moiz@example.com",
    })

    expect(result.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "test-user-id" },
      data: {
        name: "Moiz Dhilawala",
        upiId: "moiz@okhdfc",
        email: "moiz@example.com",
      },
      select: expect.any(Object),
    })
  })
})



