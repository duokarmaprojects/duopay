import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createOrderImport,
  getOrderImport,
  confirmOrderImport,
  dismissOrderImport,
} from "./orderImport"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NormalizedOrder } from "@/domain/orderImport"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/actions/expense", () => ({
  addExpense: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    receiptScan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn(),
    },
    orderImport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn(),
    },
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
  },
}))

function createSampleOrder(overrides: Partial<NormalizedOrder> = {}): NormalizedOrder {
  return {
    provider: "SWIGGY",
    externalOrderId: "SWIGGY-123",
    merchant: "Burger King",
    orderDate: "2026-02-01",
    subtotalPaise: 40000,
    taxPaise: 2000,
    deliveryFeePaise: 3000,
    discountPaise: 5000,
    tipPaise: 1000,
    totalPaise: 41000, // 40000 + 2000 + 3000 + 1000 - 5000 = 41000 (balanced)
    items: [
      {
        id: "item-1",
        name: "Whopper",
        quantity: 1,
        unitPricePaise: 40000,
        lineTotalPaise: 40000,
        categorySuggestion: "Food",
      },
    ],
    importSource: "MANUAL",
    ...overrides,
  }
}

describe("Order Import Security & Lifecycle Suite (orderImport.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createOrderImport", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      const order = createSampleOrder()
      await expect(createOrderImport(order)).rejects.toThrow("Unauthorized")
    })

    it("rejects negative monetary amounts", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      const order = createSampleOrder({ totalPaise: -500 })
      await expect(createOrderImport(order)).rejects.toThrow(/non-negative/)
    })

    it("successfully creates pending order import", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.orderImport.create).mockResolvedValueOnce({
        id: "import-123",
        status: "PENDING_REVIEW",
      } as any)

      const order = createSampleOrder()
      const res = await createOrderImport(order)
      expect(res.success).toBe(true)
      expect(res.importId).toBe("import-123")
    })
  })

  describe("IDOR Protection", () => {
    it("prevents reading another user's order import", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-bob" } } as any)
      vi.mocked(prisma.orderImport.findUnique).mockResolvedValueOnce({
        id: "import-alice",
        userId: "victim-alice",
        status: "PENDING_REVIEW",
      } as any)

      await expect(getOrderImport("import-alice")).rejects.toThrow(/Unauthorized/)
    })

    it("prevents dismissing another user's order import", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-bob" } } as any)
      vi.mocked(prisma.orderImport.findUnique).mockResolvedValueOnce({
        id: "import-alice",
        userId: "victim-alice",
        status: "PENDING_REVIEW",
      } as any)

      await expect(dismissOrderImport("import-alice")).rejects.toThrow(/Unauthorized/)
    })

    it("prevents confirming another user's order import", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-bob" } } as any)
      vi.mocked(prisma.orderImport.findUnique).mockResolvedValueOnce({
        id: "import-alice",
        userId: "victim-alice",
        status: "PENDING_REVIEW",
      } as any)

      const form = new FormData()
      form.append("importId", "import-alice")

      await expect(confirmOrderImport(form)).rejects.toThrow(/Unauthorized/)
    })
  })

  describe("confirmOrderImport Reconciliation & Invariants", () => {
    it("rejects confirming an order that is already CONFIRMED", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.orderImport.findUnique).mockResolvedValueOnce({
        id: "import-1",
        userId: "user-alice",
        status: "CONFIRMED",
      } as any)

      const form = new FormData()
      form.append("importId", "import-1")

      await expect(confirmOrderImport(form)).rejects.toThrow(/already been confirmed/)
    })

    it("rejects confirmation of unbalanced order without acknowledgeWarning", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      // Unbalanced order: stated total is 90000, components sum to 41000
      vi.mocked(prisma.orderImport.findUnique).mockResolvedValueOnce({
        id: "import-1",
        userId: "user-alice",
        status: "PENDING_REVIEW",
        provider: "SWIGGY",
        subtotalPaise: 40000,
        taxPaise: 2000,
        deliveryFeePaise: 3000,
        discountPaise: 5000,
        tipPaise: 1000,
        totalPaise: 90000, // Mismatch!
        itemsJson: JSON.stringify([
          { id: "i1", name: "Food", lineTotalPaise: 40000 },
        ]),
      } as any)

      const form = new FormData()
      form.append("importId", "import-1")

      await expect(confirmOrderImport(form)).rejects.toThrow(/Reconciliation mismatch/)
    })

    it("accepts confirmation of unbalanced order when user explicitly acknowledges warning", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.orderImport.findUnique).mockResolvedValueOnce({
        id: "import-1",
        userId: "user-alice",
        status: "PENDING_REVIEW",
        provider: "SWIGGY",
        subtotalPaise: 40000,
        taxPaise: 0,
        deliveryFeePaise: 0,
        discountPaise: 0,
        tipPaise: 0,
        totalPaise: 90000,
        itemsJson: "[]",
      } as any)

      const form = new FormData()
      form.append("importId", "import-1")
      form.append("acknowledgeWarning", "true")

      const res = await confirmOrderImport(form)
      expect(res.success).toBe(true)
      expect(prisma.orderImport.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "import-1", status: "PENDING_REVIEW" },
          data: { status: "CONFIRMED" },
        })
      )
    })
  })
})
