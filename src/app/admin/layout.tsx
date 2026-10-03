import { requireAdmin } from "@/lib/admin"
import Link from "next/link"
import { 
  LayoutDashboard, 
  Users, 
  FolderGit2, 
  Receipt, 
  ArrowRightLeft, 
  LineChart, 
  Activity, 
  ServerCrash
} from "lucide-react"

const navigation = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Groups', href: '/admin/groups', icon: FolderGit2 },
  { name: 'Expenses', href: '/admin/expenses', icon: Receipt },
  { name: 'Settlements', href: '/admin/settlements', icon: ArrowRightLeft },
  { name: 'Analytics', href: '/admin/analytics', icon: LineChart },
  { name: 'Activity', href: '/admin/activity', icon: Activity },
  { name: 'System', href: '/admin/system', icon: ServerCrash },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hidden md:flex md:flex-col">
        <div className="flex h-16 shrink-0 items-center px-6">
          <Link href="/admin" className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
            DuoPay Admin
          </Link>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav className="flex-1 space-y-1 px-4 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-full px-4 sm:px-6 md:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
