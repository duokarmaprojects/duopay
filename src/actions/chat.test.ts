import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendGroupMessage, getGroupMessages, deleteGroupMessage } from "./chat"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { pusherServer } from "@/lib/realtime/pusher"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/realtime/pusher", () => ({
  pusherServer: {
    trigger: vi.fn().mockResolvedValue({}),
  },
  getPusherClient: vi.fn(),
}))

vi.mock("@/lib/rateLimit", () => ({
  checkActionRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    groupMember: {
      findUnique: vi.fn(),
    },
    groupMessage: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe("Phase N: Group Chat Actions (chat.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("sendGroupMessage", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      await expect(sendGroupMessage("group-1", "Hello")).rejects.toThrow("Unauthorized")
    })

    it("rejects empty or whitespace-only messages", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1", name: "Alice" } } as any)
      await expect(sendGroupMessage("group-1", "   ")).rejects.toThrow("Message body cannot be empty")
    })

    it("rejects messages exceeding max length", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1", name: "Alice" } } as any)
      const longMessage = "a".repeat(2001)
      await expect(sendGroupMessage("group-1", longMessage)).rejects.toThrow(
        "Message exceeds maximum length"
      )
    })

    it("rejects non-members of the group (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1", name: "Attacker" } } as any)
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce(null) // Not a member

      await expect(sendGroupMessage("group-secret", "I shouldn't be here")).rejects.toThrow(
        "Unauthorized: You are not a member of this group"
      )
    })

    it("returns duplicate message when idempotencyKey matches existing message", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1", name: "Alice" } } as any)
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({
        groupId: "group-1",
        userId: "user-1",
      } as any)

      const existingMsg = {
        id: "msg-existing",
        groupId: "group-1",
        senderId: "user-1",
        body: "Hello",
        idempotencyKey: "key-123",
      }
      vi.mocked(prisma.groupMessage.findFirst).mockResolvedValueOnce(existingMsg as any)

      const res = await sendGroupMessage("group-1", "Hello", "key-123")
      expect(res.isDuplicate).toBe(true)
      expect(res.message.id).toBe("msg-existing")
      expect(prisma.groupMessage.create).not.toHaveBeenCalled()
    })

    it("successfully creates message and broadcasts Pusher event", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1", name: "Alice" } } as any)
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({
        groupId: "group-1",
        userId: "user-1",
      } as any)

      const createdMsg = {
        id: "msg-new",
        groupId: "group-1",
        senderId: "user-1",
        body: "Hello everyone",
        createdAt: new Date(),
        sender: { id: "user-1", name: "Alice", image: null },
        attachments: [],
      }
      vi.mocked(prisma.groupMessage.create).mockResolvedValueOnce(createdMsg as any)

      const res = await sendGroupMessage("group-1", "Hello everyone")
      expect(res.success).toBe(true)
      expect(res.isDuplicate).toBe(false)
      expect(pusherServer.trigger).toHaveBeenCalledWith(
        "group-group-1",
        "chat.message_created",
        expect.objectContaining({ id: "msg-new", body: "Hello everyone" })
      )
    })
  })

  describe("getGroupMessages", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      await expect(getGroupMessages("group-1")).rejects.toThrow("Unauthorized")
    })

    it("rejects non-members of the group (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce(null)

      await expect(getGroupMessages("group-1")).rejects.toThrow("Unauthorized")
    })

    it("returns messages in chronological order with cursor pagination", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1" } } as any)
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({
        groupId: "group-1",
        userId: "user-1",
      } as any)

      const d1 = new Date("2026-01-01T10:00:00Z")
      const d2 = new Date("2026-01-01T10:05:00Z")
      // prisma findMany orders desc: [d2, d1]
      vi.mocked(prisma.groupMessage.findMany).mockResolvedValueOnce([
        { id: "m2", createdAt: d2, body: "Second" },
        { id: "m1", createdAt: d1, body: "First" },
      ] as any)

      const res = await getGroupMessages("group-1", null, 10)
      expect(res.messages).toHaveLength(2)
      // Reversed to chronological: [m1, m2]
      expect(res.messages[0].id).toBe("m1")
      expect(res.messages[1].id).toBe("m2")
    })
  })

  describe("deleteGroupMessage", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      await expect(deleteGroupMessage("msg-1")).rejects.toThrow("Unauthorized")
    })

    it("prevents deleting another user's message (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.groupMessage.findUnique).mockResolvedValueOnce({
        id: "msg-1",
        senderId: "victim-1",
        groupId: "group-1",
      } as any)

      await expect(deleteGroupMessage("msg-1")).rejects.toThrow(
        "Unauthorized: You can only delete your own messages"
      )
    })

    it("allows author to soft-delete message and triggers broadcast", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "author-1" } } as any)
      vi.mocked(prisma.groupMessage.findUnique).mockResolvedValueOnce({
        id: "msg-1",
        senderId: "author-1",
        groupId: "group-1",
      } as any)
      vi.mocked(prisma.groupMessage.update).mockResolvedValueOnce({ id: "msg-1" } as any)

      const res = await deleteGroupMessage("msg-1")
      expect(res.success).toBe(true)
      expect(prisma.groupMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "msg-1" },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      )
      expect(pusherServer.trigger).toHaveBeenCalledWith(
        "group-group-1",
        "chat.message_deleted",
        expect.objectContaining({ messageId: "msg-1" })
      )
    })
  })
})
