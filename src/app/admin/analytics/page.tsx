import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { LineChart, BarChart3, PieChart } from "lucide-react"

export const metadata = {
  title: 'Product Analytics | Admin Dashboard',
}

export default async function AdminAnalyticsPage() {
  await requireAdmin()

  // High-level product analytics using AnalyticsEvent table
  // Group by eventType to see feature usage
  const eventsByCount = await prisma.analyticsEvent.groupBy({
    by: ['eventType'],
    _count: {
      id: true
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    },
    take: 10
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Product Analytics</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Feature usage, retention, and funnel metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-4 sm:px-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500" />
            <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">Top Events</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {eventsByCount.map((event) => (
                <div key={event.eventType} className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{event.eventType}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{event._count.id} times</div>
                </div>
              ))}
              {eventsByCount.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No events recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-4 sm:px-6 flex items-center gap-2">
            <LineChart className="h-5 w-5 text-gray-500" />
            <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">Funnel Drop-off (Simulated)</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {/* This is a placeholder since we don't have complex funnel logic ready, but the UI is prepared */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-200">Sign Up</span>
                  <span className="text-gray-500 dark:text-gray-400">100%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-200">Create Group</span>
                  <span className="text-gray-500 dark:text-gray-400">65%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-200">Add First Expense</span>
                  <span className="text-gray-500 dark:text-gray-400">42%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '42%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
