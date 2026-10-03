"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Gift,
  Share2,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { ReferralSummary } from "@/domain/referral"
import { applyReferralCode } from "@/actions/referral"

interface ReferralViewProps {
  summary: ReferralSummary
}

export default function ReferralView({ summary }: ReferralViewProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [inputCode, setInputCode] = useState("")
  const [isApplying, setIsApplying] = useState(false)
  const [applyMessage, setApplyMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const handleShare = async () => {
    const shareData = {
      title: "Split expenses easily with DuoPay",
      text: `Join me on DuoPay! Split expenses with friends seamlessly. Use my invite code: ${summary.referralCode}`,
      url: summary.referralLink,
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.log("Share failed:", err)
        }
      }
    }

    // Fallback to clipboard
    handleCopyLink()
  }

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(summary.referralLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(summary.referralCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    }
  }

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputCode.trim()) return

    setIsApplying(true)
    setApplyMessage(null)

    try {
      const res = await applyReferralCode(inputCode)
      if (res.success) {
        setApplyMessage({
          text: res.message || "Referral code applied successfully!",
          isError: false,
        })
        setInputCode("")
      } else {
        setApplyMessage({
          text: res.error || "Failed to apply referral code.",
          isError: true,
        })
      }
    } catch {
      setApplyMessage({
        text: "Network error. Please try again.",
        isError: true,
      })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 pb-24 min-h-screen text-gray-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold">Refer &amp; Earn</h1>
        </div>

        <Link
          href="/referrals/terms"
          className="text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors py-1 px-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Terms*
        </Link>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 space-y-6">
        {/* Hero Card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white p-6 shadow-lg shadow-amber-500/10">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-32 h-32 bg-black/10 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-inner">
              <Gift size={30} className="text-white" />
            </div>

            <h2 className="text-2xl font-black tracking-tight flex items-center gap-1.5">
              <span>Refer &amp; Earn ₹21</span>
              <Link
                href="/referrals/terms"
                className="text-amber-200 hover:text-white underline font-bold"
                aria-label="Terms and conditions apply"
                title="Terms and conditions apply"
              >
                *
              </Link>
            </h2>

            <p className="text-sm text-amber-100 mt-1 max-w-xs font-medium">
              Invite your friends to DuoPay and earn up to ₹21 for each verified referral.
            </p>

            {/* Reward Breakdown Cards */}
            <div className="grid grid-cols-2 gap-3 w-full mt-6">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 text-left">
                <div className="text-2xl font-black text-white">₹11</div>
                <div className="text-xs text-amber-100 font-medium mt-1 leading-snug">
                  When your friend joins
                </div>
              </div>

              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 text-left">
                <div className="text-2xl font-black text-white">₹10</div>
                <div className="text-xs text-amber-100 font-medium mt-1 leading-snug">
                  After 10 verified payments
                </div>
              </div>
            </div>

            {/* Total Indicator */}
            <div className="mt-4 inline-flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-3.5 py-1 rounded-full text-xs font-semibold text-amber-100">
              <Sparkles size={13} className="text-amber-300" />
              <span>Total: ₹21 per successful referral</span>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleShare}
              className="w-full mt-5 bg-white text-gray-950 font-bold py-3.5 px-4 rounded-xl shadow-md hover:bg-amber-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Share2 size={18} />
              <span>Invite Friends</span>
            </button>
          </div>
        </section>

        {/* Share Link & Code Card */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
            Your Referral Code &amp; Link
          </h3>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 dark:bg-zinc-800/80 px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 flex items-center justify-between min-w-0">
              <div className="truncate">
                <div className="text-[10px] text-gray-400 dark:text-zinc-500 font-semibold uppercase">
                  Referral Code
                </div>
                <div className="font-mono font-bold text-base text-gray-900 dark:text-zinc-100 tracking-wider">
                  {summary.referralCode}
                </div>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-2 text-gray-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg active:scale-90 transition-transform"
                title="Copy Code"
                aria-label="Copy referral code"
              >
                {copiedCode ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-zinc-100 px-4 py-3 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 shrink-0"
              aria-label="Copy referral link"
            >
              {copiedLink ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Server-Authoritative Stats Grid */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs">
            <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Total Earned</div>
            <div className="text-2xl font-black text-gray-900 dark:text-zinc-100 mt-1 font-mono">
              {summary.totalEarnedRupees}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <ShieldCheck size={12} />
              <span>Credited to rewards</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs">
            <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Pending Milestones</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {summary.pendingRewardRupees}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium mt-1 flex items-center gap-1">
              <Clock size={12} />
              <span>{summary.activeReferrals} in progress</span>
            </div>
          </div>
        </section>

        {/* Referral Progress & History */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              Referral Activity ({summary.totalReferrals})
            </h3>
            <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500">
              {summary.completedReferrals} Completed
            </span>
          </div>

          {summary.history.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-dashed border-gray-200 dark:border-zinc-700">
              <Gift size={32} className="mx-auto text-gray-300 dark:text-zinc-600 mb-2" />
              <div className="font-semibold text-sm text-gray-800 dark:text-zinc-200">
                No friends invited yet
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-xs mx-auto mt-1">
                Share your invite link with your friends to earn ₹11 immediately and ₹10 after their verified payments!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {summary.history.map((item) => (
                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-gray-600 dark:text-zinc-300">
                        {item.refereeName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                          {item.refereeName}
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-zinc-500">
                          Joined {item.joinedDate}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-sm text-gray-900 dark:text-zinc-100">
                        {item.earnedAmountRupees}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.isComplete
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        }`}
                      >
                        {item.isComplete ? (
                          <>
                            <CheckCircle2 size={10} />
                            <span>Completed</span>
                          </>
                        ) : (
                          <>
                            <Clock size={10} />
                            <span>In Progress</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Progress towards 10 verified payments */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-zinc-400">
                      <span>Verified Payments:</span>
                      <span className="font-mono font-medium">
                        {item.qualifyingPaymentCount} / {item.targetPaymentCount}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.isComplete ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                        style={{
                          width: `${(item.qualifyingPaymentCount / item.targetPaymentCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Have an Invite Code Form */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-xs">
          <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-1">
            Have a friend&apos;s invite code?
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">
            Enter your friend&apos;s code to connect your accounts and unlock rewards.
          </p>

          <form onSubmit={handleApplyCode} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. DUO..."
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              maxLength={16}
            />
            <button
              type="submit"
              disabled={isApplying || !inputCode.trim()}
              className="bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 active:scale-95 transition-all"
            >
              {isApplying ? "Applying..." : "Apply"}
            </button>
          </form>

          {applyMessage && (
            <div
              className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
                applyMessage.isError
                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
              }`}
            >
              {applyMessage.isError ? <AlertCircle size={14} className="shrink-0" /> : <CheckCircle2 size={14} className="shrink-0" />}
              <span>{applyMessage.text}</span>
            </div>
          )}
        </section>

        {/* Footer Terms Disclaimer */}
        <section className="text-center pt-2">
          <Link
            href="/referrals/terms"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors py-2 px-3 rounded-lg font-medium"
          >
            <span>*Terms &amp; conditions apply. Read full Referral Policy</span>
            <ChevronRight size={14} />
          </Link>
        </section>
      </main>
    </div>
  )
}
