"use client"

import { Trash2 } from "lucide-react"
import { deleteExpense } from "@/actions/expense"
import { useTransition } from "react"

export default function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => {
        if (confirm("Are you sure you want to delete this expense? This cannot be undone.")) {
          startTransition(async () => {
            try {
              await deleteExpense(expenseId)
            } catch (e: any) {
              alert(e.message || "Failed to delete expense")
            }
          })
        }
      }}
      disabled={isPending}
      className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-full active:bg-red-50 disabled:opacity-50"
      aria-label="Delete expense"
    >
      <Trash2 size={16} />
    </button>
  )
}
