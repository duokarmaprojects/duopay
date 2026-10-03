"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Phone, UserPlus, Search, Check, AlertCircle, Loader2, Sparkles } from "lucide-react"
import { matchContacts } from "@/actions/user"
import { addFriend } from "@/actions/friend"

export default function AddFriendClient({ currentUserId }: { currentUserId: string }) {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [matchedUser, setMatchedUser] = useState<any>(null)

  const handleSearchPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || phone.trim().length < 8) {
      setError("Please enter a valid phone number")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    setMatchedUser(null)

    try {
      const res = await matchContacts([{ name: "Contact", tel: phone.trim() }])
      if (res.registered.length > 0) {
        const found = res.registered[0]
        if (found.id === currentUserId) {
          setError("You cannot add yourself as a friend.")
        } else {
          setMatchedUser(found)
        }
      } else {
        setError("No registered DuoPay user found with this phone number. Share an invite link!")
      }
    } catch (err: any) {
      setError(err.message || "Failed to search phone number")
    } finally {
      setLoading(false)
    }
  }

  const handleAddConfirmed = async () => {
    if (!matchedUser) return
    setLoading(true)
    setError(null)

    try {
      await addFriend(matchedUser.id)
      setSuccess(`${matchedUser.name} has been added to your friends!`)
      setTimeout(() => {
        router.push(`/friends/${matchedUser.id}`)
      }, 1000)
    } catch (err: any) {
      setError(err.message || "Failed to add friend")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search by Phone Card */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Phone size={16} className="text-blue-600 dark:text-blue-400" />
            Find by Phone Number
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            Enter your friend's 10-digit mobile number registered on DuoPay.
          </p>
        </div>

        <form onSubmit={handleSearchPhone} className="space-y-3">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-mono">
              +91
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium text-gray-900 dark:text-zinc-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xs"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            <span>Search DuoPay</span>
          </button>
        </form>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900/40 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40 animate-in fade-in">
            <Check size={15} className="shrink-0 mt-0.5" />
            <p>{success}</p>
          </div>
        )}
      </div>

      {/* Matched User Result Card */}
      {matchedUser && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-blue-200/80 dark:border-blue-900/60 shadow-md space-y-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-base flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900">
              {matchedUser.image ? (
                <img
                  src={matchedUser.image.startsWith("data:") ? `/api/users/${matchedUser.id}/avatar` : matchedUser.image}
                  alt=""
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                matchedUser.name?.charAt(0) || "U"
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-gray-900 dark:text-zinc-100 truncate">
                {matchedUser.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-mono">
                {matchedUser.upiId ? `UPI: ${matchedUser.upiId}` : "Registered DuoPay User"}
              </p>
            </div>
          </div>

          <button
            onClick={handleAddConfirmed}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            <span>Confirm & Add Friend</span>
          </button>
        </div>
      )}
    </div>
  )
}
