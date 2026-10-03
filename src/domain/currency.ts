export type SupportedCurrency = "INR" | "USD" | "EUR" | "GBP"

export interface CurrencyConfig {
  code: SupportedCurrency
  symbol: string
  name: string
  minorUnitsPerMajor: number // 100 for paise / cents / pence
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", minorUnitsPerMajor: 100 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", minorUnitsPerMajor: 100 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", minorUnitsPerMajor: 100 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", minorUnitsPerMajor: 100 },
}

/**
 * Indicative base conversion rates against INR (in basis points or multiplier)
 * 1 USD = ₹83.50 (8350 paise)
 * 1 EUR = ₹91.20 (9120 paise)
 * 1 GBP = ₹108.40 (10840 paise)
 * 1 INR = ₹1.00 (100 paise)
 */
export const INR_EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  INR: 1.0,
  USD: 83.5,
  EUR: 91.2,
  GBP: 108.4,
}

/**
 * Deterministically formats an integer minor unit (paise/cents) in the given currency.
 * Never performs floating point operations for display or storage.
 */
export function formatCurrency(
  minorUnits: number,
  currency: SupportedCurrency = "INR"
): string {
  const config = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.INR
  const isNegative = minorUnits < 0
  const absUnits = Math.abs(minorUnits)
  const major = Math.floor(absUnits / config.minorUnitsPerMajor)
  const minor = absUnits % config.minorUnitsPerMajor
  const formatted = `${config.symbol}${major}.${minor.toString().padStart(2, "0")}`
  return isNegative ? `-${formatted}` : formatted
}

/**
 * Converts foreign currency minor units to INR paise deterministically.
 */
export function convertToInrPaise(
  foreignMinorUnits: number,
  fromCurrency: SupportedCurrency
): number {
  if (fromCurrency === "INR") return foreignMinorUnits
  const rate = INR_EXCHANGE_RATES[fromCurrency] || 1.0
  return Math.round(foreignMinorUnits * rate)
}
