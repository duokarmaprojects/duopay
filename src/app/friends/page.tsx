import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UserPlus, Users, Search, ChevronRight } from "lucide-react"
import { getFriendsList } from "@/actions/friend"
import FriendsListClient from "./FriendsListClient"
import BottomNav from "@/components/navigation/BottomNav"

export default async function FriendsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const friends = await getFriendsList()

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-zinc-100">Friends</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              {friends.length} {friends.length === 1 ? "friend" : "friends"} on DuoPay
            </p>
          </div>
        </div>

        <Link
          href="/friends/add"
          className="flex items-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-all shadow-xs"
        >
          <UserPlus size={14} />
          <span>Add Friend</span>
        </Link>
      </header>

      {/* Main Friends List */}
      <main className="max-w-md w-full mx-auto px-4 py-4 flex-1">
        <FriendsListClient initialFriends={friends} />
      </main>

      <BottomNav
        activeTab="home"
        userImage={session.user.image}
        userName={session.user.name}
      />
    </div>
  )
}
