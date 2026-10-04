import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Users, ChevronRight, Scan, PencilLine } from "lucide-react"
import { AddExpenseForm } from "./form"
import { ReceiptScanner } from "./ReceiptScanner"
import { GroupIcon } from "@/components/ui/GroupIcon"

export default async function AddExpensePage({
  searchParams,
}: {
  searchParams: { groupId?: string, mode?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { groupId, mode } = await searchParams

  if (!groupId) {
    // Select Group Flow
    const userGroups = await prisma.groupMember.findMany({
      where: { userId: session.user.id },
      include: { group: true }
    })

    return (
      <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 h-screen transition-colors">
        <header className="bg-white dark:bg-zinc-900 flex items-center p-4 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-10">
          <Link href="/" className="p-2 -ml-2 text-gray-900 dark:text-zinc-100 active:bg-gray-100 dark:active:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold ml-2 text-gray-900 dark:text-zinc-100">Select a Group</h1>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:px-6">
          <p className="text-sm font-medium text-gray-500 dark:text-zinc-400 mb-4 px-2">Which group is this expense for?</p>
          
          {userGroups.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800 shadow-sm mt-4">
              <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users size={32} />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-lg mb-2">No groups yet</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8 px-4">You need a group to add an expense.</p>
              <Link 
                href="/groups/create"
                className="inline-flex bg-blue-600 dark:bg-blue-500 text-white px-8 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-sm shadow-blue-500/20"
              >
                Create Group
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col overflow-hidden">
              {userGroups.map(({ group }) => (
                <Link 
                  key={group.id} 
                  href={`/expenses/add?groupId=${group.id}`}
                  className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-50 dark:border-zinc-800/50 active:bg-gray-50 dark:active:bg-zinc-800 transition-colors last:border-b-0 group-hover:bg-gray-50 dark:group-hover:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-900 dark:text-zinc-100 shadow-sm">
                      <GroupIcon iconId={group.image} size={24} />
                    </div>
                    <span className="font-bold text-gray-900 dark:text-zinc-100 text-lg tracking-tight">{group.name}</span>
                  </div>
                  <ChevronRight size={20} className="text-gray-300 dark:text-zinc-600" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: true }
      }
    }
  })

  if (!group || !group.members.some(m => m.userId === session?.user?.id)) {
    redirect('/')
  }

  const members = group.members.map(m => ({
    id: m.user.id,
    name: m.user.name || 'Unknown',
    image: m.user.image,
  }))

  if (!mode) {
    return (
      <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 h-screen transition-colors">
        <header className="bg-white dark:bg-zinc-900 flex items-center p-4 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-10">
          <Link href={`/expenses/add`} className="p-2 -ml-2 text-gray-900 dark:text-zinc-100 active:bg-gray-100 dark:active:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold ml-2 text-gray-900 dark:text-zinc-100">Add Expense</h1>
        </header>

        <div className="flex-1 p-6 flex flex-col justify-center items-center gap-4 max-w-sm mx-auto w-full">
          <Link 
            href={`/expenses/add?groupId=${groupId}&mode=scan`}
            className="w-full flex items-center gap-4 p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all group"
          >
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Scan size={28} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-zinc-100 tracking-tight">Scan Receipt</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 leading-snug">AI extracts items & totals</p>
            </div>
          </Link>

          <Link 
            href={`/expenses/add?groupId=${groupId}&mode=screenshot`}
            className="w-full flex items-center gap-4 p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-sm hover:shadow-md hover:border-purple-500/30 transition-all group"
          >
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-zinc-100 tracking-tight">Payment Screenshot</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 leading-snug">Import from GPay, PhonePe...</p>
            </div>
          </Link>

          <Link 
            href={`/expenses/add?groupId=${groupId}&mode=cash`}
            className="w-full flex items-center gap-4 p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all group"
          >
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-zinc-100 tracking-tight">Cash Expense</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 leading-snug">Log offline physical cash</p>
            </div>
          </Link>

          <Link 
            href={`/expenses/add?groupId=${groupId}&mode=manual`}
            className="w-full flex items-center gap-4 p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all group"
          >
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <PencilLine size={28} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-zinc-100 tracking-tight">Manual Entry</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 leading-snug">Type details yourself</p>
            </div>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-zinc-950 h-screen transition-colors">
      <header className="flex items-center p-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <Link href={`/expenses/add?groupId=${groupId}`} className="p-2 -ml-2 text-gray-900 dark:text-zinc-100 active:bg-gray-100 dark:active:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold ml-2 text-gray-900 dark:text-zinc-100 tracking-tight">
          {mode === 'scan' ? 'Scan Receipt' : 
           mode === 'screenshot' ? 'Process Screenshot' : 
           mode === 'cash' ? 'Add Cash Expense' : 'Add Expense'}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {mode === 'scan' || mode === 'screenshot' ? (
          <ReceiptScanner groupId={groupId} members={members} currentUserId={session.user.id} mode={mode} />
        ) : (
          <AddExpenseForm groupId={groupId} members={members} currentUserId={session.user.id} source={mode === 'cash' ? 'CASH' : 'MANUAL'} />
        )}
      </div>
    </div>
  )
}
