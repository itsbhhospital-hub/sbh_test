console.log('--- SBH SERVICE WORKER v7.2 LOADED (ULTRA-STABLE) ---');

const CACHE_NAME = 'sbh-cms-v7.2';
const ASSETS_TO_PRECACHE = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/favicon_white.png'
];

// Force immediate update & skip waiting
self.addEventListener('install', (event) => {
    console.log('[SW v7.2] Installing...');
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_PRECACHE))
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW v7.2] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW v7.2] Purging old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// CLEAN & ROBUST FETCH STRATEGY
self.addEventListener('fetch', (event) => {
    // Only handle GET requests and valid HTTP/HTTPS schemes
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);
    const isLocal = url.origin === self.location.origin;
    const isStatic = url.href.includes('googleapis.com') || url.href.includes('gstatic.com') || url.href.includes('unpkg.com');

    if (!isLocal && !isStatic) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Ensure response is valid and is not a partial/opaque response (status 200)
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cacheCopy).catch(err => console.warn('Cache Put Error:', err));
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Return cached response even on error if available
                return cachedResponse || new Response('Offline', { status: 503 });
            });

            // Return cache immediately if found, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});
