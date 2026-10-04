import { describe, it, expect, vi, beforeEach } from "vitest"
import { addExpense } from "./expense"
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
    group: {
      findUnique: vi.fn().mockResolvedValue({ id: "group-1", name: "Group 1" }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: "user-alice", name: "Alice" }),
    },
    groupMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    expense: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    expenseParticipant: {
      createMany: vi.fn(),
    },
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
    receiptScan: { create: async () => null, findUnique: async () => null, update: async () => null, findMany: async () => [] },
    orderImport: { create: async () => null, findUnique: async () => null, update: async () => null, findMany: async () => [] },
    $transaction: vi.fn(async (cb) => {
      const mockTx = {
        expense: {
          create: vi.fn().mockResolvedValue({ id: "cash-exp-1", groupId: "group-1" }),
        },
        expenseParticipant: {
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        receiptItem: {
          createMany: vi.fn(),
        },
      }
      return cb(mockTx)
    }),
  },
}))

describe("Phase M: Cash Expenses Hardening Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects unauthenticated cash expense submission", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const form = new FormData()
    form.set("groupId", "group-1")
    form.set("description", "Street food cash")
    form.set("amount", "250.00")
    form.set("source", "CASH")

    await expect(addExpense(form)).rejects.toThrow("Unauthorized")
  })

  it("rejects cash expense from non-member of group", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-attacker" } } as any)
    vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
      { userId: "user-alice" },
      { userId: "user-bob" },
    ] as any)

    const form = new FormData()
    form.set("groupId", "group-1")
    form.set("description", "Taxi cash")
    form.set("amount", "500.00")
    form.set("payerId", "user-attacker")
    form.set("source", "CASH")
    form.append("participants", "user-attacker")

    await expect(addExpense(form)).rejects.toThrow(/Unauthorized: You are not a member of this group/)
  })

  it("blocks client attempts to forge verification fields on cash expenses", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)

    const form = new FormData()
    form.set("groupId", "group-1")
    form.set("description", "Cash payment")
    form.set("amount", "100.00")
    form.set("source", "CASH")
    form.set("paymentStatus", "PROVIDER_VERIFIED") // Malicious parameter

    await expect(addExpense(form)).rejects.toThrow(/Client submission of payment verification state is strictly prohibited/)
  })

  it("blocks client attempts to set status=FINAL directly", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)

    const form = new FormData()
    form.set("groupId", "group-1")
    form.set("description", "Cash payment")
    form.set("amount", "100.00")
    form.set("source", "CASH")
    form.set("status", "FINAL") // Malicious parameter

    await expect(addExpense(form)).rejects.toThrow(/Client submission of payment verification state is strictly prohibited/)
  })

  it("successfully processes valid cash expense using integer paise within transaction", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
    vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
      { userId: "user-alice" },
      { userId: "user-bob" },
    ] as any)

    const form = new FormData()
    form.set("groupId", "group-1")
    form.set("description", "Local Market Groceries")
    form.set("amount", "450.00")
    form.set("payerId", "user-alice")
    form.append("participants", "user-alice")
    form.append("participants", "user-bob")
    form.set("splitMethod", "EQUAL")
    form.set("source", "CASH")

    await expect(addExpense(form)).rejects.toThrow(/NEXT_REDIRECT|REDIRECT/)
    expect(prisma.$transaction).toHaveBeenCalled()
  })
})
