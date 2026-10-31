'use client'
/** Browser helpers for Web Push (service worker + subscription). */

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

const b64ToUint8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function getRegistration() {
  if (!pushSupported()) return null
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export async function currentSubscription() {
  const reg = await getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

/** Ask permission (must be called from a tap) and register this device with the server. */
export async function enablePush({ lang } = {}) {
  if (!pushSupported()) throw new Error('unsupported')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('denied')
  const reg = await getRegistration()
  await navigator.serviceWorker.ready
  const { publicKey } = await (await fetch('/api/push/public-key')).json()
  if (!publicKey) throw new Error('no-key')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const r = await fetch('/api/push/subscribe', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), tz, lang }),
  })
  if (!r.ok) throw new Error('subscribe-failed')
  return sub
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (sub) {
    await fetch('/api/push/unsubscribe', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
    await sub.unsubscribe().catch(() => {})
  }
}
