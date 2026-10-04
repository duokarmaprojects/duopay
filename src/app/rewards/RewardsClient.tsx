"use client"

import { useState } from "react"

import { 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Banknote
} from "lucide-react"
import { CashbackSummary, requestCashbackRedemption } from "@/actions/cashback"

interface RewardsClientProps {
  summary: CashbackSummary
  history: { type: string, createdAt: Date | string, formattedAmount: string, status: string }[]
}

export default function RewardsClient({ summary, history }: RewardsClientProps) {
  const [activeTab, setActiveTab] = useState<"all" | "available" | "redeemed">("all")
  const [isPending, setIsPending] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const handleRedeem = async () => {
    setIsPending(true)
    setErrorMsg("")
    setSuccessMsg("")
    try {
      const res = await requestCashbackRedemption()
      if (res.success) {
        setSuccessMsg(`Redemption of ${res.formattedAmount} submitted!`)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg("Failed to process redemption")
      }
    } finally {
      setIsPending(false)
    }
  }

  const redeemedHistory = history.filter(h => h.type === "REDEMPTION")

  return (
    <div className="flex flex-col w-full max-w-md mx-auto">
      {/* 1. Top Hero Card */}
      <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-900 dark:from-zinc-900 dark:to-black text-white p-6 rounded-3xl shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider mb-1">Your Points</p>
        <h2 className="text-4xl font-extrabold tracking-tight mb-4 flex items-center gap-3">
          {summary.balanceRupees} <Sparkles size={24} className="text-amber-400" />
        </h2>
        
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">How you earn points</h3>
          <ul className="text-xs text-zinc-300 space-y-1.5">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <span>Settle a balance with a friend using DuoPay</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <span>Must use a verified online UPI payment method</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <span>Earn instant cashback (₹0.10–₹0.50) per payment</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 2. Tabs */}
      <div className="flex p-1 bg-gray-100 dark:bg-zinc-900 rounded-xl mb-6">
        <button 
          onClick={() => setActiveTab("all")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "all" ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm" : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-300"}`}
        >
          All
        </button>
        <button 
          onClick={() => setActiveTab("available")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "available" ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm" : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-300"}`}
        >
          Available
        </button>
        <button 
          onClick={() => setActiveTab("redeemed")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "redeemed" ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm" : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-300"}`}
        >
          Redeemed
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs font-medium text-red-800 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. Tab Content */}
      <div className="flex flex-col gap-4">
        {(activeTab === "all" || activeTab === "available") && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-zinc-100">UPI Cash Transfer</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Cash/value: {summary.balanceRupees}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-500">₹25.00 min</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Required</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-50 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${summary.canRedeem ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                  {summary.canRedeem ? 'Available to redeem' : `Needs ₹${(summary.remainingPaise / 100).toFixed(2)} more`}
                </span>
              </div>
              <button 
                onClick={handleRedeem}
                disabled={!summary.canRedeem || isPending}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-bold rounded-xl disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>Redeem &rarr;</span>
              </button>
            </div>
            {!summary.upiId && (
              <p className="text-[10px] text-red-500 mt-3 text-center">
                You must set up a UPI ID in your Profile first.
              </p>
            )}
          </div>
        )}

        {(activeTab === "all" || activeTab === "redeemed") && (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-3 px-2">Past Redemptions</h3>
            {redeemedHistory.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500 dark:text-zinc-400">
                No past redemptions found.
              </div>
            ) : (
              <div className="space-y-3">
                {redeemedHistory.map((item, idx) => (
                  <div key={idx} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900 dark:text-zinc-100">Redeemed to Bank</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{item.formattedAmount}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
