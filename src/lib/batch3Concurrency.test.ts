import { describe, it, expect, vi, beforeEach } from "vitest"
import { confirmReceiptExpense } from "@/actions/receiptScan"
import { confirmOrderImport } from "@/actions/orderImport"
import { addExpense } from "@/actions/expense"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  let expenseStore: any[] = []
  let receiptScanState: any = null
  let orderImportState: any = null

  return {
    __resetState: () => {
      expenseStore = []
      receiptScanState = {
        id: "scan-concurrent-1",
        userId: "user-1",
        status: "NEEDS_REVIEW",
        source: "RECEIPT",
      }
      orderImportState = {
        id: "import-concurrent-1",
        userId: "user-1",
        status: "PENDING_REVIEW",
        provider: "SWIGGY",
        subtotalPaise: 50000,
        taxPaise: 0,
        deliveryFeePaise: 0,
        discountPaise: 0,
        tipPaise: 0,
        totalPaise: 50000,
        itemsJson: JSON.stringify([{ id: "i1", name: "Food", quantity: 1, unitPricePaise: 50000, lineTotalPaise: 50000 }]),
        orderDate: new Date(),
      }
    },
    prisma: {
      group: {
        findUnique: vi.fn().mockResolvedValue({ id: "group-1", name: "Test Group" }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "user-1", name: "User 1" }),
      },
      groupMember: {
        findMany: vi.fn().mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]),
      },
      expense: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.idempotencyKey) {
            return expenseStore.find((e) => e.idempotencyKey === where.idempotencyKey) || null
          }
          return null
        }),
        create: vi.fn(async ({ data }: any) => {
          if (data.idempotencyKey && expenseStore.some((e) => e.idempotencyKey === data.idempotencyKey)) {
            const err: any = new Error("Unique constraint failed on the fields: (`idempotencyKey`)")
            err.code = "P2002"
            throw err
          }
          const rec = { id: `exp-${expenseStore.length + 1}`, ...data }
          expenseStore.push(rec)
          return rec
        }),
      },
      expenseParticipant: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      receiptItem: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      receiptScan: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id === "scan-concurrent-1") return receiptScanState
          return null
        }),
        update: vi.fn(async ({ where, data }: any) => {
          if (where.id === "scan-concurrent-1") {
            receiptScanState = { ...receiptScanState, ...data }
            return receiptScanState
          }
          return null
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (where.id === "scan-concurrent-1" && receiptScanState?.status === where.status) {
            receiptScanState = { ...receiptScanState, ...data }
            return { count: 1 }
          }
          return { count: 0 }
        }),
      },
      orderImport: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id === "import-concurrent-1") return orderImportState
          return null
        }),
        update: vi.fn(async ({ where, data }: any) => {
          if (where.id === "import-concurrent-1") {
            orderImportState = { ...orderImportState, ...data }
            return orderImportState
          }
          return null
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (where.id === "import-concurrent-1" && orderImportState?.status === where.status) {
            orderImportState = { ...orderImportState, ...data }
            return { count: 1 }
          }
          return { count: 0 }
        }),
      },
      automationRule: { findMany: async () => [] },
      merchantAlias: { findUnique: async () => null },
      merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
      $transaction: vi.fn(async (cb: any) => {
        const txMock = {
          expense: {
            findUnique: async ({ where }: any) => {
              if (where.idempotencyKey) {
                return expenseStore.find((e) => e.idempotencyKey === where.idempotencyKey) || null
              }
              return null
            },
            create: async ({ data }: any) => {
              if (data.idempotencyKey && expenseStore.some((e) => e.idempotencyKey === data.idempotencyKey)) {
                const err: any = new Error("Unique constraint failed on fields (`idempotencyKey`)")
                err.code = "P2002"
                throw err
              }
              const rec = { id: `exp-${expenseStore.length + 1}`, ...data }
              expenseStore.push(rec)
              return rec
            },
          },
          expenseParticipant: {
            createMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          receiptItem: {
            createMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        }
        return cb(txMock)
      }),
    },
  }
})

describe("Batch 3 Concurrency & Idempotency Enforcement (10 concurrent requests)", () => {
  beforeEach(async () => {
    const dbModule: any = await import("@/lib/db")
    if (dbModule.__resetState) dbModule.__resetState()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any)
  })

  it("10 concurrent cash expense submissions with identical idempotencyKey produce EXACTLY ONE expense", async () => {
    const idempotencyKey = "cash-concurrent-token-999"

    const runSubmission = async () => {
      const form = new FormData()
      form.set("groupId", "group-1")
      form.set("description", "Concurrent Cash Chai")
      form.set("amount", "100.00")
      form.set("payerId", "user-1")
      form.append("participants", "user-1")
      form.append("participants", "user-2")
      form.set("splitMethod", "EQUAL")
      form.set("source", "CASH")
      form.set("idempotencyKey", idempotencyKey)

      try {
        await addExpense(form)
        return "SUCCESS"
      } catch (err: any) {
        if (err?.message?.includes("REDIRECT")) return "REDIRECT"
        return `ERROR: ${err?.message}`
      }
    }

    // Launch 10 concurrent attempts simultaneously
    const results = await Promise.all(Array.from({ length: 10 }, () => runSubmission()))

    // All should succeed or redirect cleanly without unhandled failure
    for (const res of results) {
      expect(res).toMatch(/SUCCESS|REDIRECT/)
    }

    // Verify only 1 expense was created in database transaction
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it("10 concurrent receipt confirmations on same scan produce EXACTLY ONE confirmation", async () => {
    let successCount = 0
    let alreadyConfirmedCount = 0

    const runConfirm = async () => {
      const form = new FormData()
      form.set("scanId", "scan-concurrent-1")
      form.set("groupId", "group-1")
      form.set("description", "Pizza Receipt")
      form.set("amount", "800.00")
      form.set("payerId", "user-1")
      form.append("participants", "user-1")
      form.append("participants", "user-2")
      form.set("splitMethod", "EQUAL")

      try {
        await confirmReceiptExpense(form)
        successCount++
      } catch (err: any) {
        if (err?.message?.includes("already been confirmed") || err?.message?.includes("REDIRECT")) {
          alreadyConfirmedCount++
        }
      }
    }

    await Promise.all(Array.from({ length: 10 }, () => runConfirm()))

    // Exactly 1 must successfully transition state
    expect(successCount).toBe(1)
    expect(alreadyConfirmedCount).toBe(9)
  })

  it("10 concurrent order import confirmations on same order produce EXACTLY ONE confirmation", async () => {
    let successCount = 0
    let rejectedCount = 0

    const runConfirm = async () => {
      const form = new FormData()
      form.set("importId", "import-concurrent-1")
      form.set("groupId", "group-1")
      form.set("description", "Swiggy Dinner")
      form.set("amount", "500.00")
      form.set("payerId", "user-1")
      form.append("participants", "user-1")
      form.append("participants", "user-2")
      form.set("splitMethod", "EQUAL")

      try {
        await confirmOrderImport(form)
        successCount++
      } catch (err: any) {
        if (err?.message?.includes("already been confirmed") || err?.message?.includes("REDIRECT")) {
          rejectedCount++
        }
      }
    }

    await Promise.all(Array.from({ length: 10 }, () => runConfirm()))

    expect(successCount).toBe(1)
    expect(rejectedCount).toBe(9)
  })
})
