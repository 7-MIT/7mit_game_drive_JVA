// driving.7mit service worker: faster loading on the next visit and a fallback when the connection drops.
// - libraries from CDNs with a fixed version in the URL (three.js, the server client, icons, fonts) never change: cache first
// - the game's own files: network first (so an update is picked up right away), the cached copy when offline
const LIB = 'drive7-lib-v1', APP = 'drive7-app-v1';
const IMMUTABLE = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/[^/]+@\d|unpkg\.com\/[^/]+@\d|fonts\.gstatic\.com\/)/;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => { for (const k of await caches.keys()) if (k.startsWith('drive7-') && ![LIB, APP].includes(k)) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const url = new URL(r.url);
  if (IMMUTABLE.test(r.url)) { e.respondWith(caches.open(LIB).then(async c => { const hit = await c.match(r); if (hit) return hit; const res = await fetch(r); if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; })); return; }
  if (url.origin !== self.location.origin || url.pathname.includes('/terbang/') && url.pathname.endsWith('.json')) return;
  e.respondWith((async () => { const c = await caches.open(APP);
    try { const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res; }
    catch (err) { const hit = await c.match(r, {ignoreSearch: true}); if (hit) return hit; throw err; } })());
});
