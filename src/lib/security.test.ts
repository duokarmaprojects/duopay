import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  validateId,
  getSafeRedirectUrl,
  sanitizeTextInput,
  validateImageSignature,
  isAllowedSettlementTransition,
} from "./security"
import {
  checkActionRateLimit,
  resetAllRateLimitsForTesting,
} from "./rateLimit"
import {
  generateGroupInviteToken,
  verifyGroupInviteToken,
} from "./invite"
import { auth } from "./auth"
import { prisma } from "./db"
import { recordSettlement } from "@/actions/settlement"
import { addExpense } from "@/actions/expense"
import { deleteGroup, joinGroupWithInviteToken } from "@/actions/group"
import { getUserBalances } from "@/services/balance"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock("@/services/balance", () => ({
  getUserBalances: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    settlement: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    expense: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    expenseParticipant: {
      deleteMany: vi.fn(),
    },
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(prisma)
    }),
  },
}))

describe("Production Security Hardening Test Suite", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    resetAllRateLimitsForTesting()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "user-alice", name: "Alice" },
    } as any)
  })

  // =========================================================================
  // 1. INPUT SANITIZATION & ID VALIDATION
  // =========================================================================
  describe("ID Validation & Path Traversal / Injection Defenses", () => {
    it("should accept valid alphanumeric, CUID, and hyphenated IDs", () => {
      expect(validateId("clx123abc456", "userId")).toBe("clx123abc456")
      expect(validateId("group-123_xyz", "groupId")).toBe("group-123_xyz")
    })

    it("should reject path traversal, SQL injection, and script characters in IDs", () => {
      expect(() => validateId("../etc/passwd", "fileId")).toThrow()
      expect(() => validateId("1; DROP TABLE users;--", "id")).toThrow()
      expect(() => validateId("<script>alert(1)</script>", "id")).toThrow()
      expect(() => validateId("user id with spaces", "id")).toThrow()
      expect(() => validateId("", "id")).toThrow()
    })
  })

  describe("Open Redirect Protection (getSafeRedirectUrl)", () => {
    it("should allow safe internal relative URLs", () => {
      expect(getSafeRedirectUrl("/dashboard")).toBe("/dashboard")
      expect(getSafeRedirectUrl("/groups/123?tab=activity")).toBe("/groups/123?tab=activity")
      expect(getSafeRedirectUrl("/settle")).toBe("/settle")
    })

    it("should block external URLs and protocol-relative open redirects", () => {
      expect(getSafeRedirectUrl("https://evil.com")).toBe("/")
      expect(getSafeRedirectUrl("http://attacker.com/steal")).toBe("/")
      expect(getSafeRedirectUrl("//evil.com")).toBe("/")
      expect(getSafeRedirectUrl("///attacker.com")).toBe("/")
      expect(getSafeRedirectUrl("javascript:alert(1)")).toBe("/")
      expect(getSafeRedirectUrl("data:text/html,evil")).toBe("/")
      expect(getSafeRedirectUrl(null as any, "/home")).toBe("/home")
      expect(getSafeRedirectUrl("", "/home")).toBe("/home")
    })
  })

  describe("Text Input Sanitization (sanitizeTextInput)", () => {
    it("should strip control characters and truncate to maxLength", () => {
      const dirty = "Hello\x00\x08World\x1F! 1234567890"
      const clean = sanitizeTextInput(dirty, 11)
      expect(clean).toBe("HelloWorld!")
      expect(clean.length).toBeLessThanOrEqual(11)
    })

    it("should handle empty or nullish input gracefully", () => {
      expect(sanitizeTextInput("")).toBe("")
      expect(sanitizeTextInput(null as any)).toBe("")
    })
  })

  // =========================================================================
  // 2. IMAGE MAGIC BYTES VALIDATION
  // =========================================================================
  describe("Avatar Image Magic Bytes Inspection", () => {
    it("should accept authentic JPEG files", () => {
      const jpegBuffer = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.alloc(10),
      ])
      const res = validateImageSignature(jpegBuffer)
      expect(res.valid).toBe(true)
      expect(res.mimeType).toBe("image/jpeg")
    })

    it("should accept authentic PNG files", () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(10),
      ])
      const res = validateImageSignature(pngBuffer)
      expect(res.valid).toBe(true)
      expect(res.mimeType).toBe("image/png")
    })

    it("should accept authentic WebP files", () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, // WEBP
      ])
      const res = validateImageSignature(webpBuffer)
      expect(res.valid).toBe(true)
      expect(res.mimeType).toBe("image/webp")
    })

    it("should reject polyglot scripts, SVGs, and executables masquerading as images", () => {
      const svgPayload = Buffer.from("<svg onload='alert(1)'>")
      const htmlPayload = Buffer.from("<html><body>Malicious</body></html>")
      const fakePng = Buffer.from([0x89, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
      const emptyBuffer = Buffer.alloc(0)

      expect(validateImageSignature(svgPayload).valid).toBe(false)
      expect(validateImageSignature(htmlPayload).valid).toBe(false)
      expect(validateImageSignature(fakePng).valid).toBe(false)
      expect(validateImageSignature(emptyBuffer).valid).toBe(false)
    })
  })

  // =========================================================================
  // 3. SERVER-SIDE RATE LIMITING
  // =========================================================================
  describe("Sliding-Window Rate Limiting", () => {
    it("should allow requests within the threshold and block requests exceeding limit", () => {
      const customConfig = { maxAttempts: 3, windowMs: 60000 }
      const key = "rate-test-user"

      const res1 = checkActionRateLimit("TEST", key, customConfig)
      expect(res1.allowed).toBe(true)
      expect(res1.remaining).toBe(2)

      const res2 = checkActionRateLimit("TEST", key, customConfig)
      expect(res2.allowed).toBe(true)
      expect(res2.remaining).toBe(1)

      const res3 = checkActionRateLimit("TEST", key, customConfig)
      expect(res3.allowed).toBe(true)
      expect(res3.remaining).toBe(0)

      // 4th attempt must be rejected
      const res4 = checkActionRateLimit("TEST", key, customConfig)
      expect(res4.allowed).toBe(false)
      expect(res4.remaining).toBe(0)
      expect(res4.resetMs).toBeGreaterThan(0)
    })

    it("should reset rate limits on resetAllRateLimitsForTesting", () => {
      const customConfig = { maxAttempts: 1, windowMs: 60000 }
      checkActionRateLimit("TEST2", "user-x", customConfig)
      expect(checkActionRateLimit("TEST2", "user-x", customConfig).allowed).toBe(false)

      resetAllRateLimitsForTesting()
      expect(checkActionRateLimit("TEST2", "user-x", customConfig).allowed).toBe(true)
    })
  })

  // =========================================================================
  // 4. CRYPTOGRAPHIC GROUP INVITES (HMAC-SHA256)
  // =========================================================================
  describe("Cryptographic Group Invite Tokens", () => {
    it("should generate a valid HMAC token and verify it", () => {
      const token = generateGroupInviteToken("group-123", "user-alice", 7)
      const res = verifyGroupInviteToken("group-123", token)

      expect(res.valid).toBe(true)
      expect(res.inviterId).toBe("user-alice")
    })

    it("should reject token if used for a different group ID", () => {
      const token = generateGroupInviteToken("group-123", "user-alice", 7)
      const res = verifyGroupInviteToken("group-different", token)

      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/does not match this group/)
    })

    it("should reject tampered tokens", () => {
      const token = generateGroupInviteToken("group-123", "user-alice", 7)
      // Tamper base64url content
      const tampered = token.slice(0, -4) + "AAAA"
      const res = verifyGroupInviteToken("group-123", tampered)

      expect(res.valid).toBe(false)
    })

    it("should reject expired tokens", () => {
      // Create a token expired in the past
      const token = generateGroupInviteToken("group-123", "user-alice", -1)
      const res = verifyGroupInviteToken("group-123", token)

      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/expired/)
    })
  })

  // =========================================================================
  // 5. SETTLEMENT STATE MACHINE TRANSITIONS
  // =========================================================================
  describe("Settlement State Machine Transition Security", () => {
    it("should allow valid forward transitions from PENDING", () => {
      expect(isAllowedSettlementTransition("PENDING", "COMPLETED")).toBe(true)
      expect(isAllowedSettlementTransition("PENDING", "FAILED")).toBe(true)
      expect(isAllowedSettlementTransition("PENDING", "CANCELLED")).toBe(true)
    })

    it("should reject illegal reverse or terminal state tampering", () => {
      expect(isAllowedSettlementTransition("COMPLETED", "PENDING")).toBe(false)
      expect(isAllowedSettlementTransition("COMPLETED", "FAILED")).toBe(false)
      expect(isAllowedSettlementTransition("CANCELLED", "COMPLETED")).toBe(false)
      expect(isAllowedSettlementTransition("FAILED", "COMPLETED")).toBe(false)
    })
  })

  // =========================================================================
  // 6. FINANCIAL INTEGRITY & SETTLEMENT ENFORCEMENT
  // =========================================================================
  describe("Financial Settlement Protection (recordSettlement)", () => {
    it("should reject unauthenticated settlements", async () => {
      vi.mocked(auth as any).mockResolvedValueOnce(null)
      const formData = new FormData()
      formData.set("receiverId", "user-bob")
      formData.set("amountPaise", "1000")

      await expect(recordSettlement(formData)).rejects.toThrow("Unauthorized")
    })

    it("should block self-settlement (paying oneself)", async () => {
      const formData = new FormData()
      formData.set("receiverId", "user-alice") // same as authenticated user
      formData.set("amountPaise", "1000")

      await expect(recordSettlement(formData)).rejects.toThrow("Cannot record a settlement with yourself")
    })

    it("should reject negative or zero settlement amounts", async () => {
      const formData = new FormData()
      formData.set("receiverId", "user-bob")
      formData.set("amountPaise", "-500")

      await expect(recordSettlement(formData)).rejects.toThrow("Settlement amount must be positive")
    })

    it("should block settlement when the payer does not owe the recipient", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-bob",
        name: "Bob",
        upiId: "bob@oksbi",
        upiVerified: true,
      } as any)

      // Balances report that Alice owes 0 to Bob
      vi.mocked(getUserBalances).mockResolvedValueOnce({
        totalOwedToUser: 0,
        totalUserOwes: 0,
        detailedBalances: [],
      })

      const formData = new FormData()
      formData.set("receiverId", "user-bob")
      formData.set("amountPaise", "1000")

      await expect(recordSettlement(formData)).rejects.toThrow(
        "You do not have an outstanding balance to settle with this user"
      )
    })

    it("should block settlement amount exceeding the payer's actual debt", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-bob",
        name: "Bob",
        upiId: "bob@oksbi",
        upiVerified: true,
      } as any)

      // Alice only owes Bob 500 paise (₹5.00)
      vi.mocked(getUserBalances).mockResolvedValueOnce({
        totalOwedToUser: 0,
        totalUserOwes: 500,
        detailedBalances: [
          {
            userId: "user-bob",
            userName: "Bob",
            amount: 500,
            type: "USER_OWES",
          },
        ],
      })

      // Attempt to settle 2000 paise (₹20.00)
      const formData = new FormData()
      formData.set("receiverId", "user-bob")
      formData.set("amountPaise", "2000")

      await expect(recordSettlement(formData)).rejects.toThrow(
        /Settlement amount exceeds outstanding balance/
      )
    })

    it("should deduplicate settlement requests with existing idempotencyKey", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "user-bob",
        name: "Bob",
        upiId: "bob@oksbi",
      } as any)

      vi.mocked(getUserBalances).mockResolvedValueOnce({
        totalOwedToUser: 0,
        totalUserOwes: 1000,
        detailedBalances: [
          {
            userId: "user-bob",
            userName: "Bob",
            amount: 1000,
            type: "USER_OWES",
          },
        ],
      })

      // Existing settlement found with this key
      vi.mocked(prisma.settlement.findUnique).mockResolvedValueOnce({
        id: "settle-already-done",
        idempotencyKey: "test-idem-key-123",
      } as any)

      const formData = new FormData()
      formData.set("receiverId", "user-bob")
      formData.set("amountPaise", "1000")
      formData.set("idempotencyKey", "test-idem-key-123")

      // Should redirect gracefully without calling tx.settlement.create
      await expect(recordSettlement(formData)).rejects.toThrow("REDIRECT:/")
      expect(prisma.settlement.create).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 7. EXPENSE SPLIT & AUTHORIZATION SECURITY
  // =========================================================================
  describe("Expense Integrity & Split Enforcement (addExpense)", () => {
    it("should reject non-group members attempting to add expenses to a group", async () => {
      // Alice is NOT a member of group-secret
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([])

      const formData = new FormData()
      formData.set("description", "Hacked Dinner")
      formData.set("amount", "100")
      formData.set("groupId", "group-secret")
      formData.set("payerId", "user-alice")
      formData.append("participants", "user-alice")

      await expect(addExpense(formData)).rejects.toThrow(
        "Unauthorized: You are not a member of this group"
      )
    })

    it("should reject expense when sum of split shares does not match total amount", async () => {
      // Both Alice and Bob are members
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
        { userId: "user-alice" },
        { userId: "user-bob" },
      ] as any)

      const formData = new FormData()
      formData.set("description", "Team Lunch")
      formData.set("amount", "100") // 10000 paise
      formData.set("groupId", "group-1")
      formData.set("payerId", "user-alice")
      formData.append("participants", "user-alice")
      formData.append("participants", "user-bob")
      formData.set("splitMethod", "EXACT")
      // Sum is 4000 + 4000 = 8000 paise, which does not equal 10000 paise
      formData.set(
        "splitData",
        JSON.stringify({
          "user-alice": 4000,
          "user-bob": 4000,
        })
      )

      await expect(addExpense(formData)).rejects.toThrow(
        /do not sum up to the total expense amount|does not match expense amount/
      )
    })
  })

  // =========================================================================
  // 8. GROUP ACCESS & DELETION AUTHORIZATION
  // =========================================================================
  describe("Group Security & Deletion Authorization (group.ts)", () => {
    it("should reject group deletion by anyone other than the creator", async () => {
      // Creator is user-charlie (index 0), but session is user-alice
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
        { userId: "user-charlie", joinedAt: new Date(1000) },
        { userId: "user-alice", joinedAt: new Date(2000) },
      ] as any)

      await expect(deleteGroup("group-1")).rejects.toThrow(
        "Only the group creator can delete the group"
      )
      expect(prisma.group.delete).not.toHaveBeenCalled()
    })

    it("should reject group join with forged or invalid HMAC invite token", async () => {
      await expect(
        joinGroupWithInviteToken("group-123", "forged-invalid-token")
      ).rejects.toThrow("Invalid invite token")
      expect(prisma.groupMember.create).not.toHaveBeenCalled()
    })
  })
})
