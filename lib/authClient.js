'use client'

// Emergent Google Auth flow — client helpers
// Redirects to Emergent auth, then handles session_id from URL fragment on return.

export const EMERGENT_AUTH_URL = 'https://auth.emergentagent.com/'
export const EMERGENT_SESSION_ENDPOINT =
  'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data'

export function startGoogleLogin(redirectAfter = '/') {
  const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
  const callback = `${base}/auth/callback?next=${encodeURIComponent(redirectAfter)}`
  const url = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(callback)}`
  window.location.href = url
}

export async function exchangeSessionId(sessionId) {
  const res = await fetch(EMERGENT_SESSION_ENDPOINT, {
    method: 'GET',
    headers: { 'X-Session-ID': sessionId },
  })
  if (!res.ok) throw new Error('Failed to fetch profile from Emergent auth')
  return res.json()
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}
