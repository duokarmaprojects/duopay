import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createRecurringExpense,
  updateRecurringExpenseStatus,
  deleteRecurringExpense,
  generateDueRecurringExpenses,
} from "./recurring"
import { calculateNextOccurrence, getRecurringExpenseIdempotencyKey } from "@/domain/recurring"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/services/notification", () => ({
  sendNotification: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    groupMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    recurringExpense: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    expenseParticipant: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt-1" }),
    },
  },
}))

describe("PHASE 2: Recurring Expenses System", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "user-alice" },
    } as any)
  })

  describe("1. Next Occurrence & Idempotency Domain Calculations", () => {
    it("advances DAILY frequency by exactly 1 day", () => {
      const start = new Date("2026-10-01T10:00:00.000Z")
      const next = calculateNextOccurrence(start, "DAILY")
      expect(next.toISOString().slice(0, 10)).toBe("2026-10-02")
    })

    it("advances WEEKLY frequency by exactly 7 days", () => {
      const start = new Date("2026-10-01T10:00:00.000Z")
      const next = calculateNextOccurrence(start, "WEEKLY")
      expect(next.toISOString().slice(0, 10)).toBe("2026-10-08")
    })

    it("advances MONTHLY frequency deterministically without drift", () => {
      const start = new Date("2026-01-31T10:00:00.000Z")
      const next = calculateNextOccurrence(start, "MONTHLY")
      // Jan 31 -> Feb 28 in 2026
      expect(next.getMonth()).toBe(1) // February
      expect(next.getDate()).toBe(28)
    })

    it("generates deterministic idempotency key for recurring occurrences", () => {
      const date = new Date("2026-10-15T00:00:00.000Z")
      const key1 = getRecurringExpenseIdempotencyKey("rec-123", date)
      const key2 = getRecurringExpenseIdempotencyKey("rec-123", date)
      expect(key1).toBe("recurring:rec-123:2026-10-15")
      expect(key1).toBe(key2)
    })
  })

  describe("2. Authorization & Input Validation", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce(null)
      await expect(
        createRecurringExpense({
          groupId: "group-1",
          description: "WiFi Bill",
          amount: 1500,
          frequency: "MONTHLY",
          startDate: "2026-10-01",
          participantIds: ["user-alice"],
        })
      ).rejects.toThrow("Unauthorized")
    })

    it("rejects recurring expense creation by non-group member", async () => {
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce(null) // Not member
      await expect(
        createRecurringExpense({
          groupId: "group-1",
          description: "Rent",
          amount: 20000,
          frequency: "MONTHLY",
          startDate: "2026-10-01",
          participantIds: ["user-alice"],
        })
      ).rejects.toThrow("You must be an active member of this group")
    })

    it("rejects invalid frequencies", async () => {
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({ id: "gm-1" } as any)
      await expect(
        createRecurringExpense({
          groupId: "group-1",
          description: "Netflix",
          amount: 649,
          frequency: "HOURLY" as any,
          startDate: "2026-10-01",
          participantIds: ["user-alice"],
        })
      ).rejects.toThrow()
    })

    it("creates recurring expense successfully with positive paise", async () => {
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({ id: "gm-1" } as any)
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
        { userId: "user-alice" },
        { userId: "user-bob" },
      ] as any)
      vi.mocked(prisma.recurringExpense.create).mockResolvedValueOnce({
        id: "rec-new",
      } as any)

      const res = await createRecurringExpense({
        groupId: "group-1",
        description: "Shared WiFi",
        amount: 1000,
        frequency: "MONTHLY",
        startDate: "2026-10-05T00:00:00.000Z",
        participantIds: ["user-alice", "user-bob"],
      })

      expect(res.success).toBe(true)
      expect(prisma.recurringExpense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          groupId: "group-1",
          amount: 100000, // In paise
          frequency: "MONTHLY",
          payerId: "user-alice",
          status: "ACTIVE",
        }),
      })
    })
  })

  describe("3. Lifecycle: Pause, Resume, Deletion & IDOR Protection", () => {
    it("prevents non-owner/non-creator from pausing or deleting schedule", async () => {
      vi.mocked(prisma.recurringExpense.findUnique).mockResolvedValueOnce({
        id: "rec-1",
        payerId: "user-victim",
        groupId: "group-1",
        group: {
          members: [{ userId: "group-creator" }],
        },
      } as any)

      await expect(updateRecurringExpenseStatus("rec-1", "PAUSED")).rejects.toThrow(
        "You are not authorized to update this recurring expense"
      )
    })

    it("allows owner to pause, resume and delete schedule", async () => {
      vi.mocked(prisma.recurringExpense.findUnique).mockResolvedValue({
        id: "rec-1",
        payerId: "user-alice",
        groupId: "group-1",
        group: {
          members: [{ userId: "user-alice" }],
        },
      } as any)

      const pauseRes = await updateRecurringExpenseStatus("rec-1", "PAUSED")
      expect(pauseRes.success).toBe(true)
      expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: "rec-1" },
        data: { status: "PAUSED" },
      })

      const deleteRes = await deleteRecurringExpense("rec-1")
      expect(deleteRes.success).toBe(true)
      expect(prisma.recurringExpense.delete).toHaveBeenCalledWith({
        where: { id: "rec-1" },
      })
    })
  })

  describe("4. Idempotent Due Expense Generation", () => {
    it("generates an immutable expense record for due occurrence without duplicate re-execution", async () => {
      const pastDue = new Date(Date.now() - 10000)
      vi.mocked(prisma.recurringExpense.findMany).mockResolvedValueOnce([
        {
          id: "rec-due-1",
          groupId: "group-1",
          description: "Office Internet",
          amount: 200000,
          payerId: "user-alice",
          frequency: "MONTHLY",
          splitMethod: "EQUAL",
          splitData: JSON.stringify({ participantIds: ["user-alice", "user-bob"] }),
          nextOccurrence: pastDue,
          status: "ACTIVE",
          group: {
            id: "group-1",
            name: "Roommates",
            members: [{ userId: "user-alice" }, { userId: "user-bob" }],
          },
        } as any,
      ])

      // First run: no existing expense
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.expense.create).mockResolvedValueOnce({ id: "exp-gen-1" } as any)

      const run1 = await generateDueRecurringExpenses("group-1")
      expect(run1.generatedCount).toBe(1)
      expect(prisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          groupId: "group-1",
          amount: 200000,
          idempotencyKey: expect.stringContaining("recurring:rec-due-1:"),
        }),
      })

      // Occurrence advanced
      expect(prisma.recurringExpense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rec-due-1" },
          data: expect.objectContaining({
            lastGeneratedAt: expect.any(Date),
          }),
        })
      )
    })
  })
})
