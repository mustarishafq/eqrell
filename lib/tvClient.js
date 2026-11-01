'use client'
// TV helpers: linked-device credentials (survive cookie wipes), lite mode for older smart-TV browsers.

const CREDS_KEY = 'eqrel-tv-device'
const LITE_KEY = 'eqrel-tv-lite'     // '1' | '0' (manual override)

export function getTvCreds() {
  try { const v = JSON.parse(localStorage.getItem(CREDS_KEY) || 'null'); return v?.deviceId && v?.secret ? v : null } catch { return null }
}
export function saveTvCreds(c) { try { localStorage.setItem(CREDS_KEY, JSON.stringify({ deviceId: c.deviceId, secret: c.secret })) } catch { /* ignore */ } }
export function clearTvCreds() { try { localStorage.removeItem(CREDS_KEY) } catch { /* ignore */ } }

/** Ask the server to (re)issue a TV session for this linked device. → 'approved'|'pending'|'expired'|'revoked'|'unknown'|'error' */
export async function connectTvDevice(creds = getTvCreds()) {
  if (!creds) return { status: 'unknown' }
  try {
    const r = await fetch('/api/tv/device/connect', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: creds.deviceId, secret: creds.secret }),
    })
    const d = await r.json().catch(() => ({}))
    return { status: d.status || (r.ok ? 'error' : 'unknown'), ...d }
  } catch { return { status: 'error' } }
}

/** Smart TV / weak device heuristic (Tizen, webOS, VIDAA, Android TV, Fire TV, low RAM/CPU). */
export function detectTvBrowser() {
  if (typeof navigator === 'undefined') return false
  return /SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|VIDAA|Hisense|HbbTV|BRAVIA|AFT[A-Z]|Android TV|GoogleTV|MiTV|PatchWall|CrKey|; TV\b|Large Screen/i.test(navigator.userAgent || '')
}
export function detectLite() {
  if (typeof window === 'undefined') return false
  try {
    const o = new URLSearchParams(window.location.search).get('lite')
    if (o === '1' || o === '0') localStorage.setItem(LITE_KEY, o)
    const saved = localStorage.getItem(LITE_KEY)
    if (saved === '1') return true
    if (saved === '0') return false
  } catch { /* ignore */ }
  const lowRam = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  return detectTvBrowser() || lowRam || lowCpu || !!reduced
}
export function setLiteOverride(on) { try { localStorage.setItem(LITE_KEY, on ? '1' : '0') } catch { /* ignore */ } }

/** Toggle <html class="eq-lite"> (CSS kills animations/blur) and return the flag. */
export function applyLite(on) {
  if (typeof document === 'undefined') return on
  document.documentElement.classList.toggle('eq-lite', !!on)
  return on
}
