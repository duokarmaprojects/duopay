import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, UserPlus, Receipt, Settings, PieChart, Users, Camera } from "lucide-react"
import { getGroupBalances } from "@/services/balance"
import GroupActions from "./GroupActions"
import { GroupIcon } from "@/components/ui/GroupIcon"
import GroupSmartSettleButton from "./GroupSmartSettleButton"
import RecurringExpensesModal from "./RecurringExpensesModal"
import GroupExpenseList from "./GroupExpenseList"
import { getGroupRecurringExpenses, generateDueRecurringExpenses } from "@/actions/recurring"
import TripDashboard from "./TripDashboard"
import CollectionDashboard from "./CollectionDashboard"

import GroupContentSwitcher from "./GroupContentSwitcher"

export default async function GroupPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  // Verify access and get group
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: 'asc' }
      },
      expenses: {
        orderBy: { createdAt: 'desc' },
        include: { payer: true, participants: true }
      }
    }
  })

  if (!group || !group.members.some(m => m.userId === session?.user?.id)) {
    redirect('/')
  }

  const userId = session.user.id;
  const isCreator = group.members.length > 0 && group.members[0].userId === userId

  // Process due recurring expenses (idempotent)
  await generateDueRecurringExpenses(id).catch(() => {})
  const recurringSchedules = await getGroupRecurringExpenses(id).catch(() => [] as any[])

  const membersList = group.members.map(m => ({
    id: m.user.id,
    name: m.user.name || 'Unknown',
  }))

  // Use domain logic to get exact balances scoped to this group
  const { netPositions } = await getGroupBalances(id, userId)
  const userPositions = netPositions[userId] || {}
  
  let netAmount = 0
  const oweBalances = []
  const owedBalances = []

  for (const [otherUserId, amount] of Object.entries(userPositions)) {
    const user = group.members.find(m => m.userId === otherUserId)?.user
    if (!user) continue
    
    netAmount += amount
    if (amount < 0) {
      oweBalances.push({ userId: otherUserId, user, amount: Math.abs(amount) })
    } else if (amount > 0) {
      owedBalances.push({ userId: otherUserId, user, amount })
    }
  }

  // Calculate total group spending
  const totalSpending = group.expenses.reduce((sum, e) => sum + e.amount, 0)
  
  const isOwed = netAmount > 0
  const owes = netAmount < 0
  const isSettled = netAmount === 0

  const dashboardProps = {
    group,
    totalSpending,
    oweBalances,
    owedBalances,
    netAmount,
    userId
  }

  return (
    <div className="flex flex-col flex-1 bg-slate-50 dark:bg-slate-950 h-screen overflow-hidden">
      {/* Premium Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 pt-12 pb-4 border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <Link href="/groups" className="p-2 -ml-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <RecurringExpensesModal
              groupId={id}
              members={membersList}
              currentUserId={userId}
              initialSchedules={recurringSchedules}
            />
            <Link href={`/groups/${group.id}/add-member`} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <UserPlus size={22} />
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white shrink-0 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <GroupIcon iconId={group.image} size={36} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{group.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Users size={14} />
              <span>{group.members.length} members</span>
            </p>
          </div>
        </div>
      </header>

      <GroupContentSwitcher
        groupId={group.id}
        groupName={group.name}
        currentUserId={userId}
        overviewContent={
          group.type === 'TRIP' ? (
            <TripDashboard {...dashboardProps} />
          ) : group.type === 'COLLECTION' ? (
            <CollectionDashboard {...dashboardProps} />
          ) : (
            <div className="flex-1 overflow-y-auto pb-32">
              <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
                
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Total Spent</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">₹{(totalSpending / 100).toFixed(0)}</p>
                  </div>
                  <div className={`p-4 rounded-3xl border shadow-sm ${
                    isOwed ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50' : 
                    owes ? 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50' : 
                    'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                  }`}>
                    <p className={`text-[13px] font-semibold uppercase tracking-wide mb-1 ${
                      isOwed ? 'text-emerald-600/80 dark:text-emerald-500/80' : 
                      owes ? 'text-red-600/80 dark:text-red-500/80' : 
                      'text-slate-500 dark:text-slate-400'
                    }`}>
                      {isOwed ? 'You are owed' : owes ? 'You owe' : 'Your Balance'}
                    </p>
                    <p className={`text-xl font-bold ${
                      isOwed ? 'text-emerald-700 dark:text-emerald-400' : 
                      owes ? 'text-red-700 dark:text-red-400' : 
                      'text-slate-900 dark:text-white'
                    }`}>
                      ₹{(Math.abs(netAmount) / 100).toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-3">
                  <Link 
                    href={`/expenses/add?groupId=${group.id}`} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-2xl text-center transition-all shadow-sm shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2"
                  >
                    <Receipt size={18} />
                    Add Expense
                  </Link>
                  <Link
                    href={`/expenses/add?groupId=${group.id}&mode=receipt`}
                    className="flex-1 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold py-3.5 px-4 rounded-2xl text-center transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera size={18} />
                    Scan Receipt
                  </Link>
                </div>

                {/* Settle Up Section */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Settlements</h2>
                    <GroupSmartSettleButton groupId={group.id} />
                  </div>
                  
                  {oweBalances.length === 0 && owedBalances.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                        <PieChart size={24} />
                      </div>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">You're all settled up!</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No pending balances in this group.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {oweBalances.map((b: any) => (
                        <div key={b.userId} className="flex items-center justify-between p-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20">
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">You owe <span className="font-semibold text-slate-900 dark:text-white">{b.user.name}</span></p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-500">₹{(b.amount / 100).toFixed(0)}</p>
                          </div>
                          <Link href={`/settle?userId=${b.userId}&groupId=${group.id}`} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                            Settle
                          </Link>
                        </div>
                      ))}
                      
                      {owedBalances.map((b: any) => (
                        <div key={b.userId} className="flex items-center justify-between p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400"><span className="font-semibold text-slate-900 dark:text-white">{b.user.name}</span> owes you</p>
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-500">₹{(b.amount / 100).toFixed(0)}</p>
                          </div>
                          <div className="px-4 py-2 bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-semibold">
                            Waiting
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expenses List */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm sm:p-5">
                  <GroupExpenseList expenses={group.expenses} currentUserId={userId} groupId={group.id} />
                </div>

                <GroupActions groupId={group.id} isCreator={isCreator} />
              </div>
            </div>
          )
        }
      />
    </div>
  )
}
