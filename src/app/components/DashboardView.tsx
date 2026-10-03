"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Users, Plus, Activity, User as UserIcon, Bell, TrendingUp } from "lucide-react"
import BalanceCards from "./BalanceCards"
import { GroupIcon } from "@/components/ui/GroupIcon"
import CashbackCard from "@/components/rewards/CashbackCard"
import ReferralHeaderButton from "@/components/referrals/ReferralHeaderButton"
import BottomNav from "@/components/navigation/BottomNav"
import GlobalSearchModal from "@/components/search/GlobalSearchModal"

type DashboardViewProps = {
  user: any
  sessionUser: any
  totalUserOwes: number
  totalOwedToUser: number
  detailedBalances: any[]
  cashbackSummary?: any
  unreadNotificationCount?: number
}

export default function DashboardView({
  user,
  sessionUser,
  totalUserOwes,
  totalOwedToUser,
  detailedBalances,
  cashbackSummary,
  unreadNotificationCount = 0,
}: DashboardViewProps) {
  const [privacyMode, setPrivacyMode] = useState(true)

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 px-4 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-10 transition-colors">
        <div className="flex justify-between items-center mb-6 gap-2">
          {/* Left: Page Title & Privacy Toggle */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 truncate">
              DuoPay
            </span>
            {user?.upiId && (
              <button 
                onClick={() => setPrivacyMode(!privacyMode)}
                className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 dark:bg-zinc-800 px-2 sm:px-2.5 py-1 rounded-full text-gray-700 dark:text-zinc-300 transition-colors hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white shrink-0"
                aria-label="Toggle UPI ID Privacy"
                title={privacyMode ? "Show UPI ID" : "Hide UPI ID"}
              >
                <span className="hidden sm:inline font-mono">{privacyMode ? '••••••••' : user?.upiId}</span>
                {privacyMode ? <EyeOff size={13} className="text-gray-500 shrink-0" /> : <Eye size={13} className="text-gray-500 shrink-0" />}
              </button>
            )}
          </div>
          
          {/* Right: Search + Notifications + Refer & Earn Action + Profile/Avatar Link */}
          <div className="flex items-center gap-2 shrink-0">
            <GlobalSearchModal />

            {/* Notification Bell with Unread Badge */}
            <Link
              href="/notifications"
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white shrink-0"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-xs">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              )}
            </Link>

            <ReferralHeaderButton />

            <Link
              href="/profile"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden ring-2 ring-transparent hover:ring-gray-300 dark:hover:ring-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white transition-all active:scale-95 shrink-0 block"
              aria-label="Profile"
              title="Go to Profile"
            >
              {user?.image || sessionUser.image ? (
                <img 
                  src={user?.image?.startsWith('data:') ? `/api/users/${user.id}/avatar` : (user?.image || sessionUser.image || '')} 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-zinc-400 font-medium text-sm">
                  {user?.name?.charAt(0) || sessionUser.name?.charAt(0) || 'U'}
                </div>
              )}
            </Link>
          </div>
        </div>

        <BalanceCards 
          totalUserOwes={totalUserOwes} 
          totalOwedToUser={totalOwedToUser} 
          detailedBalances={detailedBalances} 
          privacyMode={false}
        />
      </header>

      {/* Main Content Area */}
      <div className="flex-1 px-6 py-6">
        <div className="grid grid-cols-3 gap-2.5 mb-8">
          <Link 
            href="/expenses/add" 
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 bg-black dark:bg-white text-white dark:text-black h-[54px] rounded-2xl font-bold text-xs active:scale-[0.98] transition-transform shadow-xs"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add</span>
          </Link>
          <Link 
            href="/friends" 
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 h-[54px] rounded-2xl font-bold text-xs active:scale-[0.98] transition-transform shadow-xs hover:border-gray-300 dark:hover:border-zinc-700"
          >
            <Users size={16} />
            <span>Friends</span>
          </Link>
          <Link 
            href="/analytics" 
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 h-[54px] rounded-2xl font-bold text-xs active:scale-[0.98] transition-transform shadow-xs hover:border-gray-300 dark:hover:border-zinc-700"
          >
            <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
            <span>Insights</span>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Recent Groups</h2>
          <Link href="/groups" className="text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white">
            View all
          </Link>
        </div>

        {user?.groupMembers.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 text-center border border-gray-100 dark:border-zinc-800 shadow-sm mb-6">
            <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={24} />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">No groups yet</h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">Create your first group to start splitting expenses.</p>
            <Link href="/groups/create" className="inline-block bg-black dark:bg-white text-white dark:text-black text-sm font-medium px-4 py-2 rounded-lg">
              Create Group
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 mb-8">
            {user?.groupMembers.slice(0, 3).map(({ group }: any) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-900 dark:text-zinc-100">
                  <GroupIcon iconId={group.image} size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{group.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">View group</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Universal 5-section Bottom Navigation */}
      <BottomNav
        activeTab="home"
        userImage={user?.image || sessionUser?.image}
        userName={user?.name || sessionUser?.name}
      />
    </div>
  )
}
