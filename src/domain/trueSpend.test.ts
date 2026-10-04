import { describe, it, expect } from "vitest"
import {
  calculateExpenseTrueSpend,
  calculateUpcomingObligation,
  aggregateTrueSpend,
  TrueSpendExpenseInput,
  TrueSpendSettlementInput,
} from "./trueSpend"

describe("Phase R: True Spend Domain Engine (trueSpend.ts)", () => {
  const ALICE = "user-alice"
  const BOB = "user-bob"
  const CHARLIE = "user-charlie"

  describe("calculateExpenseTrueSpend (Single Expense Share)", () => {
    it("calculates True Spend as ₹750 for a ₹3,000 expense where user share is ₹750 (equal split)", () => {
      const expense: TrueSpendExpenseInput = {
        id: "exp-1",
        groupId: "group-1",
        description: "Dinner",
        category: "Food",
        amount: 300000, // ₹3,000
        payerId: BOB,
        date: new Date(),
        source: "MANUAL",
        status: "FINAL",
        participants: [
          { userId: ALICE, share: 75000 }, // ₹750
          { userId: BOB, share: 75000 },
          { userId: CHARLIE, share: 75000 },
          { userId: "user-david", share: 75000 },
        ],
      }

      // Alice's True Spend is ₹750, NOT ₹3,000
      const aliceSpend = calculateExpenseTrueSpend(expense, ALICE)
      expect(aliceSpend).toBe(75000)
    })

    it("returns True Spend as ₹750 even when user was the payer who fronted the full ₹3,000", () => {
      const expense: TrueSpendExpenseInput = {
        id: "exp-2",
        groupId: "group-1",
        description: "Hotel",
        category: "Travel",
        amount: 300000, // ₹3,000
        payerId: ALICE, // Alice paid
        date: new Date(),
        source: "MANUAL",
        status: "FINAL",
        participants: [
          { userId: ALICE, share: 75000 },
          { userId: BOB, share: 225000 },
        ],
      }

      // Alice's True Spend is her consumed share (₹750), not what she paid (₹3,000)
      const aliceSpend = calculateExpenseTrueSpend(expense, ALICE)
      expect(aliceSpend).toBe(75000)
    })

    it("returns 0 True Spend when user paid on behalf of others but has 0 share (excluded participant)", () => {
      const expense: TrueSpendExpenseInput = {
        id: "exp-3",
        groupId: "group-1",
        description: "Gifts for team",
        category: "Shopping",
        amount: 500000, // ₹5,000
        payerId: ALICE, // Alice paid
        date: new Date(),
        source: "MANUAL",
        status: "FINAL",
        participants: [
          { userId: BOB, share: 250000 },
          { userId: CHARLIE, share: 250000 },
        ], // Alice is not a participant
      }

      const aliceSpend = calculateExpenseTrueSpend(expense, ALICE)
      expect(aliceSpend).toBe(0)
    })

    it("returns 0 True Spend for UPCOMING expenses (never counted in historical spend)", () => {
      const upcomingExpense: TrueSpendExpenseInput = {
        id: "exp-upcoming",
        groupId: "group-1",
        description: "Next Month Rent",
        category: "Rent",
        amount: 2000000,
        payerId: ALICE,
        date: new Date(),
        source: "MANUAL",
        status: "UPCOMING",
        participants: [{ userId: ALICE, share: 1000000 }],
      }

      expect(calculateExpenseTrueSpend(upcomingExpense, ALICE)).toBe(0)
      // But upcoming obligations should record it
      expect(calculateUpcomingObligation(upcomingExpense, ALICE)).toBe(1000000)
    })

    it("returns 0 True Spend for SKIPPED expenses", () => {
      const skippedExpense: TrueSpendExpenseInput = {
        id: "exp-skipped",
        groupId: "group-1",
        description: "Cancelled Gym",
        category: "Health",
        amount: 150000,
        payerId: ALICE,
        date: new Date(),
        source: "MANUAL",
        status: "SKIPPED",
        participants: [{ userId: ALICE, share: 150000 }],
      }

      expect(calculateExpenseTrueSpend(skippedExpense, ALICE)).toBe(0)
      expect(calculateUpcomingObligation(skippedExpense, ALICE)).toBe(0)
    })

    it("handles exact, percentage, and shares splits correctly", () => {
      // Percentage split expense
      const percentageExp: TrueSpendExpenseInput = {
        id: "exp-pct",
        groupId: "group-1",
        description: "Shared Utility",
        category: "Utilities",
        amount: 100000, // ₹1,000
        payerId: BOB,
        date: new Date(),
        source: "MANUAL",
        status: "FINAL",
        participants: [
          { userId: ALICE, share: 40000 }, // 40%
          { userId: BOB, share: 60000 }, // 60%
        ],
      }
      expect(calculateExpenseTrueSpend(percentageExp, ALICE)).toBe(40000)

      // Shares split expense
      const sharesExp: TrueSpendExpenseInput = {
        id: "exp-shares",
        groupId: "group-1",
        description: "Groceries",
        category: "Food",
        amount: 30000, // ₹300
        payerId: CHARLIE,
        date: new Date(),
        source: "MANUAL",
        status: "FINAL",
        participants: [
          { userId: ALICE, share: 20000 }, // 2 shares out of 3
          { userId: BOB, share: 10000 }, // 1 share out of 3
        ],
      }
      expect(calculateExpenseTrueSpend(sharesExp, ALICE)).toBe(20000)
    })
  })

  describe("aggregateTrueSpend", () => {
    it("aggregates True Spend across multiple expenses, personal expenses, cash, and settlements", () => {
      const expenses: TrueSpendExpenseInput[] = [
        // 1. Group expense (Dinner): Alice share ₹750, Bob paid ₹3,000
        {
          id: "exp-1",
          groupId: "group-1",
          description: "Dinner",
          category: "Food",
          amount: 300000,
          payerId: BOB,
          date: new Date("2026-10-01"),
          source: "MANUAL",
          status: "FINAL",
          participants: [
            { userId: ALICE, share: 75000 },
            { userId: BOB, share: 225000 },
          ],
        },
        // 2. Personal expense (Solo Coffee in Cash): Alice paid ₹250
        {
          id: "exp-2",
          groupId: null,
          description: "Blue Tokai Coffee",
          category: "Food",
          amount: 25000,
          payerId: ALICE,
          date: new Date("2026-10-02"),
          source: "CASH",
          status: "FINAL",
          participants: [{ userId: ALICE, share: 25000 }],
        },
        // 3. Group expense where Alice paid ₹1,000, but has 0 share (excluded)
        {
          id: "exp-3",
          groupId: "group-2",
          description: "Movie tickets",
          category: "Entertainment",
          amount: 100000,
          payerId: ALICE,
          date: new Date("2026-10-03"),
          source: "MANUAL",
          status: "FINAL",
          participants: [{ userId: BOB, share: 100000 }],
        },
        // 4. Finalized recurring expense (Netflix subscription): Alice share ₹500
        {
          id: "exp-4",
          groupId: "group-1",
          description: "Netflix",
          category: "Subscriptions",
          amount: 50000,
          payerId: ALICE,
          date: new Date("2026-10-04"),
          source: "MANUAL",
          status: "FINAL",
          priority: "RECURRING",
          participants: [{ userId: ALICE, share: 50000 }],
        },
        // 5. UPCOMING obligation (not yet finalized): Alice share ₹2,000
        {
          id: "exp-5",
          groupId: "group-1",
          description: "Upcoming Electricity",
          category: "Utilities",
          amount: 400000,
          payerId: BOB,
          date: new Date("2026-10-25"),
          source: "MANUAL",
          status: "UPCOMING",
          participants: [
            { userId: ALICE, share: 200000 },
            { userId: BOB, share: 200000 },
          ],
        },
      ]

      const settlements: TrueSpendSettlementInput[] = [
        // Alice settled ₹750 to Bob
        {
          id: "set-1",
          payerId: ALICE,
          receiverId: BOB,
          amount: 75000,
          status: "COMPLETED",
        },
        // Charlie settled ₹1,000 to Alice
        {
          id: "set-2",
          payerId: CHARLIE,
          receiverId: ALICE,
          amount: 100000,
          status: "COMPLETED",
        },
      ]

      const summary = aggregateTrueSpend(expenses, settlements, ALICE)

      // Total True Spend = ₹750 (Dinner) + ₹250 (Coffee) + ₹0 (Movie) + ₹500 (Netflix) = ₹1,500 (150,000 paise)
      expect(summary.totalTrueSpendPaise).toBe(150000)
      expect(summary.expenseCount).toBe(3) // 3 finalized expenses where Alice had share > 0

      // Group vs Personal
      // Group share: Dinner (₹750) + Netflix (₹500) = ₹1,250
      expect(summary.groupSharePaise).toBe(125000)
      // Personal: Coffee (₹250) = ₹250
      expect(summary.personalExpensesPaise).toBe(25000)

      // Cash vs Digital
      expect(summary.cashSpendPaise).toBe(25000)
      expect(summary.digitalSpendPaise).toBe(125000)

      // Recurring finalized
      expect(summary.recurringFinalizedPaise).toBe(50000)

      // Cash Out: What Alice physically spent out of pocket:
      // Coffee (₹250) + Movie (₹1,000) + Netflix (₹500) + Settlement to Bob (₹750) = ₹2,500 (250,000 paise)
      expect(summary.cashOutPaise).toBe(250000)

      // Money Received: Charlie settlement = ₹1,000 (100,000 paise)
      expect(summary.moneyReceivedPaise).toBe(100000)

      // Categories
      expect(summary.categorySpendPaise["Food"]).toBe(100000) // ₹750 + ₹250
      expect(summary.categorySpendPaise["Subscriptions"]).toBe(50000)

      // Upcoming Obligations (strictly separate!)
      expect(summary.upcomingObligationsPaise).toBe(200000)
    })
  })
})
