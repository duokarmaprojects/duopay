import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { Receipt, DollarSign, BrainCircuit } from "lucide-react"

export const metadata = {
  title: 'Expenses Analytics | Admin Dashboard',
}

export default async function AdminExpensesPage() {
  await requireAdmin()

  const [
    totalExpenses,
    totalExpenseVolume,
    smartSplitUsage
  ] = await Promise.all([
    prisma.expense.count(),
    prisma.expense.aggregate({
      _sum: {
        amount: true
      }
    }),
    prisma.analyticsEvent.count({
      where: {
        eventType: 'smart_split_used'
      }
    })
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">Expense Analytics</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track expense volume and feature usage.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <Receipt className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Expenses Logged</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{totalExpenses}</p>
          </dd>
        </div>
        
        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
              <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Volume ($)</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">
              ${(Number(totalExpenseVolume._sum.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </dd>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-indigo-50 dark:bg-indigo-900/20 p-3">
              <BrainCircuit className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Smart Split Uses</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{smartSplitUsage}</p>
          </dd>
        </div>
      </div>
    </div>
  )
}
