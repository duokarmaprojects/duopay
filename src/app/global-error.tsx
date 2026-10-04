"use client";

import { useEffect } from "react";

export default function GlobalLayoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DuoPay Root Layout Error caught by global-error.tsx]:", error);
  }, [error]);

  const handleHardReload = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <html lang="en" className="dark">
      <body className="bg-[#09090b] text-[#f4f4f5] m-0 p-0 font-sans antialiased min-h-[100dvh] flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-[#121316] border border-[#27272a] rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-4 text-2xl font-bold">
            D
          </div>

          <h2 className="text-xl font-bold tracking-tight text-[#f4f4f5] mb-2">
            DuoPay Encountered an Issue
          </h2>

          <p className="text-xs text-[#a1a1aa] mb-6 leading-relaxed max-w-xs">
            We encountered a temporary initialization problem. Your data is protected and safe. Please tap below to resume.
          </p>

          <div className="w-full flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full bg-[#2563eb] hover:bg-[#3b82f6] text-white font-semibold py-3.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer border-none"
            >
              Retry
            </button>

            <button
              type="button"
              onClick={handleHardReload}
              className="w-full bg-[#18191d] hover:bg-[#202227] text-[#d4d4d8] font-medium py-3.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer border border-[#27272a]"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
