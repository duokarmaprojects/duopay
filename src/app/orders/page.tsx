import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { listUserOrderImports } from "@/actions/orderImport"
import { OrdersDashboardClient } from "./OrdersDashboardClient"
import Link from "next/link"
import { ArrowLeft, ShoppingBag } from "lucide-react"

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/orders")

  const pendingOrders = await listUserOrderImports("PENDING_REVIEW")
  const confirmedOrders = await listUserOrderImports("CONFIRMED")
  const dismissedOrders = await listUserOrderImports("DISMISSED")

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/expenses/add"
            className="p-1.5 -ml-1 rounded-lg text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-blue-600 dark:text-blue-400" />
            <h1 className="text-base font-bold">Imported Orders</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 pb-24">
        <OrdersDashboardClient
          pendingOrders={pendingOrders}
          confirmedOrders={confirmedOrders}
          dismissedOrders={dismissedOrders}
        />
      </main>
    </div>
  )
}
