import { describe, it, expect, vi, beforeEach } from "vitest"
import { getUserTrueSpend, getUserMonthlyTrueSpend } from "./trueSpend"
import { prisma } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  prisma: {
    expense: {
      findMany: vi.fn(),
    },
    settlement: {
      findMany: vi.fn(),
    },
  },
}))

describe("Phase R: True Spend Service (services/trueSpend.ts)", () => {
  const USER_ID = "user-alice"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("queries finalized expenses and completed settlements to return True Spend metrics", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([
      {
        id: "exp-1",
        groupId: "group-1",
        description: "Team Lunch",
        category: "Food",
        amount: 400000, // ₹4,000
        payerId: "user-bob",
        date: new Date("2026-10-01"),
        source: "MANUAL",
        status: "FINAL",
        participants: [
          { userId: USER_ID, share: 100000 }, // User share ₹1,000
          { userId: "user-bob", share: 300000 },
        ],
      },
    ] as any)

    vi.mocked(prisma.settlement.findMany).mockResolvedValueOnce([
      {
        id: "set-1",
        payerId: USER_ID,
        receiverId: "user-bob",
        amount: 50000,
        status: "COMPLETED",
      },
    ] as any)

    const summary = await getUserTrueSpend(USER_ID, {
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-31"),
    })

    expect(summary.totalTrueSpendPaise).toBe(100000)
    expect(summary.cashOutPaise).toBe(50000) // Settlement paid
    expect(summary.categorySpendPaise["Food"]).toBe(100000)
    expect(summary.groupSharePaise).toBe(100000)
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([{ payerId: USER_ID }, { participants: { some: { userId: USER_ID } } }]),
            }),
          ]),
        }),
      })
    )
  })

  it("getUserMonthlyTrueSpend calculates boundaries for October 2026", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.settlement.findMany).mockResolvedValueOnce([])

    await getUserMonthlyTrueSpend(USER_ID, 2026, 9) // 9 = October (0-indexed)

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              date: {
                gte: new Date(2026, 9, 1, 0, 0, 0, 0),
                lte: new Date(2026, 10, 0, 23, 59, 59, 999),
              },
            },
          ]),
        }),
      })
    )
  })
})
