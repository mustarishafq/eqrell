'use client'
// Child's own device: link credentials (survive cookie wipes) + boot state for /kid.
import { useEffect, useState } from 'react'

const CREDS_KEY = 'eqrel-kid-device'

export function getKidCreds() {
  try { const v = JSON.parse(localStorage.getItem(CREDS_KEY) || 'null'); return v?.deviceId && v?.secret ? v : null } catch { return null }
}
const REVOKED_KEY = 'eqrel-kid-device-revoked'
export function saveKidCreds(c) { try { localStorage.setItem(CREDS_KEY, JSON.stringify({ deviceId: c.deviceId, secret: c.secret })); localStorage.removeItem(REVOKED_KEY) } catch { /* ignore */ } }
const markRevoked = () => { try { localStorage.setItem(REVOKED_KEY, '1') } catch { /* ignore */ } }
const wasRevoked = () => { try { return localStorage.getItem(REVOKED_KEY) === '1' } catch { return false } }
export function clearKidCreds() { try { localStorage.removeItem(CREDS_KEY) } catch { /* ignore */ } }

/** (Re)issue a kid session for this linked device → { status: approved|pending|expired|revoked|unknown|error, ... } */
export async function connectKidDevice(creds = getKidCreds()) {
  if (!creds) return { status: 'unknown' }
  try {
    const r = await fetch('/api/kid/device/connect', {
      method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: creds.deviceId, secret: creds.secret }),
    })
    const d = await r.json().catch(() => ({}))
    return { status: d.status || (r.ok ? 'error' : 'unknown'), ...d }
  } catch { return { status: 'error' } }
}

/**
 * Who is using /kid?
 *  - 'parent' → normal parent session (Kid Mode on the parent's phone, PIN to exit)
 *  - 'kid'    → a linked child device ({ childId } = locked to one child, null = shared by all children)
 *  - 'link'   → not linked yet → show the link screen
 */
export function useKidDeviceBoot() {
  const [state, setState] = useState({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    const set = (v) => { if (!cancelled) setState(v) }
    ;(async () => {
      try {
        const r = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
        if (r.ok) {
          const d = await r.json()
          if (d.device?.role === 'kid') { set({ status: 'kid', device: d.device, familyName: d.family?.familyName || '' }); return }
          if (!d.device) { set({ status: 'parent' }); return }
        }
      } catch { /* offline → try creds */ }
      const creds = getKidCreds()
      if (creds) {
        const res = await connectKidDevice(creds)
        if (res.status === 'approved') { set({ status: 'kid', device: { role: 'kid', childId: res.childId || null }, familyName: res.familyName || '' }); return }
        if (res.status === 'revoked') { clearKidCreds(); markRevoked(); set({ status: 'link', notice: 'revoked' }); return }
        if (res.status !== 'error') clearKidCreds()
      }
      set({ status: 'link', notice: wasRevoked() ? 'revoked' : undefined })
    })()
    return () => { cancelled = true }
  }, [])
  return state
}
