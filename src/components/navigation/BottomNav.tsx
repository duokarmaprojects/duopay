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
  const tabs = [
    {
      key: "home" as TabKey,
      label: "Home",
      href: "/",
      icon: (isActive: boolean) => (
        <UserIcon
          size={22}
          strokeWidth={isActive ? 2.5 : 1.75}
          className={isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-zinc-500"}
        />
      ),
    },
    {
      key: "groups" as TabKey,
      label: "Groups",
      href: "/groups",
      icon: (isActive: boolean) => (
        <Users
          size={22}
          strokeWidth={isActive ? 2.5 : 1.75}
          className={isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-zinc-500"}
        />
      ),
    },
    {
      key: "activity" as TabKey,
      label: "Activity",
      href: "/activity",
      icon: (isActive: boolean) => (
        <Activity
          size={22}
          strokeWidth={isActive ? 2.5 : 1.75}
          className={isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-zinc-500"}
        />
      ),
    },
    {
      key: "rewards" as TabKey,
      label: "Rewards",
      href: "/rewards",
      icon: (isActive: boolean) => (
        <Sparkles
          size={22}
          strokeWidth={isActive ? 2.5 : 1.75}
          className={isActive ? "text-amber-500 dark:text-amber-400 fill-amber-500/20" : "text-gray-400 dark:text-zinc-500"}
        />
      ),
    },
    {
      key: "profile" as TabKey,
      label: "Profile",
      href: "/profile",
      icon: (isActive: boolean) => (
        <div
          className={`w-[22px] h-[22px] rounded-full border-2 overflow-hidden flex items-center justify-center transition-all ${
            isActive
              ? "border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/20 shadow-sm"
              : "border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800"
          }`}
        >
          {userImage ? (
            <img src={userImage} className="w-full h-full object-cover" alt="" />
          ) : (
            <span
              className={`text-[10px] font-bold leading-none ${
                isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-zinc-400"
              }`}
            >
              {userName?.charAt(0) || "U"}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-200 dark:border-zinc-800/80 flex justify-around items-center px-2 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 z-30 transition-colors shadow-lg dark:shadow-none"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        const isRewards = tab.key === "rewards"

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex-1 flex flex-col items-center py-1 px-1 relative group transition-all duration-150 ${
              isActive
                ? isRewards
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-blue-600 dark:text-blue-400"
                : "text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {/* Active Pill / Icon Container */}
            <div
              className={`p-1.5 rounded-full transition-all flex items-center justify-center ${
                isActive
                  ? isRewards
                    ? "bg-amber-100/70 dark:bg-amber-950/60 shadow-sm"
                    : "bg-blue-50 dark:bg-blue-950/60 shadow-sm"
                  : "group-hover:bg-gray-100 dark:group-hover:bg-zinc-800/60"
              }`}
            >
              {tab.icon(isActive)}
            </div>

            {/* Label with dynamic active state */}
            <span
              className={`text-[11px] tracking-tight mt-0.5 transition-all ${
                isActive ? "font-bold scale-105" : "font-medium opacity-80"
              }`}
            >
              {tab.label}
            </span>

            {/* Top / Bottom active highlight indicator dot */}
            {isActive && (
              <span
                className={`w-1.5 h-1.5 rounded-full mt-0.5 animate-in fade-in zoom-in duration-200 ${
                  isRewards ? "bg-amber-500 dark:bg-amber-400" : "bg-blue-600 dark:text-blue-400 bg-blue-600 dark:bg-blue-400"
                }`}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

