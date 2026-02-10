const CACHE_NAME = "rail-radar-v2";
const OFFLINE_URL = "/offline";
const MAX_CACHE_ENTRIES = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  const path = new URL(url).pathname;
  return (
    /\/_next\/static\//.test(path) ||
    /\.(js|css|woff2?|png|jpg|webp|svg|ico)$/.test(path)
  );
}

async function trimCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  if (keys.length > MAX_CACHE_ENTRIES) {
    await Promise.all(
      keys
        .slice(0, keys.length - MAX_CACHE_ENTRIES)
        .map((k) => cache.delete(k)),
    );
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Navigation (HTML): network-first so new deploys are picked up
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Only cache static assets (hashed JS/CSS chunks, fonts, images)
  if (
    event.request.url.startsWith(self.location.origin) &&
    isStaticAsset(event.request.url)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
                trimCache();
              });
            }
            return response;
          })
          .catch(() => new Response("", { status: 408 }));
      }),
    );
  }
  // Cross-origin and non-static requests: browser handles normally
});
