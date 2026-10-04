import { describe, it, expect, vi, beforeEach } from "vitest"
import { addFriend, removeFriend, getFriendsList, getFriendProfile } from "./friend"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/services/notification", () => ({
  sendNotification: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/services/balance", () => ({
  getUserBalances: vi.fn().mockResolvedValue({
    totalOwedToUser: 5000,
    totalUserOwes: 2000,
    netBalance: 3000,
    detailedBalances: [
      {
        userId: "friend-bob",
        userName: "Bob",
        amount: 5000,
        type: "OWED_TO_USER",
      },
    ],
  }),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    automationRule: { findMany: async () => [] },
    merchantAlias: { findUnique: async () => null },
    merchant: { findFirst: async () => null, create: async () => null, findUnique: async () => null },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    friendship: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    expense: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    settlement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt-1" }),
    },
  },
}))

describe("PHASE 1: Friendship & Friends Authorization Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: "user-alice" },
    } as any)
  })

  it("1. Rejects unauthenticated friend actions", async () => {
    vi.mocked(auth as any).mockResolvedValue(null)
    await expect(addFriend("friend-bob")).rejects.toThrow("Unauthorized")
    await expect(removeFriend("friend-bob")).rejects.toThrow("Unauthorized")
    await expect(getFriendsList()).rejects.toThrow("Unauthorized")
  })

  it("2. Prevents self-friending", async () => {
    await expect(addFriend("user-alice")).rejects.toThrow("You cannot add yourself as a friend")
    expect(prisma.friendship.create).not.toHaveBeenCalled()
  })

  it("3. Successfully creates a friendship and dispatches notification", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: "friend-bob", name: "Bob" } as any) // Target friend check
      .mockResolvedValueOnce({ id: "user-alice", name: "Alice" } as any) // Current user name for notification

    vi.mocked(prisma.friendship.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.friendship.create).mockResolvedValueOnce({
      id: "friendship-1",
      userId: "user-alice",
      friendId: "friend-bob",
      status: "ACCEPTED",
    } as any)

    const result = await addFriend("friend-bob")
    expect(result.success).toBe(true)
    expect(prisma.friendship.create).toHaveBeenCalledWith({
      data: {
        userId: "user-alice",
        friendId: "friend-bob",
        status: "ACCEPTED",
      },
    })
  })

  it("4. Handles existing friendship idempotently", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "friend-bob", name: "Bob" } as any)
    vi.mocked(prisma.friendship.findFirst).mockResolvedValueOnce({
      id: "friendship-1",
      userId: "user-alice",
      friendId: "friend-bob",
      status: "ACCEPTED",
    } as any)

    const result = await addFriend("friend-bob")
    expect(result.success).toBe(true)
    expect(result.message).toBe("Already friends")
    expect(prisma.friendship.create).not.toHaveBeenCalled()
  })

  it("5. Removes friendship cleanly without deleting financial history", async () => {
    const result = await removeFriend("friend-bob")
    expect(result.success).toBe(true)
    expect(prisma.friendship.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "user-alice", friendId: "friend-bob" },
          { userId: "friend-bob", friendId: "user-alice" },
        ],
      },
    })
  })

  it("6. Scopes friend profile and balance strictly to session user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "friend-bob",
      name: "Bob",
      image: null,
      phone: "+919876543210",
      upiId: "bob@oksbi",
      settings: { showUpiOnProfile: true },
    } as any)

    const profile = await getFriendProfile("friend-bob")
    expect(profile.friend.name).toBe("Bob")
    expect(profile.friend.upiId).toBe("bob@oksbi")
    expect(profile.balance.amount).toBe(5000)
    expect(profile.balance.type).toBe("OWED_TO_USER")
  })
})


