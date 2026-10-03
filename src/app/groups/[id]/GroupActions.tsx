"use client"

import { useTransition, useState } from "react"
import { LogOut, Trash2, Loader2, AlertCircle } from "lucide-react"
import { deleteGroup, leaveGroup } from "@/actions/group"
import { useRouter } from "next/navigation"

export default function GroupActions({ groupId, isCreator }: { groupId: string, isCreator: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  return (
    <div className="mt-8 px-4 flex flex-col gap-4">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start gap-2">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {isCreator ? (
        <button
          onClick={() => {
            setError(null)
            startTransition(async () => {
              try {
                const res = await deleteGroup(groupId)
                if (res?.error) {
                  setError(res.error)
                } else if (res?.success) {
                  router.push('/groups')
                }
              } catch (e: any) {
                setError(e.message || "Failed to delete group")
              }
            })
          }}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-red-100 dark:border-red-900/50 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 font-bold active:bg-red-50 dark:active:bg-red-950/30 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          {isPending ? "Deleting..." : "Delete Group"}
        </button>
      ) : (
        <button
          onClick={() => {
            setError(null)
            startTransition(async () => {
              try {
                await leaveGroup(groupId)
              } catch (e: any) {
                setError(e.message || "Failed to leave group")
              }
            })
          }}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-red-100 dark:border-red-900/50 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 font-bold active:bg-red-50 dark:active:bg-red-950/30 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
          {isPending ? "Leaving..." : "Leave Group"}
        </button>
      )}
    </div>
  )
}
