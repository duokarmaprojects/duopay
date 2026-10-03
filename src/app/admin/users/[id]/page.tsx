import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, User, Activity as ActivityIcon, Receipt, FolderGit2 } from "lucide-react"

export const metadata = {
  title: 'User Details | Admin Dashboard',
}

export default async function AdminUserDetailPage({
  params
}: {
  params: { id: string }
}) {
  await requireAdmin()

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      groupMembers: {
        include: {
          group: true
        }
      },
      expensesPaid: {
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      analyticsEvents: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  })

  if (!user) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/users" 
          className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to users</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
            {user.name || 'Unnamed User'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {user.email || user.phone} • Joined {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-900/30 dark:text-indigo-400 dark:ring-indigo-400/20">
            Role: {user.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="col-span-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-4 sm:px-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              Profile details
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6 space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ID</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-zinc-100 font-mono">{user.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-zinc-100">{user.name || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-zinc-100">{user.email || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-zinc-100">{user.phone || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-zinc-100">{new Date(user.updatedAt).toLocaleString()}</dd>
            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 space-y-6">
          {/* Groups & Expenses */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-4 sm:px-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                  <FolderGit2 className="h-5 w-5 text-gray-500" />
                  Groups ({user.groupMembers.length})
                </h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <ul className="space-y-3">
                  {user.groupMembers.slice(0, 5).map((ug) => (
                    <li key={ug.groupId} className="text-sm text-gray-900 dark:text-zinc-100">
                      {ug.group.name}
                    </li>
                  ))}
                  {user.groupMembers.length === 0 && (
                    <p className="text-sm text-gray-500">Not part of any groups.</p>
                  )}
                </ul>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-4 sm:px-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-gray-500" />
                  Recent Expenses Paid
                </h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <ul className="space-y-3">
                  {user.expensesPaid.map((exp) => (
                    <li key={exp.id} className="text-sm text-gray-900 dark:text-zinc-100 flex justify-between">
                      <span className="truncate pr-2">{exp.description}</span>
                      <span className="font-medium">${Number(exp.amount).toFixed(2)}</span>
                    </li>
                  ))}
                  {user.expensesPaid.length === 0 && (
                    <p className="text-sm text-gray-500">No expenses logged.</p>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-4 sm:px-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                <ActivityIcon className="h-5 w-5 text-gray-500" />
                Recent Activity
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <ul className="space-y-4">
                {user.analyticsEvents.map((event) => (
                  <li key={event.id} className="flex gap-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleDateString()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                        {event.eventType}
                      </div>
                      {event.metadata && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {JSON.stringify(event.metadata)}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
                {user.analyticsEvents.length === 0 && (
                  <p className="text-sm text-gray-500">No recent activity.</p>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
