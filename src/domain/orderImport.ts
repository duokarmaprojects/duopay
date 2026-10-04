/**
 * DuoPay Phase K — Order Import Domain
 * Provider-neutral internal representation. All money in integer paise.
 */

export type OrderProvider = 'SWIGGY' | 'ZOMATO' | 'BLINKIT' | 'ZEPTO' | 'BIGBASKET' | 'UNKNOWN'
export type ImportSource = 'MANUAL' | 'EMAIL' | 'SCREENSHOT' | 'SHARE' | 'PDF'

export interface OrderLineItem {
  id: string
  name: string
  quantity: number       // positive integer
  unitPricePaise: number // integer paise
  lineTotalPaise: number // integer paise = quantity * unitPricePaise
  categorySuggestion: string | null
}

export interface NormalizedOrder {
  provider: OrderProvider
  externalOrderId: string | null
  merchant: string | null
  orderDate: string | null   // ISO date string YYYY-MM-DD
  subtotalPaise: number
  taxPaise: number
  deliveryFeePaise: number
  discountPaise: number
  tipPaise: number
  totalPaise: number
  items: OrderLineItem[]
  importSource: ImportSource
}

export interface OrderReconciliation {
  isBalanced: boolean
  computedTotal: number
  delta: number
  warning: string | null
}

/**
 * Reconcile an order. All values must be non-negative integers in paise.
 * Tolerance: ±2 paise (rounding).
 */
export function reconcileOrder(order: NormalizedOrder): OrderReconciliation {
  const itemsSum = order.items.reduce((acc, item) => acc + item.lineTotalPaise, 0)
  const computedTotal =
    itemsSum + order.taxPaise + order.deliveryFeePaise + order.tipPaise - order.discountPaise
  const delta = order.totalPaise - computedTotal

  if (Math.abs(delta) <= 2) {
    return { isBalanced: true, computedTotal, delta, warning: null }
  }

  const totalInr = (order.totalPaise / 100).toFixed(2)
  const computedInr = (computedTotal / 100).toFixed(2)
  const deltaInr = (delta / 100).toFixed(2)
  return {
    isBalanced: false,
    computedTotal,
    delta,
    warning: `Order total ₹${totalInr} does not match computed sum ₹${computedInr} (delta: ₹${deltaInr})`,
  }
}

/**
 * Safe integer conversion for untrusted numeric inputs.
 * Returns 0 if input is invalid/negative.
 */
export function safePaise(value: unknown): number {
  if (typeof value === 'number' && isFinite(value) && value >= 0) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    const n = parseFloat(value)
    if (isFinite(n) && n >= 0) return Math.round(n)
  }
  return 0
}
