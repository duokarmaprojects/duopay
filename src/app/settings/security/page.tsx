import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Smartphone, CheckCircle } from "lucide-react";
import { BiometricSettingsCard } from "@/components/biometric/BiometricSettingsCard";

export const metadata = {
  title: "Security - DuoPay",
};

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex flex-col flex-1 bg-gray-50 dark:bg-black min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-950 px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-900 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg">
              <Shield size={16} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">
              Security & Biometrics
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
            Device Authentication
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Configure local device lock to protect your financial balances and sensitive transactions.
          </p>
        </div>

        {/* 1. Biometric Unlock Card */}
        <BiometricSettingsCard userName={session.user.name || "DuoPay User"} />

        {/* 2. Authentication & Session Details */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-zinc-100">
                Primary Authentication
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Server-verified credentials
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs border-t border-gray-100 dark:border-zinc-800/80 pt-3">
            <div className="flex items-center justify-between py-1 text-gray-600 dark:text-zinc-400">
              <span>Authentication Method</span>
              <span className="font-semibold text-gray-900 dark:text-zinc-100">
                Phone Number
              </span>
            </div>
            <div className="flex items-center justify-between py-1 text-gray-600 dark:text-zinc-400">
              <span>Verified Identity</span>
              <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">
                {(session.user as any).phone || "Verified"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 text-gray-600 dark:text-zinc-400">
              <span>Server-Authoritative Ledger</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Enforced
              </span>
            </div>
          </div>
        </div>

        {/* 3. Security Architecture Notice */}
        <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-xs text-gray-600 dark:text-zinc-400 leading-relaxed flex items-start gap-3">
          <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-gray-900 dark:text-zinc-200 block mb-0.5">
              Zero-Trust Financial Protection
            </span>
            Biometric credentials never leave your physical device and are never sent to DuoPay servers. Biometric unlock safeguards the app interface locally; all ledger state, invites, and settlements remain cryptographically enforced on the server.
          </div>
        </div>
      </div>
    </div>
  );
}
