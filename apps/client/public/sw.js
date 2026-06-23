/**
 * Service worker — background-image cache (and nothing else, for now).
 *
 * The full-screen backgrounds (see AppBackground.vue) are large, immutable,
 * content-hashed assets. We cache them with a cache-first strategy: once an
 * image is fetched it is served from the cache on every later visit, and
 * because the filename hash changes whenever the image content changes, a
 * cached entry can never go stale.
 *
 * Matching is by filename, so it works in dev (`/src/assets/bg/...`) and in
 * the hashed production build (`/assets/sunset_..-<hash>.avif`) alike.
 */

const CACHE = "bg-images-v1";
const BG_IMAGE = /\/(sunset|night)_[^/]*\.(avif|webp|jpe?g)$/i;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !BG_IMAGE.test(new URL(request.url).pathname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })(),
  );
});
