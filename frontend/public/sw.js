const CACHE_NAME = 'pashusetu-cache-v2';
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.svg',
    '/icon-192.png',
    '/icon-512.png'
];

// 1. Install event: Pre-cache core app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[PashuSetu SW] Pre-caching offline shell assets');
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate event: Clean up old cache versions
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[PashuSetu SW] Removing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch event: Stale-While-Revalidate for UI shell; Network-First for API calls
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Skip non-GET, browser extensions, and Vite development server polling/HMR
    if (
        event.request.method !== 'GET' ||
        !event.request.url.startsWith('http') ||
        requestUrl.pathname.includes('/@vite/') ||
        requestUrl.pathname.includes('/@fs/') ||
        requestUrl.pathname.includes('/__vite_ping')
    ) {
        return;
    }

    // Never cache API calls (model inference, database queries)
    if (requestUrl.pathname.startsWith('/api/')) {
        return;
    }

    // SPA Navigation Fallback (serve index shell when loading subroutes offline)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('/') || caches.match('/index.html');
            })
        );
        return;
    }

    // Stale-While-Revalidate caching strategy for UI assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});