"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkActionRateLimit } from "@/lib/rateLimit"
import { sanitizeTextInput } from "@/lib/security"

export interface SearchResultItem {
  id: string
  type: "EXPENSE" | "GROUP" | "FRIEND" | "SETTLEMENT"
  title: string
  subtitle: string
  amount?: number
  category?: string | null
  url: string
  date?: string
}

export interface SearchResponse {
  results: SearchResultItem[]
  query: string
  totalCount: number
}

/**
 * Server-authoritative global search across authorized resources.
 * Only searches entities the authenticated user is authorized to see.
 */
export async function searchGlobal(rawQuery: string): Promise<SearchResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  // Rate Limiting
  const rateLimit = checkActionRateLimit("SEARCH", userId)
  if (!rateLimit.allowed) {
    throw new Error("Rate limit exceeded for search. Please wait a moment.")
  }

  const query = sanitizeTextInput(rawQuery || "", 60).trim()
  if (!query || query.length < 2) {
    return { results: [], query, totalCount: 0 }
  }

  const normalizedQuery = query.toLowerCase()

  // 1. Authorized Groups
  const userGroups = await prisma.groupMember.findMany({
    where: {
      userId,
      group: {
        name: { contains: query },
      },
    },
    include: {
      group: { select: { id: true, name: true, image: true } },
    },
    take: 5,
  })

  // 2. Authorized Friends
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userId }, { friendId: userId }],
      status: "ACCEPTED",
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      friend: { select: { id: true, name: true, email: true, phone: true } },
    },
    take: 20,
  })

  const matchedFriends = friendships
    .map((f) => (f.userId === userId ? f.friend : f.user))
    .filter((f) => {
      const name = (f.name || "").toLowerCase()
      const email = (f.email || "").toLowerCase()
      return name.includes(normalizedQuery) || email.includes(normalizedQuery)
    })
    .slice(0, 5)

  // 3. Authorized Expenses (User is payer OR participant)
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payerId: userId },
        { participants: { some: { userId } } },
      ],
      description: { contains: query },
    },
    include: {
      payer: { select: { name: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  })

  // 4. Authorized Settlements
  const settlements = await prisma.settlement.findMany({
    where: {
      OR: [{ payerId: userId }, { receiverId: userId }],
      group: {
        name: { contains: query },
      },
    },
    include: {
      payer: { select: { name: true } },
      receiver: { select: { name: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  // Aggregate formatted results
  const results: SearchResultItem[] = [
    ...userGroups.map((g) => ({
      id: `grp_${g.group.id}`,
      type: "GROUP" as const,
      title: g.group.name,
      subtitle: "Group",
      url: `/groups/${g.group.id}`,
    })),
    ...matchedFriends.map((f) => ({
      id: `frd_${f.id}`,
      type: "FRIEND" as const,
      title: f.name || "Friend",
      subtitle: "Friend Contact",
      url: `/friends/${f.id}`,
    })),
    ...expenses.map((e) => ({
      id: `exp_${e.id}`,
      type: "EXPENSE" as const,
      title: e.description,
      subtitle: `${e.payer?.name || "Someone"} paid • ${e.group?.name || "Expense"}`,
      amount: e.amount,
      category: e.category,
      url: e.groupId ? `/groups/${e.groupId}` : `/expenses/add`,
      date: e.createdAt.toISOString(),
    })),
    ...settlements.map((s) => ({
      id: `set_${s.id}`,
      type: "SETTLEMENT" as const,
      title: `Settlement: ₹${(s.amount / 100).toFixed(2)}`,
      subtitle: `${s.payer?.name || "Payer"} → ${s.receiver?.name || "Receiver"}`,
      amount: s.amount,
      url: s.groupId ? `/groups/${s.groupId}` : `/activity`,
      date: s.createdAt.toISOString(),
    })),
  ]

  return {
    results,
    query,
    totalCount: results.length,
  }
}
