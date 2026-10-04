import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  addExpenseComment,
  getExpenseComments,
  editExpenseComment,
  deleteExpenseComment,
} from "./comment"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { pusherServer } from "@/lib/realtime/pusher"
import { sendNotification } from "@/services/notification"

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

vi.mock("@/services/notification", () => ({
  sendNotification: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/rateLimit", () => ({
  checkActionRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    expense: {
      findUnique: vi.fn(),
    },
    expenseComment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe("Phase O: Expense Comments Actions (comment.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("addExpenseComment", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      await expect(addExpenseComment("exp-1", "Nice split")).rejects.toThrow("Unauthorized")
    })

    it("rejects empty comments", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1" } } as any)
      await expect(addExpenseComment("exp-1", "   ")).rejects.toThrow("Comment text cannot be empty")
    })

    it("rejects comments exceeding 1000 characters", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1" } } as any)
      const longComment = "x".repeat(1001)
      await expect(addExpenseComment("exp-1", longComment)).rejects.toThrow(
        "Comment exceeds maximum length"
      )
    })

    it("rejects users who are neither in the group nor participants of the expense (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        groupId: "group-1",
        payerId: "user-alice",
        group: {
          members: [{ userId: "user-alice" }, { userId: "user-bob" }],
        },
        participants: [{ userId: "user-alice" }, { userId: "user-bob" }],
      } as any)

      await expect(addExpenseComment("exp-1", "Unauthorized comment")).rejects.toThrow(
        "Unauthorized: You do not have access to this expense"
      )
    })

    it("returns duplicate when idempotencyKey matches existing comment", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice", name: "Alice" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        groupId: "group-1",
        payerId: "user-alice",
        group: { members: [{ userId: "user-alice" }] },
        participants: [{ userId: "user-alice" }],
      } as any)

      const existingComment = {
        id: "c-existing",
        expenseId: "exp-1",
        authorId: "user-alice",
        body: "Duplicate check",
        idempotencyKey: "key-comment-1",
      }
      vi.mocked(prisma.expenseComment.findFirst).mockResolvedValueOnce(existingComment as any)

      const res = await addExpenseComment("exp-1", "Duplicate check", "key-comment-1")
      expect(res.isDuplicate).toBe(true)
      expect(res.comment.id).toBe("c-existing")
      expect(prisma.expenseComment.create).not.toHaveBeenCalled()
    })

    it("successfully creates comment, triggers Pusher broadcast, and notifies participants", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice", name: "Alice" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        description: "Dinner",
        groupId: "group-1",
        payerId: "user-alice",
        group: { members: [{ userId: "user-alice" }, { userId: "user-bob" }] },
        participants: [{ userId: "user-alice" }, { userId: "user-bob" }],
      } as any)

      const createdComment = {
        id: "c-new",
        expenseId: "exp-1",
        authorId: "user-alice",
        body: "I will pay tomorrow",
        createdAt: new Date(),
        author: { id: "user-alice", name: "Alice", image: null },
      }
      vi.mocked(prisma.expenseComment.create).mockResolvedValueOnce(createdComment as any)

      const res = await addExpenseComment("exp-1", "I will pay tomorrow")
      expect(res.success).toBe(true)
      expect(res.isDuplicate).toBe(false)
      expect(pusherServer.trigger).toHaveBeenCalledWith(
        "expense-exp-1",
        "expense.comment_created",
        expect.objectContaining({ id: "c-new", body: "I will pay tomorrow" })
      )
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-bob",
          type: "EXPENSE_COMMENT",
        })
      )
    })
  })

  describe("editExpenseComment", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      await expect(editExpenseComment("c-1", "Edited")).rejects.toThrow("Unauthorized")
    })

    it("prevents editing someone else's comment (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.expenseComment.findUnique).mockResolvedValueOnce({
        id: "c-1",
        authorId: "user-alice",
      } as any)

      await expect(editExpenseComment("c-1", "Malicious edit")).rejects.toThrow(
        "Unauthorized: You can only edit your own comments"
      )
    })

    it("allows author to edit comment and triggers Pusher update", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.expenseComment.findUnique).mockResolvedValueOnce({
        id: "c-1",
        expenseId: "exp-1",
        authorId: "user-alice",
      } as any)
      vi.mocked(prisma.expenseComment.update).mockResolvedValueOnce({
        id: "c-1",
        body: "Updated text",
        updatedAt: new Date(),
      } as any)

      const res = await editExpenseComment("c-1", "Updated text")
      expect(res.success).toBe(true)
      expect(pusherServer.trigger).toHaveBeenCalledWith(
        "expense-exp-1",
        "expense.comment_updated",
        expect.objectContaining({ id: "c-1", body: "Updated text" })
      )
    })
  })

  describe("deleteExpenseComment", () => {
    it("prevents deleting someone else's comment (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.expenseComment.findUnique).mockResolvedValueOnce({
        id: "c-1",
        authorId: "user-alice",
      } as any)

      await expect(deleteExpenseComment("c-1")).rejects.toThrow(
        "Unauthorized: You can only delete your own comments"
      )
    })

    it("allows author to delete comment", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.expenseComment.findUnique).mockResolvedValueOnce({
        id: "c-1",
        expenseId: "exp-1",
        authorId: "user-alice",
      } as any)
      vi.mocked(prisma.expenseComment.update).mockResolvedValueOnce({ id: "c-1" } as any)

      const res = await deleteExpenseComment("c-1")
      expect(res.success).toBe(true)
      expect(pusherServer.trigger).toHaveBeenCalledWith(
        "expense-exp-1",
        "expense.comment_deleted",
        expect.objectContaining({ commentId: "c-1" })
      )
    })
  })
})
