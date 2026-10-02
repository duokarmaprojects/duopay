"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;

    // Reload once when the new service worker takes over
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // If an updated worker is already waiting
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Listen for new updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });

        // Check for updates when app regains visibility
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration skipped:", err);
      });
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdate(false);
    }
  };

  return (
    <>
      {children}
      {showUpdate && (
        <div className="fixed bottom-20 left-4 right-4 max-w-sm mx-auto z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-gray-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <RefreshCw size={16} className="text-white" />
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
                className="bg-white text-gray-900 hover:bg-gray-100 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors active:scale-95 shadow-sm"
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
    </>
  );
}
