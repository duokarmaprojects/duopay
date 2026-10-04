"use client";

import { Lock } from "lucide-react";

/**
 * Renders an opaque privacy shield when the application is placed into the background
 * or the OS app switcher. This prevents sensitive financial information from being
 * previewed in multitasking screenshots on Android and iOS.
 */
export function AppSwitcherPrivacyShield() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[999999] bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-6 select-none pointer-events-auto"
    >
      <div className="w-16 h-16 rounded-3xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-2xl shadow-xl mb-4">
        D
      </div>
      <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100 tracking-tight">
        DuoPay
      </h2>
      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5" />
        <span>Privacy Protection Active</span>
      </p>
    </div>
  );
}
