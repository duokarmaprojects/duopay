import { prisma } from "@/lib/db"
import { calculateNetBalances, simplifyDebts, ExpenseRecord, SettlementRecord, SimplifiedTransaction, Paise } from "@/domain/money"

export interface UserBalanceSummary {
  totalOwedToUser: Paise
  totalUserOwes: Paise
  netBalance?: Paise
  detailedBalances: Array<{
    userId: string
    userName: string
    userImage?: string | null
    upiId?: string | null
    amount: Paise
    type: "OWED_TO_USER" | "USER_OWES"
  }>
}

export interface SimplifiedSettlementPlan {
  planId: string
  scope: "GLOBAL" | "GROUP"
  groupId?: string | null
  generatedAt: number
  totalOutstandingPaise: number
  originalTransactionCount: number
  optimizedTransactionCount: number
  transactions: Array<{
    fromUserId: string
    fromUserName: string
    toUserId: string
    toUserName: string
    toUserUpiId?: string | null
    amountPaise: Paise
    isUserDebtor: boolean
    isUserCreditor: boolean
  }>
}

/**
 * Authoritative Balance Engine:
 * Fetches all relevant expenses and settlements and computes exact net balances in minor units (paise).
 */
export async function getUserBalances(userId: string): Promise<UserBalanceSummary> {
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payerId: userId },
        { participants: { some: { userId } } }
      ]
    },
    include: {
      participants: true
    }
  })

  const settlements = await prisma.settlement.findMany({
    where: {
      OR: [
        { payerId: userId },
        { receiverId: userId }
      ],
      status: { in: ["COMPLETED", "SETTLED"] }
    }
  })

  const expenseRecords: ExpenseRecord[] = expenses.map(e => ({
    payerId: e.payerId,
    participants: e.participants.map(p => ({
      userId: p.userId,
      share: p.share
    }))
  }))

  const settlementRecords: SettlementRecord[] = settlements.map(s => ({
    payerId: s.payerId,
    receiverId: s.receiverId,
    amount: s.amount
  }))

  const netPositions = calculateNetBalances(expenseRecords, settlementRecords)
  const userPosition = netPositions[userId] || {}
  
  let totalOwedToUser = 0
  let totalUserOwes = 0
  const detailedBalances: UserBalanceSummary["detailedBalances"] = []
  
  const otherUserIds = Object.keys(userPosition)
  const users = await prisma.user.findMany({
    where: { id: { in: otherUserIds } },
    select: {
      id: true,
      name: true,
      image: true,
      upiId: true,
      settings: {
        select: { showUpiOnProfile: true }
      }
    }
  })
  
  const userMap = new Map(users.map(u => [u.id, u]))

  for (const [otherUserId, amount] of Object.entries(userPosition)) {
    const userObj = userMap.get(otherUserId)
    const userName = userObj?.name || "Friend"
    const userImage = userObj?.image || null
    const upiId = userObj?.settings?.showUpiOnProfile === false ? null : userObj?.upiId

    if (amount > 0) {
      totalOwedToUser += amount
      detailedBalances.push({
        userId: otherUserId,
        userName,
        userImage,
        upiId,
        amount,
        type: "OWED_TO_USER"
      })
    } else if (amount < 0) {
      const absAmount = Math.abs(amount)
      totalUserOwes += absAmount
      detailedBalances.push({
        userId: otherUserId,
        userName,
        userImage,
        upiId,
        amount: absAmount,
        type: "USER_OWES"
      })
    }
  }

  // Sort by highest amount first
  detailedBalances.sort((a, b) => b.amount - a.amount)

  return {
    totalOwedToUser,
    totalUserOwes,
    netBalance: totalOwedToUser - totalUserOwes,
    detailedBalances
  }
}

/**
 * Authoritative Group Balance Engine:
 * Computes pairwise and net balances strictly scoped to a group.
 */
export async function getGroupBalances(groupId: string, sessionUserId?: string) {
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { participants: true }
  })

  const settlements = await prisma.settlement.findMany({
    where: { groupId, status: { in: ["COMPLETED", "SETTLED"] } }
  })

  const expenseRecords: ExpenseRecord[] = expenses.map(e => ({
    payerId: e.payerId,
    participants: e.participants.map(p => ({
      userId: p.userId,
      share: p.share
    }))
  }))

  const settlementRecords: SettlementRecord[] = settlements.map(s => ({
    payerId: s.payerId,
    receiverId: s.receiverId,
    amount: s.amount
  }))

  const netPositions = calculateNetBalances(expenseRecords, settlementRecords)

  return {
    netPositions,
    expenseRecords,
    settlementRecords
  }
}

/**
 * Authoritative Smart Settlement / Simplify Debts Plan Generator:
 * Generates an optimized, minimum-transaction settlement plan across multi-party balances.
 * Returns state stamp so clients/server detect if balances change before execution (SETTLEMENT_PLAN_STALE).
 */
export async function generateSmartSettlementPlan(
  options: { userId: string; groupId?: string | null }
): Promise<SimplifiedSettlementPlan> {
  const { userId, groupId } = options

  let expenses: ExpenseRecord[] = []
  let settlements: SettlementRecord[] = []

  if (groupId) {
    const res = await getGroupBalances(groupId, userId)
    expenses = res.expenseRecords
    settlements = res.settlementRecords
  } else {
    // Global settlement across all groups and direct relationships involving user
    const userExpenses = await prisma.expense.findMany({
      where: {
        OR: [
          { payerId: userId },
          { participants: { some: { userId } } }
        ]
      },
      include: { participants: true }
    })

    const userSettlements = await prisma.settlement.findMany({
      where: {
        OR: [
          { payerId: userId },
          { receiverId: userId }
        ],
        status: { in: ["COMPLETED", "SETTLED"] }
      }
    })

    expenses = userExpenses.map(e => ({
      payerId: e.payerId,
      participants: e.participants.map(p => ({
        userId: p.userId,
        share: p.share
      }))
    }))

    settlements = userSettlements.map(s => ({
      payerId: s.payerId,
      receiverId: s.receiverId,
      amount: s.amount
    }))
  }

  const { simplifiedTransactions, originalTransactionCount, totalOriginalVolumePaise } = simplifyDebts(expenses, settlements)

  const participantIds = new Set<string>()
  for (const t of simplifiedTransactions) {
    participantIds.add(t.fromUserId)
    participantIds.add(t.toUserId)
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(participantIds) } },
    select: {
      id: true,
      name: true,
      upiId: true,
      settings: { select: { showUpiOnProfile: true } }
    }
  })

  const userMap = new Map(users.map(u => [u.id, u]))

  const transactions = simplifiedTransactions.map(t => {
    const fromUser = userMap.get(t.fromUserId)
    const toUser = userMap.get(t.toUserId)
    return {
      fromUserId: t.fromUserId,
      fromUserName: fromUser?.name || "Friend",
      toUserId: t.toUserId,
      toUserName: toUser?.name || "Friend",
      toUserUpiId: toUser?.settings?.showUpiOnProfile === false ? null : toUser?.upiId,
      amountPaise: t.amountPaise,
      isUserDebtor: t.fromUserId === userId,
      isUserCreditor: t.toUserId === userId,
    }
  })

  const planId = `plan_${groupId || "global"}_${Date.now()}`

  return {
    planId,
    scope: groupId ? "GROUP" : "GLOBAL",
    groupId: groupId || null,
    generatedAt: Date.now(),
    totalOutstandingPaise: totalOriginalVolumePaise,
    originalTransactionCount,
    optimizedTransactionCount: transactions.length,
    transactions
  }
}