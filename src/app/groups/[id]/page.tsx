import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, UserPlus } from "lucide-react"
import { getUserBalances } from "@/services/balance"
import GroupActions from "./GroupActions"
import { GroupIcon } from "@/components/ui/GroupIcon"
import GroupSmartSettleButton from "./GroupSmartSettleButton"
import RecurringExpensesModal from "./RecurringExpensesModal"
import GroupExpenseList from "./GroupExpenseList"
import { getGroupRecurringExpenses, generateDueRecurringExpenses } from "@/actions/recurring"

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
        orderBy: { joinedAt: 'asc' } // Ensure oldest is first to determine creator
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

  const userId = session?.user?.id;
  if (!userId) redirect('/login');
  
  const isCreator = group.members.length > 0 && group.members[0].userId === userId

  const { detailedBalances } = await getUserBalances(userId)
  
  // Find members we owe in this group context (for V1 we just look at global detailed balances with group members)
  const groupMemberIds = new Set(group.members.map(m => m.userId))
  
  const oweBalances = detailedBalances.filter(b => b.type === 'USER_OWES' && groupMemberIds.has(b.userId))
  const owedBalances = detailedBalances.filter(b => b.type === 'OWED_TO_USER' && groupMemberIds.has(b.userId))

  // Process due recurring expenses (idempotent)
  await generateDueRecurringExpenses(id).catch(() => {})

  // Fetch recurring expense schedules for this group
  const recurringSchedules = await getGroupRecurringExpenses(id).catch(() => [] as any[])

  const membersList = group.members.map(m => ({
    id: m.user.id,
    name: m.user.name || 'Unknown',
  }))

  return (
    <div className="flex flex-col flex-1 bg-gray-50 h-screen">
      <header className="bg-white px-4 pt-4 pb-4 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 text-gray-900 active:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <GroupIcon iconId={group.image} size={24} className="text-gray-900" />
            <h1 className="text-xl font-bold">{group.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <RecurringExpensesModal
            groupId={id}
            members={membersList}
            currentUserId={userId}
            initialSchedules={recurringSchedules}
          />
          <Link href={`/groups/${group.id}/add-member`} className="p-2 text-gray-900 active:bg-gray-100 rounded-full">
            <UserPlus size={24} />
          </Link>
        </div>
      </header>

      {/* Balances to Settle */}
      <div className="bg-white p-6 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Settle Up</h2>
        
        {oweBalances.length === 0 && owedBalances.length === 0 ? (
          <div className="text-center py-4 bg-gray-50 rounded-xl">
            <p className="text-emerald-600 font-medium text-sm">₹0 — ALL SETTLED 🎉</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {oweBalances.map(b => {
              const user = group.members.find(m => m.userId === b.userId)?.user
              return (
                <div key={b.userId} className="flex items-center justify-between p-3 rounded-xl border border-red-100 bg-red-50">
                  <div>
                    <p className="text-sm text-red-600">You owe <span className="font-semibold">{user?.name}</span></p>
                    <p className="text-lg font-bold text-red-700">₹{b.amount / 100}</p>
                  </div>
                  <Link href={`/settle?userId=${b.userId}&groupId=${group.id}`} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium active:bg-red-700">
                    Pay Now
                  </Link>
                </div>
              )
            })}
            
            {owedBalances.map(b => {
              const user = group.members.find(m => m.userId === b.userId)?.user
              return (
                <div key={b.userId} className="flex items-center justify-between p-3 rounded-xl border border-emerald-100 bg-emerald-50">
                  <div>
                    <p className="text-sm text-emerald-600"><span className="font-semibold">{user?.name}</span> owes you</p>
                    <p className="text-lg font-bold text-emerald-700">₹{b.amount / 100}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <GroupSmartSettleButton groupId={group.id} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <GroupExpenseList expenses={group.expenses} currentUserId={userId} />

        <GroupActions groupId={group.id} isCreator={isCreator} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 fixed bottom-0 w-full max-w-md">
        <Link 
          href={`/expenses/add?groupId=${group.id}`} 
          className="flex items-center justify-center w-full bg-black text-white font-semibold py-3.5 px-4 rounded-xl active:bg-gray-800 transition-colors"
        >
          Add Expense
        </Link>
      </div>
    </div>
  )
}
