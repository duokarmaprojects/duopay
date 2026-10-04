import { describe, it, expect, vi, beforeEach } from "vitest"
import { createAttachment, getAttachment, deleteAttachment } from "./attachment"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rateLimit", () => ({
  checkActionRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    groupMember: {
      findUnique: vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
    },
    groupMessage: {
      findUnique: vi.fn(),
    },
    attachment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

describe("Phase P: Attachments Security & Storage Suite (attachment.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createAttachment", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      const fd = new FormData()
      await expect(createAttachment(fd)).rejects.toThrow("Unauthorized")
    })

    it("rejects files exceeding 10MB limit", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      const oversized = new File([new Uint8Array(11 * 1024 * 1024)], "huge.jpg", {
        type: "image/jpeg",
      })
      const fd = new FormData()
      fd.append("file", oversized)

      await expect(createAttachment(fd)).rejects.toThrow("File exceeds maximum allowed size of 10MB")
    })

    it("rejects disallowed MIME types", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      const badFile = new File(["malicious script"], "hack.exe", {
        type: "application/x-msdownload",
      })
      const fd = new FormData()
      fd.append("file", badFile)

      await expect(createAttachment(fd)).rejects.toThrow("Disallowed file type")
    })

    it("rejects spoofed images with magic-bytes mismatch", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      // Declares image/jpeg, but starts with GIF header
      const spoofed = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], "fake.jpg", {
        type: "image/jpeg",
      })
      const fd = new FormData()
      fd.append("file", spoofed)

      await expect(createAttachment(fd)).rejects.toThrow("Invalid image header")
    })

    it("blocks non-members from attaching to a group (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce(null)

      // Valid JPEG header
      const validJpg = new File(
        [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])],
        "pic.jpg",
        { type: "image/jpeg" }
      )
      const fd = new FormData()
      fd.append("file", validJpg)
      fd.append("groupId", "group-secret")

      await expect(createAttachment(fd)).rejects.toThrow(
        "Unauthorized: You are not a member of this group"
      )
    })

    it("blocks non-participants from attaching to an expense (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        payerId: "user-alice",
        group: { members: [{ userId: "user-alice" }] },
        participants: [{ userId: "user-alice" }],
      } as any)

      const validPng = new File(
        [
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
            0x48, 0x44, 0x52,
          ]),
        ],
        "receipt.png",
        { type: "image/png" }
      )
      const fd = new FormData()
      fd.append("file", validPng)
      fd.append("expenseId", "exp-1")

      await expect(createAttachment(fd)).rejects.toThrow(
        "Unauthorized: You do not have access to this expense"
      )
    })

    it("successfully creates attachment with SHA-256 fingerprint and storage key", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({
        groupId: "group-1",
        userId: "user-alice",
      } as any)

      const validJpg = new File(
        [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])],
        "lunch.jpg",
        { type: "image/jpeg" }
      )
      const fd = new FormData()
      fd.append("file", validJpg)
      fd.append("groupId", "group-1")

      vi.mocked(prisma.attachment.create).mockResolvedValueOnce({
        id: "att-1",
        ownerId: "user-alice",
        groupId: "group-1",
        storageKey: "attachments/user-alice/uuid-lunch.jpg",
        fileName: "lunch.jpg",
        mimeType: "image/jpeg",
        sizeBytes: validJpg.size,
      } as any)

      const res = await createAttachment(fd)
      expect(res.success).toBe(true)
      expect(res.attachment.id).toBe("att-1")
      expect(res.attachment.storageKey).toContain("attachments/user-alice/")
    })
  })

  describe("getAttachment (IDOR Protection)", () => {
    it("rejects unauthorized access when user is not owner, group member, or expense participant", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.attachment.findUnique).mockResolvedValueOnce({
        id: "att-private",
        ownerId: "victim-1",
        groupId: "group-victim",
        group: { members: [{ userId: "victim-1" }] },
      } as any)

      await expect(getAttachment("att-private")).rejects.toThrow("Unauthorized: Access denied")
    })

    it("allows authorized group member to access attachment", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.attachment.findUnique).mockResolvedValueOnce({
        id: "att-group",
        ownerId: "user-bob",
        groupId: "group-1",
        group: { members: [{ userId: "user-alice" }, { userId: "user-bob" }] },
        fileName: "bill.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        storageKey: "key-123",
        createdAt: new Date(),
      } as any)

      const res = await getAttachment("att-group")
      expect(res.id).toBe("att-group")
      expect(res.fileName).toBe("bill.jpg")
    })
  })

  describe("deleteAttachment (IDOR Protection)", () => {
    it("prevents non-owner from deleting an attachment", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.attachment.findUnique).mockResolvedValueOnce({
        id: "att-1",
        ownerId: "victim-1",
      } as any)

      await expect(deleteAttachment("att-1")).rejects.toThrow(
        "Unauthorized: You can only delete your own attachments"
      )
    })

    it("allows owner to delete their attachment", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.attachment.findUnique).mockResolvedValueOnce({
        id: "att-1",
        ownerId: "user-alice",
      } as any)
      vi.mocked(prisma.attachment.delete).mockResolvedValueOnce({ id: "att-1" } as any)

      const res = await deleteAttachment("att-1")
      expect(res.success).toBe(true)
    })
  })
})
