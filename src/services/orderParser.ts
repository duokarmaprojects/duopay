/**
 * DuoPay Phase K — Provider-neutral order parser
 * Converts raw provider data into NormalizedOrder.
 * All inputs treated as UNTRUSTED. Never trust client-supplied totals.
 */
import { NormalizedOrder, OrderLineItem, OrderProvider, safePaise } from '@/domain/orderImport'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function detectProvider(rawText: string): OrderProvider {
  const lower = rawText.toLowerCase()
  if (lower.includes('swiggy')) return 'SWIGGY'
  if (lower.includes('zomato')) return 'ZOMATO'
  if (lower.includes('blinkit') || lower.includes('grofers')) return 'BLINKIT'
  if (lower.includes('zepto')) return 'ZEPTO'
  if (lower.includes('bigbasket')) return 'BIGBASKET'
  if (lower.includes('instamart')) return 'SWIGGY' // Swiggy Instamart
  return 'UNKNOWN'
}

/** Parse a Swiggy-like JSON order (defensive, never trust totals) */
export function parseSwiggyOrder(rawJson: unknown): NormalizedOrder {
  const data = rawJson && typeof rawJson === 'object' ? (rawJson as Record<string, unknown>) : {}

  const itemsRaw = Array.isArray(data.items) ? (data.items as unknown[]) : []
  const items: OrderLineItem[] = itemsRaw.map((item) => {
    const i = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const qty = Math.max(1, Math.round(safePaise(i.quantity) / 100) || 1)
    const unitPrice = safePaise(i.unitPrice ?? i.price)
    return {
      id: generateId(),
      name: typeof i.name === 'string' ? i.name.slice(0, 100) : 'Item',
      quantity: qty,
      unitPricePaise: unitPrice,
      lineTotalPaise: qty * unitPrice,
      categorySuggestion: 'Food',
    }
  })

  const subtotal = items.reduce((s, i) => s + i.lineTotalPaise, 0)
  const tax = safePaise(data.gst ?? data.tax ?? data.taxes)
  const delivery = safePaise(data.deliveryFee ?? data.delivery_charges)
  const discount = safePaise(data.discount ?? data.couponDiscount)
  const tip = safePaise(data.tip ?? data.driverTip)
  // Compute authoritative total from components — never trust client total
  const computedTotal = subtotal + tax + delivery + tip - discount

  return {
    provider: 'SWIGGY',
    externalOrderId: typeof data.orderId === 'string' ? data.orderId.slice(0, 64) : null,
    merchant: typeof data.restaurant === 'string' ? data.restaurant.slice(0, 100) : 'Swiggy',
    orderDate: typeof data.orderDate === 'string' ? data.orderDate.slice(0, 10) : null,
    subtotalPaise: subtotal,
    taxPaise: tax,
    deliveryFeePaise: delivery,
    discountPaise: discount,
    tipPaise: tip,
    totalPaise: computedTotal,
    items,
    importSource: 'MANUAL',
  }
}

/** Parse a Zomato-like JSON order (defensive) */
export function parseZomatoOrder(rawJson: unknown): NormalizedOrder {
  const data = rawJson && typeof rawJson === 'object' ? (rawJson as Record<string, unknown>) : {}

  const itemsRaw = Array.isArray(data.itemDetails) ? (data.itemDetails as unknown[]) : 
                   Array.isArray(data.items) ? (data.items as unknown[]) : []
  const items: OrderLineItem[] = itemsRaw.map((item) => {
    const i = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const qty = Math.max(1, Number(i.quantity) || 1)
    const unitPrice = safePaise(i.unitPrice ?? i.itemPrice ?? i.price)
    return {
      id: generateId(),
      name: typeof i.name === 'string' ? i.name.slice(0, 100) : 'Item',
      quantity: qty,
      unitPricePaise: unitPrice,
      lineTotalPaise: qty * unitPrice,
      categorySuggestion: 'Food',
    }
  })

  const subtotal = items.reduce((s, i) => s + i.lineTotalPaise, 0)
  const tax = safePaise(data.taxes ?? data.gst)
  const delivery = safePaise(data.deliveryFee ?? data.packagingCharges)
  const discount = safePaise(data.discount ?? data.couponDiscount)
  const tip = safePaise(data.tip)
  const computedTotal = subtotal + tax + delivery + tip - discount

  return {
    provider: 'ZOMATO',
    externalOrderId: typeof data.orderId === 'string' ? data.orderId.slice(0, 64) : null,
    merchant: typeof data.restaurant === 'string' ? data.restaurant.slice(0, 100) : 'Zomato',
    orderDate: typeof data.placedAt === 'string' ? data.placedAt.slice(0, 10) : null,
    subtotalPaise: subtotal,
    taxPaise: tax,
    deliveryFeePaise: delivery,
    discountPaise: discount,
    tipPaise: tip,
    totalPaise: computedTotal,
    items,
    importSource: 'MANUAL',
  }
}

/** Best-effort parse from raw text (screenshot OCR output, email body, etc.) */
export function parseGenericOrder(rawText: string): Partial<NormalizedOrder> {
  const provider = detectProvider(rawText)
  
  // Extract amount patterns like ₹1,234.56 or Rs. 1234
  const amountMatches = rawText.match(/(?:₹|Rs\.?\s*)(\d+(?:,\d+)*(?:\.\d{1,2})?)/g) || []
  const amounts = amountMatches
    .map(m => {
      const cleaned = m.replace(/[₹Rs.,\s]/g, '')
      const n = parseFloat(cleaned)
      return isFinite(n) ? Math.round(n * 100) : 0
    })
    .filter(n => n > 0)
    .sort((a, b) => b - a)

  // The largest amount is likely the total
  const totalPaise = amounts[0] ?? 0

  // Extract order ID
  const orderIdMatch = rawText.match(/order[#\s:]*([A-Z0-9\-]{6,20})/i)
  const externalOrderId = orderIdMatch ? orderIdMatch[1] : null

  // Extract merchant name from first line
  const firstLine = rawText.split('\n')[0]?.trim()?.slice(0, 100)

  return {
    provider,
    externalOrderId,
    merchant: firstLine || null,
    totalPaise,
    subtotalPaise: totalPaise,
    taxPaise: 0,
    deliveryFeePaise: 0,
    discountPaise: 0,
    tipPaise: 0,
    items: [],
    importSource: 'SCREENSHOT',
  }
}
