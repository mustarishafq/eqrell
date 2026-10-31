/* EQrel service worker — Web Push for parent digests (Niat Pagi, Laporan Malam, Laporan Mingguan). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

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
