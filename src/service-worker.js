import { FIREBASE_PUBLIC_KEY } from "./env";

const CACHE_NAME = 'tease-me-cache-v1';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/apple-touch-icon.png'
    // add other assets you want to cache here
];

// Cache install
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(URLS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate and cleanup old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch from cache first, then network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('push', event => {
    console.log("Push received:", event);
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification('Title', {
            body: data.message,
            icon: '/apple-touch-icon.png'
        })
    );
});

if ('PushManager' in self) {
    self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: FIREBASE_PUBLIC_KEY
    });
} else {
    console.warn('Push API not supported; you may need a fallback.');
}