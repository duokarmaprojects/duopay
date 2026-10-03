"use client"

import { useState } from "react"
import { Receipt } from "lucide-react"
import { ExpenseIcon } from "@/components/expenses/ExpenseIcon"
import DeleteExpenseButton from "./DeleteExpenseButton"
import { ExpenseCategory } from "@/domain/expenseIcon"

interface Participant {
  userId: string
  share: number
}

interface ExpenseItem {
  id: string
  description: string
  category: string | null
  amount: number
  payerId: string
  payer: {
    name: string | null
  }
  participants: Participant[]
}

interface Props {
  expenses: ExpenseItem[]
  currentUserId: string
}

export default function GroupExpenseList({ expenses, currentUserId }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")

  // Extract unique categories present in these expenses
  const presentCategories = Array.from(
    new Set(
      expenses
        .map((e) => e.category || "OTHER")
        .filter(Boolean)
    )
  )

  const filteredExpenses = expenses.filter((e) => {
    if (selectedCategory === "ALL") return true
    const cat = e.category || "OTHER"
    return cat === selectedCategory
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">Expenses</h2>
        {expenses.length > 0 && (
          <span className="text-xs font-semibold text-gray-400">
            {filteredExpenses.length} {filteredExpenses.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {/* Category Filter Chips */}
      {presentCategories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === "ALL"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {presentCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors capitalize ${
                selectedCategory === cat
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {filteredExpenses.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Receipt size={24} />
          </div>
          <p className="text-gray-500 font-medium text-sm">
            {expenses.length === 0 ? "No expenses yet" : "No expenses in this category"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredExpenses.map((expense) => {
            const userShare = expense.participants.find((p) => p.userId === currentUserId)?.share
            const isPayer = expense.payerId === currentUserId

            let summary = ""
            let color = ""

            if (isPayer && userShare) {
              const youLent = expense.amount - userShare
              if (youLent > 0) {
                summary = `You lent ₹${youLent / 100}`
                color = "text-emerald-600"
              } else {
                summary = `You paid for yourself`
                color = "text-gray-500"
              }
            } else if (isPayer) {
              summary = `You lent ₹${expense.amount / 100}`
              color = "text-emerald-600"
            } else if (userShare) {
              summary = `You borrowed ₹${userShare / 100}`
              color = "text-red-500"
            } else {
              summary = `Not involved`
              color = "text-gray-400"
            }

            return (
              <div
                key={expense.id}
                className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <ExpenseIcon
                    category={expense.category}
                    description={expense.description}
                    className="w-10 h-10 rounded-xl shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {expense.description}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                      {expense.payer.name || "Someone"} paid ₹{expense.amount / 100}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <p className={`text-xs sm:text-sm font-bold ${color}`}>{summary}</p>
                  </div>
                  <DeleteExpenseButton expenseId={expense.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
