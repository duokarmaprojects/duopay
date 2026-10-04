"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Layers,
  Banknote,
  PiggyBank,
  Sparkles,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { formatPaise } from "@/domain/money"
import { ExpenseIcon } from "@/components/expenses/ExpenseIcon"
import { SpendingAnalyticsSummary, TimeRangeFilter } from "@/actions/analytics"
import { ForecastResult } from "@/domain/forecast"
import { EnrichedBudget } from "@/actions/budget"

interface Props {
  initialData: SpendingAnalyticsSummary
  forecast?: ForecastResult | null
  budgets?: EnrichedBudget[]
  currentRange: TimeRangeFilter
}

export default function AnalyticsDashboard({
  initialData,
  forecast,
  budgets = [],
  currentRange,
}: Props) {
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
    largestExpensePaise,
    settlementPaidPaise,
    settlementReceivedPaise,
    groupSharePaise,
    personalExpensesPaise,
    cashSpendPaise,
    digitalSpendPaise,
    recurringFinalizedPaise,
    upcomingObligationsPaise,
    categories,
    merchants,
    groupSpendings,
    timeline,
    monthOverMonth,
    insights,
  } = initialData

  const overallBudget = budgets.find((b) => !b.category)

  // Max value in timeline for scaling chart
  const maxTimelinePaise = timeline.reduce((max, pt) => Math.max(max, pt.amountPaise), 1)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Time Range Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x">
        {(
          [
            { id: "WEEK", label: "7 Days" },
            { id: "MONTH", label: "This Month" },
            { id: "LAST_MONTH", label: "Last Month" },
            { id: "3MONTHS", label: "3 Months" },
            { id: "6MONTHS", label: "6 Months" },
            { id: "YEAR", label: "This Year" },
            { id: "ALL", label: "All Time" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleRangeChange(tab.id)}
            disabled={isPending}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors snap-start ${
              range === tab.id
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* True Spend Hero Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Your True Spend
          </span>
          {monthOverMonth.hasPreviousData && monthOverMonth.changePercent !== null && (
            <div
              className={`flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                monthOverMonth.isIncrease
                  ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
              }`}
            >
              {monthOverMonth.isIncrease ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              )}
              <span>
                {monthOverMonth.isIncrease ? "+" : ""}
                {monthOverMonth.changePercent}% vs prior
              </span>
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
            {formatPaise(userSharePaise)}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            across {expenseCount} {expenseCount === 1 ? "expense" : "expenses"}
          </span>
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Paid</p>
            <p className="font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatPaise(totalSpentPaise)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Avg Expense</p>
            <p className="font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatPaise(averageExpensePaise)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Largest</p>
            <p className="font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatPaise(largestExpensePaise)}
            </p>
          </div>
        </div>
      </div>

      {/* Spending Forecast Card (Phase U) */}
      {forecast && (range === "MONTH" || range === "THIS_MONTH") && (
        <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-900/40 to-indigo-950/40 border border-blue-500/20 shadow-sm relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Monthly Spending Forecast
              </h3>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                forecast.confidence === "HIGH"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : forecast.confidence === "MEDIUM"
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {forecast.confidence} Confidence
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div>
              <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {formatPaise(forecast.projectedTotalPaise)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Projected total for this month
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-slate-400">Remaining estimate</p>
              <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                +{formatPaise(forecast.projectedRemainingPaise)}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 border-t border-blue-500/10 pt-2 mt-2">
            Methodology: {forecast.methodology}
          </p>
        </div>
      )}

      {/* Budgets Quick Link (Phase T) */}
      <Link
        href="/budgets"
        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between group hover:border-blue-500 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PiggyBank size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Spending Budgets</span>
              {overallBudget && (
                <span className="text-[10px] font-semibold text-slate-400">
                  ({overallBudget.percentUsed}% used)
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {budgets.length > 0
                ? `${budgets.length} active budgets configured`
                : "Set monthly limits to keep spending on track"}
            </p>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
      </Link>

      {/* Spending Trend Chart (Lightweight accessible SVG) */}
      {timeline.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} className="text-blue-500" />
              <span>Spending Trend</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              {timeline.length} {timeline.length === 1 ? "period" : "periods"}
            </span>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-36 flex items-end gap-1.5 pt-4 pb-2">
            {timeline.map((pt, i) => {
              const heightPct = Math.max(8, Math.round((pt.amountPaise / maxTimelinePaise) * 100))
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end h-full gap-1 group relative"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-10 font-mono">
                    {formatPaise(pt.amountPaise)}
                  </div>
                  <div
                    className="w-full bg-blue-600/80 hover:bg-blue-600 rounded-t-md transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[9px] text-slate-400 truncate w-full text-center">
                    {pt.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Categories Breakdown */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart size={18} className="text-blue-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Spending by Category
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No expenses recorded for this time range.
          </div>
        ) : (
          <div className="space-y-3.5">
            {categories.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <ExpenseIcon category={cat.category} className="w-7 h-7 rounded-lg text-xs" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 capitalize truncate">
                      {cat.category.toLowerCase()}
                    </span>
                    {cat.changePercent !== undefined && cat.changePercent !== null && (
                      <span
                        className={`text-[10px] font-bold ${
                          cat.changePercent > 0
                            ? "text-red-500"
                            : cat.changePercent < 0
                            ? "text-emerald-500"
                            : "text-slate-400"
                        }`}
                      >
                        ({cat.changePercent > 0 ? "+" : ""}
                        {cat.changePercent}%)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatPaise(cat.amountPaise)}
                    </span>
                    <span className="text-slate-400 text-[10px] w-8 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Merchants Breakdown */}
      {merchants.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Top Merchants</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {merchants.map((m, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                  {m.merchant}
                </span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {formatPaise(m.amountPaise)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending Breakdown Cards: Group vs Personal & Cash vs Digital */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Shared vs Personal</p>
          <p className="font-bold text-slate-900 dark:text-white font-mono text-sm">
            {formatPaise(groupSharePaise)}
          </p>
          <p className="text-[10px] text-slate-500">
            Personal: {formatPaise(personalExpensesPaise)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Digital vs Cash</p>
          <p className="font-bold text-slate-900 dark:text-white font-mono text-sm">
            {formatPaise(digitalSpendPaise)}
          </p>
          <p className="text-[10px] text-slate-500">
            Cash: {formatPaise(cashSpendPaise)}
          </p>
        </div>
      </div>

      {/* Deterministic Financial Insights (Phase S) */}
      <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-md space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          <h3 className="font-bold text-sm">Personal Finance Insights</h3>
        </div>

        <div className="space-y-2">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className="text-xs text-slate-300 leading-relaxed p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-start gap-2"
            >
              <span className="text-amber-400 mt-0.5">•</span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
