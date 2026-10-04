import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createReceiptScan,
  getReceiptScan,
  confirmReceiptExpense,
} from "./receiptScan"
import { validateImageMagicBytes } from "@/domain/receipt"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/actions/expense", () => ({
  addExpense: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    receiptScan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderImport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
  },
}))

describe("Receipt Intelligence & Security Suite (receiptScan.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Magic Byte Image Validation", () => {
    it("accepts valid JPEG header (FF D8 FF)", () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
      expect(validateImageMagicBytes(bytes, "image/jpeg")).toBe(true)
    })

    it("rejects spoofed JPEG with invalid header", () => {
      const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]) // GIF
      expect(validateImageMagicBytes(bytes, "image/jpeg")).toBe(false)
    })

    it("accepts valid PNG header (89 50 4E 47)", () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
      expect(validateImageMagicBytes(bytes, "image/png")).toBe(true)
    })

    it("rejects buffer with length < 12 bytes", () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff])
      expect(validateImageMagicBytes(bytes, "image/jpeg")).toBe(false)
    })
  })

  describe("createReceiptScan Security Checks", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      const form = new FormData()
      await expect(createReceiptScan(form)).rejects.toThrow("Unauthorized")
    })

    it("rejects invalid MIME types", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      const file = new File(["fake script"], "malicious.js", { type: "application/javascript" })
      const form = new FormData()
      form.append("receipt", file)

      await expect(createReceiptScan(form)).rejects.toThrow(/Invalid file type/)
    })

    it("rejects images with spoofed MIME and invalid magic bytes", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      // File reports image/jpeg but content is plain text
      const fakeBytes = new Uint8Array(20).fill(0x41) // "AAAA..."
      const file = new File([fakeBytes], "spoofed.jpg", { type: "image/jpeg" })
      const form = new FormData()
      form.append("receipt", file)

      await expect(createReceiptScan(form)).rejects.toThrow(/Invalid image header/)
    })
  })

  describe("IDOR Protection", () => {
    it("prevents reading another user's receipt scan", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-bob" } } as any)
      vi.mocked(prisma.receiptScan.findUnique).mockResolvedValueOnce({
        id: "scan-alice",
        userId: "victim-alice",
        status: "NEEDS_REVIEW",
      } as any)

      await expect(getReceiptScan("scan-alice")).rejects.toThrow(/Unauthorized/)
    })

    it("prevents confirming another user's receipt scan", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-bob" } } as any)
      vi.mocked(prisma.receiptScan.findUnique).mockResolvedValueOnce({
        id: "scan-alice",
        userId: "victim-alice",
        status: "NEEDS_REVIEW",
      } as any)

      const form = new FormData()
      form.append("scanId", "scan-alice")

      await expect(confirmReceiptExpense(form)).rejects.toThrow(/Unauthorized/)
    })

    it("rejects confirming a scan that is already CONFIRMED", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.receiptScan.findUnique).mockResolvedValueOnce({
        id: "scan-alice",
        userId: "user-alice",
        status: "CONFIRMED",
      } as any)

      const form = new FormData()
      form.append("scanId", "scan-alice")

      await expect(confirmReceiptExpense(form)).rejects.toThrow(/already been confirmed/)
    })
  })
})
