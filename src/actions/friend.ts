"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { logSecurityEvent } from "@/lib/securityAudit"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { validateId } from "@/lib/security"
import { getUserBalances } from "@/services/balance"
import { sendNotification } from "@/services/notification"

const addFriendSchema = z.object({
  friendId: z.string().min(1, "Friend ID is required"),
})

/**
 * Send a friend request or add a friend directly.
 * Zero-Trust & Authorization:
 * - Session-derived identity only.
 * - Cannot add oneself.
 * - Prevents duplicate relationships.
 * - Rate limited.
 */
export async function addFriend(friendId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    await logSecurityEvent({
      type: "AUTH_UNAUTHORIZED_ACCESS",
      details: { action: "addFriend" },
    })
    throw new Error("Unauthorized")
  }

  const userId = session.user.id
  validateId(friendId, "friendId")

  if (userId === friendId) {
    throw new Error("You cannot add yourself as a friend")
  }

  const rateLimit = checkActionRateLimit("PROFILE_UPDATE", userId)
  if (!rateLimit.allowed) {
    throw new Error("Too many requests. Please wait a moment.")
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: friendId },
    select: { id: true, name: true },
  })
  if (!targetUser) {
    throw new Error("User not found")
  }

  // Check if friendship already exists in either direction
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  })

  if (existing) {
    if (existing.status === "ACCEPTED") {
      return { success: true, message: "Already friends" }
    }
    if (existing.status === "BLOCKED") {
      throw new Error("Unable to add this user as a friend")
    }
    // If pending and current user is recipient, accept it
    if (existing.status === "PENDING" && existing.friendId === userId) {
      await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: "ACCEPTED" },
      })
      revalidatePath("/friends")
      revalidatePath("/")
      return { success: true, message: "Friend request accepted" }
    }
    return { success: true, message: "Friend request already sent" }
  }

  // Create Friendship
  const friendship = await prisma.friendship.create({
    data: {
      userId,
      friendId,
      status: "ACCEPTED", // Instant friend acceptance for streamlined PWA UX
    },
  })

  await logSecurityEvent({
    type: "FRIEND_REQUEST_ACCEPTED",
    userId,
    details: { friendId, friendshipId: friendship.id },
  })

  // Notify friend
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })
  sendNotification({
    userId: friendId,
    type: "FRIEND_REQUEST_ACCEPTED",
    title: "New Friend Added",
    body: `${currentUser?.name || "A contact"} added you as a friend on DuoPay.`,
    url: `/friends/${userId}`,
    dedupKey: `friend:add:${friendship.id}`,
  }).catch(() => {})

  revalidatePath("/friends")
  revalidatePath("/")
  return { success: true, friendshipId: friendship.id }
}

/**
 * Remove an existing friendship safely.
 * Does not delete transaction history or expense history.
 */
export async function removeFriend(friendId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id
  validateId(friendId, "friendId")

  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  })

  await logSecurityEvent({
    type: "FRIEND_REMOVED",
    userId,
    details: { friendId },
  })

  revalidatePath("/friends")
  revalidatePath("/")
  return { success: true }
}

/**
 * Authoritative list of friends with pairwise net balances.
 */
export async function getFriendsList() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userId }, { friendId: userId }],
      status: "ACCEPTED",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          phone: true,
          upiId: true,
          settings: { select: { showUpiOnProfile: true } },
        },
      },
      friend: {
        select: {
          id: true,
          name: true,
          image: true,
          phone: true,
          upiId: true,
          settings: { select: { showUpiOnProfile: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  // Map to distinct friend objects
  const friendMap = new Map<string, any>()
  for (const f of friendships) {
    const friendObj = f.userId === userId ? f.friend : f.user
    if (!friendMap.has(friendObj.id)) {
      friendMap.set(friendObj.id, {
        id: friendObj.id,
        name: friendObj.name || "Friend",
        image: friendObj.image || null,
        phone: friendObj.phone || null,
        upiId: friendObj.settings?.showUpiOnProfile === false ? null : friendObj.upiId,
      })
    }
  }

  // Fetch authoritative net balances
  const { detailedBalances } = await getUserBalances(userId)
  const balanceMap = new Map(detailedBalances.map((b) => [b.userId, b]))

  const friendsWithBalances = Array.from(friendMap.values()).map((friend) => {
    const b = balanceMap.get(friend.id)
    return {
      ...friend,
      balance: b
        ? {
            amount: b.amount,
            type: b.type,
          }
        : {
            amount: 0,
            type: "SETTLED" as const,
          },
    }
  })

  return friendsWithBalances
}

/**
 * Authoritative details for a specific friend profile, including:
 * - Net balance (You owe / They owe / Settled)
 * - Shared expenses
 * - Shared settlements
 */
export async function getFriendProfile(friendId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const userId = session.user.id
  validateId(friendId, "friendId")

  const [friend, balances, sharedExpenses, sharedSettlements] = await Promise.all([
    prisma.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        name: true,
        image: true,
        phone: true,
        upiId: true,
        settings: { select: { showUpiOnProfile: true } },
      },
    }),
    getUserBalances(userId),
    prisma.expense.findMany({
      where: {
        AND: [
          {
            OR: [
              { payerId: userId, participants: { some: { userId: friendId } } },
              { payerId: friendId, participants: { some: { userId } } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        payer: { select: { id: true, name: true } },
        participants: { select: { userId: true, share: true } },
      },
    }),
    prisma.settlement.findMany({
      where: {
        OR: [
          { payerId: userId, receiverId: friendId },
          { payerId: friendId, receiverId: userId },
        ],
        status: { in: ["COMPLETED", "SETTLED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  if (!friend) throw new Error("Friend not found")

  const targetBalance = balances.detailedBalances.find((b) => b.userId === friendId)

  return {
    friend: {
      id: friend.id,
      name: friend.name || "Friend",
      image: friend.image || null,
      phone: friend.phone || null,
      upiId: friend.settings?.showUpiOnProfile === false ? null : friend.upiId,
    },
    balance: targetBalance
      ? {
          amount: targetBalance.amount,
          type: targetBalance.type,
        }
      : {
          amount: 0,
          type: "SETTLED" as const,
        },
    sharedExpenses,
    sharedSettlements,
  }
}
