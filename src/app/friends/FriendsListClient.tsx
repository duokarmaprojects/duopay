"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, UserPlus, Users, ArrowRight, CheckCircle2 } from "lucide-react"
import { formatPaise } from "@/domain/money"

export interface FriendItem {
  id: string
  name: string
  image?: string | null
  phone?: string | null
  upiId?: string | null
  balance: {
    amount: number
    type: "OWED_TO_USER" | "USER_OWES" | "SETTLED"
  }
}

export default function FriendsListClient({ initialFriends }: { initialFriends: FriendItem[] }) {
  const [search, setSearch] = useState("")

  const filtered = initialFriends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.phone && f.phone.includes(search)) ||
    (f.upiId && f.upiId.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      {/* Search Input */}
      {initialFriends.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends by name or UPI..."
            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-gray-900 dark:text-zinc-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-zinc-100 transition-all shadow-xs"
          />
        </div>
      )}

      {/* Friends List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 p-8 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 flex items-center justify-center mx-auto mb-3">
            <Users size={24} />
          </div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-zinc-100 mb-1">
            {initialFriends.length === 0 ? "No friends added yet" : "No friends match search"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-xs mx-auto mb-5">
            {initialFriends.length === 0
              ? "Add friends by phone number or discover your contacts on DuoPay to split expenses effortlessly."
              : "Try searching with a different name or clear the search filter."}
          </p>
          {initialFriends.length === 0 && (
            <Link
              href="/friends/add"
              className="inline-flex items-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-all shadow-xs"
            >
              <UserPlus size={14} />
              <span>Add Your First Friend</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((friend) => {
            const isOwed = friend.balance.type === "OWED_TO_USER"
            const isOwes = friend.balance.type === "USER_OWES"
            const isSettled = friend.balance.amount === 0 || friend.balance.type === "SETTLED"

            return (
              <Link
                key={friend.id}
                href={`/friends/${friend.id}`}
                className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3 hover:border-gray-200 dark:hover:border-zinc-700 active:scale-[0.99] transition-all"
              >
                {/* Avatar & Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden border border-gray-100 dark:border-zinc-800">
                    {friend.image ? (
                      <img
                        src={friend.image.startsWith("data:") ? `/api/users/${friend.id}/avatar` : friend.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      friend.name?.charAt(0) || "U"
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-gray-900 dark:text-zinc-100 truncate">
                      {friend.name}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate font-mono">
                      {friend.upiId ? friend.upiId : friend.phone || "DuoPay Friend"}
                    </p>
                  </div>
                </div>

                {/* Net Balance Badge */}
                <div className="text-right shrink-0">
                  {isSettled ? (
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500">
                      settled up
                    </span>
                  ) : isOwed ? (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                        owes you
                      </span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatPaise(friend.balance.amount)}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 block">
                        you owe
                      </span>
                      <span className="text-xs font-black text-red-600 dark:text-red-400 font-mono">
                        {formatPaise(friend.balance.amount)}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
