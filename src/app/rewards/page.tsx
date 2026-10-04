import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Sparkles
} from "lucide-react"
import { getCashbackSummary, getCashbackHistory } from "@/actions/cashback"
import RewardsClient from "./RewardsClient"
import BottomNav from "@/components/navigation/BottomNav"

import { prisma } from "@/lib/db"

export const metadata = {
  title: "Cashback & Rewards | DuoPay",
  description: "Earn instant cashback on every verified payment made with DuoPay.",
}

export default async function RewardsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    redirect("/login?expired=1")
  }

  const [summary, history] = await Promise.all([
    getCashbackSummary().catch((err) => {
      console.error("[RewardsPage] Error fetching cashback summary:", err)
      return {
        balancePaise: 0,
        balanceRupees: "0.00",
        thresholdPaise: 2500,
        remainingPaise: 2500,
        isUnlocked: false,
        progressPercentage: 0,
        upiId: user.upiId,
        canRedeem: false,
        reason: undefined,
        activeRedemption: null,
      }
    }),
    getCashbackHistory(50).catch((err) => {
      console.error("[RewardsPage] Error fetching cashback history:", err)
      return []
    }),
  ])

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-black min-h-screen pb-24 text-gray-900 dark:text-zinc-100">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-bold tracking-tight">Rewards Dashboard</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">Cashback & Points</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-200/60 dark:border-amber-800/40">
          <Sparkles size={13} />
          <span>{summary.balanceRupees}</span>
        </div>
      </header>

      <main className="w-full px-4 py-6 space-y-6">
        <RewardsClient summary={summary} history={history} />
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="profile"
        userImage={session.user.image}
        userName={session.user.name}
      />
    </div>
  )
}
