import { Paise, paiseToInr } from "./money"

/**
 * Result of UPI format validation.
 * Note: Format-valid does NOT mean existence-valid!
 */
export interface UpiFormatValidationResult {
  valid: boolean
  normalized?: string
  error?: string
}

/**
 * Normalizes a UPI ID (VPA):
 * - Trims whitespace
 * - Checks for forbidden whitespace characters
 * - Converts to lowercase according to NPCI standards
 */
export function normalizeUpiId(input: unknown): string | null {
  if (typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // Reject if it contains spaces or invisible control characters
  if (/\s/.test(trimmed)) return null

  return trimmed.toLowerCase()
}

/**
 * Validates the syntax of a UPI ID according to NPCI VPA specifications.
 * 
 * Rules:
 * 1. Exactly one '@' symbol separating username and bank handle.
 * 2. Username:
 *    - Length: 2 to 64 characters.
 *    - Allowed characters: lowercase letters (a-z), numbers (0-9), dots (.), hyphens (-), underscores (_).
 *    - Cannot start or end with a dot, hyphen, or underscore.
 *    - Cannot contain consecutive dots (..).
 * 3. Handle (PSP/Bank):
 *    - Length: 2 to 32 characters.
 *    - Allowed characters: lowercase alphanumeric (a-z, 0-9), occasionally dot (.).
 *    - Cannot start or end with a dot.
 * 4. Overall length: 5 to 70 characters.
 * 
 * IMPORTANT: Passing format validation does NOT mean the UPI ID actually exists.
 */
export function validateUpiFormat(input: unknown): UpiFormatValidationResult {
  if (typeof input !== "string" || !input.trim()) {
    return { valid: false, error: "UPI ID is required." }
  }

  // Reject internal whitespace
  if (/\s/.test(input)) {
    return { valid: false, error: "UPI ID must not contain spaces." }
  }

  const normalized = normalizeUpiId(input)
  if (!normalized) {
    return { valid: false, error: "Invalid UPI ID." }
  }

  if (normalized.length < 5) {
    return { valid: false, error: "UPI ID is too short (minimum 5 characters)." }
  }

  if (normalized.length > 70) {
    return { valid: false, error: "UPI ID is too long (maximum 70 characters)." }
  }

  const atCount = (normalized.match(/@/g) || []).length
  if (atCount === 0) {
    return { valid: false, error: "UPI ID must contain an '@' symbol (e.g., name@bank)." }
  }

  if (atCount > 1) {
    return { valid: false, error: "UPI ID cannot contain multiple '@' symbols." }
  }

  const [username, handle] = normalized.split("@")

  // Validate Username
  if (!username) {
    return { valid: false, error: "UPI ID is missing the username before '@'." }
  }

  if (username.length < 2) {
    return { valid: false, error: "Username portion must be at least 2 characters." }
  }

  if (username.length > 64) {
    return { valid: false, error: "Username portion cannot exceed 64 characters." }
  }

  if (/^[.\-_]|[.\-_]$/.test(username)) {
    return { valid: false, error: "Username cannot start or end with a special character (., -, _)." }
  }

  if (/\.{2,}/.test(username)) {
    return { valid: false, error: "Username cannot contain consecutive dots." }
  }

  if (!/^[a-z0-9.\-_]+$/.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, dots, hyphens, and underscores." }
  }

  // Validate Handle
  if (!handle) {
    return { valid: false, error: "UPI ID is missing the bank handle after '@'." }
  }

  if (handle.length < 2) {
    return { valid: false, error: "Bank handle must be at least 2 characters." }
  }

  if (handle.length > 32) {
    return { valid: false, error: "Bank handle cannot exceed 32 characters." }
  }

  if (/^\.|\.$/.test(handle)) {
    return { valid: false, error: "Bank handle cannot start or end with a dot." }
  }

  if (!/^[a-z0-9.]+$/.test(handle)) {
    return { valid: false, error: "Bank handle can only contain letters and numbers." }
  }

  return {
    valid: true,
    normalized,
  }
}

export interface UpiIntentOptions {
  upiId: string
  name?: string
  amountPaise: number
  note?: string
}

export interface UpiIntentValidationResult {
  valid: boolean
  uri?: string
  error?: string
  details?: {
    pa: string
    pn: string
    am: string
    cu: string
    tn: string
  }
}

/**
 * Safely encodes a parameter value for UPI intent URIs:
 * - Uses encodeURIComponent
 * - Replaces '+' with '%20' so spaces are never interpreted as plus characters
 */
export function encodeUpiParam(value: string): string {
  return encodeURIComponent(value).replace(/\+/g, "%20")
}

/**
 * Sanitizes payee name for UPI intent:
 * - Strips emojis and control characters that break UPI app intent filters
 * - Limits length to 50 characters (NPCI recommendation)
 */
export function sanitizeUpiName(name: string): string {
  if (!name) return "Payee"
  // Remove non-ASCII/emojis and special characters that cause PSP parse failures
  const cleaned = name
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[&?=]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return (cleaned.slice(0, 50) || "Payee").trim()
}

/**
 * Sanitizes transaction note:
 * - Alphanumeric, spaces, simple punctuation
 * - Max 50 characters
 */
export function sanitizeUpiNote(note?: string): string {
  if (!note) return "DuoPay Settlement"
  const cleaned = note
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[&?=]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return (cleaned.slice(0, 50) || "DuoPay Settlement").trim()
}

/**
 * Validates all parameters and constructs the official NPCI-compliant UPI Intent URI.
 * 
 * Critical Rules:
 * 1. pa: Virtual Payment Address with literal '@' (NOT '%40') to prevent Android Chrome double-encoding (%2540)
 * 2. pn: Payee Name (sanitized, spaces encoded as '%20', NOT '+')
 * 3. am: Amount formatted with strictly 2 decimal places (e.g. 50.00), no currency symbol, no commas
 * 4. cu: Currency code (INR)
 * 5. tn: Transaction Note (sanitized, spaces as '%20', NOT '+')
 * 6. No unsupported parameters (tr, tid, mc, etc.) that cause banking app rejections.
 */
export function validateAndGenerateUpiIntent(options: UpiIntentOptions): UpiIntentValidationResult {
  const { upiId, name, amountPaise, note } = options

  // 1. Validate UPI ID
  const upiCheck = validateUpiFormat(upiId)
  if (!upiCheck.valid || !upiCheck.normalized) {
    return {
      valid: false,
      error: upiCheck.error || "Invalid recipient UPI ID.",
    }
  }

  // 2. Validate Amount
  if (typeof amountPaise !== "number" || isNaN(amountPaise) || !Number.isInteger(amountPaise) || amountPaise <= 0) {
    return {
      valid: false,
      error: "Amount must be a positive integer in paise (greater than 0).",
    }
  }

  // Exact 2 decimal places string
  const am = (amountPaise / 100).toFixed(2)

  // 3. Format VPA: Keep the '@' literal so Android Chrome does not double-encode %40 to %2540
  const normalizedVpa = upiCheck.normalized
  const [username, handle] = normalizedVpa.split("@")
  const pa = `${encodeUpiParam(username)}@${encodeUpiParam(handle)}`

  // 4. Format Payee Name
  const cleanName = sanitizeUpiName(name || "Payee")
  const pn = encodeUpiParam(cleanName)

  // 5. Currency
  const cu = "INR"

  // 6. Transaction Note
  const cleanNote = sanitizeUpiNote(note)
  const tn = encodeUpiParam(cleanNote)

  // Strict minimal query string: pa, pn, am, cu, tn
  const uri = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`

  return {
    valid: true,
    uri,
    details: {
      pa,
      pn,
      am,
      cu,
      tn,
    },
  }
}

/**
 * Standard generator function matching DuoPay interface.
 * Throws Error if validation fails.
 */
export function generateUpiIntent(
  upiId: string,
  name: string,
  amountPaise: Paise,
  note?: string
): string {
  const result = validateAndGenerateUpiIntent({
    upiId,
    name,
    amountPaise,
    note,
  })

  if (!result.valid || !result.uri) {
    throw new Error(result.error || "Failed to generate UPI payment intent.")
  }

  return result.uri
}
