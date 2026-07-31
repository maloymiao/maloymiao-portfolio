// Bump this version string whenever you update cached files, so the browser
// fetches fresh copies instead of serving stale ones from cache.
const CACHE_NAME = "maloymiao-v1";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js",
  "/Transformer_eff.html",
  "/tx_eff_style.css",
  "/tx_eff_app.js",
  "/calculator.html",
  "/battery-calculator.html",
  "/battery-style.css",
  "/battery-script.js",
  "/txsizing-calc.html",
  "/txsizing-calc.css",
  "/txsizing-calc.js",
  "/my-logo.png",
  "/my-battery-logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png"
];

// Install: pre-cache the core pages/assets so the app can open offline.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clear out old cache versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin requests, falling back to network,
// and updating the cache with fresh responses as they come in.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline: fall back to cache if network fails

      return cached || networkFetch;
    })
  );
});
