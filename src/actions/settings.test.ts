import { describe, it, expect, vi, beforeEach } from "vitest"
import { getUserSettings, updateUserSettings } from "./settings"
import { defaultUserSettings } from "@/domain/settings"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt-1" }),
    },
  },
}))

describe("User Settings & Privacy Enforcement (settings.ts)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "test-user-alice" },
    } as any)
  })

  it("should reject unauthenticated access when fetching settings", async () => {
    vi.mocked(auth as any).mockResolvedValueOnce(null)
    await expect(getUserSettings()).rejects.toThrow("Unauthorized")
  })

  it("should reject unauthenticated mutations", async () => {
    vi.mocked(auth as any).mockResolvedValueOnce(null)
    await expect(updateUserSettings({ currency: "USD" })).rejects.toThrow("Unauthorized")
  })

  it("should return safe defaults when user has no existing settings row", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce(null)

    const result = await getUserSettings()
    expect(result.userId).toBe("test-user-alice")
    expect(result.currency).toBe(defaultUserSettings.currency)
    expect(result.defaultSplitMethod).toBe(defaultUserSettings.defaultSplitMethod)
    expect(result.simplifyDebts).toBe(true)
    expect(result.discoverableByPhone).toBe(true)
    expect(result.expenseAlerts).toBe(true)
  })

  it("should return persisted settings when found in database", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
      id: "set-1",
      userId: "test-user-alice",
      currency: "EUR",
      defaultSplitMethod: "EXACT",
      simplifyDebts: false,
      expenseAlerts: false,
      paymentReminders: true,
      groupActivityAlerts: true,
      pushNotifications: true,
      discoverableByPhone: false,
      shareActivityInGroup: false,
      showUpiOnProfile: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const result = await getUserSettings()
    expect(result.currency).toBe("EUR")
    expect(result.defaultSplitMethod).toBe("EXACT")
    expect(result.simplifyDebts).toBe(false)
    expect(result.discoverableByPhone).toBe(false)
    expect(result.pushNotifications).toBe(true)
  })

  it("should reject invalid/unsupported preference values", async () => {
    await expect(updateUserSettings({ currency: "BITCOIN" as any })).rejects.toThrow()
    await expect(updateUserSettings({ defaultSplitMethod: "RANDOM" as any })).rejects.toThrow()
  })

  it("should enforce session userId and prevent cross-user settings modification", async () => {
    vi.mocked(prisma.userSettings.upsert).mockResolvedValueOnce({
      id: "set-1",
      userId: "test-user-alice",
      currency: "USD",
      defaultSplitMethod: "PERCENTAGE",
      simplifyDebts: true,
      expenseAlerts: true,
      paymentReminders: true,
      groupActivityAlerts: true,
      pushNotifications: false,
      discoverableByPhone: false,
      shareActivityInGroup: true,
      showUpiOnProfile: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const res = await updateUserSettings({
      currency: "USD",
      defaultSplitMethod: "PERCENTAGE",
      discoverableByPhone: false,
    })

    expect(res.success).toBe(true)
    expect(res.settings.currency).toBe("USD")
    expect(res.settings.discoverableByPhone).toBe(false)

    // MUST target test-user-alice from session, never arbitrary user
    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "test-user-alice" },
        update: expect.objectContaining({
          currency: "USD",
          defaultSplitMethod: "PERCENTAGE",
          discoverableByPhone: false,
        }),
      })
    )
  })
})


