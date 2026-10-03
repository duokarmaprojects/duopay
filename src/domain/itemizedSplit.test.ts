import { describe, it, expect } from "vitest"
import { reconcileItemizedSplit } from "@/domain/itemizedSplit"
import { calculateEqualSplit } from "@/domain/money"

describe("Phase 3 Killer UX Suite: Itemized Splitting & Reconciliation", () => {
  it("should reconcile single item split exactly across participants", () => {
    const items = [
      {
        itemId: "item-1",
        name: "Pizza",
        amountPaise: 60000, // ₹600
        assignedUserIds: ["user-alice", "user-bob"],
      },
    ]

    const result = reconcileItemizedSplit(items, 60000)
    expect(result.shares["user-alice"]).toBe(30000)
    expect(result.shares["user-bob"]).toBe(30000)
    expect(result.totalPaise).toBe(60000)
    expect(result.isExactMatch).toBe(true)
  })

  it("should enforce financial invariant: SUM(participant shares) === totalPaise exactly", () => {
    // 3 items with distinct participants and uneven split
    // Item 1: Pizza ₹600 -> Alice + Bob
    // Item 2: Burger ₹300 -> Bob
    // Item 3: Drinks ₹200 -> Alice + Charlie
    // Total = ₹1100 (110000 paise)
    const items = [
      {
        itemId: "item-1",
        name: "Pizza",
        amountPaise: 60000,
        assignedUserIds: ["user-alice", "user-bob"],
      },
      {
        itemId: "item-2",
        name: "Burger",
        amountPaise: 30000,
        assignedUserIds: ["user-bob"],
      },
      {
        itemId: "item-3",
        name: "Drinks",
        amountPaise: 20000,
        assignedUserIds: ["user-alice", "user-charlie"],
      },
    ]

    const totalPaise = 110000
    const result = reconcileItemizedSplit(items, totalPaise)

    expect(result.shares["user-alice"]).toBe(30000 + 10000) // 40000 paise (₹400)
    expect(result.shares["user-bob"]).toBe(30000 + 30000)   // 60000 paise (₹600)
    expect(result.shares["user-charlie"]).toBe(10000)       // 10000 paise (₹100)

    const sumShares = Object.values(result.shares).reduce((a, b) => a + b, 0)
    expect(sumShares).toBe(totalPaise)
    expect(result.isExactMatch).toBe(true)
  })

  it("should handle 1-paise division remainder deterministically without money creation or leakage", () => {
    // ₹100.00 = 10000 paise split 3 ways -> 3334, 3333, 3333 = 10000
    const items = [
      {
        itemId: "item-odd",
        name: "Odd Split",
        amountPaise: 10000,
        assignedUserIds: ["u1", "u2", "u3"],
      },
    ]

    const result = reconcileItemizedSplit(items, 10000)
    const sum = Object.values(result.shares).reduce((a, b) => a + b, 0)
    expect(sum).toBe(10000)
    expect(result.isExactMatch).toBe(true)
  })
})
