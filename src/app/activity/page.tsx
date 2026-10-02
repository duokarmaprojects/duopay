import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { User, Users, Activity, Receipt } from "lucide-react"
import ActivityFeed, { ActivityItem } from "./ActivityFeed"

export default async function ActivityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id
  const userName = session.user.name || "Unknown"
  const userImage = session.user.image

  // Fetch expenses
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payerId: userId },
        { participants: { some: { userId: userId } } }
      ]
    },
    include: {
      payer: true,
      group: true
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  // Fetch settlements
  const settlements = await prisma.settlement.findMany({
    where: {
      OR: [
        { payerId: userId },
        { receiverId: userId }
      ]
    },
    include: {
      payer: true,
      receiver: true
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  // Transform and combine
  const activities: ActivityItem[] = [
    ...expenses.map(e => ({
      id: `exp_${e.id}`,
      type: 'EXPENSE' as const,
      amount: e.amount,
      description: e.description,
      category: e.category,
      groupName: e.group?.name,
      date: e.createdAt.toISOString(),
      isUserPayer: e.payerId === userId,
      payerName: e.payer.name || "Unknown",
    })),
    ...settlements.map(s => ({
      id: `set_${s.id}`,
      type: 'SETTLEMENT' as const,
      amount: s.amount,
      description: 'Settlement',
      date: s.createdAt.toISOString(),
      isUserPayer: s.payerId === userId,
      payerName: s.payer.name || "Unknown",
      receiverName: s.receiver.name || "Unknown"
    }))
  ]

  // Sort combined by date descending
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="flex flex-col flex-1 bg-gray-50 pb-20">
      <header className="bg-gray-50 px-6 pt-10 pb-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <ActivityFeed activities={activities} />
      </div>

      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 flex justify-between px-6 pb-[env(safe-area-inset-bottom)] pt-2 z-20">
        <Link href="/" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><User size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Home</span>
        </Link>
        <Link href="/groups" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1"><Users size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Groups</span>
        </Link>
        <Link href="/activity" className="flex flex-col items-center p-2 text-black">
          <div className="p-1"><Activity size={24} strokeWidth={2.5}/></div>
          <span className="text-[10px] font-medium mt-1">Activity</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center p-2 text-gray-400 hover:text-black transition-colors">
          <div className="p-1">
            <div className="w-6 h-6 rounded-full border-2 border-current overflow-hidden flex items-center justify-center bg-gray-100">
              {userImage ? <img src={userImage} className="w-full h-full object-cover" alt=""/> : <span className="text-[10px] font-bold text-gray-500">{userName.charAt(0)}</span>}
            </div>
          </div>
          <span className="text-[10px] font-medium mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  )
}
