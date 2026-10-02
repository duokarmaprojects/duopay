import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Search } from "lucide-react"

export const metadata = {
  title: 'Users | Admin Dashboard',
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string }
}) {
  await requireAdmin()

  const q = searchParams?.q || ""
  const page = Number(searchParams?.page) || 1
  const limit = 20
  const skip = (page - 1) * limit

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [users, totalUsers] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])

  const totalPages = Math.ceil(totalUsers / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Users</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your users, view their details, and monitor activity.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <form className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, or phone..."
            className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700 dark:focus:ring-indigo-500"
          />
        </form>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  User
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Role
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Joined
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-transparent">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-medium">
                        {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900 dark:text-white">{user.name || 'Unnamed'}</div>
                        <div className="text-gray-500 dark:text-gray-400">{user.email || user.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700">
                      {user.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <Link href={`/admin/users/${user.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                      View<span className="sr-only">, {user.name}</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <Link
                href={`/admin/users?q=${q}&page=${page - 1}`}
                className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
              >
                Previous
              </Link>
              <Link
                href={`/admin/users?q=${q}&page=${page + 1}`}
                className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
              >
                Next
              </Link>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-400">
                  Showing <span className="font-medium">{skip + 1}</span> to <span className="font-medium">{Math.min(skip + limit, totalUsers)}</span> of{' '}
                  <span className="font-medium">{totalUsers}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <Link
                    href={`/admin/users?q=${q}&page=${page - 1}`}
                    className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-700 dark:hover:bg-gray-800 ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    <span className="sr-only">Previous</span>
                    &larr;
                  </Link>
                  {/* Simplistic pagination for now */}
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 dark:text-white dark:ring-gray-700">
                    Page {page} of {totalPages}
                  </span>
                  <Link
                    href={`/admin/users?q=${q}&page=${page + 1}`}
                    className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-700 dark:hover:bg-gray-800 ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    <span className="sr-only">Next</span>
                    &rarr;
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
