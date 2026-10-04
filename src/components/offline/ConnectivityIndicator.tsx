"use client";

import { useEffect, useState } from "react";
import { WifiOff, Loader2 } from "lucide-react";

export type ConnectionState = "ONLINE" | "SLOW" | "OFFLINE" | "SYNCING";

export function ConnectivityIndicator() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("ONLINE");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOnlineStatus = () => {
      setConnectionState(navigator.onLine ? "ONLINE" : "OFFLINE");
    };

    window.addEventListener("online", () => {
      setConnectionState("SYNCING");
      // Simulate sync duration or hook into actual SyncEngine
      setTimeout(() => setConnectionState("ONLINE"), 2000);
    });
    
    window.addEventListener("offline", updateOnlineStatus);
    
    // Initial check
    updateOnlineStatus();

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  if (connectionState === "ONLINE") return null;

  return (
    <div className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-50 flex justify-center pointer-events-none mt-2">
      <div className="bg-gray-900/90 dark:bg-black/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm animate-in slide-in-from-top-2 fade-in">
        {connectionState === "OFFLINE" && (
          <>
            <WifiOff size={14} className="text-gray-400" />
            <span>You're offline — changes will sync when you're back</span>
          </>
        )}
        {connectionState === "SYNCING" && (
          <>
            <Loader2 size={14} className="animate-spin text-blue-400" />
            <span>Syncing...</span>
          </>
        )}
        {connectionState === "SLOW" && (
          <>
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Slow connection</span>
          </>
        )}
      </div>
    </div>
  );
}
