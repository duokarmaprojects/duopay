import Link from "next/link"
import { ArrowLeft, ShieldAlert, CheckCircle, AlertTriangle, FileText, ArrowRight } from "lucide-react"

export const metadata = {
  title: "Referral Terms & Conditions | DuoPay",
  description: "Terms and conditions for DuoPay Refer & Earn program.",
}

export default function ReferralTermsPage() {
  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-zinc-950 pb-24 min-h-screen text-gray-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/referrals"
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
            aria-label="Back to Referrals"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold">Referral Terms &amp; Conditions</h1>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
        >
          Home
        </Link>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Title Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">
            <FileText size={16} />
            <span>Official Policy &amp; Rules</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100">
            DuoPay Refer &amp; Earn Program Terms
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">
            Please read these terms carefully before participating in the DuoPay Referral Program.
            By sharing your referral link or applying a referral code, you agree to these transparent conditions.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
            <span>Summary: Earn up to ₹21* per friend (₹11 on signup + ₹10 on 10 verified payments).</span>
          </div>
        </div>

        {/* Section 1: Reward Structure */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
            1. Reward Structure &amp; Milestones
          </h3>
          <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
            The DuoPay Refer &amp; Earn reward of up to <strong>₹21</strong> is unlocked in two distinct stages:
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700">
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ₹11
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-gray-900 dark:text-zinc-100">
                  Milestone 1: ₹11 Signup Reward
                </div>
                <div className="text-gray-500 dark:text-zinc-400 leading-normal">
                  Awarded to the referrer when an invited friend registers a new account using the referral link or code and completes their profile setup.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700">
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ₹10
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-gray-900 dark:text-zinc-100">
                  Milestone 2: ₹10 Completion Reward
                </div>
                <div className="text-gray-500 dark:text-zinc-400 leading-normal">
                  Awarded to the referrer after the referred friend successfully completes <strong>10 qualifying verified payments</strong> through DuoPay.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Qualifying Payment Definition */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600" />
            <span>2. Qualifying Payment Definition</span>
          </h3>
          <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
            To prevent fraud and maintain financial integrity, DuoPay strictly verifies all qualifying payments:
          </p>
          <ul className="text-xs text-gray-600 dark:text-zinc-400 space-y-2 list-disc list-inside leading-relaxed pl-1">
            <li>
              <strong>Qualifying:</strong> Payments with verified gateway/UPI reconciliation status (<code>WEBHOOK_VERIFIED</code> or <code>PROVIDER_VERIFIED</code>) with cryptographic signature validation.
            </li>
            <li>
              <strong>Non-Qualifying:</strong> Peer-to-peer manual confirmations (<code>MANUAL_CONFIRMED</code>), initiated payments, pending intents, cancelled or failed transactions do NOT count towards the 10-payment milestone.
            </li>
          </ul>
        </div>

        {/* Section 3: Attribution & Self-Referral */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-600" />
            <span>3. Single Attribution &amp; No Self-Referrals</span>
          </h3>
          <div className="text-xs text-gray-600 dark:text-zinc-400 space-y-2 leading-relaxed">
            <p>
              <strong>Single Attribution:</strong> Each user can be referred only once. Once a referral code is associated with an account, it cannot be changed, transferred, or reassigned to a different referrer.
            </p>
            <p>
              <strong>Strict Prohibition of Self-Referrals:</strong> You cannot refer yourself, whether by using alternative email addresses, virtual phone numbers, secondary profiles, or fake credentials. Self-referral attempts are automatically blocked and logged by our security audit system.
            </p>
          </div>
        </div>

        {/* Section 4: Duplicate Protection & Anti-Fraud */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600" />
            <span>4. Duplicate Protection &amp; Anti-Fraud Rules</span>
          </h3>
          <div className="text-xs text-gray-600 dark:text-zinc-400 space-y-2 leading-relaxed">
            <p>
              <strong>Duplicate Protection:</strong> Each referral milestone can only be rewarded once per referee. Re-joining or re-submitting codes will not generate duplicate rewards.
            </p>
            <p>
              <strong>Abuse &amp; Sybil Attacks:</strong> Any coordinated activity involving bot networks, fictitious expenses, circular peer-to-peer payments between dummy accounts, or synthetic device farms will result in immediate permanent disqualification and forfeiture of all accumulated balances.
            </p>
          </div>
        </div>

        {/* Section 5: Reversals & Refunds */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
            5. Reversals &amp; Refund Handling
          </h3>
          <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
            If a payment that contributed to a referee&apos;s 10-payment milestone is refunded, charged back, or reversed by a banking partner, DuoPay deducts the transaction from the qualifying payment count. If milestone rewards were granted based on transactions that are subsequently reversed, DuoPay reserves the right to debit the corresponding reward from the referrer&apos;s cashback ledger.
          </p>
        </div>

        {/* Section 6: Reward Availability & Redemption */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
            6. Reward Availability &amp; Payout Rules
          </h3>
          <div className="text-xs text-gray-600 dark:text-zinc-400 space-y-2 leading-relaxed">
            <p>
              All referral bonuses are credited directly to your unified <strong>DuoPay Cashback &amp; Rewards Balance</strong>.
            </p>
            <p>
              Redemptions are governed by the standard DuoPay Rewards policy:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Minimum payout threshold: <strong>₹25.00</strong> (2,500 paise).</li>
              <li>Payout destination: Transferred directly to your provider-verified UPI ID.</li>
              <li>Processing: Payout requests are processed securely with cryptographic idempotency.</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Link
            href="/referrals"
            className="flex-1 bg-black dark:bg-white text-white dark:text-black font-bold py-3.5 px-4 rounded-xl text-center text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>Go to Refer &amp; Earn</span>
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/"
            className="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-semibold py-3.5 px-4 rounded-xl text-center text-sm hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}
