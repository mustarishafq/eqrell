/* EQrel service worker — Web Push for parent digests (Niat Pagi, Laporan Malam, Laporan Mingguan). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// Page navigations: network first, friendly offline page if there is no connection.
// (A real fetch handler also keeps the app installable on browsers that still require one.)
const OFFLINE_HTML = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>EQrel</title>'
  + '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FFF8E7;font-family:system-ui;color:#0F2E25;text-align:center">'
  + '<div><div style="font-size:56px">📡</div><h2 style="margin:8px 0">You are offline</h2><p style="opacity:.7">Check your internet connection and try again.</p>'
  + '<button onclick="location.reload()" style="margin-top:12px;background:#00B894;color:#fff;border:0;border-radius:14px;padding:12px 22px;font-weight:800;font-size:15px">Try again</button></div></body>'
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'EQrel', body: event.data && event.data.text() } }
  const title = data.title || 'EQrel'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/assets/brand/eqrel_logo.webp',
    badge: '/assets/brand/eqrel_logo.webp',
    tag: data.tag || 'eqrel',
    renotify: false,
    data: { url: data.url || '/?parent=1' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/?parent=1'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { try { await c.navigate(url) } catch { /* cross-origin */ } return c.focus() }
    }
    return self.clients.openWindow(url)
  })())
})
