import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getReceiptScan } from "@/actions/receiptScan"
import { ReceiptReviewClient } from "./ReceiptReviewClient"
import Link from "next/link"
import { ArrowLeft, AlertCircle } from "lucide-react"

export default async function ReceiptReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ scanId?: string }> | { scanId?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/receipt")

  const resolvedParams = await searchParams
  const scanId = resolvedParams?.scanId

  if (!scanId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-2">No Receipt Specified</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6 max-w-sm">
          Please upload or scan a receipt first before accessing this review screen.
        </p>
        <Link
          href="/expenses/add?mode=scan"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          Scan Receipt
        </Link>
      </div>
    )
  }

  let scanData
  try {
    scanData = await getReceiptScan(scanId)
  } catch (err: any) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-2">Unable to Load Receipt</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6 max-w-sm">
          {err?.message || "You may not have authorization to view this receipt, or it may have expired."}
        </p>
        <Link
          href="/expenses/add"
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          Back to Add Expense
        </Link>
      </div>
    )
  }

  // Fetch user groups with members
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
            href="/expenses/add"
            className="p-1.5 -ml-1 rounded-lg text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-base font-bold">Review Receipt</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              {scanData.source === "SHARE" ? "Shared Payment Screen" : "Scanned Physical Receipt"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 pb-24">
        <ReceiptReviewClient
          scan={scanData}
          groups={groups}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  )
}
