import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Users, Activity, User as UserIcon } from "lucide-react"
import { prisma } from "@/lib/db"
import { getUserBalances } from "@/services/balance"
import { getCashbackSummary } from "@/actions/cashback"

import DashboardView from "./components/DashboardView"

export default async function HomePage() {
  const session = await auth()
  
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      groupMembers: {
        include: { group: true }
      }
    }
  })

  if (user && (!user.phone || !user.upiId || !user.name || user.name === "New User")) {
    redirect('/setup-profile')
  }

  const [{ totalOwedToUser, totalUserOwes, detailedBalances }, cashbackSummary] = await Promise.all([
    getUserBalances(session.user.id),
    getCashbackSummary(),
  ])

  return (
    <DashboardView 
      user={user}
      sessionUser={session.user}
      totalUserOwes={totalUserOwes}
      totalOwedToUser={totalOwedToUser}
      detailedBalances={detailedBalances as any}
      cashbackSummary={cashbackSummary}
    />
  )
}

