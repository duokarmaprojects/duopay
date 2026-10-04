import { describe, it, expect, vi, beforeEach } from "vitest"
import { previewMoveExpense, moveExpense, getUserGroups } from "./moveExpense"
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
      updateMany: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
    },
    attachment: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn((fn: any) =>
      fn({
        expense: {
          findUnique: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        attachment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      })
    ),
  },
}))

describe("Phase Q: Move Expense Actions & Invariants (moveExpense.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("previewMoveExpense", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any)
      await expect(previewMoveExpense("exp-1", "group-2")).rejects.toThrow("Unauthorized")
    })

    it("rejects moving to the same group", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        groupId: "group-1",
        group: { name: "Source Group" },
        participants: [],
      } as any)

      await expect(previewMoveExpense("exp-1", "group-1")).rejects.toThrow(
        "Source and destination groups must be different"
      )
    })

    it("correctly identifies missing participants in destination group", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        groupId: "group-source",
        group: { name: "Apartment" },
        amount: 50000,
        description: "Groceries",
        participants: [
          { userId: "user-alice", user: { id: "user-alice", name: "Alice" } },
          { userId: "user-bob", user: { id: "user-bob", name: "Bob" } },
        ],
      } as any)

      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({
        groupId: "group-source",
        userId: "user-alice",
      } as any)

      // In destination group, only Alice is a member, Bob is missing!
      vi.mocked(prisma.group.findUnique).mockResolvedValueOnce({
        id: "group-dest",
        name: "Goa Trip",
        members: [{ userId: "user-alice", user: { id: "user-alice", name: "Alice" } }],
      } as any)

      const preview = await previewMoveExpense("exp-1", "group-dest")
      expect(preview.canMove).toBe(false)
      expect(preview.missingParticipants).toContain("Bob")
      expect(preview.message).toContain("Bob")
    })

    it("returns canMove=true when all participants are members in destination group", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        groupId: "group-source",
        group: { name: "Apartment" },
        amount: 50000,
        description: "Groceries",
        participants: [
          { userId: "user-alice", user: { id: "user-alice", name: "Alice" } },
          { userId: "user-bob", user: { id: "user-bob", name: "Bob" } },
        ],
      } as any)

      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({
        groupId: "group-source",
        userId: "user-alice",
      } as any)

      // Both Alice and Bob are members of destination group
      vi.mocked(prisma.group.findUnique).mockResolvedValueOnce({
        id: "group-dest",
        name: "Goa Trip",
        members: [
          { userId: "user-alice", user: { id: "user-alice", name: "Alice" } },
          { userId: "user-bob", user: { id: "user-bob", name: "Bob" } },
        ],
      } as any)

      const preview = await previewMoveExpense("exp-1", "group-dest")
      expect(preview.canMove).toBe(true)
      expect(preview.missingParticipants).toHaveLength(0)
    })
  })

  describe("moveExpense", () => {
    it("rejects caller who is not a member of the source group (IDOR protection)", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "attacker-1" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        groupId: "group-source",
        participants: [],
      } as any)

      // Caller is not member of source group
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce(null)

      const fd = new FormData()
      fd.append("expenseId", "exp-1")
      fd.append("destinationGroupId", "group-dest")

      await expect(moveExpense(fd)).rejects.toThrow(
        "Unauthorized: You are not a member of the source group"
      )
    })

    it("rejects move if participants are not in destination group", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        groupId: "group-source",
        description: "Hotel",
        participants: [
          { userId: "user-alice", user: { id: "user-alice", name: "Alice" } },
          { userId: "user-charlie", user: { id: "user-charlie", name: "Charlie" } },
        ],
      } as any)

      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({
        groupId: "group-source",
        userId: "user-alice",
      } as any)

      vi.mocked(prisma.group.findUnique).mockResolvedValueOnce({
        id: "group-dest",
        name: "Trip",
        members: [{ userId: "user-alice" }], // Charlie is missing!
      } as any)

      const fd = new FormData()
      fd.append("expenseId", "exp-1")
      fd.append("destinationGroupId", "group-dest")

      await expect(moveExpense(fd)).rejects.toThrow("Cannot move expense: Charlie is not a member")
    })

    it("atomically moves expense, broadcasts Pusher events to both groups, and notifies members", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice", name: "Alice" } } as any)
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: "exp-1",
        groupId: "group-source",
        description: "Dinner",
        amount: 25000,
        participants: [
          { userId: "user-alice", user: { id: "user-alice", name: "Alice" } },
          { userId: "user-bob", user: { id: "user-bob", name: "Bob" } },
        ],
      } as any)

      vi.mocked(prisma.groupMember.findUnique).mockResolvedValueOnce({
        groupId: "group-source",
        userId: "user-alice",
      } as any)

      vi.mocked(prisma.group.findUnique).mockResolvedValueOnce({
        id: "group-dest",
        name: "Goa Vacation",
        members: [
          { userId: "user-alice", user: { name: "Alice" } },
          { userId: "user-bob", user: { name: "Bob" } },
        ],
      } as any)

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn: any) => {
        return fn({
          expense: {
            findUnique: vi.fn().mockResolvedValue({ id: "exp-1", groupId: "group-source" }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          attachment: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        })
      })

      const fd = new FormData()
      fd.append("expenseId", "exp-1")
      fd.append("destinationGroupId", "group-dest")
      fd.append("idempotencyKey", "key-move-1")

      const res = await moveExpense(fd)
      expect(res.success).toBe(true)
      expect(res.isDuplicate).toBe(false)

      // Pusher broadcast to both groups
      expect(pusherServer.trigger).toHaveBeenCalledWith(
        "group-group-source",
        "expense.moved_out",
        expect.objectContaining({ expenseId: "exp-1", destinationGroupId: "group-dest" })
      )
      expect(pusherServer.trigger).toHaveBeenCalledWith(
        "group-group-dest",
        "expense.moved_in",
        expect.objectContaining({ expenseId: "exp-1", sourceGroupId: "group-source" })
      )

      // Notification sent to other dest group members
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-bob",
          type: "EXPENSE_ADDED",
        })
      )
    })
  })

  describe("getUserGroups", () => {
    it("returns user groups when authenticated", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-alice" } } as any)
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce([
        { group: { id: "g1", name: "Group 1", image: null, type: "GROUP" } },
        { group: { id: "g2", name: "Group 2", image: null, type: "TRIP" } },
      ] as any)

      const groups = await getUserGroups()
      expect(groups).toHaveLength(2)
      expect(groups[0].id).toBe("g1")
    })
  })
})
