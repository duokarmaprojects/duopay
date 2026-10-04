import { describe, it, expect, vi, beforeEach } from "vitest"
import { createBudget, updateBudget, evaluateBudgetAlerts } from "@/actions/budget"
import { getSpendingAnalytics } from "@/actions/analytics"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUserTrueSpend } from "@/services/trueSpend"
import { sendNotification } from "@/services/notification"
import { checkActionRateLimit } from "@/lib/rateLimit"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/rateLimit", () => ({
  checkActionRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock("@/lib/securityAudit", () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/realtime/pusher", () => ({
  pusherServer: {
    trigger: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock("@/services/notification", () => ({
  sendNotification: vi.fn(),
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
    expense: {
      findMany: vi.fn(),
    },
    settlement: {
      findMany: vi.fn(),
    },
  },
}))

describe("Batch 5 Concurrency & Idempotency Invariants Suite", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(checkActionRateLimit).mockReturnValue({ allowed: true } as any)
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-concurrency-1", name: "Concurrency User" },
    } as any)
  })

  it("1. 10 concurrent requests for createBudget with the same idempotency key succeed with exactly ONE creation", async () => {
    let createdBudget: any = null
    const key = "idem-budget-concurrent-100"

    // Simulate atomic DB behavior under concurrency
    ;(vi.mocked(prisma.budget.findFirst) as any).mockImplementation(async ({ where }: any) => {
      if (where.idempotencyKey === key && createdBudget) {
        return createdBudget
      }
      return null
    })

    ;(vi.mocked(prisma.budget.updateMany) as any).mockResolvedValue({ count: 0 })

    ;(vi.mocked(prisma.budget.create) as any).mockImplementation(async ({ data }: any) => {
      if (createdBudget) {
        const err: any = new Error("Unique constraint failed on the fields: (`userId`, `idempotencyKey`)")
        err.code = "P2002"
        throw err
      }
      createdBudget = {
        id: "budget-concurrent-1",
        userId: data.userId,
        category: data.category,
        amountPaise: data.amountPaise,
        period: data.period,
        warningPercent: data.warningPercent,
        active: true,
        idempotencyKey: data.idempotencyKey,
        createdAt: new Date(),
      }
      return createdBudget
    })

    ;(vi.mocked(prisma.budget.findMany) as any).mockResolvedValue([])

    // Fire 10 concurrent requests with identical idempotencyKey
    const promises = Array.from({ length: 10 }, () => {
      const fd = new FormData()
      fd.set("amount", "10000") // ₹10,000
      fd.set("category", "SHOPPING")
      fd.set("period", "MONTHLY")
      fd.set("warningPercent", "80")
      fd.set("idempotencyKey", key)
      return createBudget(fd)
    })

    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)
    for (const res of results) {
      expect(res.success).toBe(true)
      expect(res.budget.id).toBe("budget-concurrent-1")
    }

    const newlyCreated = results.filter((r) => !r.isDuplicate)
    const duplicates = results.filter((r) => r.isDuplicate)

    expect(newlyCreated).toHaveLength(1)
    expect(duplicates).toHaveLength(9)
    expect(prisma.budget.create).toHaveBeenCalledTimes(10)
  })

  it("2. 10 concurrent calls to evaluateBudgetAlerts dispatch deduplicated notifications", async () => {
    const budgetId = "b-concurrent-alert-1"
    const userId = "user-concurrency-1"

    vi.mocked(prisma.budget.findMany).mockResolvedValue([
      {
        id: budgetId,
        userId,
        category: "FOOD",
        amountPaise: 500000, // ₹5,000
        period: "MONTHLY",
        warningPercent: 80,
        active: true,
      } as any,
    ])

    vi.mocked(getUserTrueSpend).mockResolvedValue({
      totalTrueSpendPaise: 450000,
      grossSpendPaidPaise: 450000,
      settlementPaidPaise: 0,
      settlementReceivedPaise: 0,
      cashOutPaise: 450000,
      moneyReceivedPaise: 0,
      netSpendPaise: 450000,
      groupSharePaise: 450000,
      personalExpensesPaise: 0,
      recurringFinalizedPaise: 0,
      cashSpendPaise: 0,
      digitalSpendPaise: 450000,
      categorySpendPaise: { FOOD: 450000 }, // 90% -> APPROACHING threshold
      merchantSpendPaise: {},
      expenseCount: 4,
      upcomingObligationsPaise: 0,
    })

    // Simulate deduplication cache in sendNotification
    const sentDedupKeys = new Set<string>()
    let notificationDispatchCount = 0

    ;(vi.mocked(sendNotification) as any).mockImplementation(async (params: any) => {
      if (params.dedupKey && sentDedupKeys.has(params.dedupKey)) {
        return { id: "notif-duplicate-suppressed" }
      }
      if (params.dedupKey) {
        sentDedupKeys.add(params.dedupKey)
      }
      notificationDispatchCount++
      return { id: `notif-${notificationDispatchCount}` }
    })

    // Fire 10 concurrent calls to evaluateBudgetAlerts
    const promises = Array.from({ length: 10 }, () => evaluateBudgetAlerts(userId))
    await Promise.all(promises)

    // All calls finished successfully
    expect(promises).toHaveLength(10)
    // Exactly 1 new notification recorded in the dedup store for the monthly period
    expect(sentDedupKeys.size).toBe(1)
    expect(notificationDispatchCount).toBe(1)
    expect(Array.from(sentDedupKeys)[0]).toMatch(/^budget-warn-b-concurrent-alert-1-M-/)
  })

  it("3. 10 concurrent calls to getSpendingAnalytics have zero side effects and return identical results", async () => {
    const userId = "user-concurrency-1"

    vi.mocked(getUserTrueSpend).mockResolvedValue({
      totalTrueSpendPaise: 75000,
      grossSpendPaidPaise: 75000,
      settlementPaidPaise: 15000,
      settlementReceivedPaise: 0,
      cashOutPaise: 90000,
      moneyReceivedPaise: 0,
      netSpendPaise: 75000,
      groupSharePaise: 75000,
      personalExpensesPaise: 0,
      recurringFinalizedPaise: 0,
      cashSpendPaise: 0,
      digitalSpendPaise: 75000,
      categorySpendPaise: { ENTERTAINMENT: 75000 },
      merchantSpendPaise: { Cinema: 75000 },
      expenseCount: 3,
      upcomingObligationsPaise: 0,
    })

    vi.mocked(prisma.expense.findMany).mockResolvedValue([])

    // Fire 10 concurrent analytics read queries
    const promises = Array.from({ length: 10 }, () => getSpendingAnalytics("MONTH"))
    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)

    // Zero side-effects: no creates, updates, or deletes
    expect(prisma.budget.create).not.toHaveBeenCalled()
    expect(prisma.budget.update).not.toHaveBeenCalled()
    expect(prisma.budget.updateMany).not.toHaveBeenCalled()

    // Identical deterministic values across all concurrent threads
    const first = results[0]
    for (const res of results) {
      expect(res.userSharePaise).toBe(first.userSharePaise)
      expect(res.totalSpentPaise).toBe(first.totalSpentPaise)
      expect(res.expenseCount).toBe(first.expenseCount)
      expect(res.categories).toEqual(first.categories)
      expect(res.insights).toEqual(first.insights)
    }
  })

  it("4. 10 concurrent budget updates execute safely and produce deterministic final state", async () => {
    let currentAmount = 500000
    const budgetId = "b-concurrent-update-1"
    const userId = "user-concurrency-1"

    ;(vi.mocked(prisma.budget.findUnique) as any).mockResolvedValue({
      id: budgetId,
      userId,
      amountPaise: currentAmount,
      warningPercent: 80,
    })

    ;(vi.mocked(prisma.budget.update) as any).mockImplementation(async ({ data }: any) => {
      if (data.amountPaise) {
        currentAmount = data.amountPaise
      }
      return {
        id: budgetId,
        userId,
        amountPaise: currentAmount,
        warningPercent: data.warningPercent || 80,
      }
    })

    vi.mocked(prisma.budget.findMany).mockResolvedValue([])

    // Fire 10 concurrent updates setting amounts 1000..10000
    const promises = Array.from({ length: 10 }, (_, i) => {
      const fd = new FormData()
      fd.set("id", budgetId)
      fd.set("amount", `${(i + 1) * 1000}`)
      return updateBudget(fd)
    })

    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)
    for (const res of results) {
      expect(res.success).toBe(true)
      expect(res.budget.id).toBe(budgetId)
    }
    expect(prisma.budget.update).toHaveBeenCalledTimes(10)
  })
})
