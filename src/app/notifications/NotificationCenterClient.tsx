"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Bell,
  ArrowLeft,
  Check,
  CheckCheck,
  CreditCard,
  Receipt,
  Sparkles,
  Users,
  AlertCircle,
} from "lucide-react"
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notification"

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  url: string | null
  readAt: Date | null
  createdAt: Date
}

function getNotificationIcon(type: string) {
  if (type.startsWith("EXPENSE_")) {
    return <Receipt size={18} className="text-blue-600 dark:text-blue-400" />
  }
  if (type.startsWith("PAYMENT_") || type.startsWith("SETTLEMENT_")) {
    return <CreditCard size={18} className="text-emerald-600 dark:text-emerald-400" />
  }
  if (type.startsWith("CASHBACK_") || type.startsWith("REFERRAL_")) {
    return <Sparkles size={18} className="text-amber-500 dark:text-amber-400" />
  }
  if (type.startsWith("GROUP_")) {
    return <Users size={18} className="text-purple-600 dark:text-purple-400" />
  }
  return <Bell size={18} className="text-gray-500 dark:text-zinc-400" />
}

export default function NotificationCenterClient({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[]
  initialUnreadCount: number
}) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    await markNotificationAsRead(id).catch(() => {})
  }

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date() })))
    setUnreadCount(0)
    await markAllNotificationsAsRead().catch(() => {})
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-bold tracking-tight">Notifications</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
          >
            <CheckCheck size={14} />
            <span>Mark all read</span>
          </button>
        )}
      </header>

      {/* Main List */}
      <main className="max-w-md w-full mx-auto px-4 py-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 flex items-center justify-center mb-3">
              <Bell size={24} />
            </div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-zinc-100 mb-1">
              No notifications yet
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-[240px]">
              You will receive real-time notifications here when friends add expenses or settle balances.
            </p>
          </div>
        ) : (
          notifications.map((item) => {
            const isUnread = !item.readAt
            const content = (
              <div
                onClick={() => {
                  if (isUnread) handleMarkAsRead(item.id)
                }}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                  isUnread
                    ? "bg-white dark:bg-zinc-900 border-blue-200/80 dark:border-blue-900/60 shadow-xs"
                    : "bg-white/60 dark:bg-zinc-900/50 border-gray-100 dark:border-zinc-800/80 opacity-85 hover:opacity-100"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isUnread
                      ? "bg-blue-50 dark:bg-blue-950/70"
                      : "bg-gray-100 dark:bg-zinc-800"
                  }`}
                >
                  {getNotificationIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-xs tracking-tight truncate ${
                        isUnread
                          ? "font-bold text-gray-900 dark:text-zinc-100"
                          : "font-semibold text-gray-700 dark:text-zinc-300"
                      }`}
                    >
                      {item.title}
                    </h3>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 shrink-0 font-mono">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5 leading-relaxed line-clamp-2">
                    {item.body}
                  </p>
                </div>

                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0 mt-1" />
                )}
              </div>
            )

            return item.url ? (
              <Link key={item.id} href={item.url} className="block">
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            )
          })
        )}
      </main>
    </div>
  )
}
