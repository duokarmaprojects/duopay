import { getUserRules } from "@/actions/automation"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Settings } from "lucide-react"
import RuleClient from "./RuleClient"

export const metadata = {
  title: "Automations - Settings",
}

export default async function AutomationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const rules = await getUserRules()

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-black min-h-screen">
      <header className="bg-white dark:bg-zinc-950 px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-900 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg">
              <Settings size={16} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">Smart Automations</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Your Rules</h2>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Automatically categorize expenses based on merchant names, amounts, or sources. Rules are evaluated top-to-bottom.
          </p>
        </div>

        <RuleClient initialRules={rules} />
      </div>
    </div>
  )
}
