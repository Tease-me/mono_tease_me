const CACHE_PREFIX = "tease-me-";
const ASSET_CACHE = `${CACHE_PREFIX}assets-v1`;
const CACHEABLE_DESTINATIONS = new Set(["script", "style"]);
const CACHEABLE_ICON_PATHS = new Set([
  "/apple-touch-icon.png",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
  "/favicon.svg",
  "/favicon.ico",
]);

const isSameOrigin = (url) => url.origin === self.location.origin;

function shouldCacheAsset(request, requestUrl) {
  if (request.method !== "GET") {
    return false;
  }

  if (request.destination === "font") {
    return true;
  }

  if (!isSameOrigin(requestUrl)) {
    return false;
  }

  return (
    CACHEABLE_DESTINATIONS.has(request.destination) ||
    CACHEABLE_ICON_PATHS.has(requestUrl.pathname)
  );
}

async function updateAssetCache(cache, request) {
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return undefined;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX))
          .map((cacheName) =>
            cacheName === ASSET_CACHE
              ? Promise.resolve(false)
              : caches.delete(cacheName),
          ),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (!shouldCacheAsset(event.request, requestUrl)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(event.request);

      if (cached) {
        event.waitUntil(updateAssetCache(cache, event.request));
        return cached;
      }

      const networkResponse = await updateAssetCache(cache, event.request);
      if (networkResponse) {
        return networkResponse;
      }

      return new Response("", { status: 504 });
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }
  const title = payload.title || "New Notification";
  const options = {
    body: payload.body || payload.message || "",
    icon: payload.icon || "/apple-touch-icon.png",
    badge: payload.badge || undefined,
    image: payload.image || undefined,
    tag: payload.tag || undefined,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
