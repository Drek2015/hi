// Cache-first offline support for the game shell.
const CACHE = 'boost-arena-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', 'vendor/three.module.min.js',
  'js/main.js', 'js/constants.js', 'js/arena.js', 'js/physics.js', 'js/scene.js', 'js/carModel.js',
  'js/textures.js', 'js/effects.js', 'js/camera.js', 'js/input.js', 'js/audio.js', 'js/ui.js', 'js/settings.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
