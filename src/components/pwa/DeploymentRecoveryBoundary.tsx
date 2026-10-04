"use client";

import React, { Component, ReactNode } from "react";
import { RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasChunkError: boolean;
  hasGeneralError: boolean;
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
    this.state = { hasChunkError: false, hasGeneralError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const isChunk = isChunkLoadError(error);
    return {
      hasChunkError: isChunk,
      hasGeneralError: !isChunk,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) {
      console.warn("[PWA Recovery] Chunk load error caught by boundary:", error);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("duopay:chunk-load-error", { detail: { error } })
        );
      }
    } else {
      console.error("[PWA Recovery] Runtime error caught by DeploymentRecoveryBoundary:", error);
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
        <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-[#09090b] text-zinc-100">
          <div className="max-w-sm w-full bg-[#121316] border border-zinc-800 rounded-3xl p-6 shadow-xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-4">
              <RefreshCw className="w-7 h-7 animate-spin duration-1000" />
            </div>
            <h2 className="text-lg font-bold tracking-tight mb-2 text-zinc-100">
              DuoPay Update Required
            </h2>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              A newer version of DuoPay has been deployed. Please reload the app to complete the update. Your offline records and local data are completely safe.
            </p>
            <div className="w-full space-y-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 active:scale-98 shadow-sm cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload DuoPay</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full bg-[#18191d] hover:bg-[#202227] text-zinc-300 font-medium py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer active:scale-98"
              >
                <Home size={14} />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (this.state.hasGeneralError) {
      return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-[#09090b] text-zinc-100">
          <div className="max-w-sm w-full bg-[#121316] border border-zinc-800 rounded-3xl p-6 shadow-xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-4">
              <RefreshCw className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold tracking-tight mb-2 text-zinc-100">
              Interface Restored
            </h2>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              DuoPay encountered an unexpected display issue. Your financial records and balance states are fully intact.
            </p>
            <div className="w-full space-y-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 active:scale-98 shadow-sm cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload Application</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full bg-[#18191d] hover:bg-[#202227] text-zinc-300 font-medium py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer active:scale-98"
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
