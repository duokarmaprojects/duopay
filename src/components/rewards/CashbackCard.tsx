"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle, Loader2, Gift, ShieldCheck } from "lucide-react"
import { requestCashbackRedemption, CashbackSummary } from "@/actions/cashback"

interface CashbackCardProps {
  summary: CashbackSummary
  showHistoryLink?: boolean
  className?: string
}

export default function CashbackCard({
  summary,
  showHistoryLink = true,
  className = "",
}: CashbackCardProps) {
  const [isPending, startTransition] = useTransition()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentBalance, setCurrentBalance] = useState(summary.balancePaise)

  const thresholdPaise = summary.thresholdPaise
  const remainingPaise = Math.max(0, thresholdPaise - currentBalance)
  const isUnlocked = currentBalance >= thresholdPaise
  const progressPercent = Math.min(100, Math.round((currentBalance / thresholdPaise) * 100))
  const formattedBalance = `₹${(currentBalance / 100).toFixed(2)}`
  const formattedRemaining = `₹${(remainingPaise / 100).toFixed(2)}`

  const handleRedeem = () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    startTransition(async () => {
      try {
        const res = await requestCashbackRedemption()
        if (res.success) {
          setSuccessMessage(`Redemption of ${res.formattedAmount} submitted! Funds are processing to your UPI address.`)
          setCurrentBalance(0)
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to process redemption request")
      }
    })
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isUnlocked
          ? "bg-gradient-to-br from-amber-500/10 via-emerald-500/10 to-teal-500/10 border-amber-300/40 dark:border-amber-500/30"
          : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800"
      } p-5 shadow-sm ${className}`}
    >
      {/* Decorative Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/15 dark:bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isUnlocked
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isUnlocked ? <Gift size={18} /> : <Sparkles size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
                DuoPay Rewards
              </span>
              {isUnlocked && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                  Unlocked 🎉
                </span>
              )}
            </div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              Cashback Balance
            </h3>
          </div>
        </div>
      </div>

      {/* Balance Display */}
      <div className="mt-2 mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-gray-950 dark:text-white">
            {formattedBalance}
          </span>
          <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
            Cashback Earned
          </span>
        </div>
      </div>

      {/* Progress Bar & Threshold */}
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-gray-600 dark:text-zinc-300">
            {isUnlocked ? "🎉 Ready to redeem" : `${formattedRemaining} more to unlock redemption`}
          </span>
          <span className="text-gray-400 dark:text-zinc-500 font-mono text-[11px]">
            {formattedBalance} / ₹25.00
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 rounded-full ${
              isUnlocked
                ? "bg-gradient-to-r from-amber-500 to-emerald-500"
                : "bg-gradient-to-r from-amber-400 to-amber-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Active Processing Redemption Notice */}
      {summary.activeRedemption && !successMessage && (
        <div className="p-3 mb-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span>
            Redemption of ₹{(summary.activeRedemption.amountPaise / 100).toFixed(2)} is processing to your verified UPI.
          </span>
        </div>
      )}

      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-3 mb-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 mb-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Area */}
      <div className="flex flex-col gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
        {isUnlocked && !summary.activeRedemption && currentBalance > 0 && (
          <button
            onClick={handleRedeem}
            disabled={isPending || !summary.upiId}
            className="w-full py-2.5 px-4 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-gray-900 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processing Redemption...</span>
              </>
            ) : !summary.upiId ? (
              <span>Add UPI on Profile to Redeem</span>
            ) : (
              <>
                <Gift size={14} />
                <span>Redeem {formattedBalance} to UPI</span>
              </>
            )}
          </button>
        )}

        {showHistoryLink && (
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[11px] text-gray-500 dark:text-zinc-400">
              Earn ₹0.10–₹0.50 on every verified payment
            </span>
            <Link
              href="/rewards"
              className="font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 group shrink-0"
            >
              <span>View History</span>
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
