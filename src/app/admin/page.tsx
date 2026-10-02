import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { Users, Receipt, FolderGit2, ArrowRightLeft } from "lucide-react"

export const metadata = {
  title: 'Admin Dashboard | DuoPay',
}

export default async function AdminDashboard() {
  await requireAdmin()

  // Fetch KPIs in parallel
  const [
    totalUsers,
    activeUsers,
    totalExpenses,
    totalSettlements
  ] = await Promise.all([
    prisma.user.count(),
    // Users active in the last 30 days (assuming some activity or updated_at, we'll use updated_at for now)
    prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    prisma.expense.count(),
    prisma.settlement.count()
  ])

  const stats = [
    { name: 'Total Users', value: totalUsers, icon: Users, change: '+4.75%', changeType: 'positive' },
    { name: 'Active Users (30d)', value: activeUsers, icon: Users, change: '+54.02%', changeType: 'positive' },
    { name: 'Total Expenses', value: totalExpenses, icon: Receipt, change: '-1.39%', changeType: 'negative' },
    { name: 'Total Settlements', value: totalSettlements, icon: ArrowRightLeft, change: '+10.18%', changeType: 'positive' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard Overview</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          High-level metrics and performance indicators.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <dt>
              <div className="absolute rounded-md bg-indigo-50 dark:bg-indigo-900/20 p-3">
                <item.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                {item.name}
              </p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {item.value}
              </p>
            </dd>
          </div>
        ))}
      </div>
    </div>
  )
}
