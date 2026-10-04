"use client";

import { useState } from "react";
import {
  Fingerprint,
  Lock,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useBiometricLock } from "./BiometricLockProvider";
import { LockTimeoutMinutes } from "@/lib/biometric/types";

interface BiometricSettingsCardProps {
  userName?: string;
}

export function BiometricSettingsCard({ userName }: BiometricSettingsCardProps) {
  const {
    isBiometricAvailable,
    label,
    isEnabled,
    timeoutMinutes,
    enableBiometric,
    disableBiometric,
    setTimeoutMinutes,
    lockAppNow,
  } = useBiometricLock();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleToggle = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isEnabled) {
      disableBiometric();
      setSuccessMsg("Biometric unlock has been disabled.");
      return;
    }

    setLoading(true);
    try {
      const result = await enableBiometric(userName || "DuoPay User");
      if (result.success) {
        setSuccessMsg(`${label} enabled successfully.`);
      } else if (result.cancelled) {
        setErrorMsg("Biometric prompt was cancelled.");
      } else {
        setErrorMsg(result.error || "Failed to enable biometric unlock.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mins = Number(e.target.value) as LockTimeoutMinutes;
    setTimeoutMinutes(mins);
    setSuccessMsg(`Lock timeout set to ${mins === 0 ? "immediately" : mins + " minutes"}.`);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 flex flex-col gap-4">
      {/* Header & Toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              <span>{label}</span>
              {isEnabled && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
              Use your device fingerprint or Face ID to securely unlock DuoPay without entering passwords.
            </p>
          </div>
        </div>

        {/* Real Biometric Toggle Switch */}
        {isBiometricAvailable ? (
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            disabled={loading}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 mt-1 ${
              isEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-zinc-700"
            }`}
          >
            <span className="sr-only">Toggle {label}</span>
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 shrink-0 mt-1">
            Unavailable
          </span>
        )}
      </div>

      {/* Hardware Not Available Warning */}
      {!isBiometricAvailable && (
        <div className="rounded-xl bg-gray-50 dark:bg-zinc-800/60 p-3 border border-gray-100 dark:border-zinc-800 flex items-start gap-2.5 text-xs text-gray-500 dark:text-zinc-400">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-700 dark:text-zinc-300">
              Biometric unlock isn&apos;t available on this device
            </p>
            <p className="mt-0.5 text-[11px]">
              Your browser or hardware does not report an enrolled platform authenticator (e.g. Touch ID, Face ID, Android Biometrics, or Windows Hello). You can continue using standard DuoPay login.
            </p>
          </div>
        </div>
      )}

      {/* In-Flight Spinner */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium py-1">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Communicating with device biometric sensor...</span>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-900/50 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Message */}
      {successMsg && !errorMsg && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Enabled Settings: Lock Timeout & Test Button */}
      {isEnabled && (
        <div className="pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
              <label
                htmlFor="lock-timeout-select"
                className="text-xs font-semibold text-gray-700 dark:text-zinc-300"
              >
                Lock After
              </label>
            </div>
            <div className="relative">
              <select
                id="lock-timeout-select"
                value={timeoutMinutes}
                onChange={handleTimeoutChange}
                className="appearance-none bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                <option value={0}>Immediately</option>
                <option value={1}>After 1 minute</option>
                <option value={5}>After 5 minutes (Default)</option>
                <option value={15}>After 15 minutes</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-gray-400 dark:text-zinc-500">
              Want to verify how app lock looks?
            </span>
            <button
              type="button"
              onClick={lockAppNow}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Lock Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
