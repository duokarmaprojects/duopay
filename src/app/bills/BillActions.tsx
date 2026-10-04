"use client"

import { useState } from "react"
import { Check, X, Loader2 } from "lucide-react"
import { confirmUpcomingExpense, skipUpcomingExpense } from "@/actions/expense"

export default function BillActions({ expenseId }: { expenseId: string }) {
  const [loading, setLoading] = useState<"confirm" | "skip" | null>(null)

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault() // prevent Link navigation if wrapped
    if (loading) return
    setLoading("confirm")
    try {
      await confirmUpcomingExpense(expenseId)
    } catch (err) {
      console.error(err)
      setLoading(null)
    }
  }

  const handleSkip = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading("skip")
    try {
      await skipUpcomingExpense(expenseId)
    } catch (err) {
      console.error(err)
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={handleConfirm}
        disabled={!!loading}
        className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 py-2 rounded-xl text-sm font-medium transition-colors border border-emerald-500/20 disabled:opacity-50"
      >
        {loading === "confirm" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        Confirm
      </button>
      
      <button
        onClick={handleSkip}
        disabled={!!loading}
        className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-gray-300 hover:bg-gray-700 py-2 rounded-xl text-sm font-medium transition-colors border border-gray-700 disabled:opacity-50"
      >
        {loading === "skip" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <X className="w-4 h-4" />
        )}
        Skip
      </button>
    </div>
  )
}
