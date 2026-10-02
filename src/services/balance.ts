import { prisma } from "@/lib/db"
import { calculateNetBalances } from "@/domain/money"

export async function getUserBalances(userId: string) {
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
      status: "COMPLETED"
    }
  })

  const expenseRecords = expenses.map(e => ({
    payerId: e.payerId,
    participants: e.participants.map(p => ({
      userId: p.userId,
      share: p.share
    }))
  }))

  const settlementRecords = settlements.map(s => ({
    payerId: s.payerId,
    receiverId: s.receiverId,
    amount: s.amount
  }))

  const netPositions = calculateNetBalances(expenseRecords, settlementRecords)
  const userPosition = netPositions[userId] || {}
  
  let totalOwedToUser = 0
  let totalUserOwes = 0
  const detailedBalances = []
  
  const otherUserIds = Object.keys(userPosition)
  const users = await prisma.user.findMany({
    where: { id: { in: otherUserIds } },
    select: { id: true, name: true }
  })
  
  const userMap = new Map(users.map(u => [u.id, u.name]))

  for (const [otherUserId, amount] of Object.entries(userPosition)) {
    if (amount > 0) {
      totalOwedToUser += amount
      detailedBalances.push({ userId: otherUserId, userName: userMap.get(otherUserId) || 'Unknown', amount, type: 'OWED_TO_USER' })
    } else if (amount < 0) {
      totalUserOwes += Math.abs(amount)
      detailedBalances.push({ userId: otherUserId, userName: userMap.get(otherUserId) || 'Unknown', amount: Math.abs(amount), type: 'USER_OWES' })
    }
  }

  return {
    totalOwedToUser,
    totalUserOwes,
    detailedBalances
  }
}