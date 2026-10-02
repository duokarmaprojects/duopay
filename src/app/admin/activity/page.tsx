import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { Activity } from "lucide-react"

export const metadata = {
  title: 'Activity Log | Admin Dashboard',
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  await requireAdmin()

  const page = Number(searchParams?.page) || 1
  const limit = 50
  const skip = (page - 1) * limit

  const [events, totalEvents] = await Promise.all([
    prisma.analyticsEvent.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.analyticsEvent.count()
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Global Activity Log</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Real-time stream of all AnalyticsEvents in the system.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Event
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  User
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Metadata
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-transparent">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-500" />
                      {event.eventType}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {event.user ? (
                      <div>
                        <div>{event.user.name}</div>
                        <div className="text-xs">{event.user.email}</div>
                      </div>
                    ) : (
                      'System / Anonymous'
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {event.metadata ? JSON.stringify(event.metadata) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
