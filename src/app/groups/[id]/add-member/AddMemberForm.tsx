"use client"

import { useState, useTransition } from "react"
import ContactPicker from "./ContactPicker"
import ShareInviteLink from "./ShareInviteLink"
import { addMemberToGroup } from "@/actions/group"
import { useRouter } from "next/navigation"

export default function AddMemberForm({
  groupId,
  inviteToken,
}: {
  groupId: string
  inviteToken?: string
}) {
  const [phoneOrUpi, setPhoneOrUpi] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    startTransition(async () => {
      try {
        const result = await addMemberToGroup(groupId, phoneOrUpi)
        if (result?.error) {
          setError(result.error)
        } else {
          router.push(`/groups/${groupId}`)
        }
      } catch (err: any) {
        setError(err.message || "Failed to add member")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="phoneOrUpi" className="text-sm font-medium text-gray-700">
          Phone Number or UPI ID
        </label>
        <input
          id="phoneOrUpi"
          name="phoneOrUpi"
          type="text"
          value={phoneOrUpi}
          onChange={(e) => setPhoneOrUpi(e.target.value)}
          placeholder="Phone number or UPI ID"
          required
          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1 mb-2">
          Your friend must have a DuoPay account to be added.
        </p>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium uppercase">Or</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <div className="flex flex-col gap-3">
          <ContactPicker onSelectUser={(phone) => setPhoneOrUpi(phone)} groupId={groupId} />
          <ShareInviteLink groupId={groupId} inviteToken={inviteToken} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full bg-black text-white font-semibold py-3.5 px-4 rounded-xl active:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add to Group"}
      </button>
    </form>
  )
}
