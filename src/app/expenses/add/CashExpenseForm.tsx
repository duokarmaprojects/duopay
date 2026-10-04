"use client"

import { useState, useTransition } from "react"
import { addExpense } from "@/actions/expense"
import {
  Banknote,
  Calendar,
  Store,
  Users,
  Tag,
  FileText,
  AlertCircle,
  WifiOff,
  CheckCircle2,
  Loader2,
} from "lucide-react"

interface Member {
  id: string
  name: string
  image: string | null
}

export function CashExpenseForm({
  groupId,
  members,
  currentUserId,
}: {
  groupId: string
  members: Member[]
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [description, setDescription] = useState("")
  const [amountInr, setAmountInr] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [category, setCategory] = useState("FOOD")
  const [notes, setNotes] = useState("")
  const [payerId, setPayerId] = useState(currentUserId)
  const [splitMethod, setSplitMethod] = useState<"EQUAL" | "EXACT">("EQUAL")
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    members.map((m) => m.id)
  )

  const isOffline = typeof window !== "undefined" && !navigator.onLine

  const toggleParticipant = (id: string) => {
    if (selectedParticipants.includes(id)) {
      if (selectedParticipants.length > 1) {
        setSelectedParticipants(selectedParticipants.filter((pid) => pid !== id))
      }
    } else {
      setSelectedParticipants([...selectedParticipants, id])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const parsedAmount = parseFloat(amountInr)
    if (!description.trim()) {
      setErrorMsg("Merchant or description is required")
      return
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid positive amount")
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set("groupId", groupId)
        formData.set("description", description.trim())
        formData.set("amount", amountInr)
        formData.set("payerId", payerId)
        formData.set("splitMethod", splitMethod)
        formData.set("category", category)
        formData.set("source", "CASH")
        formData.set("idempotencyKey", `cash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)

        if (notes.trim()) {
          formData.set("metadata", JSON.stringify({ notes: notes.trim().slice(0, 200) }))
        }

        selectedParticipants.forEach((pid) => {
          formData.append("participants", pid)
        })

        // Delegate to authoritative addExpense
        await addExpense(formData)
      } catch (err: any) {
        // In Next.js server actions, redirect throws an error with message NEXT_REDIRECT which is normal
        if (err?.message?.includes("NEXT_REDIRECT")) return
        setErrorMsg(err?.message || "Failed to create cash expense")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cash Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-300">
        <Banknote size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="font-semibold mb-0.5">Cash Expense Entry</p>
          <p className="text-emerald-700 dark:text-emerald-400">
            Records out-of-pocket cash payments directly into group balance calculations.
          </p>
        </div>
      </div>

      {isOffline && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs">
          <WifiOff size={16} className="shrink-0 text-amber-600" />
          <span>You are currently offline. This expense will sync when connectivity returns.</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 p-3.5 rounded-2xl flex items-center gap-2 text-xs">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Details */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 space-y-4 shadow-sm">
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
            <Store size={14} /> Description / Merchant
          </label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Street Food, Cab Cash, Local Groceries"
            className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 block">
              Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amountInr}
              onChange={(e) => setAmountInr(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-base font-bold outline-none text-emerald-600 dark:text-emerald-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Calendar size={14} /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Tag size={14} /> Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none"
            >
              <option value="FOOD">Food & Dining</option>
              <option value="TRANSPORT">Transport</option>
              <option value="SHOPPING">Shopping</option>
              <option value="ENTERTAINMENT">Entertainment</option>
              <option value="BILLS">Bills & Utilities</option>
              <option value="RENT">Rent</option>
              <option value="TRAVEL">Travel</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <FileText size={14} /> Notes (Optional)
            </label>
            <input
              type="text"
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid in cash to driver"
              className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none"
            />
          </div>
        </div>
      </div>

      {/* Split & Participants */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Users size={16} /> Split Setup
        </h3>

        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-2 block">
            Paid in cash by
          </label>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === currentUserId ? "You" : m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-2 block">
            Split Amongst ({selectedParticipants.length} people)
          </label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const isSelected = selectedParticipants.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleParticipant(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-transparent hover:bg-gray-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {m.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-2xl text-sm transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Recording Cash Expense...
          </>
        ) : (
          <>
            <CheckCircle2 size={16} />
            Add Cash Expense
          </>
        )}
      </button>
    </form>
  )
}
