/**
 * DuoPay Production Security Utilities
 * Server-side security helpers for defense-in-depth enforcement.
 */

/**
 * Validates that an ID is a non-empty string adhering to standard CUID/alphanumeric format.
 * Prevents path traversal, SQL/NoSQL injection tokens, or control characters.
 */
export function validateId(id: unknown, fieldName = "ID"): string {
  if (typeof id !== "string" || !id.trim()) {
    throw new Error(`Invalid ${fieldName}: must be a non-empty string`)
  }
  const trimmed = id.trim()
  // Allow alphanumeric, hyphen, underscore (covers CUID, UUID, nanoid)
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed) || trimmed.length > 128) {
    throw new Error(`Invalid ${fieldName} format`)
  }
  return trimmed
}

/**
 * Validates and sanitizes a redirect URL to prevent Open Redirect vulnerabilities.
 * Enforces that the redirect target is strictly an internal relative path starting with '/'
 * and explicitly rejects protocol-relative ('//') or external URLs.
 */
export function getSafeRedirectUrl(target: unknown, fallback = "/"): string {
  if (typeof target !== "string" || !target.trim()) {
    return fallback
  }

  const trimmed = target.trim()

  // Reject CR/LF, null bytes, backslashes
  if (/[\r\n\0\\]/.test(trimmed)) {
    return fallback
  }

  // Must start with '/' and must NOT start with '//' (protocol-relative)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    // Disallow javascript: or data: or other schemes
    try {
      const parsed = new URL(trimmed, "http://localhost")
      if (parsed.protocol === "http:" && parsed.pathname.startsWith("/")) {
        return parsed.pathname + parsed.search + parsed.hash
      }
    } catch {
      return fallback
    }
  }

  return fallback
}

/**
 * Sanitizes plain text input:
 * - Strips ASCII control characters
 * - Trims whitespace
 * - Enforces max length
 */
export function sanitizeTextInput(input: unknown, maxLength = 255): string {
  if (typeof input !== "string") return ""
  // Strip control characters (except newline and tab)
  const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
  return cleaned.trim().slice(0, maxLength)
}

/**
 * Validates binary image signatures (magic bytes) to prevent malicious files
 * (such as SVGs with embedded scripts or HTML executables) from masquerading as images.
 */
export function validateImageSignature(buffer: Buffer): {
  valid: boolean
  mimeType?: "image/jpeg" | "image/png" | "image/webp"
  error?: string
} {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: "File buffer too small or empty" }
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: "image/jpeg" }
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: "image/png" }
  }

  // WebP: RIFF ... WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mimeType: "image/webp" }
  }

  return {
    valid: false,
    error: "Invalid image format. Only authentic JPEG, PNG, or WebP files are allowed.",
  }
}

/**
 * Validates financial state transitions for settlements to prevent illegal state jumps.
 */
export function isAllowedSettlementTransition(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return true

  const transitions: Record<string, string[]> = {
    PENDING: ["COMPLETED", "SETTLED", "CANCELLED", "FAILED"],
    INITIATED: ["COMPLETED", "SETTLED", "CANCELLED", "FAILED"],
    COMPLETED: ["SETTLED"],
    FAILED: [], // Terminal state
    CANCELLED: [], // Terminal state
    SETTLED: [], // Terminal state
  }

  const allowed = transitions[fromStatus] || []
  return allowed.includes(toStatus)
}

/**
 * Maximum financial transaction cap: ₹10,000,000 (100 million paise)
 */
export const MAX_FINANCIAL_PAISE = 1_000_000_000 // ₹10,000,000 in paise
export const MAX_FINANCIAL_INR = 10_000_000

/**
 * Validates integer paise amounts strictly according to Zero-Trust rules.
 * Rejects floats, scientific notation, strings with non-digits, negative, NaN, Infinity, and overflow.
 */
export function validateIntegerPaise(
  raw: unknown,
  fieldName = "amountPaise",
  maxPaise: number = MAX_FINANCIAL_PAISE
): number {
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(`${fieldName} is required`)
  }

  let num: number

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || Number.isNaN(raw)) {
      throw new Error(`${fieldName} must be a valid finite number`)
    }
    if (!Number.isInteger(raw)) {
      throw new Error(`${fieldName} must be an integer minor unit (paise), decimal floats rejected`)
    }
    num = raw
  } else if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) {
      throw new Error(`${fieldName} is required`)
    }
    // Reject decimals explicitly
    if (trimmed.includes(".")) {
      throw new Error(`${fieldName} must be an integer minor unit (paise), decimal floats rejected`)
    }
    // Reject negative or zero
    if (trimmed.startsWith("-") || trimmed === "0") {
      throw new Error("Settlement amount must be positive")
    }
    // Strict digit validation
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`${fieldName} must contain strictly numeric digits`)
    }
    num = Number(trimmed)
  } else {
    throw new Error(`${fieldName} must be a number or numeric string`)
  }

  if (!Number.isSafeInteger(num)) {
    throw new Error(`${fieldName} exceeds safe integer calculation range`)
  }

  if (num <= 0) {
    throw new Error("Settlement amount must be positive")
  }

  if (num > maxPaise) {
    throw new Error(`${fieldName} exceeds maximum permitted limit`)
  }

  return num
}

/**
 * Validates INR currency input (e.g. from user input in expense forms).
 * Enforces safe finite number with at most 2 decimal places.
 */
export function validateInrAmount(
  raw: unknown,
  fieldName = "amount",
  maxInr: number = MAX_FINANCIAL_INR
): { inr: number; paise: number } {
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(`${fieldName} is required`)
  }

  let inr: number

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || Number.isNaN(raw)) {
      throw new Error(`${fieldName} must be a valid finite number`)
    }
    inr = raw
  } else if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) {
      throw new Error(`${fieldName} is required`)
    }
    // Max 2 decimal digits format
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      throw new Error(`${fieldName} must be a valid positive currency value with at most 2 decimal places`)
    }
    inr = Number(trimmed)
  } else {
    throw new Error(`${fieldName} must be a number or numeric string`)
  }

  if (!Number.isFinite(inr) || Number.isNaN(inr) || inr <= 0) {
    throw new Error("Amount must be positive")
  }

  if (inr > maxInr) {
    throw new Error("Amount exceeds limit")
  }

  const paise = Math.round(inr * 100)
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new Error(`${fieldName} resulted in invalid integer paise calculation`)
  }

  return { inr, paise }
}

/**
 * Asserts that a FormData or request body does not contain forbidden financial/verification parameters.
 */
export function assertNoForbiddenFields(
  formData: FormData,
  forbiddenKeys: string[],
  actionName: string,
  userId?: string
): void {
  for (const key of forbiddenKeys) {
    if (formData.has(key)) {
      throw new Error("Client submission of payment verification state is strictly prohibited")
    }
  }
}

