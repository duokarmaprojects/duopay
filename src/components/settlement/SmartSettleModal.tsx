"use client"

import { useState } from "react"
import { Sparkles, ArrowRight, ShieldCheck, RefreshCw, X, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { formatPaise } from "@/domain/money"

export interface SmartPlanModalProps {
  isOpen: boolean
  onClose: () => void
  plan: {
    planId: string
    scope: "GLOBAL" | "GROUP"
    groupId?: string | null
    generatedAt: number
    totalOutstandingPaise: number
    originalTransactionCount: number
    optimizedTransactionCount: number
    transactions: Array<{
      fromUserId: string
      fromUserName: string
      toUserId: string
      toUserName: string
      toUserUpiId?: string | null
      amountPaise: number
      isUserDebtor: boolean
      isUserCreditor: boolean
    }>
  } | null
  isLoading?: boolean
  onRefresh?: () => void
}

export default function SmartSettleModal({
  isOpen,
  onClose,
  plan,
  isLoading,
  onRefresh,
}: SmartPlanModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Modal Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-1.5">
                Smart Settle
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Simplify Debts
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Optimized multi-party settlement plan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                aria-label="Refresh plan"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading || !plan ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw size={28} className="animate-spin text-amber-500" />
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                Calculating optimal settlement plan...
              </p>
            </div>
          ) : (
            <>
              {/* Optimization Metric Card */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                      Total Outstanding
                    </span>
                    <p className="text-xl font-bold text-gray-900 dark:text-zinc-100 mt-0.5">
                      {formatPaise(plan.totalOutstandingPaise)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                      Transactions Saved
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {plan.optimizedTransactionCount}
                      </span>
                      <span className="text-xs text-gray-400 line-through">
                        {plan.originalTransactionCount} total
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Recommended Transfers
                </h3>

                {plan.transactions.length === 0 ? (
                  <div className="py-10 text-center bg-gray-50 dark:bg-zinc-800/40 rounded-2xl border border-gray-100 dark:border-zinc-800">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                    <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                      All Settled Up!
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      No debts remain to simplify or settle.
                    </p>
                  </div>
                ) : (
                  plan.transactions.map((tx, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        tx.isUserDebtor
                          ? "bg-red-50/60 dark:bg-red-950/20 border-red-200/80 dark:border-red-900/40 shadow-xs"
                          : tx.isUserCreditor
                          ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40"
                          : "bg-gray-50/60 dark:bg-zinc-800/40 border-gray-100 dark:border-zinc-800"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-zinc-100">
                          <span className={tx.isUserDebtor ? "text-red-600 dark:text-red-400" : ""}>
                            {tx.isUserDebtor ? "You" : tx.fromUserName}
                          </span>
                          <ArrowRight size={12} className="text-gray-400 shrink-0" />
                          <span className={tx.isUserCreditor ? "text-emerald-600 dark:text-emerald-400" : ""}>
                            {tx.isUserCreditor ? "You" : tx.toUserName}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 font-mono">
                          {tx.toUserUpiId ? `UPI: ${tx.toUserUpiId}` : "UPI on file"}
                        </p>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-3">
                        <span className="text-sm font-extrabold text-gray-900 dark:text-zinc-100 font-mono">
                          {formatPaise(tx.amountPaise)}
                        </span>

                        {tx.isUserDebtor && (
                          <Link
                            href={`/settle?userId=${tx.toUserId}${
                              plan.groupId ? `&groupId=${plan.groupId}` : ""
                            }`}
                            onClick={onClose}
                            className="bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all shadow-xs"
                          >
                            Pay
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Zero-Trust Notice */}
              <div className="flex items-start gap-2 text-[11px] text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  Balances are calculated server-side in exact paise. Simplified payments are reviewed individually and processed through your trusted UPI provider.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
