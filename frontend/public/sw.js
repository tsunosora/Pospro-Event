// Pospro Event — Service Worker (basic offline shell)
// Copyright © 2026 Muhammad Faishal Abdul Hakim · All rights reserved.

// Version string — bump manual saat deploy major changes, atau replace via build script
// Contoh build script: sed -i "s/__BUILD_ID__/$(date +%s)/" public/sw.js
const CACHE_VERSION = 'pospro-v2-1778492614036';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Asset yang di-cache saat install (offline shell)
const STATIC_ASSETS = [
    '/manifest.webmanifest',
    '/icon.svg',
    '/icon-192.png',
    '/icon-512.png',
    '/apple-touch-icon.png',
    '/favicon.ico',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined))
            .then(() => self.skipWaiting())
    );
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => !k.startsWith(CACHE_VERSION))
                        .map((k) => caches.delete(k))
                )
            )
            .then(() => self.clients.claim())
    );
});

// Fetch strategy:
// - API calls (/api/*, backend host) → network only (don't cache, real-time data)
// - Static assets (/_next/, images, fonts) → cache-first
// - HTML pages → network-first dengan cache fallback (offline support)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET
    if (request.method !== 'GET') return;

    // Skip API requests (let them hit network normally)
    if (
        url.pathname.startsWith('/api/') ||
        url.hostname !== self.location.hostname && url.port !== self.location.port
    ) {
        return;
    }

    // Skip Next.js dev WebSocket / hot-reload
    if (url.pathname.startsWith('/_next/webpack-hmr')) return;

    // Safety: skip caching saat hostname localhost (dev mode) — kalau SW masih hidup di dev
    if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
        return;
    }

    // Hanya cache chunk yang punya content hash (immutable). Chunk dev tanpa hash skip.
    const hasContentHash = /[a-f0-9]{8,}\.(js|css|woff2?|png|jpg|svg)$/i.test(url.pathname);

    // Static assets — cache-first, HANYA kalau ada content hash (production chunks)
    if (
        hasContentHash ||
        /\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf)$/i.test(url.pathname)
    ) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                    }
                    return res;
                });
            })
        );
        return;
    }

    // HTML / pages — network-first dengan cache fallback
    if (request.destination === 'document' || request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
        );
    }
});
