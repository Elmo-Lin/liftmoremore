// Service worker: makes the installed app launch fast and open offline.
// - Pages: network first (always the latest deploy when online), cached copy when offline.
// - /assets/*: content-hashed by Vite, so cache first. A file from an older deploy no longer exists,
//   and Hosting answers it with index.html; that answer is never cached and becomes a 404, so the
//   app sees a failed load (and reloads into the new deploy) instead of HTML posing as code.
// - /api/*: never cached; data always comes from the server.
// v2: drops index.html copies that v1 could have stored under /assets/ URLs.
const CACHE = 'liftmoremore-v2'
const SHELL = ['/index.html', '/favicon.svg', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Clone before handing the response to the page, which consumes its body.
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('/index.html', copy))
          }
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if ((res.headers.get('content-type') ?? '').includes('text/html')) return new Response('', { status: 404 })
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)))
})
