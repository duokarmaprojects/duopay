"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUserBalances } from "@/services/balance"
import { getSpendingAnalytics } from "@/actions/analytics"
import { formatPaise } from "@/domain/money"
import { sanitizeTextInput } from "@/lib/security"
import { checkActionRateLimit } from "@/lib/rateLimit"

export interface AssistantAnswer {
  question: string
  answer: string
  suggestedAction?: {
    label: string
    url: string
  }
}

/**
 * Server-authoritative, zero-hallucination AI Financial Assistant.
 * Strictly calculates answers from authenticated database balances & transactions.
 * CANNOT invent balances, modify financial state, or bypass authorization.
 */
export async function askFinancialAssistant(rawQuestion: string): Promise<AssistantAnswer> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id

  const rateLimit = checkActionRateLimit("SEARCH", userId)
  if (!rateLimit.allowed) {
    throw new Error("Too many queries. Please wait a moment.")
  }

  const q = sanitizeTextInput(rawQuestion || "", 150).toLowerCase().trim()
  if (!q) {
    return {
      question: rawQuestion,
      answer: "Please ask a question about your expenses, balances, or who you owe.",
    }
  }

  // Question 1: Who do I owe? / Am I settled up?
  if (q.includes("owe") || q.includes("debt") || q.includes("settle")) {
    const { detailedBalances, totalUserOwes, totalOwedToUser } = await getUserBalances(userId)

    const oweList = detailedBalances.filter((b) => b.type === "USER_OWES")
    const owedList = detailedBalances.filter((b) => b.type === "OWED_TO_USER")

    if (oweList.length === 0 && owedList.length === 0) {
      return {
        question: rawQuestion,
        answer: "You are all settled up! 🎉 You don't owe anyone and no one owes you.",
        suggestedAction: { label: "View Dashboard", url: "/" },
      }
    }

    let summary = ""
    if (oweList.length > 0) {
      const userIds = oweList.map((b) => b.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u.name || "A friend"]))

      const breakdown = oweList
        .map((b) => `${userMap.get(b.userId)} (${formatPaise(b.amount)})`)
        .join(", ")
      summary += `You currently owe a total of ${formatPaise(totalUserOwes)} to: ${breakdown}. `
    } else {
      summary += "You do not owe anyone right now. "
    }

    if (owedList.length > 0) {
      summary += `Others owe you a total of ${formatPaise(totalOwedToUser)}.`
    }

    return {
      question: rawQuestion,
      answer: summary.trim(),
      suggestedAction: { label: "Settle Up", url: "/settle" },
    }
  }

  // Question 2: Spending by category (Food, Travel, etc.)
  if (q.includes("food") || q.includes("travel") || q.includes("grocery") || q.includes("groceries") || q.includes("rent") || q.includes("bill")) {
    const analytics = await getSpendingAnalytics("MONTH")
    let targetCat = "FOOD"
    if (q.includes("travel")) targetCat = "TRAVEL"
    if (q.includes("grocery") || q.includes("groceries")) targetCat = "GROCERIES"
    if (q.includes("rent")) targetCat = "RENT"
    if (q.includes("bill")) targetCat = "BILLS"

    const match = analytics.categories.find(
      (c) => c.category.toUpperCase() === targetCat
    )

    if (!match || match.amountPaise === 0) {
      return {
        question: rawQuestion,
        answer: `You have recorded ₹0 in ${targetCat.toLowerCase()} expenses this month.`,
        suggestedAction: { label: "Spending Insights", url: "/analytics" },
      }
    }

    return {
      question: rawQuestion,
      answer: `This month, your share of ${targetCat.toLowerCase()} expenses is ${formatPaise(
        match.amountPaise
      )} across ${match.count} transactions (${match.percentage}% of your total spending).`,
      suggestedAction: { label: "View Insights", url: "/analytics" },
    }
  }

  // Question 3: Biggest / Largest expenses
  if (q.includes("biggest") || q.includes("highest") || q.includes("largest") || q.includes("top")) {
    const topExpenses = await prisma.expense.findMany({
      where: {
        OR: [
          { payerId: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: {
        payer: { select: { name: true } },
        group: { select: { name: true } },
      },
      orderBy: { amount: "desc" },
      take: 3,
    })

    if (topExpenses.length === 0) {
      return {
        question: rawQuestion,
        answer: "You have not recorded any expenses yet.",
        suggestedAction: { label: "Add Expense", url: "/expenses/add" },
      }
    }

    const items = topExpenses
      .map((e) => `"${e.description}" (${formatPaise(e.amount)})`)
      .join(", ")

    return {
      question: rawQuestion,
      answer: `Your top expenses on record are: ${items}.`,
      suggestedAction: { label: "View Activity", url: "/activity" },
    }
  }

  // Default: General monthly spending summary
  const analytics = await getSpendingAnalytics("MONTH")
  return {
    question: rawQuestion,
    answer: `This month your share of shared expenses is ${formatPaise(
      analytics.userSharePaise
    )} across ${analytics.expenseCount} expenses. Top category is ${
      analytics.categories[0]?.category.toLowerCase() || "none"
    } (${formatPaise(analytics.categories[0]?.amountPaise || 0)}).`,
    suggestedAction: { label: "View Detailed Insights", url: "/analytics" },
  }
}
