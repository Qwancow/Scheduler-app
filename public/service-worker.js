// public/service-worker.js
const CACHE_NAME = "scheduler-cache-v5";
const CORE = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);

    // Parse index.html and cache any /static/*.js|.css assets
    try {
      const res = await fetch("/index.html", { cache: "no-store" });
      const html = await res.text();
      const assetUrls = Array.from(html.matchAll(/(?:src|href)=\"(\/static\/[^\"?#]+)\"/g))
        .map(m => m[1]);
      const unique = [...new Set(assetUrls)].map(p => (p.startsWith("/") ? p : `/${p}`));
      if (unique.length) await cache.addAll(unique);
    } catch (e) {
      // runtime caching will still save files on first online use
      console.log("SW install: index parse skipped", e);
    }

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const { request } = event;

  // Navigation: use cached shell when offline
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const net = await fetch(request);
        caches.open(CACHE_NAME).then(c => c.put(request, net.clone())).catch(()=>{});
        return net;
      } catch {
        return caches.match("/index.html");
      }
    })());
    return;
  }

  // Same-origin: cache-first with runtime fill
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const net = await fetch(request);
        caches.open(CACHE_NAME).then(c => c.put(request, net.clone())).catch(()=>{});
        return net;
      } catch {
        return caches.match(request);
      }
    })());
  }
});
