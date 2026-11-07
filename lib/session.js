import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { getDb } from './mongodb'
import crypto from 'node:crypto'

const COOKIE_NAME = 'eqrel_session'
const SESSION_TTL_DAYS = 30

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'fallback-dev-secret-do-not-use-in-prod'
)

export async function createSession(payload) {
  const sid = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const claims = { ...payload, sid }

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secret)

  const db = await getDb()
  await db.collection('sessions').insertOne({
    sid,
    userId: payload.userId,
    email: payload.email,
    expiresAt,
    createdAt: new Date(),
  })

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })

  return { sid, token }
}

export async function getSession() {
  try {
    const store = await cookies()
    const token = store.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, secret)
    const db = await getDb()
    const row = await db.collection('sessions').findOne({ sid: payload.sid })
    if (!row) return null
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null
    // Linked TVs can be disconnected by a parent at any time
    if (payload.role === 'tv' && payload.tvDeviceId) {
      const dev = await db.collection('tv_devices').findOne({ id: payload.tvDeviceId }, { projection: { _id: 0, revokedAt: 1 } })
      if (!dev || dev.revokedAt) return null
    }
    // Child devices: kid-only session, scoped to one child (childId) or the whole family (childId null)
    if (payload.role === 'kid') {
      const dev = payload.kidDeviceId
        ? await db.collection('kid_devices').findOne({ id: payload.kidDeviceId }, { projection: { _id: 0, revokedAt: 1, childId: 1, familyId: 1 } })
        : null
      if (!dev || dev.revokedAt || dev.familyId !== payload.familyId) return null
      return { ...payload, kidChildId: dev.childId || null }
    }
    return payload
  } catch (e) {
    return null
  }
}

/** Cheap role check (JWT signature only, no DB) — used to route kid-device sessions through the allow-list. */
export async function peekSessionRole() {
  try {
    const store = await cookies()
    const token = store.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, secret)
    return payload?.role || null
  } catch { return null }
}

export async function destroySession() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret)
      const db = await getDb()
      await db.collection('sessions').deleteOne({ sid: payload.sid })
    } catch (e) {}
  }
  store.delete(COOKIE_NAME)
}

export function generateFamilyCode() {
  // 6-char human-friendly code, avoids ambiguous chars
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = crypto.randomBytes(6)
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}
