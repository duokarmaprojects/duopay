"use client"

import { useState } from "react"
import { Activity, CheckCircle2, UserPlus, Users, ShieldCheck, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react"
import Link from "next/link"
import { ExpenseIcon } from "@/components/expenses/ExpenseIcon"

export type ActivityItem = {
  id: string
  type: "EXPENSE" | "SETTLEMENT" | "FRIEND_ADDED" | "GROUP_JOINED"
  amount: number
  description: string
  category?: string | null
  groupId?: string | null
  groupName?: string | null
  status?: string | null
  paymentStatus?: string | null
  date: string
  isUserPayer: boolean
  payerName: string
  receiverName?: string
}

type Props = {
  activities: ActivityItem[]
}

const ITEMS_PER_PAGE = 25

function groupActivitiesByDate(activities: ActivityItem[]) {
  const groups: { [key: string]: ActivityItem[] } = {}

  activities.forEach((activity) => {
    const d = new Date(activity.date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let label = d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    })
    if (d.toDateString() === today.toDateString()) {
      label = "TODAY"
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = "YESTERDAY"
    }

    if (!groups[label]) groups[label] = []
    groups[label].push(activity)
  })

  return groups
}

export default function ActivityFeed({ activities }: Props) {
  const [filter, setFilter] = useState<"ALL" | "EXPENSES" | "SETTLEMENTS" | "PEOPLE">("ALL")
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_PAGE)

  if (activities.length === 0) {
    return (
      <div className="p-6 pt-4 flex justify-center">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800 shadow-sm w-full max-w-sm">
          <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Activity size={26} />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base mb-1">No activity yet</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4 px-2">
            Expenses, settlements, and member updates will appear here automatically.
          </p>
          <Link
            href="/"
            className="inline-block bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const filtered = activities.filter((a) => {
    if (filter === "EXPENSES") return a.type === "EXPENSE"
    if (filter === "SETTLEMENTS") return a.type === "SETTLEMENT"
    if (filter === "PEOPLE") return a.type === "FRIEND_ADDED" || a.type === "GROUP_JOINED"
    return true
  })

  const paginated = filtered.slice(0, visibleCount)
  const grouped = groupActivitiesByDate(paginated)
  const hasMore = visibleCount < filtered.length

  const formatMoney = (amountInPaise: number) => {
    return `₹${(amountInPaise / 100).toFixed(2)}`
  }

  return (
    <div className="p-5 pt-2 pb-24 font-sans">
      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: "ALL", label: "All Activity" },
            { id: "EXPENSES", label: "Expenses" },
            { id: "SETTLEMENTS", label: "Settlements" },
            { id: "PEOPLE", label: "Groups & Friends" },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id)
              setVisibleCount(ITEMS_PER_PAGE)
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors active:scale-95 ${
              filter === f.id
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 dark:text-zinc-500 font-medium">
          No items match the selected filter.
        </div>
      ) : (
        /* Timeline Feed */
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3 px-1">
                {dateLabel}
              </h2>
              <div className="flex flex-col gap-3">
                {items.map((item) => {
                  const isVerifiedPayment =
                    item.paymentStatus === "PROVIDER_VERIFIED" ||
                    item.paymentStatus === "WEBHOOK_VERIFIED"

                  const isMoneyComing = (item.type === "SETTLEMENT" && !item.isUserPayer)
                  const isMoneyGoing = (item.type === "SETTLEMENT" && item.isUserPayer)
                  // For expenses, if you paid, others owe you (technically money went out but you get owed).
                  // Let's keep expense neutral but show amount.

                  return (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform cursor-default"
                    >
                      {item.type === "EXPENSE" ? (
                        <ExpenseIcon
                          category={item.category}
                          description={item.description}
                          className="w-12 h-12 rounded-xl shrink-0"
                        />
                      ) : item.type === "SETTLEMENT" ? (
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            isMoneyComing
                              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-500"
                              : "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-500"
                          }`}
                        >
                          {isMoneyComing ? <ArrowDownRight size={24} /> : <ArrowUpRight size={24} />}
                        </div>
                      ) : item.type === "FRIEND_ADDED" ? (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-500">
                          <UserPlus size={24} />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-500">
                          <Users size={24} />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm truncate">
                            {item.type === "EXPENSE" ? (
                              item.description
                            ) : item.type === "SETTLEMENT" ? (
                              isMoneyComing ? "Payment received" : "Payment sent"
                            ) : (
                              item.description
                            )}
                          </p>

                          {item.amount > 0 && (
                            <span className={`font-black text-sm shrink-0 ${
                              item.type === 'SETTLEMENT' 
                                ? (isMoneyComing ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-900 dark:text-zinc-100')
                                : 'text-gray-900 dark:text-zinc-100'
                            }`}>
                              {item.type === 'SETTLEMENT' && isMoneyComing ? '+' : ''}{formatMoney(item.amount)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                            {item.type === "EXPENSE" && (
                              <>{item.isUserPayer ? "You paid" : `${item.payerName} paid`} • {item.groupName || 'No group'}</>
                            )}
                            {item.type === "SETTLEMENT" && (
                              <>
                                {isMoneyComing ? `From ${item.payerName}` : `To ${item.receiverName}`}
                                {item.groupName && ` • ${item.groupName}`}
                              </>
                            )}
                            {(item.type === "FRIEND_ADDED" || item.type === "GROUP_JOINED") && (
                              "System Event"
                            )}
                          </p>
                          <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 shrink-0">
                            {new Date(item.date).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>

                        {isVerifiedPayment && (
                          <div className="mt-2 inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-500 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            <ShieldCheck size={12} />
                            Verified
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load More Pagination */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm"
              >
                Load More Activities ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
