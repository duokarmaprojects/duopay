import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { FolderGit2, Users } from "lucide-react"

export const metadata = {
  title: 'Groups Analytics | Admin Dashboard',
}

export default async function AdminGroupsPage() {
  await requireAdmin()

  const [
    totalGroups,
    activeGroups, // groups with recent expenses
    avgMembersPerGroup
  ] = await Promise.all([
    prisma.group.count(),
    prisma.group.count({
      where: {
        expenses: {
          some: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }
      }
    }),
    prisma.group.findMany({
      select: {
        _count: {
          select: { members: true }
        }
      }
    }).then(groups => 
      groups.length > 0 
        ? groups.reduce((acc, g) => acc + g._count.members, 0) / groups.length 
        : 0
    )
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">Group Analytics</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor group creation and engagement metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-blue-50 dark:bg-blue-900/20 p-3">
              <FolderGit2 className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Groups</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{totalGroups}</p>
          </dd>
        </div>
        
        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-green-50 dark:bg-green-900/20 p-3">
              <FolderGit2 className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Active Groups (30d)</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{activeGroups}</p>
          </dd>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <dt>
            <div className="absolute rounded-md bg-purple-50 dark:bg-purple-900/20 p-3">
              <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Avg Members / Group</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">{avgMembersPerGroup.toFixed(1)}</p>
          </dd>
        </div>
      </div>
    </div>
  )
}
