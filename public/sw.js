// DuoPay Production Service Worker
// Version: 2026.10.3

const VERSION = '2026.10.3';
const CACHE_STATIC_NAME = `duopay-static-v${VERSION}`;
const CACHE_RUNTIME_NAME = `duopay-runtime-v${VERSION}`;
const EXPECTED_CACHES = [CACHE_STATIC_NAME, CACHE_RUNTIME_NAME];

// Static app shell resources to cache on install
const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset fetch warning:', err);
      });
    })
  );
});

// Activate: clean up obsolete cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('duopay-') && !EXPECTED_CACHES.includes(name))
          .map((name) => {
            console.log('[SW] Deleting obsolete cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for message to skip waiting (controlled update flow)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event handler with strict safety rules
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept non-GET requests (mutations, server actions, POST/PUT/DELETE)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Only handle http / https requests from same origin
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Always bypass API routes, auth callbacks, and dynamic server actions
  if (
    url.pathname.startsWith('/api/') ||
    request.headers.get('next-action') ||
    request.headers.get('accept')?.includes('text/x-component')
  ) {
    return;
  }

  // 4. Static Next.js chunks (hashed and immutable) -> Cache-First
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_STATIC_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 5. Static public assets (icons, manifest, web fonts) -> Stale-While-Revalidate
  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/icon-') ||
      url.pathname === '/apple-touch-icon.png' ||
      url.pathname === '/favicon.ico' ||
      url.pathname === '/manifest.webmanifest' ||
      url.pathname.match(/\.(woff2?|png|jpg|jpeg|svg|webp|ico)$/));

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_STATIC_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 6. Navigation / HTML pages -> Strict Network-First
  // Guarantees that freshly deployed versions and deleted records are reflected immediately.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(async () => {
          // If network is completely offline, attempt fallback
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to offline message or home if available
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <title>DuoPay - Offline</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #111; text-align: center; padding: 20px; }
                  .card { background: white; padding: 32px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 320px; }
                  h1 { font-size: 20px; margin-bottom: 8px; }
                  p { font-size: 14px; color: #666; margin-bottom: 20px; }
                  button { background: #000; color: #fff; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>You are offline</h1>
                  <p>Please check your internet connection to access DuoPay.</p>
                  <button onclick="window.location.reload()">Retry</button>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
  }
});

// ============================================================================
// 7. Push Event Handler (Real Server-Initiated Web Push)
// ============================================================================
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    // If not JSON, use raw text
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
// 8. Notification Click Handler (Safe-Origin Window Focus & Routing)
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
        // If an existing window/tab of DuoPay is open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client && targetPath !== '/') {
              return client.navigate(destinationUrl);
            }
            return client;
          }
        }
        // Otherwise, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(destinationUrl);
        }
      })
  );
});

