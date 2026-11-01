'use client'
// PWA install helpers — one-tap native install where the browser allows it (Android / desktop Chrome, Edge,
// Samsung Internet) and a guided "Add to Home Screen" on iPhone/iPad (Apple does not allow one-tap install).
// "Installed" is remembered three ways so the prompt stops nagging:
//   1. running in standalone mode right now
//   2. localStorage flag (set on `appinstalled` or when the app is opened from the home screen)
//   3. server flag on the parent account (iOS home-screen apps have separate storage from Safari)

const LS_KEY = 'eqrel-app-installed'          // { at, platform }
const FRESH_DAYS = 45                         // flag expires if the app hasn't been opened from home screen in 45 days

let _bip = null
const subs = new Set()
const emit = () => subs.forEach(fn => { try { fn(_bip) } catch { /* ignore */ } })

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || window.navigator.standalone === true
}

export function detectPlatform() {
  if (typeof navigator === 'undefined') return { os: 'other', browser: 'other', inApp: false }
  const ua = navigator.userAgent || ''
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOS
  const android = /Android/.test(ua)
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|GSA\//.test(ua)
  let browser = 'other'
  if (ios) browser = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : 'safari'
  else if (/SamsungBrowser/.test(ua)) browser = 'samsung'
  else if (/Firefox/.test(ua)) browser = 'firefox'
  else if (/Edg\//.test(ua)) browser = 'edge'
  else if (/Chrome/.test(ua)) browser = 'chrome'
  return { os: ios ? 'ios' : android ? 'android' : 'desktop', browser, inApp, iPad: /iPad/.test(ua) || iPadOS }
}

export function getLocalInstalled() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (!v?.at) return null
    if ((Date.now() - v.at) / 86400000 > FRESH_DAYS) return null
    return v
  } catch { return null }
}

export function markInstalled(platform) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), platform })) } catch { /* ignore */ }
  fetch('/api/me/app-installed', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) }).catch(() => {})
}

/** Server-side flag (parent account) — true if this platform's home-screen app was opened recently. */
export async function getServerInstalled(os) {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' })
    if (!r.ok) return false
    const d = await r.json()
    const at = d?.user?.appInstalled?.[os]
    return !!at && (Date.now() - new Date(at).getTime()) / 86400000 <= FRESH_DAYS
  } catch { return false }
}

export const getInstallEvent = () => _bip
export function onInstallEvent(fn) { subs.add(fn); return () => subs.delete(fn) }

/** Fire the native install dialog (must be called from a tap). → 'accepted' | 'dismissed' | 'unavailable' */
export async function promptInstall() {
  if (!_bip) return 'unavailable'
  const ev = _bip
  _bip = null; emit()
  try {
    await ev.prompt()
    const { outcome } = await ev.userChoice
    if (outcome === 'accepted') markInstalled(detectPlatform().os)
    return outcome
  } catch { return 'unavailable' }
}

/** In the home-screen app: record install for this platform on the server (needs a signed-in parent). */
export async function markInstalledIfStandalone() {
  if (!isStandalone()) return
  const platform = detectPlatform().os
  try { localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), platform })) } catch { /* ignore */ }
  try {
    const r = await fetch('/api/me/app-installed', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) })
    if (r.ok) sessionStorage.setItem('eqrel-pwa-marked', '1')
  } catch { /* ignore */ }
}

let _booted = false
/** Call once on app start (Providers). Captures the install event early + records home-screen opens. */
export function bootPwa() {
  if (_booted || typeof window === 'undefined') return
  _booted = true
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); _bip = e; emit() })
  window.addEventListener('appinstalled', () => { _bip = null; markInstalled(detectPlatform().os); emit() })
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  if (isStandalone()) {
    // Opened from the home screen → remember (once per app session; retried after login via markInstalledIfStandalone)
    try { if (sessionStorage.getItem('eqrel-pwa-marked')) return } catch { /* ignore */ }
    markInstalledIfStandalone()
  }
}
