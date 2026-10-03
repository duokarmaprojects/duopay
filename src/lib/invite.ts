import crypto from "crypto"

const INVITE_SECRET = process.env.AUTH_SECRET || "duopay-secure-invite-default-secret-key"

/**
 * Generates a cryptographically signed HMAC token for group invites.
 * Includes expiration timestamp and inviter ID to prevent token forgery or arbitrary group joining.
 */
export function generateGroupInviteToken(
  groupId: string,
  inviterId: string,
  expiresInDays = 7
): string {
  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  const payload = `${groupId}:${inviterId}:${expiresAt}`
  const signature = crypto
    .createHmac("sha256", INVITE_SECRET)
    .update(payload)
    .digest("hex")

  const tokenData = JSON.stringify({ groupId, inviterId, expiresAt, signature })
  return Buffer.from(tokenData).toString("base64url")
}

/**
 * Verifies that an invite token is cryptographically authentic, non-expired, and bound to this groupId.
 */
export function verifyGroupInviteToken(
  groupId: string,
  token?: string | null
): { valid: boolean; inviterId?: string; error?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Missing invite token" }
  }

  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8")
    const parsed = JSON.parse(raw)

    if (
      !parsed.groupId ||
      !parsed.inviterId ||
      !parsed.expiresAt ||
      !parsed.signature
    ) {
      return { valid: false, error: "Malformed invite token" }
    }

    if (parsed.groupId !== groupId) {
      return { valid: false, error: "Invite token does not match this group" }
    }

    if (Date.now() > parsed.expiresAt) {
      return { valid: false, error: "Invite link has expired" }
    }

    // Verify cryptographic HMAC signature
    const expectedPayload = `${parsed.groupId}:${parsed.inviterId}:${parsed.expiresAt}`
    const expectedSignature = crypto
      .createHmac("sha256", INVITE_SECRET)
      .update(expectedPayload)
      .digest("hex")

    const sigA = Buffer.from(parsed.signature, "hex")
    const sigB = Buffer.from(expectedSignature, "hex")

    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return { valid: false, error: "Invalid invite signature" }
    }

    return { valid: true, inviterId: parsed.inviterId }
  } catch {
    return { valid: false, error: "Invalid invite token" }
  }
}
