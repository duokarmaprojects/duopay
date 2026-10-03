"use client"

import Link from "next/link"
import { Users, Activity, Sparkles, User as UserIcon } from "lucide-react"

export type TabKey = "home" | "groups" | "activity" | "rewards" | "profile"

interface BottomNavProps {
  activeTab: TabKey
  userImage?: string | null
  userName?: string | null
}

export default function BottomNav({ activeTab, userImage, userName }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800 flex justify-between items-center px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 z-30 transition-colors"
    >
      {/* 1. Home */}
      <Link
        href="/"
        className={`flex-1 flex flex-col items-center py-1 px-1 transition-colors ${
          activeTab === "home"
            ? "text-black dark:text-white"
            : "text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white"
        }`}
        aria-current={activeTab === "home" ? "page" : undefined}
      >
        <div className="p-0.5">
          <UserIcon size={22} strokeWidth={activeTab === "home" ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === "home" ? "font-bold" : "font-medium"}`}>
          Home
        </span>
      </Link>

      {/* 2. Groups */}
      <Link
        href="/groups"
        className={`flex-1 flex flex-col items-center py-1 px-1 transition-colors ${
          activeTab === "groups"
            ? "text-black dark:text-white"
            : "text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white"
        }`}
        aria-current={activeTab === "groups" ? "page" : undefined}
      >
        <div className="p-0.5">
          <Users size={22} strokeWidth={activeTab === "groups" ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === "groups" ? "font-bold" : "font-medium"}`}>
          Groups
        </span>
      </Link>

      {/* 3. Activity */}
      <Link
        href="/activity"
        className={`flex-1 flex flex-col items-center py-1 px-1 transition-colors ${
          activeTab === "activity"
            ? "text-black dark:text-white"
            : "text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white"
        }`}
        aria-current={activeTab === "activity" ? "page" : undefined}
      >
        <div className="p-0.5">
          <Activity size={22} strokeWidth={activeTab === "activity" ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === "activity" ? "font-bold" : "font-medium"}`}>
          Activity
        </span>
      </Link>

      {/* 4. Rewards (New 4th Section) */}
      <Link
        href="/rewards"
        className={`flex-1 flex flex-col items-center py-1 px-1 transition-colors ${
          activeTab === "rewards"
            ? "text-amber-500 dark:text-amber-400"
            : "text-gray-400 dark:text-zinc-500 hover:text-amber-500 dark:hover:text-amber-400"
        }`}
        aria-current={activeTab === "rewards" ? "page" : undefined}
      >
        <div className="p-0.5 relative">
          <Sparkles size={22} strokeWidth={activeTab === "rewards" ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === "rewards" ? "font-bold" : "font-medium"}`}>
          Rewards
        </span>
      </Link>

      {/* 5. Profile */}
      <Link
        href="/profile"
        className={`flex-1 flex flex-col items-center py-1 px-1 transition-colors ${
          activeTab === "profile"
            ? "text-black dark:text-white"
            : "text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white"
        }`}
        aria-current={activeTab === "profile" ? "page" : undefined}
      >
        <div className="p-0.5">
          <div
            className={`w-[22px] h-[22px] rounded-full border-2 overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-zinc-800 transition-colors ${
              activeTab === "profile"
                ? "border-black dark:border-white"
                : "border-transparent"
            }`}
          >
            {userImage ? (
              <img src={userImage} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 leading-none">
                {userName?.charAt(0) || "U"}
              </span>
            )}
          </div>
        </div>
        <span className={`text-[10px] tracking-tight mt-0.5 ${activeTab === "profile" ? "font-bold" : "font-medium"}`}>
          Profile
        </span>
      </Link>
    </nav>
  )
}
