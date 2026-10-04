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

        <div className="flex-1 p-6 flex flex-col justify-center items-center gap-6 max-w-md mx-auto w-full">
          <Link 
            href={`/expenses/add?groupId=${groupId}&mode=scan`}
            className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-8 shadow-sm active:scale-[0.98] transition-transform flex flex-col items-center gap-4 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-blue-500/5 group"
          >
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Scan size={32} strokeWidth={2} />
            </div>
            <div className="text-center">
              <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-xl tracking-tight mb-1">Scan Receipt</h2>
              <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">Extract items automatically</p>
            </div>
          </Link>

          <div className="flex items-center w-full max-w-[200px]">
            <div className="flex-1 border-t border-gray-200 dark:border-zinc-800"></div>
            <span className="px-4 text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Or</span>
            <div className="flex-1 border-t border-gray-200 dark:border-zinc-800"></div>
          </div>

          <Link 
            href={`/expenses/add?groupId=${groupId}&mode=manual`}
            className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-8 shadow-sm active:scale-[0.98] transition-transform flex flex-col items-center gap-4 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-blue-500/5 group"
          >
            <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-gray-700 dark:text-zinc-300 group-hover:scale-110 transition-transform">
              <PencilLine size={32} strokeWidth={2} />
            </div>
            <div className="text-center">
              <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-xl tracking-tight mb-1">Enter Manually</h2>
              <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">Add expense details yourself</p>
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
          {mode === 'scan' ? 'Scan Receipt' : 'Add Expense'}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {mode === 'scan' ? (
          <ReceiptScanner groupId={groupId} members={members} currentUserId={session.user.id} />
        ) : (
          <AddExpenseForm groupId={groupId} members={members} currentUserId={session.user.id} />
        )}
      </div>
    </div>
  )
}
