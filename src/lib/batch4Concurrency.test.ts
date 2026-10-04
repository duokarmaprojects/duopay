import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendGroupMessage } from "@/actions/chat"
import { addExpenseComment } from "@/actions/comment"
import { moveExpense } from "@/actions/moveExpense"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
    groupMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    groupMessage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    expenseComment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    attachment: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(),
  },
}))

describe("Batch 4 Concurrency & Idempotency Invariants Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-alice", name: "Alice" },
    } as any)
  })

  it("10 concurrent requests for sendGroupMessage with the same idempotency key succeed with exactly ONE creation", async () => {
    vi.mocked(prisma.groupMember.findUnique).mockResolvedValue({
      groupId: "group-1",
      userId: "user-alice",
    } as any)

    let createdMessage: any = null
    const key = "concurrent-chat-key-1"

    // Mock findFirst and create to simulate atomic concurrent execution
    ;(vi.mocked(prisma.groupMessage.findFirst) as any).mockImplementation(async ({ where }: any) => {
      if (where.idempotencyKey === key && createdMessage) {
        return createdMessage
      }
      return null
    })

    ;(vi.mocked(prisma.groupMessage.create) as any).mockImplementation(async ({ data }: any) => {
      if (createdMessage) {
        const err: any = new Error("Unique constraint failed")
        err.code = "P2002"
        throw err
      }
      createdMessage = {
        id: "msg-concurrent-1",
        groupId: data.groupId,
        senderId: data.senderId,
        body: data.body,
        idempotencyKey: data.idempotencyKey,
        createdAt: new Date(),
        sender: { id: "user-alice", name: "Alice", image: null },
        attachments: [],
      }
      return createdMessage
    })

    // Fire 10 concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      sendGroupMessage("group-1", "Concurrent chat", key)
    )

    const results = await Promise.all(promises)

    // All 10 requests must succeed
    expect(results).toHaveLength(10)
    for (const res of results) {
      expect(res.success).toBe(true)
      expect(res.message.id).toBe("msg-concurrent-1")
    }

    // Exactly one created, nine duplicates
    const newlyCreated = results.filter((r) => !r.isDuplicate)
    const duplicates = results.filter((r) => r.isDuplicate)

    expect(newlyCreated).toHaveLength(1)
    expect(duplicates).toHaveLength(9)
    expect(prisma.groupMessage.create).toHaveBeenCalledTimes(10)
  })

  it("10 concurrent requests for addExpenseComment with the same idempotency key succeed with exactly ONE creation", async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue({
      id: "exp-1",
      groupId: "group-1",
      payerId: "user-alice",
      description: "Team Lunch",
      group: { members: [{ userId: "user-alice" }] },
      participants: [{ userId: "user-alice" }],
    } as any)

    let createdComment: any = null
    const key = "concurrent-comment-key-1"

    ;(vi.mocked(prisma.expenseComment.findFirst) as any).mockImplementation(async ({ where }: any) => {
      if (where.idempotencyKey === key && createdComment) {
        return createdComment
      }
      return null
    })

    ;(vi.mocked(prisma.expenseComment.create) as any).mockImplementation(async ({ data }: any) => {
      if (createdComment) {
        const err: any = new Error("Unique constraint failed")
        err.code = "P2002"
        throw err
      }
      createdComment = {
        id: "c-concurrent-1",
        expenseId: data.expenseId,
        authorId: data.authorId,
        body: data.body,
        idempotencyKey: data.idempotencyKey,
        createdAt: new Date(),
        author: { id: "user-alice", name: "Alice", image: null },
      }
      return createdComment
    })

    // Fire 10 concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      addExpenseComment("exp-1", "Concurrent comment", key)
    )

    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)
    for (const res of results) {
      expect(res.success).toBe(true)
      expect(res.comment.id).toBe("c-concurrent-1")
    }

    const newlyCreated = results.filter((r) => !r.isDuplicate)
    const duplicates = results.filter((r) => r.isDuplicate)

    expect(newlyCreated).toHaveLength(1)
    expect(duplicates).toHaveLength(9)
    expect(prisma.expenseComment.create).toHaveBeenCalledTimes(10)
  })

  it("10 concurrent requests for moveExpense with the same idempotency key succeed with exactly ONE database mutation", async () => {
    let currentGroupId = "group-source"
    let updateCount = 0

    ;(vi.mocked(prisma.expense.findUnique) as any).mockImplementation(async () => ({
      id: "exp-1",
      groupId: "group-source",
      description: "Trip Tickets",
      amount: 100000,
      participants: [{ userId: "user-alice", user: { name: "Alice" } }],
      group: { name: "Source" },
    }))

    vi.mocked(prisma.groupMember.findUnique).mockResolvedValue({
      groupId: "group-source",
      userId: "user-alice",
    } as any)

    vi.mocked(prisma.group.findUnique).mockResolvedValue({
      id: "group-dest",
      name: "Destination",
      members: [{ userId: "user-alice", user: { name: "Alice" } }],
    } as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txMock = {
        expense: {
          findUnique: async () => ({ id: "exp-1", groupId: currentGroupId }),
          updateMany: async ({ where, data }: any) => {
            if (where.groupId === "group-source" && currentGroupId === "group-source") {
              currentGroupId = data.groupId
              updateCount++
              return { count: 1 }
            }
            return { count: 0 }
          },
        },
        attachment: {
          updateMany: async () => ({ count: 0 }),
        },
      }
      return callback(txMock)
    })

    const key = "concurrent-move-key-1"
    const promises = Array.from({ length: 10 }, () => {
      const fd = new FormData()
      fd.append("expenseId", "exp-1")
      fd.append("destinationGroupId", "group-dest")
      fd.append("idempotencyKey", key)
      return moveExpense(fd)
    })

    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)
    for (const res of results) {
      expect(res.success).toBe(true)
      expect(res.destinationGroupId).toBe("group-dest")
    }

    const firstSuccess = results.filter((r) => !r.isDuplicate)
    const duplicateSuccess = results.filter((r) => r.isDuplicate)

    expect(firstSuccess).toHaveLength(1)
    expect(duplicateSuccess).toHaveLength(9)
    expect(updateCount).toBe(1)
  })
})
