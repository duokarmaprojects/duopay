"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, X, AlertCircle, Home } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  DeploymentRecoveryBoundary,
  isChunkLoadError,
} from "./DeploymentRecoveryBoundary";

const RECOVERY_GUARD_KEY = "duopay_recovery_guard";
const RECOVERY_WINDOW_MS = 45000; // 45 seconds

interface RecoveryState {
  count: number;
  time: number;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showRecoveryFallback, setShowRecoveryFallback] = useState(false);

  // Trigger safe single-reload recovery without infinite loops
  const triggerChunkRecovery = useCallback((errorSource: string) => {
    if (typeof window === "undefined") return;

    console.warn(`[PWA Recovery] Triggered from: ${errorSource}`);

    let recoveryState: RecoveryState = { count: 0, time: 0 };
    try {
      const stored = sessionStorage.getItem(RECOVERY_GUARD_KEY);
      if (stored) {
        recoveryState = JSON.parse(stored);
      }
    } catch (e) {}

    const now = Date.now();
    const isWithinWindow = now - recoveryState.time < RECOVERY_WINDOW_MS;

    if (isWithinWindow && recoveryState.count >= 1) {
      // Finite Recovery Guard: We already attempted an automated reload and error persisted.
      // Prevent infinite reload loop! Show user recovery UI instead.
      console.error("[PWA Recovery] Multiple chunk errors within window. Halting automated reload.");
      setShowRecoveryFallback(true);
      return;
    }

    // First attempt: Record attempt in sessionStorage
    try {
      sessionStorage.setItem(
        RECOVERY_GUARD_KEY,
        JSON.stringify({ count: 1, time: now })
      );
    } catch (e) {}

    // Tell any waiting service worker to take over immediately
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }

    // Clean up only DuoPay static and runtime caches (NEVER touch IndexedDB or outbox!)
    if ("caches" in window) {
      caches.keys().then((keys) => {
        const duopayCaches = keys.filter((k) => k.startsWith("duopay-"));
        return Promise.all(duopayCaches.map((k) => caches.delete(k)));
      }).catch(() => {});
    }

    // Perform controlled single reload
    setTimeout(() => {
      window.location.reload();
    }, 150);
  }, [waitingWorker]);

  useEffect(() => {
    // 1. Capacitor Native Shell Isolation
    // If running in a native Android or iOS Capacitor webview, bypass web service worker
    if (Capacitor.isNativePlatform()) {
      return;
    }

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let isRefreshing = false;

    // 2. Controller Change Handler
    const handleControllerChange = () => {
      if (!isRefreshing) {
        isRefreshing = true;
        console.log("[PWA Update] New service worker active. Reloading into consistent version...");
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // 3. Register Service Worker with Scope
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[PWA Update] Service worker registered with scope:", registration.scope);

        // If an updated worker is already waiting
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Listen for new service worker installation
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[PWA Update] New service worker installed and waiting.");
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });

        // Check for updates when app regains visibility or focus
        const checkForUpdates = () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        };

        document.addEventListener("visibilitychange", checkForUpdates);
        window.addEventListener("focus", checkForUpdates);
      })
      .catch((err) => {
        console.warn("[PWA Update] Service worker registration skipped:", err);
      });

    // 4. Global Error Listeners for Chunk / Module Load Failures
    const handleWindowError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error || event.message)) {
        event.preventDefault();
        triggerChunkRecovery(`window.onerror: ${event.message}`);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        triggerChunkRecovery(`unhandledrejection: ${event.reason}`);
      }
    };

    const handleCustomChunkError = (event: Event) => {
      const customEvent = event as CustomEvent;
      triggerChunkRecovery(`custom boundary: ${customEvent.detail?.error}`);
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("duopay:chunk-load-error", handleCustomChunkError);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("duopay:chunk-load-error", handleCustomChunkError);
    };
  }, [triggerChunkRecovery]);

  const handleUpdate = () => {
    if (waitingWorker) {
      console.log("[PWA Update] User accepted update. Posting SKIP_WAITING...");
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdate(false);
    }
  };

  const handleManualRecoveryReload = () => {
    try {
      sessionStorage.removeItem(RECOVERY_GUARD_KEY);
    } catch (e) {}
    window.location.reload();
  };

  const handleGoHome = () => {
    try {
      sessionStorage.removeItem(RECOVERY_GUARD_KEY);
    } catch (e) {}
    window.location.href = "/";
  };

  return (
    <DeploymentRecoveryBoundary>
      {children}

      {/* Persistent Chunk Error Recovery Screen (Prevents White-Screen Crash) */}
      {showRecoveryFallback && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-gray-950/90 backdrop-blur-md text-zinc-100 animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold tracking-tight mb-2">
              DuoPay Update Ready
            </h2>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              DuoPay has received a new deployment. Please tap below to refresh the application. Your pending offline transactions and local data are fully preserved.
            </p>
            <div className="w-full space-y-2.5">
              <button
                type="button"
                onClick={handleManualRecoveryReload}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 active:scale-98 shadow-sm"
              >
                <RefreshCw size={14} />
                <span>Reload DuoPay</span>
              </button>
              <button
                type="button"
                onClick={handleGoHome}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Home size={14} />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-Blocking "New Version Available" Banner */}
      {showUpdate && !showRecoveryFallback && (
        <div className="fixed bottom-20 left-4 right-4 max-w-sm mx-auto z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900 dark:bg-zinc-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-gray-800 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <RefreshCw size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold">New version available</p>
                <p className="text-[11px] text-gray-400">Update now for the latest features</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleUpdate}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors active:scale-95 shadow-sm"
              >
                Update
              </button>
              <button
                type="button"
                onClick={() => setShowUpdate(false)}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                aria-label="Dismiss update"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </DeploymentRecoveryBoundary>
  );
}
