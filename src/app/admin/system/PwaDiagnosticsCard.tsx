"use client";

import { useEffect, useState } from "react";
import {
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  Database,
  Wifi,
  WifiOff,
  Bell,
  RefreshCw,
} from "lucide-react";
import { APP_VERSION, BUILD_ID } from "@/lib/pwa/version";
import { getLocalDB } from "@/lib/db/local";

interface DiagnosticInfo {
  swRegistered: boolean;
  swController: boolean;
  swVersion: string | null;
  swBuildId: string | null;
  cacheNames: string[];
  isOnline: boolean;
  indexedDbAvailable: boolean;
  outboxPendingCount: number;
  pushSubscribed: boolean;
}

export function PwaDiagnosticsCard() {
  const [diag, setDiag] = useState<DiagnosticInfo>({
    swRegistered: false,
    swController: false,
    swVersion: null,
    swBuildId: null,
    cacheNames: [],
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    indexedDbAvailable: false,
    outboxPendingCount: 0,
    pushSubscribed: false,
  });
  const [loading, setLoading] = useState(true);

  const checkDiagnostics = async () => {
    setLoading(true);
    const info: DiagnosticInfo = {
      swRegistered: false,
      swController: false,
      swVersion: null,
      swBuildId: null,
      cacheNames: [],
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      indexedDbAvailable: false,
      outboxPendingCount: 0,
      pushSubscribed: false,
    };

    if (typeof window !== "undefined") {
      // 1. Service Worker & Cache
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          info.swRegistered = !!reg;
          info.swController = !!navigator.serviceWorker.controller;

          if (navigator.serviceWorker.controller) {
            const messageChannel = new MessageChannel();
            const versionPromise = new Promise<{ version: string; buildId: string }>((resolve) => {
              messageChannel.port1.onmessage = (event) => {
                resolve(event.data);
              };
              setTimeout(() => resolve({ version: "Timeout", buildId: "Timeout" }), 1000);
            });

            navigator.serviceWorker.controller.postMessage({ type: "GET_VERSION" }, [
              messageChannel.port2,
            ]);

            const swData = await versionPromise;
            info.swVersion = swData.version;
            info.swBuildId = swData.buildId;
          }

          if (reg) {
            const sub = await reg.pushManager.getSubscription().catch(() => null);
            info.pushSubscribed = !!sub;
          }
        } catch (e) {}
      }

      // 2. Cache namespaces
      if ("caches" in window) {
        try {
          info.cacheNames = await caches.keys();
        } catch (e) {}
      }

      // 3. IndexedDB & Outbox count
      try {
        const db = await getLocalDB();
        if (db) {
          info.indexedDbAvailable = true;
          const count = await db.count("outbox").catch(() => 0);
          info.outboxPendingCount = count;
        }
      } catch (e) {}
    }

    setDiag(info);
    setLoading(false);
  };

  useEffect(() => {
    checkDiagnostics();
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 col-span-1 md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-zinc-100">
          <Smartphone className="h-4 w-4 text-blue-500" />
          PWA & Update Lifecycle Diagnostics
        </h2>
        <button
          onClick={checkDiagnostics}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center gap-1 font-medium transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
        {/* App Version */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
          <span className="text-gray-500 dark:text-zinc-400 block mb-1">DuoPay App Version</span>
          <span className="font-mono font-semibold text-gray-900 dark:text-zinc-100 block">
            {APP_VERSION}
          </span>
          <span className="text-[10px] text-gray-400 font-mono">Build ID: {BUILD_ID}</span>
        </div>

        {/* SW Version */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
          <span className="text-gray-500 dark:text-zinc-400 block mb-1">Active Service Worker</span>
          <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-zinc-100">
            {diag.swController ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
                <CheckCircle className="h-3.5 w-3.5" /> {diag.swBuildId || "Active"}
              </span>
            ) : diag.swRegistered ? (
              <span className="flex items-center gap-1 text-amber-500 font-mono">
                <Clock className="h-3.5 w-3.5" /> Registered (Waiting)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400 font-mono">
                <XCircle className="h-3.5 w-3.5" /> None
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 block mt-0.5">
            {diag.swVersion ? `SW Version: ${diag.swVersion}` : "No active controller"}
          </span>
        </div>

        {/* Network & Connectivity */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
          <span className="text-gray-500 dark:text-zinc-400 block mb-1">Network State</span>
          <div className="flex items-center gap-1.5 font-semibold">
            {diag.isOnline ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Wifi className="h-3.5 w-3.5" /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500">
                <WifiOff className="h-3.5 w-3.5" /> Offline
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 block mt-0.5">
            Push Notifications: {diag.pushSubscribed ? "Subscribed" : "Unsubscribed"}
          </span>
        </div>

        {/* IndexedDB & Outbox */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
          <span className="text-gray-500 dark:text-zinc-400 block mb-1">Offline IndexedDB Storage</span>
          <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-zinc-100">
            <Database className="h-3.5 w-3.5 text-blue-500" />
            <span>{diag.indexedDbAvailable ? "duopay-local v1" : "Unavailable"}</span>
          </div>
          <span className="text-[10px] text-gray-400 block mt-0.5">
            Pending Outbox Items: {diag.outboxPendingCount}
          </span>
        </div>

        {/* Active Caches */}
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800 sm:col-span-2">
          <span className="text-gray-500 dark:text-zinc-400 block mb-1">
            Active Cache Namespaces ({diag.cacheNames.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {diag.cacheNames.length > 0 ? (
              diag.cacheNames.map((name) => (
                <span
                  key={name}
                  className="font-mono bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 px-2 py-0.5 rounded text-[11px] text-gray-700 dark:text-zinc-300"
                >
                  {name}
                </span>
              ))
            ) : (
              <span className="text-gray-400 italic">No caches allocated</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
