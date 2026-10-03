"use client"

import { useState } from "react"
import { Calendar, Repeat, Pause, Play, Trash2, Plus, Clock, X, Loader2 } from "lucide-react"
import { formatPaise } from "@/domain/money"
import {
  createRecurringExpense,
  updateRecurringExpenseStatus,
  deleteRecurringExpense,
} from "@/actions/recurring"

interface RecurringManagerProps {
  groupId: string
  members: Array<{ id: string; name: string }>
  currentUserId: string
  initialSchedules: Array<{
    id: string
    description: string
    amount: number
    frequency: string
    nextOccurrence: Date
    status: string
    payerId: string
    payer: { id: string; name: string | null }
  }>
}

export default function RecurringExpensesModal({
  groupId,
  members,
  currentUserId,
  initialSchedules,
}: RecurringManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [schedules, setSchedules] = useState(initialSchedules)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    members.map((m) => m.id)
  )

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE"
    try {
      await updateRecurringExpenseStatus(id, nextStatus)
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: nextStatus } : s))
      )
    } catch (e: any) {
      alert(e.message || "Failed to update schedule")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recurring schedule? Generated past expenses will remain untouched.")) {
      return
    }
    try {
      await deleteRecurringExpense(id)
      setSchedules((prev) => prev.filter((s) => s.id !== id))
    } catch (e: any) {
      alert(e.message || "Failed to delete schedule")
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid title and positive amount")
      return
    }
    if (selectedParticipants.length === 0) {
      setError("Select at least one participant")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await createRecurringExpense({
        groupId,
        description: description.trim(),
        amount: parsedAmount,
        frequency,
        startDate,
        participantIds: selectedParticipants,
      })

      if (res.success) {
        setSchedules((prev) => [
          {
            id: res.recurringExpenseId,
            description: description.trim(),
            amount: Math.round(parsedAmount * 100),
            frequency,
            nextOccurrence: new Date(startDate),
            status: "ACTIVE",
            payerId: currentUserId,
            payer: { id: currentUserId, name: "You" },
          },
          ...prev,
        ])
        setDescription("")
        setAmount("")
        setShowAddForm(false)
      }
    } catch (err: any) {
      setError(err.message || "Failed to create recurring expense")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-700 dark:text-zinc-300 hover:text-black dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        title="Recurring Expenses"
      >
        <Repeat size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Repeat size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                    Recurring Expenses
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Automate subscriptions, rent, and utility bills
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {showAddForm ? (
                <form onSubmit={handleCreate} className="space-y-3.5 bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                      New Recurring Schedule
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-zinc-400 block mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. WiFi, Netflix, Rent"
                      className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 dark:text-zinc-400 block mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="500"
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 dark:text-zinc-400 block mb-1">
                        Frequency
                      </label>
                      <select
                        value={frequency}
                        onChange={(e: any) => setFrequency(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-zinc-100"
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-zinc-400 block mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-zinc-100"
                    />
                  </div>

                  {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black dark:bg-white text-white dark:text-black py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    <span>Save Schedule</span>
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full bg-gray-50 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-gray-700 dark:text-zinc-300 transition-all active:scale-[0.99]"
                >
                  <Plus size={16} />
                  <span>Create Recurring Schedule</span>
                </button>
              )}

              {/* Schedules List */}
              <div className="space-y-2.5">
                {schedules.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No recurring expenses scheduled for this group.
                  </div>
                ) : (
                  schedules.map((s) => (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        s.status === "ACTIVE"
                          ? "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 shadow-xs"
                          : "bg-gray-50/60 dark:bg-zinc-800/40 border-gray-100 dark:border-zinc-800 opacity-60"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                            {s.description}
                          </h4>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              s.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-gray-500/10 text-gray-500"
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1 font-mono">
                          <Clock size={11} />
                          {s.frequency.toLowerCase()} • next:{" "}
                          {new Date(s.nextOccurrence).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-zinc-100 font-mono">
                          {formatPaise(s.amount)}
                        </span>

                        <button
                          onClick={() => handleToggleStatus(s.id, s.status)}
                          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 flex items-center justify-center hover:bg-gray-200 transition-colors"
                          title={s.status === "ACTIVE" ? "Pause" : "Resume"}
                        >
                          {s.status === "ACTIVE" ? <Pause size={12} /> : <Play size={12} />}
                        </button>

                        <button
                          onClick={() => handleDelete(s.id)}
                          className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
