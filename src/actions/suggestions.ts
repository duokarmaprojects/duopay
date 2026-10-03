"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getExpenseCategory, ExpenseCategory } from "@/domain/expenseIcon"

export interface ExpenseSuggestions {
  suggestedCategory: ExpenseCategory
  suggestedGroupId?: string
  suggestedGroupName?: string
  commonParticipantIds: string[]
  typicalAmountPaise?: number
  recentDescriptions: string[]
}

/**
 * Server-authoritative, privacy-preserving smart suggestions engine.
 * Computes advisory recommendations based ONLY on the user's existing historical records.
 * NEVER creates, mutates, or verifies transactions.
 */
export async function getSmartExpenseSuggestions(
  descriptionQuery?: string
): Promise<ExpenseSuggestions> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id
  const suggestedCategory = getExpenseCategory(descriptionQuery)

  // Fetch recent user expenses to find recurring patterns and frequent collaborators
  const recentExpenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payerId: userId },
        { participants: { some: { userId } } },
      ],
    },
    include: {
      group: { select: { id: true, name: true } },
      participants: { select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  // 1. Common group
  const groupCounts = new Map<string, { count: number; name: string }>()
  for (const exp of recentExpenses) {
    if (exp.groupId && exp.group?.name) {
      const cur = groupCounts.get(exp.groupId) || { count: 0, name: exp.group.name }
      cur.count++
      groupCounts.set(exp.groupId, cur)
    }
  }

  let suggestedGroupId: string | undefined
  let suggestedGroupName: string | undefined
  let highestGroupCount = 0
  for (const [gid, val] of groupCounts.entries()) {
    if (val.count > highestGroupCount) {
      highestGroupCount = val.count
      suggestedGroupId = gid
      suggestedGroupName = val.name
    }
  }

  // 2. Common participants (top 3 most frequent co-participants)
  const participantCounts = new Map<string, number>()
  for (const exp of recentExpenses) {
    for (const p of exp.participants) {
      if (p.userId !== userId) {
        participantCounts.set(p.userId, (participantCounts.get(p.userId) || 0) + 1)
      }
    }
  }

  const commonParticipantIds = Array.from(participantCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid]) => pid)

  // 3. Typical amount if category matches
  let typicalAmountPaise: number | undefined
  if (suggestedCategory !== "OTHER") {
    const matchingExpenses = recentExpenses.filter(
      (e) => (e.category || getExpenseCategory(e.description)) === suggestedCategory
    )
    if (matchingExpenses.length > 0) {
      const sum = matchingExpenses.reduce((a, b) => a + b.amount, 0)
      typicalAmountPaise = Math.round(sum / matchingExpenses.length)
    }
  }

  // 4. Distinct recent descriptions
  const recentDescriptions = Array.from(
    new Set(recentExpenses.map((e) => e.description.trim()))
  ).slice(0, 5)

  return {
    suggestedCategory,
    suggestedGroupId,
    suggestedGroupName,
    commonParticipantIds,
    typicalAmountPaise,
    recentDescriptions,
  }
}
