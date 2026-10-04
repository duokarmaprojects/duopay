"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Bell, Plus, Receipt, UserPlus, History, ChevronDown, ChevronUp, CheckCircle, Clock, Sparkles, ChevronRight, PiggyBank, TrendingUp } from "lucide-react"
import { ExpenseIcon } from "@/components/expenses/ExpenseIcon"
import BottomNav from "@/components/navigation/BottomNav"
import GlobalSearchModal from "@/components/search/GlobalSearchModal"
import { TrueSpendSummary } from "@/domain/trueSpend"

type DetailedBalance = {
  userId: string
  userName: string
  amount: number
  type: 'OWED_TO_USER' | 'USER_OWES'
}

type DashboardViewProps = {
  user: any
  sessionUser: any
  totalUserOwes: number
  totalOwedToUser: number
  detailedBalances: DetailedBalance[]
  cashbackSummary?: any
  unreadNotificationCount?: number
  recentExpenses?: any[]
  monthlyTrueSpend?: TrueSpendSummary | null
}

export default function DashboardView({
  user,
  sessionUser,
  totalUserOwes,
  totalOwedToUser,
  detailedBalances,
  unreadNotificationCount = 0,
  recentExpenses = [],
  monthlyTrueSpend = null,
}: DashboardViewProps) {
  const [expandedSection, setExpandedSection] = useState<'owe' | 'owed' | null>(null)
  
  const netBalance = totalOwedToUser - totalUserOwes
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const formatMoney = (amountInPaise: number) => {
    return `₹${(amountInPaise / 100).toFixed(2)}`
  }

  const oweBalances = detailedBalances.filter(b => b.type === 'USER_OWES')
  const owedBalances = detailedBalances.filter(b => b.type === 'OWED_TO_USER')

  const toggleSection = (section: 'owe' | 'owed') => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  return (
    <div className="flex flex-col flex-1 bg-[#09090b] text-zinc-100 min-h-[100dvh] font-sans pb-24">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex justify-between items-center sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-20 border-b border-zinc-800/40">
        <div className="font-bold text-xl tracking-tight text-blue-500">
          DuoPay
        </div>
        <div className="flex items-center gap-3">
          <GlobalSearchModal />
          <Link
            href="/notifications"
            className="relative w-10 h-10 rounded-full bg-[#121316] shadow-sm border border-zinc-800 flex items-center justify-center text-zinc-300 active:scale-95 transition-transform"
          >
            <Bell size={20} />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#121316]"></span>
            )}
          </Link>
          <Link href="/profile" className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800 active:scale-95 transition-transform shadow-sm bg-[#121316]">
            {user?.image || sessionUser.image ? (
              <img src={user?.image?.startsWith('data:') ? `/api/users/${user.id}/avatar` : (user?.image || sessionUser.image || '')} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400 font-semibold">
                {(user?.name || sessionUser.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
        </div>
      </header>

      <main className="px-5 flex flex-col gap-6">
        {/* Greeting */}
        <div>
          <h1 suppressHydrationWarning className="text-2xl font-bold tracking-tight text-zinc-100">
            {greeting}, {user?.name?.split(' ')[0] || sessionUser.name?.split(' ')[0]}
          </h1>
        </div>

        {/* Hero Balance Section */}
        <div className="bg-[#121316] rounded-3xl p-5 shadow-sm border border-zinc-800/80 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Net Balance</span>
            <span className={`text-4xl font-black tracking-tight ${netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netBalance >= 0 ? '+' : '-'}{formatMoney(Math.abs(netBalance))}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => toggleSection('owe')}
              className="bg-red-50/50 dark:bg-red-950/20 rounded-2xl p-4 border border-red-100 dark:border-red-900/30 flex flex-col gap-1 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-600 dark:text-red-500 uppercase tracking-wide">You Owe</span>
                {expandedSection === 'owe' ? <ChevronUp size={16} className="text-red-500" /> : <ChevronDown size={16} className="text-red-500" />}
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-zinc-100">{formatMoney(totalUserOwes)}</span>
            </div>

            <div 
              onClick={() => toggleSection('owed')}
              className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/30 flex flex-col gap-1 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wide">You're Owed</span>
                {expandedSection === 'owed' ? <ChevronUp size={16} className="text-emerald-500" /> : <ChevronDown size={16} className="text-emerald-500" />}
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-zinc-100">{formatMoney(totalOwedToUser)}</span>
            </div>
          </div>

          {/* Expandable detailed balances */}
          {expandedSection === 'owe' && (
            <div className="mt-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">People You Owe</h3>
              {oweBalances.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-zinc-400 py-2">You don't owe anyone.</p>
              ) : (
                oweBalances.map(b => (
                  <div key={b.userId} className="flex items-center justify-between bg-gray-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                    <div>
                      <p className="font-semibold text-sm">{b.userName}</p>
                      <p className="text-xs text-red-500 font-medium">{formatMoney(b.amount)}</p>
                    </div>
                    <Link href={`/settle?userId=${b.userId}`} className="bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-4 py-2 rounded-lg active:scale-95 transition-transform">
                      Pay
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          {expandedSection === 'owed' && (
            <div className="mt-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">People Who Owe You</h3>
              {owedBalances.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-zinc-400 py-2">No one owes you.</p>
              ) : (
                owedBalances.map(b => (
                  <div key={b.userId} className="flex items-center justify-between bg-gray-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/50">
                    <div>
                      <p className="font-semibold text-sm">{b.userName}</p>
                      <p className="text-xs text-emerald-500 font-medium">{formatMoney(b.amount)}</p>
                    </div>
                    <button className="bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 text-xs font-bold px-4 py-2 rounded-lg active:scale-95 transition-transform">
                      Remind
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Personal Finance / True Spend Card */}
        {monthlyTrueSpend && (
          <div className="bg-gradient-to-br from-indigo-900/90 to-purple-900/90 text-white rounded-3xl p-5 shadow-sm border border-indigo-700/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                  <Sparkles size={16} className="text-yellow-300" />
                </div>
                <span className="text-xs font-bold tracking-wider uppercase text-indigo-200">
                  This Month's True Spend
                </span>
              </div>
              <Link
                href="/analytics"
                className="text-xs font-semibold text-white/90 hover:text-white flex items-center gap-1 bg-white/15 px-3 py-1.5 rounded-full active:scale-95 transition-all"
              >
                Analytics <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-3xl font-extrabold tracking-tight">
                  {formatMoney(monthlyTrueSpend.totalTrueSpendPaise)}
                </span>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  Your actual financial share (excluding loans & group totals)
                </p>
              </div>
              {monthlyTrueSpend.upcomingObligationsPaise > 0 && (
                <div className="text-right">
                  <span className="text-xs text-indigo-200 block">Upcoming</span>
                  <span className="text-sm font-bold text-yellow-300">
                    +{formatMoney(monthlyTrueSpend.upcomingObligationsPaise)}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <Link
                href="/budgets"
                className="text-indigo-200 hover:text-white py-1 flex items-center gap-1.5 transition-colors"
              >
                <PiggyBank size={14} className="text-indigo-300" />
                <span>Manage Budgets</span>
              </Link>
              <Link
                href="/analytics"
                className="text-indigo-200 hover:text-white py-1 flex items-center justify-end gap-1.5 transition-colors"
              >
                <TrendingUp size={14} className="text-emerald-300" />
                <span>Forecast & Trends</span>
              </Link>
            </div>
          </div>
        )}

        {/* Add Expense Button */}
        <Link 
          href="/expenses/add" 
          className="bg-blue-600 hover:bg-blue-700 text-white w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 active:scale-[0.98] transition-transform"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span>Add Expense</span>
        </Link>

        {/* Shortcuts */}
        <div>
          <h2 className="text-sm font-bold text-zinc-100 mb-3">Shortcuts</h2>
          <div className="grid grid-cols-4 gap-3">
            <Link href="/expenses/add" className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-[#121316] border border-zinc-800/80 flex items-center justify-center text-blue-500 shadow-sm active:scale-95 transition-transform">
                <Receipt size={24} />
              </div>
              <span className="text-[11px] font-semibold text-zinc-400 text-center leading-tight">Scan<br/>Receipt</span>
            </Link>
            <Link href="/settle" className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-[#121316] border border-zinc-800/80 flex items-center justify-center text-emerald-400 shadow-sm active:scale-95 transition-transform">
                <CheckCircle size={24} />
              </div>
              <span className="text-[11px] font-semibold text-zinc-400 text-center leading-tight">Settle<br/>Up</span>
            </Link>
            <Link href="/groups/create" className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-[#121316] border border-zinc-800/80 flex items-center justify-center text-purple-400 shadow-sm active:scale-95 transition-transform">
                <UserPlus size={24} />
              </div>
              <span className="text-[11px] font-semibold text-zinc-400 text-center leading-tight">Create<br/>Group</span>
            </Link>
            <Link href="/activity" className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-[#121316] border border-zinc-800/80 flex items-center justify-center text-amber-400 shadow-sm active:scale-95 transition-transform">
                <History size={24} />
              </div>
              <span className="text-[11px] font-semibold text-zinc-400 text-center leading-tight">View<br/>Activity</span>
            </Link>
          </div>
        </div>

        {/* Recent Expenses */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-zinc-100">Recent Expenses</h2>
            <Link href="/activity" className="text-xs font-semibold text-blue-400">View all</Link>
          </div>
          
          <div className="flex flex-col gap-3">
            {recentExpenses.length === 0 ? (
              <div className="bg-[#121316] rounded-2xl p-6 text-center border border-zinc-800/80 shadow-sm">
                <Clock size={24} className="mx-auto text-zinc-500 mb-2" />
                <p className="text-sm font-medium text-zinc-100">No recent expenses</p>
                <p className="text-xs text-zinc-400 mt-1">Expenses you're involved in will appear here.</p>
              </div>
            ) : (
              recentExpenses.map((expense: any) => {
                const isPayer = expense.payerId === user.id
                const userParticipant = expense.participants.find((p: any) => p.userId === user.id)
                const amountForUser = userParticipant ? userParticipant.amountOwed : 0
                
                return (
                  <Link key={expense.id} href={`/expenses/${expense.id}`} className="bg-[#121316] p-4 rounded-2xl border border-zinc-800/80 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-transform">
                    <ExpenseIcon 
                      category={expense.category?.name || expense.categoryId} 
                      description={expense.description} 
                      className="w-12 h-12 rounded-xl"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-zinc-100 truncate">{expense.description}</p>
                      <p suppressHydrationWarning className="text-xs text-zinc-400 truncate">
                        {expense.group?.name || 'Non-group expense'} • {new Date(expense.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-bold text-sm text-zinc-100">{formatMoney(expense.amount)}</span>
                      {isPayer ? (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/30">You paid</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-900/30">You owe {formatMoney(amountForUser)}</span>
                      )}
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </main>

      <BottomNav
        activeTab="home"
        userImage={user?.image || sessionUser?.image}
        userName={user?.name || sessionUser?.name}
      />
    </div>
  )
}
