import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createBudget,
  getBudgets,
  updateBudget,
  deleteBudget,
  evaluateBudgetAlerts,
} from "./budget"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getUserTrueSpend } from "@/services/trueSpend"
import { sendNotification } from "@/services/notification"
import { logSecurityEvent } from "@/lib/securityAudit"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { pusherServer } from "@/lib/realtime/pusher"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rateLimit", () => ({
  checkActionRateLimit: vi.fn(() => ({ allowed: true })),
}))

vi.mock("@/lib/securityAudit", () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/realtime/pusher", () => ({
  pusherServer: {
    trigger: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock("@/services/notification", () => ({
  sendNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}))

vi.mock("@/services/trueSpend", () => ({
  getUserTrueSpend: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    budget: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

describe("Budget Actions Test Suite (budget.ts)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(logSecurityEvent).mockResolvedValue(undefined as any)
    vi.mocked(checkActionRateLimit).mockReturnValue({ allowed: true } as any)
    vi.mocked(sendNotification).mockResolvedValue({ id: "notif-1" } as any)
    vi.mocked(pusherServer.trigger).mockResolvedValue(undefined as any)
  })

  describe("createBudget", () => {
    it("should reject unauthenticated calls and log security event", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce(null)
      const formData = new FormData()
      formData.set("amount", "5000")

      await expect(createBudget(formData)).rejects.toThrow("Unauthorized")
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "AUTH_UNAUTHORIZED_ACCESS" })
      )
    })

    it("should reject non-positive or zero budget amounts", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-123" } })
      const formData = new FormData()
      formData.set("amount", "0")

      await expect(createBudget(formData)).rejects.toThrow(
        "Budget amount must be a positive number"
      )

      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-123" } })
      const formDataNeg = new FormData()
      formDataNeg.set("amount", "-100")

      await expect(createBudget(formDataNeg)).rejects.toThrow(
        "Budget amount must be a positive number"
      )
    })

    it("should reject budget amounts exceeding limit", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-123" } })
      const formData = new FormData()
      formData.set("amount", "200000000") // 2 crore

      await expect(createBudget(formData)).rejects.toThrow(
        "Budget amount exceeds maximum limit"
      )
    })

    it("should successfully create a category budget and deactivate previous active budget", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-123" } })
      vi.mocked(prisma.budget.findFirst).mockResolvedValueOnce(null)
      vi.mocked(prisma.budget.updateMany).mockResolvedValueOnce({ count: 1 })
      vi.mocked(prisma.budget.create).mockResolvedValueOnce({
        id: "budget-1",
        userId: "user-123",
        category: "FOOD",
        amountPaise: 500000,
        period: "MONTHLY",
        warningPercent: 80,
        active: true,
        createdAt: new Date(),
      } as any)
      vi.mocked(prisma.budget.findMany).mockResolvedValueOnce([])

      const formData = new FormData()
      formData.set("category", "FOOD")
      formData.set("amount", "5000") // ₹5,000 -> 500,000 paise
      formData.set("period", "MONTHLY")
      formData.set("warningPercent", "80")

      const result = await createBudget(formData)
      expect(result.success).toBe(true)
      expect(result.isDuplicate).toBe(false)
      expect(prisma.budget.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          category: "FOOD",
          period: "MONTHLY",
          active: true,
        },
        data: { active: false },
      })
      expect(prisma.budget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          category: "FOOD",
          amountPaise: 500000,
          warningPercent: 80,
        }),
      })
    })

    it("should return existing budget when idempotencyKey matches", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-123" } })
      const existingBudget = {
        id: "budget-existing",
        userId: "user-123",
        idempotencyKey: "idem-key-1",
        amountPaise: 500000,
      }
      vi.mocked(prisma.budget.findFirst).mockResolvedValueOnce(existingBudget as any)

      const formData = new FormData()
      formData.set("amount", "5000")
      formData.set("idempotencyKey", "idem-key-1")

      const result = await createBudget(formData)
      expect(result.success).toBe(true)
      expect(result.isDuplicate).toBe(true)
      expect(result.budget.id).toBe("budget-existing")
      expect(prisma.budget.create).not.toHaveBeenCalled()
    })
  })

  describe("getBudgets", () => {
    it("should return enriched budgets with accurate status calculations", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "user-123" } })
      vi.mocked(prisma.budget.findMany).mockResolvedValueOnce([
        {
          id: "b-track",
          userId: "user-123",
          category: "FOOD",
          amountPaise: 100000, // ₹1,000
          period: "MONTHLY",
          warningPercent: 80,
          active: true,
          createdAt: new Date(),
        } as any,
        {
          id: "b-approach",
          userId: "user-123",
          category: "TRANSPORT",
          amountPaise: 100000, // ₹1,000
          period: "MONTHLY",
          warningPercent: 80,
          active: true,
          createdAt: new Date(),
        } as any,
        {
          id: "b-exceeded",
          userId: "user-123",
          category: null, // Overall budget
          amountPaise: 200000, // ₹2,000
          period: "MONTHLY",
          warningPercent: 80,
          active: true,
          createdAt: new Date(),
        } as any,
      ])

      // Mock True Spend
      vi.mocked(getUserTrueSpend).mockResolvedValue({
        totalTrueSpendPaise: 250000, // Overall spend: ₹2,500 (125% of 2,000 -> EXCEEDED)
        grossSpendPaidPaise: 250000,
        settlementPaidPaise: 0,
        settlementReceivedPaise: 0,
        cashOutPaise: 250000,
        moneyReceivedPaise: 0,
        netSpendPaise: 250000,
        groupSharePaise: 250000,
        personalExpensesPaise: 0,
        recurringFinalizedPaise: 0,
        cashSpendPaise: 0,
        digitalSpendPaise: 250000,
        categorySpendPaise: {
          FOOD: 50000, // 50% -> ON_TRACK
          TRANSPORT: 85000, // 85% -> APPROACHING
        },
        merchantSpendPaise: {},
        expenseCount: 5,
        upcomingObligationsPaise: 0,
      })

      const enriched = await getBudgets()
      expect(enriched.length).toBe(3)

      const foodBudget = enriched.find((b) => b.category === "FOOD")!
      expect(foodBudget.status).toBe("ON_TRACK")
      expect(foodBudget.actualSpendPaise).toBe(50000)
      expect(foodBudget.remainingPaise).toBe(50000)
      expect(foodBudget.percentUsed).toBe(50)

      const transportBudget = enriched.find((b) => b.category === "TRANSPORT")!
      expect(transportBudget.status).toBe("APPROACHING")
      expect(transportBudget.percentUsed).toBe(85)

      const overallBudget = enriched.find((b) => b.category === null)!
      expect(overallBudget.status).toBe("EXCEEDED")
      expect(overallBudget.percentUsed).toBe(125)
      expect(overallBudget.remainingPaise).toBe(0)
    })
  })

  describe("updateBudget & deleteBudget (IDOR Security)", () => {
    it("should prevent IDOR when user attempts to update someone else's budget", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "attacker-id" } })
      vi.mocked(prisma.budget.findUnique).mockResolvedValueOnce({
        id: "victim-budget",
        userId: "victim-user-id",
        amountPaise: 500000,
      } as any)

      const formData = new FormData()
      formData.set("id", "victim-budget")
      formData.set("amount", "100")

      await expect(updateBudget(formData)).rejects.toThrow("Unauthorized: Access denied")
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "IDOR_ATTEMPT_BLOCKED" })
      )
    })

    it("should prevent IDOR when user attempts to delete someone else's budget", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "attacker-id" } })
      vi.mocked(prisma.budget.findUnique).mockResolvedValueOnce({
        id: "victim-budget",
        userId: "victim-user-id",
      } as any)

      await expect(deleteBudget("victim-budget")).rejects.toThrow("Unauthorized: Access denied")
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "IDOR_ATTEMPT_BLOCKED" })
      )
    })

    it("should allow owner to delete their budget", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce({ user: { id: "owner-id" } })
      vi.mocked(prisma.budget.findUnique).mockResolvedValueOnce({
        id: "owner-budget",
        userId: "owner-id",
      } as any)
      vi.mocked(prisma.budget.update).mockResolvedValueOnce({} as any)

      const res = await deleteBudget("owner-budget")
      expect(res.success).toBe(true)
      expect(prisma.budget.update).toHaveBeenCalledWith({
        where: { id: "owner-budget" },
        data: { active: false },
      })
    })
  })

  describe("evaluateBudgetAlerts (Deduplicated Alerts)", () => {
    it("should dispatch deduplicated BUDGET_WARNING and BUDGET_EXCEEDED notifications", async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValueOnce([
        {
          id: "b-warn",
          userId: "user-1",
          category: "FOOD",
          amountPaise: 100000,
          period: "MONTHLY",
          warningPercent: 80,
          active: true,
        } as any,
        {
          id: "b-exceed",
          userId: "user-1",
          category: "TRAVEL",
          amountPaise: 100000,
          period: "MONTHLY",
          warningPercent: 80,
          active: true,
        } as any,
      ])

      // Spend: Food at 85% (Warning), Travel at 110% (Exceeded)
      vi.mocked(getUserTrueSpend).mockResolvedValue({
        totalTrueSpendPaise: 195000,
        grossSpendPaidPaise: 195000,
        settlementPaidPaise: 0,
        settlementReceivedPaise: 0,
        cashOutPaise: 195000,
        moneyReceivedPaise: 0,
        netSpendPaise: 195000,
        groupSharePaise: 195000,
        personalExpensesPaise: 0,
        recurringFinalizedPaise: 0,
        cashSpendPaise: 0,
        digitalSpendPaise: 195000,
        categorySpendPaise: {
          FOOD: 85000,
          TRAVEL: 110000,
        },
        merchantSpendPaise: {},
        expenseCount: 2,
        upcomingObligationsPaise: 0,
      })

      await evaluateBudgetAlerts("user-1")

      expect(sendNotification).toHaveBeenCalledTimes(2)
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "BUDGET_WARNING",
          dedupKey: expect.stringMatching(/^budget-warn-b-warn-M-/),
        })
      )
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "BUDGET_EXCEEDED",
          dedupKey: expect.stringMatching(/^budget-exceeded-b-exceed-M-/),
        })
      )
    })
  })
})
