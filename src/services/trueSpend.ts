import { prisma } from "@/lib/db"
import {
  aggregateTrueSpend,
  TrueSpendExpenseInput,
  TrueSpendSettlementInput,
  TrueSpendSummary,
} from "@/domain/trueSpend"

export interface TrueSpendDateRange {
  startDate?: Date
  endDate?: Date
}

/**
 * Service to calculate True Spend from authoritative database records.
 * Only selects FINAL records for actual historical spend and UPCOMING for projected obligations.
 */
export async function getUserTrueSpend(
  userId: string,
  range?: TrueSpendDateRange
): Promise<TrueSpendSummary> {
  const dateFilter =
    range?.startDate || range?.endDate
      ? {
          date: {
            ...(range.startDate ? { gte: range.startDate } : {}),
            ...(range.endDate ? { lte: range.endDate } : {}),
          },
        }
      : {}

  // 1. Fetch expenses where user is either payer or a participant
  const rawExpenses = await prisma.expense.findMany({
    where: {
      AND: [
        {
          OR: [
            { payerId: userId },
            { participants: { some: { userId } } },
          ],
        },
        dateFilter,
      ],
    },
    include: {
      participants: {
        select: {
          userId: true,
          share: true,
        },
      },
    },
    orderBy: { date: "desc" },
  })

  // 2. Fetch settlements in period
  const settlementDateFilter =
    range?.startDate || range?.endDate
      ? {
          createdAt: {
            ...(range.startDate ? { gte: range.startDate } : {}),
            ...(range.endDate ? { lte: range.endDate } : {}),
          },
        }
      : {}

  const rawSettlements = await prisma.settlement.findMany({
    where: {
      AND: [
        {
          OR: [{ payerId: userId }, { receiverId: userId }],
        },
        settlementDateFilter,
      ],
    },
    select: {
      id: true,
      payerId: true,
      receiverId: true,
      amount: true,
      status: true,
    },
  })

  const expensesInput: TrueSpendExpenseInput[] = (rawExpenses || []).map((e) => ({
    id: e.id,
    groupId: e.groupId,
    description: e.description,
    category: e.category,
    amount: e.amount,
    payerId: e.payerId,
    date: e.date,
    source: e.source,
    status: e.status,
    isPoolExpense: e.isPoolExpense,
    priority: e.priority,
    metadata: e.metadata,
    participants: e.participants,
  }))

  const settlementsInput: TrueSpendSettlementInput[] = (rawSettlements || []).map((s) => ({
    id: s.id,
    payerId: s.payerId,
    receiverId: s.receiverId,
    amount: s.amount,
    status: s.status,
  }))

  return aggregateTrueSpend(expensesInput, settlementsInput, userId)
}

/**
 * Calculates True Spend for a specific calendar month.
 */
export async function getUserMonthlyTrueSpend(
  userId: string,
  year: number,
  month: number // 0-indexed (0 = Jan, 11 = Dec)
): Promise<TrueSpendSummary> {
  const startDate = new Date(year, month, 1, 0, 0, 0, 0)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return getUserTrueSpend(userId, { startDate, endDate })
}
