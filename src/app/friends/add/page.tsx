import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UserPlus, Phone, Sparkles } from "lucide-react"
import AddFriendClient from "./AddFriendClient"

export default async function AddFriendPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/friends"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-zinc-100">Add Friend</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              Discover contacts or enter phone number
            </p>
          </div>
        </div>
      </header>

      {/* Main Form */}
      <main className="max-w-md w-full mx-auto px-4 py-6">
        <AddFriendClient currentUserId={session.user.id} />
      </main>
    </div>
  )
}
