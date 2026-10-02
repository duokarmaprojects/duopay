"use client"

import { useState } from "react"
import { Share } from "lucide-react"

export default function ShareInviteLink({ groupId }: { groupId: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    // Generate absolute URL for the invite link
    const inviteUrl = `${window.location.origin}/groups/join/${groupId}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my DuoPay group',
          text: 'Tap the link to join my group and split expenses on DuoPay!',
          url: inviteUrl,
        })
        return
      } catch (err: any) {
        // Fallback to clipboard if share was cancelled or failed
        if (err.name !== 'AbortError') {
          copyToClipboard(inviteUrl)
        }
      }
    } else {
      copyToClipboard(inviteUrl)
    }
  }

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-900 font-semibold rounded-xl active:bg-gray-200 transition-colors"
    >
      <Share size={18} />
      {copied ? "Link Copied!" : "Share Invite Link"}
    </button>
  )
}
