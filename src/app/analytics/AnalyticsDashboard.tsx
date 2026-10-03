"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, PieChart, CreditCard, ArrowUpRight, ArrowDownLeft, Layers, Calendar, ChevronRight } from "lucide-react"
import { formatPaise } from "@/domain/money"
import { ExpenseIcon } from "@/components/expenses/ExpenseIcon"
import { SpendingAnalyticsSummary, TimeRangeFilter } from "@/actions/analytics"

interface Props {
  initialData: SpendingAnalyticsSummary
  currentRange: TimeRangeFilter
}

export default function AnalyticsDashboard({ initialData, currentRange }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [range, setRange] = useState<TimeRangeFilter>(currentRange)

  const handleRangeChange = (newRange: TimeRangeFilter) => {
    setRange(newRange)
    startTransition(() => {
      router.push(`/analytics?range=${newRange}`)
    })
  }

  const {
    totalSpentPaise,
    userSharePaise,
    expenseCount,
    averageExpensePaise,
    settlementPaidPaise,
    settlementReceivedPaise,
    categories,
    groupSpendings,
  } = initialData

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: "WEEK", label: "This Week" },
            { id: "MONTH", label: "This Month" },
            { id: "LAST_MONTH", label: "Last Month" },
            { id: "3MONTHS", label: "3 Months" },
            { id: "YEAR", label: "This Year" },
            { id: "ALL", label: "All Time" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleRangeChange(tab.id)}
            disabled={isPending}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              range === tab.id
                ? "bg-black text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-100 shadow-xs">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Your Share
          </p>
          <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono">
            {formatPaise(userSharePaise)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Across {expenseCount} {expenseCount === 1 ? "expense" : "expenses"}
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-100 shadow-xs">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Total Paid
          </p>
          <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono">
            {formatPaise(totalSpentPaise)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Avg: {formatPaise(averageExpensePaise)}
          </p>
        </div>
      </div>

      {/* Settlement Activity Mini-Card */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CreditCard size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">Settlements Made & Received</h4>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 font-mono">
              <span className="flex items-center gap-1 text-red-600 font-bold">
                <ArrowUpRight size={14} /> Paid: {formatPaise(settlementPaidPaise)}
              </span>
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <ArrowDownLeft size={14} /> Received: {formatPaise(settlementReceivedPaise)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart size={18} className="text-gray-900" />
            <h3 className="font-bold text-gray-900 text-sm">Spending by Category</h3>
          </div>
          <span className="text-xs font-semibold text-gray-400">
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">
            No expenses recorded for this time range.
          </div>
        ) : (
          <div className="space-y-3.5">
            {categories.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <ExpenseIcon category={cat.category} className="w-6 h-6 rounded-lg text-xs" />
                    <span className="font-bold text-gray-800 capitalize truncate">
                      {cat.category.toLowerCase()}
                    </span>
                    <span className="text-gray-400 text-[10px]">({cat.count})</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-gray-900">{formatPaise(cat.amountPaise)}</span>
                    <span className="text-gray-400 text-[10px] w-8 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-black h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Group Spending Breakdown */}
      {groupSpendings.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-gray-900" />
            <h3 className="font-bold text-gray-900 text-sm">Spending by Group</h3>
          </div>

          <div className="space-y-2.5">
            {groupSpendings.map((grp) => (
              <div
                key={grp.groupId}
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100"
              >
                <div>
                  <h4 className="text-xs font-bold text-gray-900 truncate">{grp.groupName}</h4>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {grp.expenseCount} {grp.expenseCount === 1 ? "expense" : "expenses"}
                  </p>
                </div>

                <div className="text-right font-mono">
                  <p className="text-xs font-bold text-gray-900">{formatPaise(grp.amountPaise)}</p>
                  <p className="text-[10px] text-gray-400">{grp.percentage}% of total</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
