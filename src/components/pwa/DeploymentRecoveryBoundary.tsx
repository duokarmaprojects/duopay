"use client";

import React, { Component, ReactNode } from "react";
import { RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasChunkError: boolean;
  errorMessage: string;
}

/**
 * Deterministic detection of Next.js chunk load errors and dynamic import failures.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /Loading chunk [\d\w]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    (/Failed to load resource/i.test(msg) && /_next\/static\/chunks/i.test(msg)) ||
    /_next\/static\/chunks/i.test(msg)
  );
}

/**
 * Production error boundary that traps chunk load errors and prevents white-screen crashes.
 */
export class DeploymentRecoveryBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasChunkError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): State | null {
    if (isChunkLoadError(error)) {
      return {
        hasChunkError: true,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
    return null;
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) {
      console.warn("[PWA Recovery] Chunk load error caught by boundary:", error);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("duopay:chunk-load-error", { detail: { error } })
        );
      }
    }
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("duopay_recovery_guard");
      } catch (e) {}
      window.location.reload();
    }
  };

  handleGoHome = () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("duopay_recovery_guard");
      } catch (e) {}
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasChunkError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
          <div className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <RefreshCw className="w-7 h-7 animate-spin duration-1000" />
            </div>
            <h2 className="text-lg font-bold tracking-tight mb-2">
              DuoPay Update Required
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-6 leading-relaxed">
              A newer version of DuoPay has been deployed. Please reload the app to complete the update. Your offline records and local data are completely safe.
            </p>
            <div className="w-full space-y-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 active:scale-98 shadow-sm"
              >
                <RefreshCw size={14} />
                <span>Reload DuoPay</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 font-medium py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Home size={14} />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
