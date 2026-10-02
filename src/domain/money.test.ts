import { describe, it, expect } from 'vitest'
import { calculateEqualSplit, calculateNetBalances } from './money'

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
})
