import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Users, ChevronRight } from "lucide-react"
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
      <div className="flex flex-col flex-1 bg-gray-50 h-screen">
        <header className="bg-white flex items-center p-4 border-b border-gray-100 sticky top-0 z-10">
          <Link href="/" className="p-2 -ml-2 text-gray-900 active:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold ml-2">Select a Group</h1>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-500 mb-4 px-2">Which group is this expense for?</p>
          
          {userGroups.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm mt-4">
              <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users size={24} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">No groups yet</h3>
              <p className="text-sm text-gray-500 mb-6 px-4">You need a group to add an expense.</p>
              <Link 
                href="/groups/create"
                className="inline-block bg-black text-white px-6 py-2.5 rounded-lg text-sm font-semibold active:scale-95 transition-transform"
              >
                Create Group
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              {userGroups.map(({ group }) => (
                <Link 
                  key={group.id} 
                  href={`/expenses/add?groupId=${group.id}`}
                  className="flex items-center justify-between p-4 border-b border-gray-50 active:bg-gray-50 transition-colors last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-900">
                      <GroupIcon iconId={group.image} size={20} />
                    </div>
                    <span className="font-semibold text-gray-900">{group.name}</span>
                  </div>
                  <ChevronRight size={20} className="text-gray-300" />
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
      <div className="flex flex-col flex-1 bg-gray-50 h-screen">
        <header className="bg-white flex items-center p-4 border-b border-gray-100">
          <Link href={`/expenses/add`} className="p-2 -ml-2 text-gray-900 active:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold ml-2">Add Expense</h1>
        </header>

        <div className="flex-1 p-6 flex flex-col justify-center items-center gap-6">
          <Link 
            href={`/expenses/add?groupId=${groupId}&mode=scan`}
            className="w-full bg-white border border-gray-200 rounded-2xl p-6 shadow-sm active:scale-95 transition-transform flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl">
              📷
            </div>
            <div className="text-center">
              <h2 className="font-bold text-gray-900 text-lg">Scan Receipt</h2>
              <p className="text-sm text-gray-500">Extract expense details</p>
            </div>
          </Link>

          <div className="flex items-center w-full max-w-[200px]">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Or</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <Link 
            href={`/expenses/add?groupId=${groupId}&mode=manual`}
            className="w-full bg-white border border-gray-200 rounded-2xl p-6 shadow-sm active:scale-95 transition-transform flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl">
              ✏️
            </div>
            <div className="text-center">
              <h2 className="font-bold text-gray-900 text-lg">Enter Manually</h2>
              <p className="text-sm text-gray-500">Add expense yourself</p>
            </div>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-white h-screen">
      <header className="flex items-center p-4 border-b border-gray-100">
        <Link href={`/expenses/add?groupId=${groupId}`} className="p-2 -ml-2 text-gray-900 active:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold ml-2">
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
