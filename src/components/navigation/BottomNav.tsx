"use client"

import Link from "next/link"
import { Users, Activity, Plus, User as UserIcon } from "lucide-react"

export type TabKey = "home" | "groups" | "activity" | "profile"

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
          size={24}
          strokeWidth={isActive ? 2.5 : 2}
          className={isActive ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-zinc-500"}
        />
      ),
    },
    {
      key: "groups" as TabKey,
      label: "Groups",
      href: "/groups",
      icon: (isActive: boolean) => (
        <Users
          size={24}
          strokeWidth={isActive ? 2.5 : 2}
          className={isActive ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-zinc-500"}
        />
      ),
    },
    {
      key: "add",
      label: "Add",
      href: "/expenses/add",
      isAction: true,
      icon: (isActive: boolean) => (
        <div className="flex items-center justify-center w-14 h-14 bg-blue-600 dark:bg-blue-500 rounded-full shadow-lg shadow-blue-500/30 transform -translate-y-4 hover:scale-105 transition-all">
          <Plus size={28} strokeWidth={3} className="text-white" />
        </div>
      )
    },
    {
      key: "activity" as TabKey,
      label: "Activity",
      href: "/activity",
      icon: (isActive: boolean) => (
        <Activity
          size={24}
          strokeWidth={isActive ? 2.5 : 2}
          className={isActive ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-zinc-500"}
        />
      ),
    },
    {
      key: "profile" as TabKey,
      label: "Profile",
      href: "/profile",
      icon: (isActive: boolean) => (
        <div
          className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center transition-all ${
            isActive
              ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
              : "ring-1 ring-gray-300 dark:ring-zinc-700 bg-gray-100 dark:bg-zinc-800"
          }`}
        >
          {userImage ? (
            <img src={userImage} className="w-full h-full object-cover" alt="Profile" />
          ) : (
            <span
              className={`text-xs font-bold leading-none ${
                isActive ? "text-blue-500 dark:text-blue-400" : "text-gray-500 dark:text-zinc-400"
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
      className="fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-zinc-950/90 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800/50 flex justify-around items-end px-2 sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 z-30 transition-colors"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        
        if (tab.isAction) {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex-1 flex flex-col items-center relative group"
            >
              {tab.icon(isActive)}
            </Link>
          )
        }

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-end gap-1 relative group transition-all duration-150 h-[50px] ${
              isActive
                ? "text-blue-500 dark:text-blue-400"
                : "text-gray-400 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.icon(isActive)}
            <span
              className={`text-[10px] font-medium tracking-wide transition-all ${
                isActive ? "font-bold" : "opacity-90"
              }`}
            >
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

