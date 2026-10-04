import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    receiptScan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    orderImport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
  },
}))

describe("Share Target API Route Security", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects unauthenticated requests to login", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)

    const req = new NextRequest("http://localhost:3000/api/share-target", {
      method: "POST",
    })

    const res = await POST(req)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toContain("/login")
  })

  it("rejects files exceeding 10MB limit", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)

    const req = new NextRequest("http://localhost:3000/api/share-target", {
      method: "POST",
    })
    const mockFormData = new FormData()
    const largeFile = new File([], "large.jpg", { type: "image/jpeg" })
    Object.defineProperty(largeFile, "size", { value: 11 * 1024 * 1024 })
    mockFormData.append("receipt", largeFile)
    vi.spyOn(req, "formData").mockResolvedValueOnce(mockFormData)

    const res = await POST(req)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toContain("error=FileTooLarge")
  })

  it("rejects disallowed MIME types", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)

    const formData = new FormData()
    const invalidFile = new File(["malicious content"], "evil.exe", { type: "application/x-msdownload" })
    formData.append("receipt", invalidFile)

    const req = new NextRequest("http://localhost:3000/api/share-target", {
      method: "POST",
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toContain("error=InvalidFileType")
  })

  it("successfully validates valid image and creates ReceiptScan", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
    vi.mocked(prisma.receiptScan.create).mockResolvedValueOnce({ id: "scan-created-123" } as any)

    const formData = new FormData()
    // Valid JPEG header
    const validBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    const validFile = new File([validBytes], "payment.jpg", { type: "image/jpeg" })
    formData.append("receipt", validFile)

    const req = new NextRequest("http://localhost:3000/api/share-target", {
      method: "POST",
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toContain("/receipt?scanId=scan-created-123")
  })
})
