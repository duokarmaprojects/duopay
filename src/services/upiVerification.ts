import { prisma } from "@/lib/db"
import { normalizeUpiId, validateUpiFormat } from "@/domain/upi"

export interface UpiVerificationResult {
  success: boolean
  exists: boolean
  status: "VERIFIED" | "FAILED" | "UNAVAILABLE" | "RATE_LIMITED"
  vpa: string
  verifiedName?: string
  provider: string
  referenceId?: string
  message: string
}

export interface UpiVerificationProvider {
  readonly name: string
  isConfigured(): boolean
  verifyVpa(vpa: string): Promise<UpiVerificationResult>
}

/**
 * Provider used when no external verification API keys are configured.
 * Strictly adheres to requirement: NEVER FAKE VERIFICATION.
 */
class NoneUpiVerificationProvider implements UpiVerificationProvider {
  readonly name = "none"

  isConfigured(): boolean {
    return false
  }

  async verifyVpa(vpa: string): Promise<UpiVerificationResult> {
    return {
      success: false,
      exists: false,
      status: "UNAVAILABLE",
      vpa,
      provider: "none",
      message:
        "Actual UPI existence verification requires a supported verification provider/API; format validation alone cannot establish that a UPI ID exists.",
    }
  }
}

/**
 * Cashfree VPA Verification Provider
 * Uses Cashfree's Verification Suite (POST /verification/vpa)
 */
class CashfreeUpiVerificationProvider implements UpiVerificationProvider {
  readonly name = "cashfree"
  private clientId = process.env.CASHFREE_CLIENT_ID
  private clientSecret = process.env.CASHFREE_CLIENT_SECRET
  private baseUrl = process.env.CASHFREE_ENV === "production" 
    ? "https://api.cashfree.com/verification" 
    : "https://sandbox.cashfree.com/verification"

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret)
  }

  async verifyVpa(vpa: string): Promise<UpiVerificationResult> {
    if (!this.isConfigured()) {
      return new NoneUpiVerificationProvider().verifyVpa(vpa)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    try {
      const response = await fetch(`${this.baseUrl}/vpa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": this.clientId!,
          "x-client-secret": this.clientSecret!,
        },
        body: JSON.stringify({ vpa }),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            exists: false,
            status: "RATE_LIMITED",
            vpa,
            provider: "cashfree",
            message: "Too many verification requests. Please wait and try again.",
          }
        }
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            exists: false,
            status: "UNAVAILABLE",
            vpa,
            provider: "cashfree",
            message: "Verification temporarily unavailable. Please try again later.",
          }
        }
        return {
          success: false,
          exists: false,
          status: "FAILED",
          vpa,
          provider: "cashfree",
          message: "UPI ID not found. Please check your UPI ID and try again.",
        }
      }

      // Cashfree returns valid: true/false or account_status: "VALID"/"INVALID"
      const isValid =
        data.valid === true ||
        data.account_status === "VALID" ||
        (data.status === "SUCCESS" && data.account_status !== "INVALID")
      const verifiedName =
        data.name_at_bank ||
        data.nameAtBank ||
        data.registered_name ||
        undefined
      const referenceId = data.ref_id
        ? String(data.ref_id)
        : data.reference_id
        ? String(data.reference_id)
        : undefined

      if (isValid) {
        return {
          success: true,
          exists: true,
          status: "VERIFIED",
          vpa,
          verifiedName,
          provider: "cashfree",
          referenceId,
          message: "UPI ID verified successfully.",
        }
      }

      return {
        success: true,
        exists: false,
        status: "FAILED",
        vpa,
        provider: "cashfree",
        referenceId,
        message: "UPI ID not found. Please check your UPI ID and try again.",
      }
    } catch (err: any) {
      clearTimeout(timeout)
      const isTimeout = err.name === "AbortError"
      return {
        success: false,
        exists: false,
        status: "UNAVAILABLE",
        vpa,
        provider: "cashfree",
        message: isTimeout
          ? "Verification provider timed out. Please try again later."
          : "Verification temporarily unavailable. Please try again later.",
      }
    }
  }
}

/**
 * Razorpay VPA Validation Provider
 * Uses Razorpay's POST /v1/payments/validate/vpa
 */
class RazorpayUpiVerificationProvider implements UpiVerificationProvider {
  readonly name = "razorpay"
  private keyId = process.env.RAZORPAY_KEY_ID
  private keySecret = process.env.RAZORPAY_KEY_SECRET

  isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret)
  }

  async verifyVpa(vpa: string): Promise<UpiVerificationResult> {
    if (!this.isConfigured()) {
      return new NoneUpiVerificationProvider().verifyVpa(vpa)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    try {
      const authHeader = "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")
      const response = await fetch("https://api.razorpay.com/v1/payments/validate/vpa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ vpa }),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            exists: false,
            status: "RATE_LIMITED",
            vpa,
            provider: "razorpay",
            message: "Too many verification requests. Please wait and try again.",
          }
        }
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            exists: false,
            status: "UNAVAILABLE",
            vpa,
            provider: "razorpay",
            message: "Verification temporarily unavailable. Please try again later.",
          }
        }
        return {
          success: false,
          exists: false,
          status: "FAILED",
          vpa,
          provider: "razorpay",
          message: "UPI ID not found. Please check your UPI ID and try again.",
        }
      }

      // Razorpay returns { vpa: string, success: boolean, customer_name: string }
      if (data.success === true) {
        return {
          success: true,
          exists: true,
          status: "VERIFIED",
          vpa,
          verifiedName: data.customer_name || undefined,
          provider: "razorpay",
          referenceId: data.vpa ? String(data.vpa) : undefined,
          message: "UPI ID verified successfully.",
        }
      }

      return {
        success: true,
        exists: false,
        status: "FAILED",
        vpa,
        provider: "razorpay",
        message: "UPI ID not found. Please check your UPI ID and try again.",
      }
    } catch (err: any) {
      clearTimeout(timeout)
      const isTimeout = err.name === "AbortError"
      return {
        success: false,
        exists: false,
        status: "UNAVAILABLE",
        vpa,
        provider: "razorpay",
        message: isTimeout
          ? "Verification provider timed out. Please try again later."
          : "Verification temporarily unavailable. Please try again later.",
      }
    }
  }
}

/**
 * Returns the active configured verification provider, or fallback to NoneProvider.
 */
export function getActiveUpiProvider(): UpiVerificationProvider {
  const cashfree = new CashfreeUpiVerificationProvider()
  if (cashfree.isConfigured()) return cashfree

  const razorpay = new RazorpayUpiVerificationProvider()
  if (razorpay.isConfigured()) return razorpay

  return new NoneUpiVerificationProvider()
}

/**
 * In-memory sliding window rate limiter
 * Allows max 5 attempts per userId per 10 minutes (600,000 ms)
 */
const rateLimitMap = new Map<string, number[]>()

export function checkRateLimit(userId: string, maxAttempts = 5, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(userId) || []
  const validTimestamps = timestamps.filter((t) => now - t < windowMs)

  if (validTimestamps.length >= maxAttempts) {
    rateLimitMap.set(userId, validTimestamps)
    return false
  }

  validTimestamps.push(now)
  rateLimitMap.set(userId, validTimestamps)
  return true
}

export function resetRateLimitsForTesting(): void {
  rateLimitMap.clear()
}

/**
 * Main verification function called by server actions:
 * 1. Checks authentication & format validity
 * 2. Enforces server-side rate limits
 * 3. Checks verification cache in DB (for positive verifications)
 * 4. Calls configured provider (or NoneProvider)
 * 5. Caches positive result
 * 6. Logs attempt for security audits
 */
export async function verifyUpiId(
  rawUpiId: string,
  userId: string,
  options?: { customProvider?: UpiVerificationProvider }
): Promise<UpiVerificationResult> {
  // Step 1: Format Validation
  const format = validateUpiFormat(rawUpiId)
  if (!format.valid || !format.normalized) {
    return {
      success: false,
      exists: false,
      status: "FAILED",
      vpa: typeof rawUpiId === "string" ? rawUpiId.trim() : "",
      provider: "format_check",
      message: format.error || "Invalid UPI ID format.",
    }
  }

  const vpa = format.normalized

  // Step 2: Rate Limiting (Process-local + Persistent Database Multi-Tier)
  const allowed = checkRateLimit(userId)
  if (!allowed) {
    return {
      success: false,
      exists: false,
      status: "RATE_LIMITED",
      vpa,
      provider: "rate_limiter",
      message: "Too many verification attempts. Please wait 10 minutes before trying again.",
    }
  }

  // Persistent serverless rate limit check across distributed Vercel instances
  try {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000)
    const dbAttempts = await prisma.upiVerificationAttempt.count({
      where: {
        userId,
        createdAt: { gte: tenMinsAgo },
      },
    })
    if (dbAttempts >= 5) {
      return {
        success: false,
        exists: false,
        status: "RATE_LIMITED",
        vpa,
        provider: "rate_limiter",
        message: "Too many verification attempts. Please wait 10 minutes before trying again.",
      }
    }
  } catch {
    // Fall back to in-memory limit if DB read fails
  }

  // Step 3: Check Cache (only valid, non-expired verified records)
  try {
    const cached = await prisma.upiVerification.findUnique({
      where: { upiId: vpa },
    })

    if (cached && cached.status === "VERIFIED" && cached.expiresAt > new Date()) {
      // Record attempt
      await prisma.upiVerificationAttempt.create({
        data: { userId, upiId: vpa, success: true },
      })

      return {
        success: true,
        exists: true,
        status: "VERIFIED",
        vpa,
        verifiedName: cached.verifiedName || undefined,
        provider: cached.provider,
        referenceId: cached.referenceId || undefined,
        message: "UPI ID verified (from secure cache).",
      }
    }
  } catch (err) {
    // If DB check fails, proceed to live verification without blocking
    console.error("Cache lookup error:", err)
  }

  // Step 4: Call Provider
  const provider = options?.customProvider || getActiveUpiProvider()
  const result = await provider.verifyVpa(vpa)

  // Step 5: Save positive result to cache (30 days validity)
  if (result.exists && result.status === "VERIFIED") {
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await prisma.upiVerification.upsert({
        where: { upiId: vpa },
        create: {
          upiId: vpa,
          verifiedName: result.verifiedName || null,
          status: "VERIFIED",
          provider: result.provider,
          referenceId: result.referenceId || null,
          expiresAt,
        },
        update: {
          verifiedName: result.verifiedName || null,
          status: "VERIFIED",
          provider: result.provider,
          referenceId: result.referenceId || null,
          verifiedAt: new Date(),
          expiresAt,
        },
      })
    } catch (err) {
      console.error("Failed to cache verification:", err)
    }
  }

  // Step 6: Audit log attempt
  try {
    await prisma.upiVerificationAttempt.create({
      data: {
        userId,
        upiId: vpa,
        success: result.exists,
      },
    })
  } catch (err) {
    console.error("Failed to log verification attempt:", err)
  }

  return result
}
