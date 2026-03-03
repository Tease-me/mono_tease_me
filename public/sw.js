const SW_VERSION = "v2.0.0";
const STATIC_CACHE = `tease-me-static-${SW_VERSION}`;
const RUNTIME_CACHE = `tease-me-runtime-${SW_VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/site.webmanifest",
  "/apple-touch-icon.png",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
  "/favicon.svg",
  "/favicon.ico",
];

const API_PATH_PREFIXES = ["/api", "/chat", "/call", "/ws", "/socket"];
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);

const isSameOrigin = (url) => url.origin === self.location.origin;
const isApiRequest = (url) =>
  API_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

async function precacheShell() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(
    SHELL_ASSETS.map(async (assetPath) => {
      try {
        const response = await fetch(assetPath, { cache: "no-store" });
        if (response.ok) {
          await cache.put(assetPath, response.clone());
        }
      } catch {
        // Keep install resilient: missing optional files must not break SW install.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precacheShell();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        }),
      );
      await self.clients.claim();
    })(),
  );
});

async function handleNavigation(request) {
  const staticCache = await caches.open(STATIC_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await staticCache.put("/index.html", networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedDocument =
      (await staticCache.match(request)) ||
      (await staticCache.match("/index.html")) ||
      (await caches.match("/index.html"));
    if (cachedDocument) {
      return cachedDocument;
    }
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function handleStaticAsset(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const cached = await runtimeCache.match(request);
  const fetchAndUpdate = fetch(request)
    .then((response) => {
      if (response.ok) {
        runtimeCache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    fetchAndUpdate.catch(() => {});
    return cached;
  }

  const networkResponse = await fetchAndUpdate;
  if (networkResponse) {
    return networkResponse;
  }

  const staticFallback = await caches.match(request);
  if (staticFallback) {
    return staticFallback;
  }

  return new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (!isSameOrigin(requestUrl)) {
    return;
  }

  if (isApiRequest(requestUrl)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  if (STATIC_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(handleStaticAsset(event.request));
  }
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
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
