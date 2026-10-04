"use client"

import { useState } from "react"
import { Receipt, Calendar } from "lucide-react"
import { ExpenseIcon } from "@/components/expenses/ExpenseIcon"
import DeleteExpenseButton from "./DeleteExpenseButton"

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
  createdAt: Date
}

interface Props {
  expenses: ExpenseItem[]
  currentUserId: string
}

export default function GroupExpenseList({ expenses, currentUserId }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")

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

  // Format date helper
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }).format(new Date(date))
  }

  return (
    <div className="p-4 sm:p-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Recent Expenses</h2>
        {expenses.length > 0 && (
          <span className="text-[13px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            {filteredExpenses.length}
          </span>
        )}
      </div>

      {presentCategories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-2 scrollbar-none snap-x">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all snap-start ${
              selectedCategory === "ALL"
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            All
          </button>
          {presentCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all capitalize snap-start ${
                selectedCategory === cat
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {cat.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {filteredExpenses.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/80">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <Receipt size={24} />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            {expenses.length === 0 ? "No expenses yet" : "No expenses in this category"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredExpenses.map((expense) => {
            const userShare = expense.participants.find((p) => p.userId === currentUserId)?.share
            const isPayer = expense.payerId === currentUserId

            let summary = ""
            let color = ""

            if (isPayer && userShare) {
              const youLent = expense.amount - userShare
              if (youLent > 0) {
                summary = `You lent ₹${(youLent / 100).toFixed(0)}`
                color = "text-emerald-600 dark:text-emerald-400"
              } else {
                summary = `You paid`
                color = "text-slate-500 dark:text-slate-400"
              }
            } else if (isPayer) {
              summary = `You lent ₹${(expense.amount / 100).toFixed(0)}`
              color = "text-emerald-600 dark:text-emerald-400"
            } else if (userShare) {
              summary = `You borrowed ₹${(userShare / 100).toFixed(0)}`
              color = "text-red-600 dark:text-red-400"
            } else {
              summary = `Not involved`
              color = "text-slate-400 dark:text-slate-500"
            }

            return (
              <div
                key={expense.id}
                className="group bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <ExpenseIcon
                      category={expense.category}
                      description={expense.description}
                      className="w-12 h-12 rounded-2xl shadow-sm border border-slate-100/50 dark:border-slate-700/50"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-[15px] truncate">
                      {expense.description}
                    </h3>
                    <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="truncate">
                        {isPayer ? 'You' : expense.payer.name || "Someone"} paid <span className="font-semibold text-slate-700 dark:text-slate-300">₹{(expense.amount / 100).toFixed(0)}</span>
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                      <span className="flex items-center gap-1 shrink-0">
                        {formatDate(expense.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:pl-4 sm:border-l border-slate-100 dark:border-slate-800 pt-3 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0">
                  <div className="text-left sm:text-right">
                    <p className={`text-[13px] font-bold ${color}`}>{summary}</p>
                    {userShare && !isPayer && (
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Your share: ₹{(userShare / 100).toFixed(0)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <DeleteExpenseButton expenseId={expense.id} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
