/**
 * Phone number normalization utility for DuoPay.
 * Standardizes Indian and international phone numbers into E.164 format.
 */

export function normalizePhoneNumber(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  // Remove all whitespace, dashes, dots, parentheses
  let cleaned = raw.replace(/[\s\-\.\(\)]/g, "").trim();

  // If empty after stripping
  if (!cleaned) return null;

  // Handle leading 00 (international format like 0091...)
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // Handle Indian phone numbers
  // 1. Starts with +91
  if (cleaned.startsWith("+91")) {
    const digits = cleaned.slice(3);
    if (/^\d{10}$/.test(digits)) {
      return `+91${digits}`;
    }
  }

  // 2. Starts with 91 followed by 10 digits (e.g. 919876543210)
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // 3. Starts with 0 followed by 10 digits (e.g. 09876543210)
  if (/^0\d{10}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }

  // 4. Raw 10 digits (e.g. 9876543210) - Default to India (+91)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // 5. Standard international format with '+' and 10-15 digits
  if (/^\+\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  // If it's pure 10 digits of another format
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  return null;
}

export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return "";
  const normalized = normalizePhoneNumber(phone) || phone;
  if (normalized.startsWith("+91") && normalized.length === 13) {
    return `+91 ${normalized.slice(3, 8)} ${normalized.slice(8)}`;
  }
  return normalized;
}
