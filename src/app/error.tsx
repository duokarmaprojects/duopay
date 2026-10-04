"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DuoPay Route Error caught by error.tsx]:", error);
  }, [error]);

  const handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-[#09090b] text-zinc-100 select-none">
      <div className="max-w-sm w-full bg-[#121316] border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-2">
          Something went wrong
        </h2>

        <p className="text-xs text-zinc-400 mb-6 leading-relaxed max-w-xs">
          An unexpected interface issue occurred. Your balances, groups, and offline transactions are completely safe.
        </p>

        <div className="w-full space-y-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-4 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 active:scale-98 shadow-md cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>

          <button
            type="button"
            onClick={handleGoHome}
            className="w-full bg-[#18191d] hover:bg-[#202227] text-zinc-300 font-medium py-3.5 px-4 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer active:scale-98"
          >
            <Home size={14} />
            <span>Return to Home</span>
          </button>
        </div>

        {error?.digest && (
          <p className="text-[10px] font-mono text-zinc-600 mt-5">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
