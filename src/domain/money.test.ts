import { describe, it, expect } from 'vitest'
import { calculateEqualSplit, calculateNetBalances, simplifyDebts } from './money'

describe('Domain: Money calculations', () => {
  describe('calculateEqualSplit', () => {
    it('Example 2: ₹100 split between 3 users should total exactly ₹100', () => {
      // 10000 paise
      const participants = ['A', 'B', 'C']
      const split = calculateEqualSplit(10000, participants)
      
      const total = Object.values(split).reduce((sum, amount) => sum + amount, 0)
      
      expect(total).toBe(10000)
      expect(split['A']).toBe(3334)
      expect(split['B']).toBe(3333)
      expect(split['C']).toBe(3333)
    })
  })

  describe('calculateNetBalances', () => {
    it('Example 1: Rahul pays ₹900. Participants: Rahul, Moiz, Aman', () => {
      // 90000 paise
      const expenses = [{
        payerId: 'Rahul',
        participants: [
          { userId: 'Rahul', share: 30000 },
          { userId: 'Moiz', share: 30000 },
          { userId: 'Aman', share: 30000 },
        ]
      }]
      const settlements: any[] = []

      const netPositions = calculateNetBalances(expenses, settlements)
      
      // Rahul is owed 30000 by Moiz and 30000 by Aman
      expect(netPositions['Rahul']['Moiz']).toBe(30000)
      expect(netPositions['Rahul']['Aman']).toBe(30000)
      // Moiz owes Rahul 30000 (negative means owes)
      expect(netPositions['Moiz']['Rahul']).toBe(-30000)
    })

    it('Example 3: A owes B ₹500. A settles ₹500.', () => {
      const expenses = [{
        payerId: 'B',
        participants: [
          { userId: 'A', share: 50000 },
          { userId: 'B', share: 0 },
        ]
      }]
      const settlements = [{
        payerId: 'A',
        receiverId: 'B',
        amount: 50000
      }]

      const netPositions = calculateNetBalances(expenses, settlements)
      
      expect(netPositions['A']['B']).toBe(0)
      expect(netPositions['B']['A']).toBe(0)
    })

    it('Example 4: A owes B ₹500. A settles ₹200. Remaining ₹300.', () => {
      const expenses = [{
        payerId: 'B',
        participants: [
          { userId: 'A', share: 50000 },
          { userId: 'B', share: 0 },
        ]
      }]
      const settlements = [{
        payerId: 'A',
        receiverId: 'B',
        amount: 20000
      }]

      const netPositions = calculateNetBalances(expenses, settlements)
      
      // A owes B 30000
      expect(netPositions['A']['B']).toBe(-30000)
      // B is owed 30000 by A
      expect(netPositions['B']['A']).toBe(30000)
    })
  })

  describe('simplifyDebts (Smart Settle)', () => {
    it('simplifies triangular debt correctly: Rahul owes Moiz ₹500, Sara owes Moiz ₹300, Moiz owes Ali ₹200', () => {
      // Rahul -> Moiz 50000
      // Sara -> Moiz 30000
      // Moiz -> Ali 20000
      const expenses = [
        {
          payerId: 'Moiz',
          participants: [
            { userId: 'Rahul', share: 50000 },
            { userId: 'Moiz', share: 0 },
          ],
        },
        {
          payerId: 'Moiz',
          participants: [
            { userId: 'Sara', share: 30000 },
            { userId: 'Moiz', share: 0 },
          ],
        },
        {
          payerId: 'Ali',
          participants: [
            { userId: 'Moiz', share: 20000 },
            { userId: 'Ali', share: 0 },
          ],
        },
      ]

      const { simplifiedTransactions, originalTransactionCount } = simplifyDebts(expenses, [])

      expect(originalTransactionCount).toBe(3)
      // Net balances:
      // Rahul: -50000
      // Sara: -30000
      // Moiz: +50000 +30000 -20000 = +60000
      // Ali: +20000
      // Sum of net balances = -50000 - 30000 + 60000 + 20000 = 0 (Conservation of money)

      const totalTransferred = simplifiedTransactions.reduce((acc, t) => acc + t.amountPaise, 0)
      expect(totalTransferred).toBe(80000)

      // Verified: Rahul and Sara pay Moiz and Ali directly without intermediary debt inflation
      for (const t of simplifiedTransactions) {
        expect(['Rahul', 'Sara']).toContain(t.fromUserId)
        expect(['Moiz', 'Ali']).toContain(t.toUserId)
      }
    })

    it('returns empty simplified transactions when all balances are settled', () => {
      const { simplifiedTransactions, optimizedTransactionCount } = simplifyDebts([], [])
      expect(simplifiedTransactions).toEqual([])
      expect(optimizedTransactionCount).toBe(0)
    })
  })
})
