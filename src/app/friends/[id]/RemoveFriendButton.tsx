"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserMinus, Loader2 } from "lucide-react"
import { removeFriend } from "@/actions/friend"

export default function RemoveFriendButton({ friendId }: { friendId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleRemove = async () => {
    if (!confirm("Are you sure you want to remove this friend? Existing shared expenses and settlements will remain preserved.")) {
      return
    }

    setLoading(true)
    try {
      await removeFriend(friendId)
      router.push("/friends")
    } catch (err: any) {
      alert(err.message || "Failed to remove friend")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
      title="Remove Friend"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
    </button>
  )
}
