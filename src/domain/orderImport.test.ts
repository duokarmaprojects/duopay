/**
 * DuoPay Phase K — Order Import Domain Tests
 */
import { describe, it, expect } from 'vitest'
import { reconcileOrder, safePaise, NormalizedOrder } from './orderImport'

function makeOrder(overrides: Partial<NormalizedOrder> = {}): NormalizedOrder {
  return {
    provider: 'SWIGGY',
    externalOrderId: null,
    merchant: 'Swiggy',
    orderDate: '2026-01-01',
    subtotalPaise: 50000,
    taxPaise: 500,
    deliveryFeePaise: 3000,
    discountPaise: 0,
    tipPaise: 0,
    totalPaise: 53500,
    items: [{ id: '1', name: 'Burger', quantity: 1, unitPricePaise: 50000, lineTotalPaise: 50000, categorySuggestion: 'Food' }],
    importSource: 'MANUAL',
    ...overrides,
  }
}

describe('reconcileOrder', () => {
  it('balanced Swiggy order passes reconciliation', () => {
    const order = makeOrder()
    const result = reconcileOrder(order)
    expect(result.isBalanced).toBe(true)
    expect(result.warning).toBeNull()
    expect(result.computedTotal).toBe(53500)
  })

  it('unbalanced order (delta > 2) fails reconciliation', () => {
    const order = makeOrder({ totalPaise: 60000 }) // 60000 vs computed 53500
    const result = reconcileOrder(order)
    expect(result.isBalanced).toBe(false)
    expect(result.warning).toMatch(/does not match/)
    expect(result.delta).toBe(6500)
  })

  it('rounding within ±2 paise is considered balanced', () => {
    const order = makeOrder({ totalPaise: 53501 }) // delta = 1
    const result = reconcileOrder(order)
    expect(result.isBalanced).toBe(true)
    expect(result.warning).toBeNull()
  })

  it('order with discount reconciles correctly', () => {
    const order = makeOrder({ discountPaise: 5000, totalPaise: 48500 })
    const result = reconcileOrder(order)
    expect(result.isBalanced).toBe(true)
    expect(result.computedTotal).toBe(48500)
  })

  it('order with no line items (sum=0) reconciles against fees only', () => {
    const order = makeOrder({ items: [], subtotalPaise: 0, totalPaise: 3500 })
    const result = reconcileOrder(order)
    // computed = 0 + 500 + 3000 + 0 - 0 = 3500
    expect(result.isBalanced).toBe(true)
  })
})

describe('safePaise', () => {
  it('converts valid number', () => expect(safePaise(123.6)).toBe(124))
  it('converts valid string', () => expect(safePaise('100.5')).toBe(101))
  it('rejects negative', () => expect(safePaise(-100)).toBe(0))
  it('rejects NaN', () => expect(safePaise(NaN)).toBe(0))
  it('rejects undefined', () => expect(safePaise(undefined)).toBe(0))
  it('rejects object', () => expect(safePaise({})).toBe(0))
})
