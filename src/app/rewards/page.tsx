import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  User,
  Users,
  Activity,
} from "lucide-react"
import { getCashbackSummary, getCashbackHistory } from "@/actions/cashback"
import CashbackCard from "@/components/rewards/CashbackCard"

export const metadata = {
  title: "Cashback & Rewards | DuoPay",
  description: "Earn instant cashback on every verified payment made with DuoPay.",
}

export default async function RewardsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const [summary, history] = await Promise.all([
    getCashbackSummary(),
    getCashbackHistory(50),
  ])

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-black min-h-screen pb-24 text-gray-900 dark:text-zinc-100">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-bold tracking-tight">DuoPay Cashback</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">Rewards & Ledger History</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-200/60 dark:border-amber-800/40">
          <Sparkles size={13} />
          <span>{summary.balanceRupees}</span>
        </div>
      </header>

      <main className="max-w-md w-full mx-auto px-4 py-6 space-y-6">
        {/* 1. Main Cashback Card */}
        <CashbackCard summary={summary} showHistoryLink={false} />

        {/* 2. Payout Destination Card */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Payout Destination
            </h2>
          </div>

          {summary.upiId ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white font-mono">
                    {summary.upiId}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                    Primary Payout Address
                  </p>
                </div>
              </div>
              <Link
                href="/profile"
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
              >
                Change
              </Link>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">Add your UPI ID to unlock payouts</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Redemption requires a UPI payment destination address.
                  </p>
                </div>
              </div>
              <Link
                href="/profile"
                className="self-end text-xs font-bold text-amber-700 dark:text-amber-300 underline"
              >
                Go to Profile to Add UPI →
              </Link>
            </div>
          )}
        </section>

        {/* 3. Cashback Policy & Scaling Tiers */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle size={16} className="text-gray-400 dark:text-zinc-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              How You Earn Cashback
            </h2>
          </div>

          <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
            Every genuine, gateway-verified payment automatically earns instant cashback deposited into your rewards ledger.
          </p>

          <div className="divide-y divide-gray-50 dark:divide-zinc-800/80 rounded-xl bg-gray-50 dark:bg-zinc-800/40 p-2.5 border border-gray-100 dark:border-zinc-800 text-xs">
            <div className="flex justify-between py-1.5 px-2">
              <span className="text-gray-500 dark:text-zinc-400">Under ₹100</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+₹0.10</span>
            </div>
            <div className="flex justify-between py-1.5 px-2">
              <span className="text-gray-500 dark:text-zinc-400">₹100 – ₹499</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+₹0.15</span>
            </div>
            <div className="flex justify-between py-1.5 px-2">
              <span className="text-gray-500 dark:text-zinc-400">₹500 – ₹999</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+₹0.25</span>
            </div>
            <div className="flex justify-between py-1.5 px-2">
              <span className="text-gray-500 dark:text-zinc-400">₹1,000 – ₹1,999</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+₹0.35</span>
            </div>
            <div className="flex justify-between py-1.5 px-2">
              <span className="text-gray-500 dark:text-zinc-400">₹2,000 & above</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+₹0.50</span>
            </div>
          </div>
        </section>

        {/* 4. Auditable Cashback Ledger History */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-400 dark:text-zinc-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                Reward History
              </h2>
            </div>
            <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">
              {history.length} records
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mb-3">
                <Sparkles size={24} />
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                No cashback activity yet
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-[240px]">
                Settle a balance using verified online UPI to earn your first instant cashback!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {history.map((item) => {
                const isDebit = item.amountPaise < 0
                return (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          item.type === "PAYMENT_CASHBACK"
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                            : item.type === "REDEMPTION"
                            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                            : item.type === "REVERSAL"
                            ? "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400"
                            : "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400"
                        }`}
                      >
                        {isDebit ? "-" : "+"}
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-gray-900 dark:text-white">
                          {item.type === "PAYMENT_CASHBACK"
                            ? "Payment Cashback"
                            : item.type === "REDEMPTION"
                            ? "Cashback Redemption"
                            : item.type === "REVERSAL"
                            ? "Cashback Reversal"
                            : "Adjustment"}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
                          {new Date(item.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {item.sourcePaymentId && ` · Payment #${item.sourcePaymentId.slice(-6)}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-bold text-xs font-mono ${
                          isDebit
                            ? "text-gray-900 dark:text-zinc-200"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {item.formattedAmount}
                      </span>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500 capitalize">
                        {item.status.toLowerCase()}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md mx-auto left-0 right-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800 flex justify-between px-6 pb-[env(safe-area-inset-bottom)] pt-2 z-20">
        <Link href="/" className="flex flex-col items-center p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
          <div className="p-1"><User size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Home</span>
        </Link>
        <Link href="/groups" className="flex flex-col items-center p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
          <div className="p-1"><Users size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Groups</span>
        </Link>
        <Link href="/activity" className="flex flex-col items-center p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
          <div className="p-1"><Activity size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Activity</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center p-2 text-amber-600 dark:text-amber-400">
          <div className="p-1"><Sparkles size={24} /></div>
          <span className="text-[10px] font-medium mt-1">Rewards</span>
        </Link>
      </nav>
    </div>
  )
}
