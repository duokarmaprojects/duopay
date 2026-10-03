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
