"use client"

import { useTransition } from "react"
import { LogOut, Trash2 } from "lucide-react"
import { deleteGroup, leaveGroup } from "@/actions/group"

export default function GroupActions({ groupId, isCreator }: { groupId: string, isCreator: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="mt-8 px-4">
      {isCreator ? (
        <button
          onClick={() => {
            if (confirm("Are you sure you want to delete this group? All expenses and members will be removed. This cannot be undone.")) {
              startTransition(async () => {
                try {
                  await deleteGroup(groupId)
                } catch (e: any) {
                  alert(e.message || "Failed to delete group")
                }
              })
            }
          }}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-red-100 bg-white text-red-600 font-bold active:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 size={18} />
          Delete Group
        </button>
      ) : (
        <button
          onClick={() => {
            if (confirm("Are you sure you want to leave this group?")) {
              startTransition(async () => {
                try {
                  await leaveGroup(groupId)
                } catch (e: any) {
                  alert(e.message || "Failed to leave group")
                }
              })
            }
          }}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-red-100 bg-white text-red-600 font-bold active:bg-red-50 transition-colors disabled:opacity-50"
        >
          <LogOut size={18} />
          Leave Group
        </button>
      )}
    </div>
  )
}
