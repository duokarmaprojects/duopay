"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Users, Plus, Activity, User as UserIcon } from "lucide-react"
import BalanceCards from "./BalanceCards"
import { GroupIcon } from "@/components/ui/GroupIcon"
import CashbackCard from "@/components/rewards/CashbackCard"
import ReferralHeaderButton from "@/components/referrals/ReferralHeaderButton"

type DashboardViewProps = {
  user: any
  sessionUser: any
  totalUserOwes: number
  totalOwedToUser: number
  detailedBalances: any[]
  cashbackSummary?: any
}

export default function DashboardView({
  user,
  sessionUser,
  totalUserOwes,
  totalOwedToUser,
  detailedBalances,
  cashbackSummary,
}: DashboardViewProps) {
  const [privacyMode, setPrivacyMode] = useState(true)

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 pb-20 min-h-screen">
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
          
          {/* Right: Refer & Earn Action + Profile/Avatar Link */}
          <div className="flex items-center gap-2 shrink-0">
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
      <div className="flex-1 px-6 py-6 overflow-y-auto">
        {cashbackSummary && (
          <div className="mb-6">
            <CashbackCard summary={cashbackSummary} />
          </div>
        )}
        
        <Link 
          href="/expenses/add" 
          className="w-full flex items-center justify-center gap-2 bg-black text-white h-[52px] rounded-xl font-bold text-sm mb-8 active:scale-[0.98] transition-transform shadow-sm"
        >
          <Plus size={18} strokeWidth={2.5} />
          Add Expense
        </Link>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Groups</h2>
          <Link href="/groups" className="text-sm font-medium text-gray-500 hover:text-black">
            View all
          </Link>
        </div>

        {user?.groupMembers.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm mb-6">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={24} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No groups yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first group to start splitting expenses.</p>
            <Link href="/groups/create" className="inline-block bg-black text-white text-sm font-medium px-4 py-2 rounded-lg">
              Create Group
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 mb-8">
            {user?.groupMembers.slice(0, 3).map(({ group }: any) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-900">
                  <GroupIcon iconId={group.image} size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{group.name}</h3>
                  <p className="text-sm text-gray-500">View group</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 flex justify-between px-6 pb-[env(safe-area-inset-bottom)] pt-2 z-20">
        <Link href="/" className="flex flex-col items-center p-2 text-black">
          <div className="p-1"><UserIcon size={24} strokeWidth={2.5} /></div>
          <span className="text-[10px] font-medium mt-1">Home</span>
        </Link>
        <Link href="/groups" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><Users size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Groups</span>
        </Link>
        <Link href="/activity" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><Activity size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Activity</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1">
            <div className="w-6 h-6 rounded-full border-2 border-current overflow-hidden flex items-center justify-center bg-gray-100">
              {user?.image || sessionUser.image ? <img src={user?.image || sessionUser.image} className="w-full h-full object-cover" alt=""/> : <span className="text-[10px] font-bold text-gray-500">{user?.name?.charAt(0) || sessionUser.name?.charAt(0) || 'U'}</span>}
            </div>
          </div>
          <span className="text-[10px] font-medium mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  )
}
