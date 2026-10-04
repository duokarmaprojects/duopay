import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getOrderImport } from "@/actions/orderImport"
import { OrderDetailClient } from "./OrderDetailClient"
import Link from "next/link"
import { ArrowLeft, AlertCircle } from "lucide-react"

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/orders")

  const resolvedParams = await params
  const orderId = resolvedParams.id

  let orderData
  try {
    orderData = await getOrderImport(orderId)
  } catch (err: any) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-2">Order Not Found</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6 max-w-sm">
          {err?.message || "This order may have expired, or you may not have authorization to view it."}
        </p>
        <Link
          href="/orders"
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          Back to Orders
        </Link>
      </div>
    )
  }

  // Fetch groups
  const groupMemberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, image: true },
              },
            },
          },
        },
      },
    },
  })

  const groups = groupMemberships.map((gm) => ({
    id: gm.group.id,
    name: gm.group.name,
    members: gm.group.members.map((m) => ({
      id: m.user.id,
      name: m.user.name || "Member",
      image: m.user.image,
    })),
  }))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="p-1.5 -ml-1 rounded-lg text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-base font-bold">Review Order</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              {orderData.merchant || orderData.provider}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 pb-24">
        <OrderDetailClient
          order={orderData}
          groups={groups}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  )
}
