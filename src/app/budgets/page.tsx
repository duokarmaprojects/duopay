import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getBudgets } from "@/actions/budget"
import BudgetManager from "./BudgetManager"
import BottomNav from "@/components/navigation/BottomNav"
import Link from "next/link"
import { ArrowLeft, PieChart } from "lucide-react"

export default async function BudgetsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const budgets = await getBudgets()

  return (
    <div className="flex flex-col flex-1 bg-slate-50 dark:bg-slate-950 pb-24 min-h-screen">
      {/* Premium Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 pt-12 pb-4 border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              className="p-2 -ml-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <ArrowLeft size={22} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Budgets</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Set and track monthly spending targets
              </p>
            </div>
          </div>
          <Link
            href="/analytics"
            className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            title="View Analytics"
          >
            <PieChart size={20} />
          </Link>
        </div>
      </header>

      {/* Main Budget Manager */}
      <div className="flex-1 overflow-y-auto">
        <BudgetManager initialBudgets={budgets} />
      </div>

      <BottomNav
        activeTab="activity"
        userImage={session.user.image}
        userName={session.user.name}
      />
    </div>
  )
}
