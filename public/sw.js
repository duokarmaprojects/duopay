// DuoPay Production Service Worker
// Automatically generated at build time — DO NOT MANUALLY EDIT public/sw.js
// Template: src/pwa/sw-template.js

const BUILD_ID = '43dcad4';
const VERSION = '2026.10.43dcad4';
const CACHE_STATIC_NAME = 'duopay-static-' + BUILD_ID;
const CACHE_RUNTIME_NAME = 'duopay-runtime-' + BUILD_ID;
const EXPECTED_CACHES = [CACHE_STATIC_NAME, CACHE_RUNTIME_NAME];

// Minimal resilient assets to precache on install
const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
];

// ============================================================================
// 1. Install Event: Resilient Precache (Does not fail if single asset fails)
// ============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME).then(async (cache) => {
      // Use resilient individual fetches so a missing asset never fails install
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          fetch(asset, { cache: 'no-cache' })
            .then((res) => {
              if (res && res.status === 200) {
                return cache.put(asset, res);
              }
            })
            .catch((err) => {
              console.warn('[SW] Precache item failed for ' + asset + ':', err);
            })
        )
      );
      console.log('[SW] Service Worker installed. Build ID:', BUILD_ID);
    })
  );
  // Intentionally NOT calling self.skipWaiting() here to avoid breaking active sessions.
  // The client / PwaProvider controls skipWaiting safely.
});

// ============================================================================
// 2. Activate Event: Safe Cache Cleanup (Preserves current + 1 previous version)
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        // Collect all DuoPay static caches
        const duopayStaticCaches = cacheNames.filter((name) =>
          name.startsWith('duopay-static-')
        );

        // Sort descending to find the current and the immediately preceding cache
        duopayStaticCaches.sort().reverse();

        // Keep current cache AND the immediately preceding static cache (max 2 versions)
        // so open tabs executing previous JS don't fail immediately mid-session.
        const cachesToKeep = new Set([
          CACHE_STATIC_NAME,
          CACHE_RUNTIME_NAME,
          ...duopayStaticCaches.slice(0, 2),
        ]);

        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('duopay-') && !cachesToKeep.has(name))
            .map((name) => {
              console.log('[SW] Deleting obsolete cache namespace:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activated & claimed clients for Build ID:', BUILD_ID);
        return self.clients.claim();
      })
  );
});

// ============================================================================
// 3. Message Event: Controlled Update & Diagnostic Communications
// ============================================================================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received, activating immediately...');
    self.skipWaiting();
  } else if (event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        version: VERSION,
        buildId: BUILD_ID,
        staticCache: CACHE_STATIC_NAME,
        runtimeCache: CACHE_RUNTIME_NAME,
      });
    }
  } else if (event.data.type === 'PURGE_STALE_CACHES') {
    // Client detected chunk load mismatch — purge all except active version
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('duopay-') && !EXPECTED_CACHES.includes(name))
            .map((name) => caches.delete(name))
        );
      })
    );
  }
});

// ============================================================================
// 4. Fetch Event: Strict Zero-Corruption Routing
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. Never intercept non-GET requests (Server Actions, POST/PUT/DELETE)
  if (request.method !== 'GET') {
    return;
  }

  // B. Only handle http / https requests from same origin
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // C. STRICT BYPASS: Server Actions, Next.js RSC, API endpoints, Auth
  const isServerAction = request.headers.has('next-action');
  const isRscHeader =
    request.headers.get('accept')?.includes('text/x-component') ||
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-state-tree');
  const isRscQuery = url.searchParams.has('_rsc');
  const isApiRoute = url.pathname.startsWith('/api/');
  const isNextData = url.pathname.startsWith('/_next/data/');

  if (isServerAction || isRscHeader || isRscQuery || isApiRoute || isNextData) {
    // Pure network passthrough — NEVER cache dynamic, mutable, or authenticated data
    return;
  }

  // D. Static Next.js Immutable Chunks (/_next/static/) -> Cache-First
  // Filenames are content-hashed by Next.js compiler.
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_STATIC_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        try {
          const networkResponse = await fetch(request);
          // Only cache successful 200 OK responses. Never cache 404s, 500s or opaque errors!
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (fetchErr) {
          // If network failed and not in cache, throw so client ChunkLoadError listener catches it
          throw fetchErr;
        }
      })
    );
    return;
  }

  // E. Static Public Assets (icons, manifest, web fonts) -> Stale-While-Revalidate
  const isStaticPublicAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/icon-') ||
      url.pathname === '/apple-touch-icon.png' ||
      url.pathname === '/manifest.webmanifest' ||
      url.pathname.match(/\.(woff2?|png|jpg|jpeg|svg|webp|ico)$/));

  if (isStaticPublicAsset) {
    event.respondWith(
      caches.open(CACHE_STATIC_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // F. Navigation Requests (HTML Pages) -> Strict Network-First
  // Guarantees freshly deployed versions and deleted records are reflected immediately.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Return live server response directly
          return networkResponse;
        })
        .catch(async () => {
          // Complete Network Failure (Device is offline)
          // Return clean, dark-mode-styled offline shell that preserves local outbox & state
          return new Response(
            `<!DOCTYPE html>
            <html lang="en" class="dark">
              <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
                <title>DuoPay — Offline</title>
                <style>
                  * { box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: #09090b;
                    color: #f4f4f5;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 24px;
                  }
                  .card {
                    background: #18181b;
                    border: 1px solid #27272a;
                    border-radius: 24px;
                    padding: 32px 24px;
                    max-width: 360px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                  }
                  .logo {
                    font-size: 20px;
                    font-weight: 800;
                    color: #3b82f6;
                    margin-bottom: 20px;
                  }
                  .icon-wrap {
                    width: 56px;
                    height: 56px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    font-size: 24px;
                  }
                  h1 { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
                  p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 24px; }
                  .btn {
                    background: #3b82f6;
                    color: #fff;
                    border: none;
                    padding: 14px 24px;
                    border-radius: 14px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: transform 0.1s ease, background 0.15s ease;
                  }
                  .btn:active { transform: scale(0.98); background: #2563eb; }
                  .notice {
                    font-size: 11px;
                    color: #71717a;
                    margin-top: 16px;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="logo">DuoPay</div>
                  <div class="icon-wrap">⚡</div>
                  <h1>You are currently offline</h1>
                  <p>Check your internet connection to access live updates. Any pending offline transactions in your outbox are saved safely on your device.</p>
                  <button class="btn" onclick="window.location.reload()">Retry Connection</button>
                  <div class="notice">Your local financial data is preserved securely.</div>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
  }
});

// ============================================================================
// 5. Push Notification Handler
// ============================================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'DuoPay',
      body: event.data.text() || 'You have a new update.',
      url: '/',
      type: 'SYSTEM',
    };
  }

  const title = payload.title || 'DuoPay';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/icon-192x192.png',
    data: {
      url: payload.url || '/',
      type: payload.type || 'SYSTEM',
      timestamp: Date.now(),
      ...(payload.data || {}),
    },
    tag: payload.tag || `duopay-${payload.type || 'notice'}-${Date.now()}`,
    renotify: true,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================================
// 6. Notification Click Handler (Safe-Origin Window Focus & Routing)
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/';

  // Strict URL Validation: Only allow same-origin relative paths, prevent open redirect attacks
  let targetPath = '/';
  if (typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    try {
      const dummyOrigin = self.location.origin;
      const parsed = new URL(rawUrl, dummyOrigin);
      if (parsed.origin === dummyOrigin) {
        targetPath = parsed.pathname + parsed.search + parsed.hash;
      }
    } catch (e) {
      targetPath = '/';
    }
  }

  const destinationUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client && targetPath !== '/') {
              return client.navigate(destinationUrl);
            }
            return client;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(destinationUrl);
        }
      })
  );
});
