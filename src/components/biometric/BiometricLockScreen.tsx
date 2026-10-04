"use client";

import { useState } from "react";
import { Lock, Fingerprint, ShieldAlert, LogOut, ArrowRight, Loader2 } from "lucide-react";

interface BiometricLockScreenProps {
  label: string; // e.g., "Fingerprint / Face Unlock", "Face ID / Touch ID"
  onUnlock: () => Promise<boolean>;
  onFallbackLogin: () => void;
  error?: string | null;
}

export function BiometricLockScreen({
  label,
  onUnlock,
  onFallbackLogin,
  error: initialError,
}: BiometricLockScreenProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError || null);

  const handlePrompt = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const success = await onUnlock();
      if (!success) {
        setErrorMsg("Biometric verification did not succeed. Please try again.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Biometric unlock failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-white dark:bg-black text-gray-900 dark:text-zinc-100 flex flex-col justify-between items-center p-6 animate-in fade-in duration-300">
      {/* Top Branding */}
      <div className="pt-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-xl shadow-lg mb-2">
          D
        </div>
        <span className="text-sm font-semibold tracking-wide text-gray-500 dark:text-zinc-400">
          DuoPay
        </span>
      </div>

      {/* Center Lock Card */}
      <div className="w-full max-w-sm flex flex-col items-center text-center px-4">
        <div className="w-20 h-20 rounded-3xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 shadow-sm border border-blue-500/20">
          <Lock className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-2 text-gray-900 dark:text-zinc-100">
          Unlock DuoPay
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8 max-w-xs leading-relaxed">
          Use your device biometric to continue safely into your financial account.
        </p>

        {errorMsg && (
          <div className="w-full mb-6 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-left text-xs text-red-600 dark:text-red-400">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Authentication Notice</span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handlePrompt}
          disabled={loading}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Fingerprint className="w-5 h-5" />
          )}
          <span>{loading ? "Verifying..." : `Use ${label}`}</span>
        </button>
      </div>

      {/* Bottom Fallback */}
      <div className="pb-8 w-full max-w-sm flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onFallbackLogin}
          className="text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Use Normal DuoPay Login</span>
        </button>
        <span className="text-[10px] text-gray-400 dark:text-zinc-600">
          Financial data is securely locked on this device
        </span>
      </div>
    </div>
  );
}
