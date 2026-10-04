import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { ServerCrash, Key, CheckCircle, XCircle } from "lucide-react"
import { PwaDiagnosticsCard } from "./PwaDiagnosticsCard"

export const metadata = {
  title: 'System Health | Admin Dashboard',
}

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }> | { page?: string }
}) {
  await requireAdmin()

  const resolvedParams = searchParams ? await searchParams : {}
  const page = Number(resolvedParams?.page) || 1
  const limit = 50
  const skip = (page - 1) * limit

  const [errors, totalErrors] = await Promise.all([
    prisma.systemError.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.systemError.count()
  ])

  // Secure Server-Only Diagnostic for VAPID Configuration
  const vapidStatus = {
    publicKey: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: !!process.env.VAPID_PRIVATE_KEY,
    subject: !!process.env.VAPID_SUBJECT
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">System Health</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor system health, PWA update states, and runtime exceptions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PWA & Lifecycle Diagnostics */}
        <PwaDiagnosticsCard />

        {/* VAPID Configuration Status */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-zinc-100 mb-4">
            <Key className="h-4 w-4" />
            VAPID Configuration
          </h2>
          <ul className="space-y-3">
            <li className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-mono">NEXT_PUBLIC_VAPID_PUBLIC_KEY</span>
              {vapidStatus.publicKey ? (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle className="h-4 w-4" /> Configured
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                  <XCircle className="h-4 w-4" /> Missing
                </span>
              )}
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-mono">VAPID_PRIVATE_KEY</span>
              {vapidStatus.privateKey ? (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle className="h-4 w-4" /> Configured
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                  <XCircle className="h-4 w-4" /> Missing
                </span>
              )}
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-mono">VAPID_SUBJECT</span>
              {vapidStatus.subject ? (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle className="h-4 w-4" /> Configured
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <XCircle className="h-4 w-4" /> Missing
                </span>
              )}
            </li>
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-zinc-100 sm:pl-6">
                  Code / Error
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-zinc-100">
                  Message
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-zinc-100">
                  User Context
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-zinc-100">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-transparent">
              {errors.map((err) => (
                <tr key={err.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-red-600 dark:text-red-400 sm:pl-6">
                    <div className="flex items-center gap-2">
                      <ServerCrash className="h-4 w-4" />
                      {err.code}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-md truncate">
                    {err.message}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    System / Anonymous
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(err.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {errors.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No system errors recorded. System is healthy.
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
