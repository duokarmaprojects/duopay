import { describe, it, expect, vi, beforeEach } from "vitest"
import { searchGlobal } from "./search"
import { getSpendingAnalytics } from "./analytics"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    receiptScan: { create: async () => ({ id: 'scan-1', status: 'PENDING' }), findUnique: async () => null, update: async () => null, findMany: async () => [] },
    orderImport: { create: async () => null, findUnique: async () => null, update: async () => null, findMany: async () => [] },
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
    groupMember: { findMany: vi.fn() },
    friendship: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    settlement: { findMany: vi.fn() },
  },
}))

describe("Phase 2 Retention Suite: Search & Analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Global Search (search.ts)", () => {
    it("should reject unauthenticated search queries", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce(null)

      await expect(searchGlobal("food")).rejects.toThrow("Unauthorized")
    })

    it("should return empty results for queries under 2 characters", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-123" } })

      const res = await searchGlobal("a")
      expect(res.results).toEqual([])
      expect(res.totalCount).toBe(0)
    })

    it("should return authorized matching groups, friends, and expenses", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-123" } })

      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
        {
          group: { id: "grp-1", name: "Goa Trip", image: null },
        } as any,
      ])

      vi.mocked(prisma.friendship.findMany).mockResolvedValueOnce([
        {
          id: "frd-1",
          userId: "user-123",
          friendId: "user-456",
          user: { id: "user-123", name: "Alice", email: "alice@test.com", phone: null },
          friend: { id: "user-456", name: "Bob Goa", email: "bob@test.com", phone: null },
        } as any,
      ])

      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([
        {
          id: "exp-1",
          description: "Goa Dinner",
          amount: 150000,
          category: "FOOD",
          createdAt: new Date("2026-09-15"),
          payer: { name: "Alice" },
          group: { id: "grp-1", name: "Goa Trip" },
        } as any,
      ])

      vi.mocked(prisma.settlement.findMany).mockResolvedValueOnce([])

      const res = await searchGlobal("Goa")
      expect(res.totalCount).toBe(3)
      expect(res.results[0].type).toBe("GROUP")
      expect(res.results[1].type).toBe("FRIEND")
      expect(res.results[2].type).toBe("EXPENSE")
    })
  })

  describe("Spending Analytics Engine (analytics.ts)", () => {
    it("should reject unauthenticated analytics requests", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce(null)

      await expect(getSpendingAnalytics("MONTH")).rejects.toThrow("Unauthorized")
    })

    it("should compute correct category totals and user share strictly from database", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-1" } })

      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([
        {
          id: "exp-1",
          amount: 60000, // ₹600 total
          category: "FOOD",
          payerId: "user-1",
          createdAt: new Date(),
          group: { id: "grp-1", name: "Flatmates" },
          participants: [
            { userId: "user-1", share: 30000 },
            { userId: "user-2", share: 30000 },
          ],
        } as any,
        {
          id: "exp-2",
          amount: 40000, // ₹400 total
          category: "TRANSPORT",
          payerId: "user-2",
          createdAt: new Date(),
          group: { id: "grp-1", name: "Flatmates" },
          participants: [
            { userId: "user-1", share: 20000 },
            { userId: "user-2", share: 20000 },
          ],
        } as any,
      ])

      vi.mocked(prisma.settlement.findMany).mockResolvedValueOnce([
        {
          payerId: "user-1",
          receiverId: "user-2",
          amount: 20000,
          status: "COMPLETED",
        } as any,
      ])

      const summary = await getSpendingAnalytics("MONTH")
      expect(summary.totalSpentPaise).toBe(60000)
      expect(summary.userSharePaise).toBe(50000) // ₹300 (food) + ₹200 (transport) = ₹500
      expect(summary.expenseCount).toBe(2)
      expect(summary.settlementPaidPaise).toBe(20000)
      expect(summary.categories.length).toBe(2)
      expect(summary.categories[0].category).toBe("FOOD")
      expect(summary.categories[0].amountPaise).toBe(30000)
      expect(summary.categories[1].category).toBe("TRANSPORT")
      expect(summary.categories[1].amountPaise).toBe(20000)
    })

    it("should handle custom and various date ranges deterministically", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-1" } })
      vi.mocked(prisma.expense.findMany).mockResolvedValue([])
      vi.mocked(prisma.settlement.findMany).mockResolvedValue([])

      const weekSummary = await getSpendingAnalytics("WEEK")
      expect(weekSummary.timeRange).toBe("WEEK")
      expect(weekSummary.userSharePaise).toBe(0)

      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-1" } })
      const yearSummary = await getSpendingAnalytics("YEAR")
      expect(yearSummary.timeRange).toBe("YEAR")

      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-1" } })
      const allSummary = await getSpendingAnalytics("ALL")
      expect(allSummary.timeRange).toBe("ALL")

      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-1" } })
      const customSummary = await getSpendingAnalytics(
        "CUSTOM",
        "2026-01-01T00:00:00Z",
        "2026-01-31T23:59:59Z"
      )
      expect(customSummary.timeRange).toBe("CUSTOM")
    })

    it("should compute Month-over-Month comparison with safe denominator handling", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-1" } })

      // Call 1: current month expenses (₹500 true spend)
      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([
        {
          id: "exp-curr",
          amount: 50000,
          category: "FOOD",
          payerId: "user-1",
          status: "FINAL",
          participants: [{ userId: "user-1", share: 50000 }],
        } as any,
      ])
      vi.mocked(prisma.settlement.findMany).mockResolvedValueOnce([])

      // Call 2: previous month expenses (₹250 true spend)
      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([
        {
          id: "exp-prev",
          amount: 25000,
          category: "FOOD",
          payerId: "user-1",
          status: "FINAL",
          participants: [{ userId: "user-1", share: 25000 }],
        } as any,
      ])
      vi.mocked(prisma.settlement.findMany).mockResolvedValueOnce([])

      // Call 3: enrichments
      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([])

      const summary = await getSpendingAnalytics("MONTH")
      expect(summary.monthOverMonth.hasPreviousData).toBe(true)
      expect(summary.monthOverMonth.currentPeriodPaise).toBe(50000)
      expect(summary.monthOverMonth.previousPeriodPaise).toBe(25000)
      expect(summary.monthOverMonth.changeAmountPaise).toBe(25000)
      expect(summary.monthOverMonth.changePercent).toBe(100) // 100% increase
      expect(summary.monthOverMonth.isIncrease).toBe(true)
    })

    it("should generate deterministic insights for high cash ratio and recurring commitments", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-1" } })

      // Call 1: current month expenses with Cash and Recurring and Upcoming
      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([
        {
          id: "exp-cash",
          amount: 100000,
          category: "GROCERIES",
          description: "Supermarket",
          source: "CASH",
          status: "FINAL",
          priority: "RECURRING",
          payerId: "user-1",
          participants: [{ userId: "user-1", share: 100000 }],
        } as any,
        {
          id: "exp-upcoming",
          amount: 30000,
          category: "UTILITIES",
          status: "UPCOMING",
          payerId: "user-1",
          participants: [{ userId: "user-1", share: 30000 }],
        } as any,
      ])
      vi.mocked(prisma.settlement.findMany).mockResolvedValueOnce([])
      // Call 2: previous month (empty)
      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([])
      vi.mocked(prisma.settlement.findMany).mockResolvedValueOnce([])
      // Call 3: enrichments
      vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([])

      const summary = await getSpendingAnalytics("MONTH")
      expect(summary.insights.length).toBeGreaterThanOrEqual(3)
      expect(summary.insights.some((i) => i.includes("GROCERIES is your largest"))).toBe(true)
      expect(summary.insights.some((i) => i.includes("Recurring commitments account for"))).toBe(true)
      expect(summary.insights.some((i) => i.includes("Cash transactions represent 100%"))).toBe(true)
      expect(summary.insights.some((i) => i.includes("upcoming scheduled obligations"))).toBe(true)
    })
  })
})



