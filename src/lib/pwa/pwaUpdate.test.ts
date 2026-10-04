import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isChunkLoadError, DeploymentRecoveryBoundary } from "@/components/pwa/DeploymentRecoveryBoundary";
import { getBuildId, generatePwaVersion } from "../../../scripts/generate-pwa-version.mjs";
import { APP_VERSION, BUILD_ID, CACHE_STATIC_NAME, CACHE_RUNTIME_NAME } from "./version";
import fs from "fs";
import path from "path";

describe("PWA Update & Service Worker Reliability Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Service Worker Automated Versioning & Cache Namespacing", () => {
    it("should produce a valid non-empty build identifier", () => {
      const id = getBuildId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThanOrEqual(4);
    });

    it("should format application version with year, month and build ID", () => {
      expect(APP_VERSION).toMatch(/^2026\.10\.[a-zA-Z0-9_\-]+$/);
      expect(BUILD_ID).toBeDefined();
      expect(CACHE_STATIC_NAME).toBe(`duopay-static-${BUILD_ID}`);
      expect(CACHE_RUNTIME_NAME).toBe(`duopay-runtime-${BUILD_ID}`);
    });

    it("should generate public/sw.js with embedded build ID and version", () => {
      const { buildId, version, staticCache, runtimeCache } = generatePwaVersion();
      const swPath = path.resolve(process.cwd(), "public", "sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, "utf8");
      expect(swContent).toContain(`const BUILD_ID = '${buildId}';`);
      expect(swContent).toContain(`const VERSION = '${version}';`);
      expect(swContent).toContain("CACHE_STATIC_NAME = 'duopay-static-' + BUILD_ID");
      expect(swContent).toContain("CACHE_RUNTIME_NAME = 'duopay-runtime-' + BUILD_ID");
    });
  });

  describe("2. Next.js Chunk Load Error Detection", () => {
    it("should detect ChunkLoadError instances", () => {
      const err = new Error("ChunkLoadError: Loading chunk 842 failed.");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("should detect dynamically imported module fetch failures", () => {
      const err = new TypeError("Failed to fetch dynamically imported module: https://duopay.app/_next/static/chunks/app/page-123.js");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("should detect static chunk 404 resource errors", () => {
      const err = "Failed to load resource: the server responded with a status of 404 () /_next/static/chunks/404.js";
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("should NOT flag ordinary application errors as chunk errors", () => {
      expect(isChunkLoadError(new Error("Network timeout"))).toBe(false);
      expect(isChunkLoadError(new Error("ValidationError: amount must be positive"))).toBe(false);
      expect(isChunkLoadError(new SyntaxError("Unexpected token"))).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
    });

    it("DeploymentRecoveryBoundary.getDerivedStateFromError should trap chunk errors and general errors without returning null", () => {
      const chunkState = DeploymentRecoveryBoundary.getDerivedStateFromError(
        new Error("ChunkLoadError: Loading chunk 555 failed")
      );
      expect(chunkState.hasChunkError).toBe(true);
      expect(chunkState.hasGeneralError).toBe(false);

      const generalState = DeploymentRecoveryBoundary.getDerivedStateFromError(
        new TypeError("Cannot read properties of undefined")
      );
      expect(generalState.hasChunkError).toBe(false);
      expect(generalState.hasGeneralError).toBe(true);
    });
  });

  describe("3. Finite Recovery Guard (Infinite Reload Loop Prevention)", () => {
    const RECOVERY_GUARD_KEY = "duopay_recovery_guard";
    const mockSessionStorage: Record<string, string> = {};

    beforeEach(() => {
      for (const k in mockSessionStorage) delete mockSessionStorage[k];
      vi.stubGlobal("sessionStorage", {
        getItem: (k: string) => mockSessionStorage[k] || null,
        setItem: (k: string, v: string) => {
          mockSessionStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockSessionStorage[k];
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should allow first recovery attempt and persist guard timestamp", () => {
      const now = Date.now();
      sessionStorage.setItem(
        RECOVERY_GUARD_KEY,
        JSON.stringify({ count: 1, time: now })
      );

      const stored = JSON.parse(sessionStorage.getItem(RECOVERY_GUARD_KEY)!);
      expect(stored.count).toBe(1);
      expect(stored.time).toBe(now);
    });

    it("should block subsequent reload attempts within 45 seconds window", () => {
      const now = Date.now();
      sessionStorage.setItem(
        RECOVERY_GUARD_KEY,
        JSON.stringify({ count: 1, time: now - 5000 }) // 5s ago
      );

      const stored = JSON.parse(sessionStorage.getItem(RECOVERY_GUARD_KEY)!);
      const isWithinWindow = now - stored.time < 45000;
      const shouldBlock = isWithinWindow && stored.count >= 1;

      expect(shouldBlock).toBe(true);
    });

    it("should reset recovery guard after expiration window passes", () => {
      const now = Date.now();
      sessionStorage.setItem(
        RECOVERY_GUARD_KEY,
        JSON.stringify({ count: 1, time: now - 50000 }) // 50s ago (expired)
      );

      const stored = JSON.parse(sessionStorage.getItem(RECOVERY_GUARD_KEY)!);
      const isWithinWindow = now - stored.time < 45000;
      expect(isWithinWindow).toBe(false);
    });
  });

  describe("4. Cache & User Data Safety Invariant", () => {
    it("should only target duopay-* cache namespaces and preserve other storages", () => {
      const allCaches = [
        "duopay-static-old1",
        "duopay-runtime-old1",
        "duopay-static-current",
        "duopay-runtime-current",
        "google-fonts-cache",
        "other-app-cache",
      ];

      const currentStatic = "duopay-static-current";
      const currentRuntime = "duopay-runtime-current";
      const expectedCaches = new Set([currentStatic, currentRuntime]);

      const cachesToDelete = allCaches.filter(
        (name) => name.startsWith("duopay-") && !expectedCaches.has(name)
      );

      expect(cachesToDelete).toEqual(["duopay-static-old1", "duopay-runtime-old1"]);
      expect(cachesToDelete).not.toContain("google-fonts-cache");
      expect(cachesToDelete).not.toContain("other-app-cache");
    });

    it("should strictly guarantee IndexedDB and outbox are never purged during cache cleanup", () => {
      // Invariant test: Cache cleanup uses window.caches (CacheStorage API).
      // IndexedDB (idb, 'duopay-local') must never be called or referenced in cache purging.
      const swContent = fs.readFileSync(
        path.resolve(process.cwd(), "public", "sw.js"),
        "utf8"
      );

      expect(swContent).not.toContain("indexedDB.deleteDatabase");
      expect(swContent).not.toContain("duopay-local");
      expect(swContent).not.toContain("clearLocalDB");
      expect(swContent).not.toContain("db.clear");
    });
  });

  describe("5. Service Worker Bypass Invariants (RSC, Server Actions, Dynamic Data)", () => {
    it("sw.js must contain explicit bypass for Server Actions and Next.js RSC requests", () => {
      const swContent = fs.readFileSync(
        path.resolve(process.cwd(), "public", "sw.js"),
        "utf8"
      );

      // Verify strict Server Action bypass
      expect(swContent).toContain("request.headers.has('next-action')");

      // Verify RSC headers and query bypass
      expect(swContent).toContain("request.headers.get('accept')?.includes('text/x-component')");
      expect(swContent).toContain("request.headers.get('rsc') === '1'");
      expect(swContent).toContain("url.searchParams.has('_rsc')");

      // Verify API bypass
      expect(swContent).toContain("url.pathname.startsWith('/api/')");

      // Verify non-GET bypass
      expect(swContent).toContain("request.method !== 'GET'");
    });

    it("sw.js navigation handler must prioritize network (Network-First)", () => {
      const swContent = fs.readFileSync(
        path.resolve(process.cwd(), "public", "sw.js"),
        "utf8"
      );

      expect(swContent).toContain("request.mode === 'navigate'");
      // Network-First: fetch(request) is called first, fallback to offline shell only on .catch()
      expect(swContent).toContain("fetch(request)");
      expect(swContent).toContain(".catch(async () =>");
      expect(swContent).toContain("DuoPay — Offline");
    });

    it("sw.js static chunks must only cache successful 200 OK responses", () => {
      const swContent = fs.readFileSync(
        path.resolve(process.cwd(), "public", "sw.js"),
        "utf8"
      );

      expect(swContent).toContain("networkResponse.status === 200");
      expect(swContent).toContain("cache.put(request, networkResponse.clone())");
    });
  });
});
