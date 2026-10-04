import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Users, Activity, User as UserIcon } from "lucide-react"
import { prisma } from "@/lib/db"
import { getUserBalances } from "@/services/balance"
import { getCashbackSummary } from "@/actions/cashback"
import { getUserMonthlyTrueSpend } from "@/services/trueSpend"

import DashboardView from "./components/DashboardView"

export default async function HomePage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  let user = null
  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        groupMembers: {
          include: { group: true }
        }
      }
    })
  } catch (err) {
    console.error("[HomePage] Error fetching user:", err)
  }

  if (!user) {
    redirect('/login?expired=1')
  }

  if (!user.phone || !user.upiId || !user.name || user.name === "New User") {
    redirect('/setup-profile')
  }

  const now = new Date()
  const [
    balancesData,
    cashbackSummary,
    unreadNotificationCount,
    recentExpenses,
    monthlyTrueSpend,
  ] = await Promise.all([
    getUserBalances(session.user.id).catch((err) => {
      console.error("[HomePage] getUserBalances failed:", err)
      return { totalOwedToUser: 0, totalUserOwes: 0, detailedBalances: [] }
    }),
    getCashbackSummary().catch((err) => {
      console.error("[HomePage] getCashbackSummary failed:", err)
      return null
    }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }).catch((err) => {
      console.error("[HomePage] notification.count failed:", err)
      return 0
    }),
    prisma.expense.findMany({
      where: {
        OR: [
          { payerId: session.user.id },
          { participants: { some: { userId: session.user.id } } },
        ],
      },
      include: { group: true, participants: true, payer: true },
      orderBy: { date: 'desc' },
      take: 5
    }).catch((err) => {
      console.error("[HomePage] expense.findMany failed:", err)
      return []
    }),
    getUserMonthlyTrueSpend(session.user.id, now.getFullYear(), now.getMonth()).catch((err) => {
      console.error("[HomePage] getUserMonthlyTrueSpend failed:", err)
      return null
    }),
  ])

  const { totalOwedToUser = 0, totalUserOwes = 0, detailedBalances = [] } = balancesData || {}

  return (
    <DashboardView 
      user={user}
      sessionUser={session.user}
      totalUserOwes={totalUserOwes}
      totalOwedToUser={totalOwedToUser}
      detailedBalances={detailedBalances as any}
      cashbackSummary={cashbackSummary}
      unreadNotificationCount={unreadNotificationCount}
      recentExpenses={recentExpenses}
      monthlyTrueSpend={monthlyTrueSpend}
    />
  )
}

