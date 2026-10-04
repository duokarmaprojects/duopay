"use client"

import { useState } from "react"
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  Loader2,
  X,
} from "lucide-react"
import { EnrichedBudget, createBudget, deleteBudget } from "@/actions/budget"
import { formatPaise } from "@/domain/money"

interface Props {
  initialBudgets: EnrichedBudget[]
}

const COMMON_CATEGORIES = [
  "OVERALL",
  "Food",
  "Travel",
  "Shopping",
  "Entertainment",
  "Bills",
  "Rent",
  "Utilities",
  "Health",
  "Education",
  "Subscriptions",
  "Personal",
  "Other",
]

export default function BudgetManager({ initialBudgets }: Props) {
  const [budgets, setBudgets] = useState<EnrichedBudget[]>(initialBudgets)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [category, setCategory] = useState("OVERALL")
  const [amount, setAmount] = useState("")
  const [warningPercent, setWarningPercent] = useState("80")

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Please enter a valid positive amount")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("category", category)
      formData.append("amount", amount)
      formData.append("period", "MONTHLY")
      formData.append("warningPercent", warningPercent)
      formData.append("idempotencyKey", crypto.randomUUID())

      await createBudget(formData)
      setShowAddModal(false)
      setAmount("")
      window.location.reload()
    } catch (err: any) {
      setError(err.message || "Failed to create budget")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm("Are you sure you want to deactivate this budget?")) return
    try {
      await deleteBudget(budgetId)
      setBudgets((prev) => prev.filter((b) => b.id !== budgetId))
    } catch (err: any) {
      alert(err.message || "Failed to delete budget")
    }
  }

  const overallBudget = budgets.find((b) => !b.category)
  const categoryBudgets = budgets.filter((b) => !!b.category)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Top Header & CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active Budgets</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Authoritative tracking of your true monthly consumption
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Plus size={16} />
          <span>New Budget</span>
        </button>
      </div>

      {/* Overall Budget Hero (if set) */}
      {overallBudget && (
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md border border-slate-700/50 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Total Monthly Budget
            </span>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                overallBudget.status === "EXCEEDED"
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : overallBudget.status === "APPROACHING"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {overallBudget.status === "EXCEEDED"
                ? "Exceeded"
                : overallBudget.status === "APPROACHING"
                ? "Approaching Limit"
                : "On Track"}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div>
              <p className="text-3xl font-black font-mono">
                {formatPaise(overallBudget.actualSpendPaise)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                of {formatPaise(overallBudget.amountPaise)} limit ({overallBudget.percentUsed}%)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Remaining</p>
              <p className="text-lg font-bold font-mono text-emerald-400">
                {formatPaise(overallBudget.remainingPaise)}
              </p>
            </div>
          </div>

          {/* Accessible Progress bar */}
          <div className="w-full bg-slate-700/70 rounded-full h-2.5 overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallBudget.percentUsed >= 100
                  ? "bg-red-500"
                  : overallBudget.percentUsed >= overallBudget.warningPercent
                  ? "bg-amber-400"
                  : "bg-blue-400"
              }`}
              style={{ width: `${Math.min(100, Math.max(2, overallBudget.percentUsed))}%` }}
              role="progressbar"
              aria-valuenow={overallBudget.percentUsed}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall budget progress"
            />
          </div>

          <button
            onClick={() => handleDeleteBudget(overallBudget.id)}
            title="Delete overall budget"
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Category Budgets Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Category Budgets
        </h3>

        {categoryBudgets.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <PiggyBank size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No category budgets yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Set spending limits on Food, Travel, Rent, and Subscriptions to track budget progress
              automatically.
            </p>
          </div>
        ) : (
          categoryBudgets.map((b) => (
            <div
              key={b.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                    {b.category}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      b.status === "EXCEEDED"
                        ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                        : b.status === "APPROACHING"
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                    }`}
                  >
                    {b.status === "EXCEEDED"
                      ? "Exceeded"
                      : b.status === "APPROACHING"
                      ? "Approaching"
                      : "On Track"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {formatPaise(b.actualSpendPaise)} / {formatPaise(b.amountPaise)}
                  </span>
                  <button
                    onClick={() => handleDeleteBudget(b.id)}
                    title="Delete budget"
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    b.percentUsed >= 100
                      ? "bg-red-500"
                      : b.percentUsed >= b.warningPercent
                      ? "bg-amber-400"
                      : "bg-blue-600"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, b.percentUsed))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{b.percentUsed}% used</span>
                <span>{formatPaise(b.remainingPaise)} remaining</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Create Budget */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Set Spending Budget
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Budget Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs px-3 py-2.5 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="OVERALL">Total Monthly Budget (All Spending)</option>
                  {COMMON_CATEGORIES.filter((c) => c !== "OVERALL").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Limit (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  required
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3.5 py-2.5 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alert Warning Threshold
                </label>
                <select
                  value={warningPercent}
                  onChange={(e) => setWarningPercent(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs px-3 py-2.5 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="50">50% of budget</option>
                  <option value="75">75% of budget</option>
                  <option value="80">80% of budget (Recommended)</option>
                  <option value="90">90% of budget</option>
                </select>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Budget"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
