/**
 * PyTodo Service Worker
 * Cache-first for static assets, network-first for API calls.
 * Enables offline PWA support.
 */

const CACHE_NAME = "pytodo-v1";
const STATIC_ASSETS = [
  "/",
  "/static/css/app.css",
  "/static/js/app.js",
  "/static/manifest.json",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
];

// ===== Install: cache all static assets =====
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ===== Activate: clean old caches =====
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) {
            return k !== CACHE_NAME;
          })
          .map(function (k) {
            return caches.delete(k);
          })
      );
    })
  );
  self.clients.claim();
});

// ===== Fetch =====
self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);

  // Don't intercept non-GET requests
  if (event.request.method !== "GET") return;

  // API calls: network-first
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/s/")) {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        // Cache new requests for future offline use
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
