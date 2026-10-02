import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { ArrowRightLeft, CheckCircle2, Clock } from "lucide-react"

export const metadata = {
  title: 'Settlements | Admin Dashboard',
}

export default async function AdminSettlementsPage() {
  await requireAdmin()

  const [
    totalSettlements,
    completedSettlements,
    pendingSettlements,
    totalSettledVolume
  ] = await Promise.all([
    prisma.settlement.count(),
    prisma.settlement.count({ where: { status: 'COMPLETED' } }),
    prisma.settlement.count({ where: { status: 'PENDING' } }),
    prisma.settlement.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true }
    })
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Settlements</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor balance settlements between users.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-indigo-50 dark:bg-indigo-900/20 p-3">
              <ArrowRightLeft className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Initiated</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{totalSettlements}</p>
          </dd>
        </div>
        
        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-green-50 dark:bg-green-900/20 p-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Completed</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{completedSettlements}</p>
          </dd>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-orange-50 dark:bg-orange-900/20 p-3">
              <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Pending</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{pendingSettlements}</p>
          </dd>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-blue-50 dark:bg-blue-900/20 p-3">
              <ArrowRightLeft className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Volume Settled</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              ${(Number(totalSettledVolume._sum.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </dd>
        </div>
      </div>
    </div>
  )
}
