"use client"

import { useState } from "react"
import { Activity, CheckCircle2, UserPlus, Users, ShieldCheck, ChevronRight } from "lucide-react"
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
        <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-xs w-full max-w-sm">
          <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Activity size={26} />
          </div>
          <h3 className="font-bold text-gray-900 text-base mb-1">No activity yet</h3>
          <p className="text-xs text-gray-500 mb-4 px-2">
            Expenses, settlements, and member updates will appear here automatically.
          </p>
          <Link
            href="/"
            className="inline-block bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
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

  return (
    <div className="p-4 sm:p-6 pt-2 pb-24">
      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: "ALL", label: "All" },
            { id: "EXPENSES", label: "Expenses" },
            { id: "SETTLEMENTS", label: "Settlements" },
            { id: "PEOPLE", label: "People & Groups" },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id)
              setVisibleCount(ITEMS_PER_PAGE)
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === f.id
                ? "bg-black text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-xs text-gray-400">
          No items match the selected filter.
        </div>
      ) : (
        /* Timeline Feed */
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-1">
                {dateLabel}
              </h2>
              <div className="flex flex-col gap-2.5">
                {items.map((item) => {
                  const isVerifiedPayment =
                    item.paymentStatus === "PROVIDER_VERIFIED" ||
                    item.paymentStatus === "WEBHOOK_VERIFIED"

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3.5"
                    >
                      {item.type === "EXPENSE" ? (
                        <ExpenseIcon
                          category={item.category}
                          description={item.description}
                          className="w-10 h-10 rounded-2xl shrink-0"
                        />
                      ) : item.type === "SETTLEMENT" ? (
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            isVerifiedPayment
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {isVerifiedPayment ? <ShieldCheck size={20} /> : <CheckCircle2 size={18} />}
                        </div>
                      ) : item.type === "FRIEND_ADDED" ? (
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-purple-50 text-purple-600">
                          <UserPlus size={18} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
                          <Users size={18} />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {item.type === "EXPENSE" ? (
                              <>
                                {item.isUserPayer ? "You" : item.payerName} paid{" "}
                                <span className="font-bold text-gray-900">
                                  ₹{item.amount / 100}
                                </span>
                              </>
                            ) : item.type === "SETTLEMENT" ? (
                              <>
                                {item.isUserPayer ? "You" : item.payerName} settled{" "}
                                <span className="font-bold text-gray-900">
                                  ₹{item.amount / 100}
                                </span>
                              </>
                            ) : (
                              <span>{item.description}</span>
                            )}
                          </p>

                          {isVerifiedPayment && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                              Verified
                            </span>
                          )}
                        </div>

                        {item.type === "EXPENSE" && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {item.description}{" "}
                            {item.groupName && (
                              <span className="text-gray-400">• {item.groupName}</span>
                            )}
                          </p>
                        )}

                        {item.type === "SETTLEMENT" && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            With {item.isUserPayer ? item.receiverName : "you"}{" "}
                            {item.groupName && (
                              <span className="text-gray-400">• {item.groupName}</span>
                            )}
                          </p>
                        )}

                        <p className="text-[10px] text-gray-400 mt-1 font-mono">
                          {new Date(item.date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {item.groupId && (
                        <Link
                          href={`/groups/${item.groupId}`}
                          className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg shrink-0"
                          title="View Group"
                        >
                          <ChevronRight size={18} />
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load More Pagination */}
          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs"
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
