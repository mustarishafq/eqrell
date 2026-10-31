import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { createSession, getSession, destroySession, generateFamilyCode } from '@/lib/session'
import { QUIZ_QUESTIONS, questionsForAge, pickRandomQuestions, POINTS_PER_CORRECT, QUESTIONS_PER_SESSION } from '@/lib/quizBank'
import { TEMPLATE_DEFAULT_RECURRING, TEMPLATE_DEFAULT_SESSION } from '@/lib/prayerSession'
import { TEMPLATE_BY_ID } from '@/lib/habitTemplates'
import webpush from 'web-push'
import nodeCrypto from 'crypto'
import {
  verifyClaimDoc, checkAutoTrust, buildNightDigest, buildMorningDigest, buildWeeklyDigest,
  sanitizePrefs, DEFAULT_PREFS, localNow, isDue, utcToday,
} from '@/lib/engagement'

// ── Web Push (VAPID keys generated for this app, stored in .env) ──
let _vapidReady = false
function ensureVapid() {
  if (_vapidReady) return true
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@eqrel.app', pub, priv)
  _vapidReady = true
  return true
}
/** Send a payload to every push subscription of a user; prunes dead subscriptions. */
async function pushToUser(db, userId, payload) {
  if (!ensureVapid()) return { sent: 0, failed: 0, reason: 'no-vapid' }
  const subs = await db.collection('push_subs').find({ userId }).toArray()
  let sent = 0, failed = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 6 * 3600 })
      sent++
    } catch (e) {
      failed++
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.collection('push_subs').deleteOne({ _id: sub._id })
    }
  }
  return { sent, failed }
}
/** Cron worker: send due morning/night/weekly digests to every parent with push enabled. */
async function runDigestCron(db) {
  const userIds = await db.collection('push_subs').distinct('userId')
  const out = { checked: 0, morning: 0, night: 0, weekly: 0 }
  for (const uid of userIds) {
    const user = await db.collection('users').findOne({ id: uid })
    if (!user?.familyId) continue
    out.checked++
    const prefs = { ...DEFAULT_PREFS, ...(user.notifyPrefs || {}) }
    const last = user.notifyLast || {}
    const local = localNow(prefs.tz)
    const sets = {}
    const opts = { lang: prefs.lang, dateStr: utcToday() }
    if (prefs.morning?.enabled && isDue(prefs.morning.time, local, last.morning)) {
      const d = await buildMorningDigest(db, user.familyId, opts)
      await pushToUser(db, uid, d.push); sets['notifyLast.morning'] = local.date; out.morning++
    }
    if (prefs.night?.enabled && isDue(prefs.night.time, local, last.night)) {
      const d = await buildNightDigest(db, user.familyId, opts)
      await pushToUser(db, uid, d.push); sets['notifyLast.night'] = local.date; out.night++
      // Weekly story rides along with Sunday's night slot
      if (prefs.weekly?.enabled && local.weekday === 0 && last.weekly !== local.date) {
        const w = await buildWeeklyDigest(db, user.familyId, opts)
        await pushToUser(db, uid, w.push); sets['notifyLast.weekly'] = local.date; out.weekly++
      }
    }
    if (Object.keys(sets).length) await db.collection('users').updateOne({ id: uid }, { $set: sets })
  }
  return out
}
import { scoreDiagnosis, bandFromAge, GOALS, PRACTICE_QUESTIONS } from '@/lib/diagnosis'
import { BUILDING_TEMPLATES } from '@/lib/worldEngine'
import crypto from 'node:crypto'

// Helper: determine if a habit is per-prayer recurring, using explicit field or template default
const isPerPrayerHabit = (habit) => {
  if (habit?.recurring === 'perPrayer') return true
  if (habit?.templateId && TEMPLATE_DEFAULT_RECURRING[habit.templateId] === 'perPrayer') return true
  return false
}

// ────────────────────── HELPERS ──────────────────────
const CORS = (res) => {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-ID')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (data, status = 200) => CORS(NextResponse.json(data, { status }))
const err = (msg, status = 400) => json({ error: msg }, status)

/**
 * Compute the delta between two claim states and apply it to child.mataBina/mataReward.
 * Mata Bina = habit points × (1.5 if ihsan, else 1) awarded on 'verified'.
 * Mata Reward = +5 flat on 'ihsan' verification only.
 * prevClaim/nextClaim shape: { status, rubric, pointsAwarded }
 */
async function applyMataDelta(db, childId, prevClaim, nextClaim) {
  const prevPts = (prevClaim?.status === 'verified') ? Number(prevClaim.pointsAwarded || 0) : 0
  const nextPts = (nextClaim?.status === 'verified') ? Number(nextClaim.pointsAwarded || 0) : 0
  const prevRw  = (prevClaim?.status === 'verified' && prevClaim?.rubric === 'ihsan') ? 5 : 0
  const nextRw  = (nextClaim?.status === 'verified' && nextClaim?.rubric === 'ihsan') ? 5 : 0
  const dBina = nextPts - prevPts
  const dRw   = nextRw - prevRw
  if (dBina === 0 && dRw === 0) return
  const inc = {}
  if (dBina !== 0) inc.mataBina = dBina
  if (dRw   !== 0) inc.mataReward = dRw
  await db.collection('children').updateOne({ id: childId }, { $inc: inc })
}

export async function OPTIONS() {
  return CORS(new NextResponse(null, { status: 200 }))
}

// Emergent Auth session exchange
const EMERGENT_SESSION_ENDPOINT =
  'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data'

async function exchangeEmergentSession(sessionId) {
  const res = await fetch(EMERGENT_SESSION_ENDPOINT, {
    method: 'GET',
    headers: { 'X-Session-ID': sessionId },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Emergent auth failed: ${res.status} ${txt}`)
  }
  return res.json() // { id, email, name, picture, session_token }
}

// ────────────────────── ROUTES ──────────────────────
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    // Health
    if (route === '/' && method === 'GET') {
      return json({ app: 'EQrel', version: 'cohort-a-v0.2', status: 'ok' })
    }
    if (route === '/health' && method === 'GET') {
      const db = await getDb()
      const ping = await db.command({ ping: 1 })
      return json({ status: 'healthy', mongo: ping.ok === 1 ? 'connected' : 'error' })
    }

    // ══════════ AUTH ══════════

    // POST /auth/callback  { session_id } → creates local session
    if (route === '/auth/callback' && method === 'POST') {
      const { session_id } = await request.json().catch(() => ({}))
      if (!session_id) return err('session_id required', 400)

      const profile = await exchangeEmergentSession(session_id)
      if (!profile?.email) return err('Invalid profile from Emergent', 401)

      const db = await getDb()
      const users = db.collection('users')

      const now = new Date()
      let user = await users.findOne({ email: profile.email })
      if (!user) {
        user = {
          id: crypto.randomUUID(),
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          picture: profile.picture || null,
          familyId: null,   // set after user picks role/joins family
          role: null,       // 'ibu' | 'bapa'
          createdAt: now,
          updatedAt: now,
        }
        await users.insertOne(user)
      } else {
        await users.updateOne(
          { id: user.id },
          { $set: { name: profile.name || user.name, picture: profile.picture || user.picture, updatedAt: now } }
        )
      }

      await createSession({
        userId: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      })

      return json({
        ok: true,
        user: { id: user.id, email: user.email, name: user.name, picture: user.picture },
        familyId: user.familyId,
        role: user.role,
        needsFamilySetup: !user.familyId || !user.role,
      })
    }

    // GET /auth/me → current session info + user + family
    if (route === '/auth/me' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)

      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user) return err('user not found', 404)

      let family = null
      let parents = []
      if (user.familyId) {
        family = await db.collection('families').findOne({ id: user.familyId })
        if (family) {
          parents = await db.collection('users').find({ familyId: family.id }).project({
            id: 1, name: 1, email: 1, picture: 1, role: 1, _id: 0
          }).toArray()
        }
      }

      return json({
        user: { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role },
        family,
        parents,
        needsFamilySetup: !user.familyId || !user.role,
      })
    }

    // POST /auth/logout
    if (route === '/auth/logout' && method === 'POST') {
      await destroySession()
      return json({ ok: true })
    }

    // ══════════ FAMILY ══════════

    // POST /family/create-or-join  { role: 'ibu'|'bapa', familyCode?: string }
    if (route === '/family/create-or-join' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)

      const { role, familyCode } = await request.json().catch(() => ({}))
      if (!['ibu', 'bapa'].includes(role)) return err('role must be ibu or bapa', 400)

      const db = await getDb()
      const users = db.collection('users')
      const families = db.collection('families')

      let family
      if (familyCode) {
        // Join existing family
        family = await families.findOne({ code: familyCode.trim().toUpperCase() })
        if (!family) return err('Kod keluarga tidak dijumpai', 404)

        // Check role isn't taken
        const roleTaken = await users.findOne({ familyId: family.id, role, id: { $ne: session.userId } })
        if (roleTaken) return err(`Peranan "${role}" sudah diambil dalam keluarga ini`, 409)
      } else {
        // Create new family
        let code
        let attempt = 0
        while (attempt++ < 5) {
          code = generateFamilyCode()
          const exists = await families.findOne({ code })
          if (!exists) break
        }
        family = {
          id: crypto.randomUUID(),
          code,
          createdBy: session.userId,
          createdAt: new Date(),
          streak: 0,
          location: null,
        }
        await families.insertOne(family)
      }

      // Link user to family with role
      await users.updateOne(
        { id: session.userId },
        { $set: { familyId: family.id, role, updatedAt: new Date() } }
      )

      return json({ family, role })
    }

    // POST /family/leave  → unlink from family
    if (route === '/family/leave' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      await db.collection('users').updateOne(
        { id: session.userId },
        { $set: { familyId: null, role: null, updatedAt: new Date() } }
      )
      return json({ ok: true })
    }

    // ══════════ CHILDREN ══════════

    // GET /children  → list for current family
    if (route === '/children' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ children: [] })
      const children = await db.collection('children')
        .find({ familyId: user.familyId })
        .sort({ createdAt: 1 })
        .project({ _id: 0 })
        .toArray()
      return json({ children })
    }

    // POST /children  → create
    if (route === '/children' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('Setup keluarga dulu', 400)

      const child = {
        id: body.id || crypto.randomUUID(),
        familyId: user.familyId,
        nickname: (body.nickname || '').trim(),
        dob: body.dob || null,
        gender: body.gender || 'male',
        ageBand: body.ageBand || '5-6',
        avatarId: body.avatarId || 'B01',
        favColor: body.favColor || 'green',
        preferredLang: body.preferredLang || 'ms',
        todayCompleted: body.todayCompleted ?? 0,
        todayTotal: body.todayTotal ?? 0,
        lightLevel: body.lightLevel ?? 100,
        blackClouds: body.blackClouds ?? 0,
        buildingCount: body.buildingCount ?? 0,
        claimMode: ['self','parent'].includes(body.claimMode) ? body.claimMode : 'parent',
        mataBina: 0,
        mataReward: 0,
        createdBy: session.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      if (!child.nickname) return err('Nama panggilan diperlukan', 400)
      await db.collection('children').insertOne(child)
      const { _id, ...clean } = child
      return json({ child: clean })
    }

    // PATCH /children/:id  → update
    if (route.startsWith('/children/') && method === 'PATCH') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const childId = route.split('/')[2]
      const body = await request.json().catch(() => ({}))
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)

      const allowed = ['nickname', 'dob', 'gender', 'ageBand', 'avatarId', 'favColor', 'preferredLang',
                       'claimMode',
                       'todayCompleted', 'todayTotal', 'lightLevel', 'blackClouds', 'buildingCount']
      const $set = { updatedAt: new Date() }
      for (const k of allowed) if (k in body) $set[k] = body[k]

      const result = await db.collection('children').updateOne(
        { id: childId, familyId: user.familyId },
        { $set }
      )
      if (result.matchedCount === 0) return err('Anak tidak dijumpai', 404)
      const updated = await db.collection('children').findOne({ id: childId }, { projection: { _id: 0 } })
      return json({ child: updated })
    }

    // DELETE /children/:id
    if (route.startsWith('/children/') && !route.includes('/habits') && !route.includes('/claims') && method === 'DELETE') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const childId = route.split('/')[2]
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const result = await db.collection('children').deleteOne({ id: childId, familyId: user.familyId })
      if (result.deletedCount === 0) return err('Anak tidak dijumpai', 404)
      // Cascade delete habits + claims for this child
      await db.collection('habits').deleteMany({ childId, familyId: user.familyId })
      await db.collection('habit_claims').deleteMany({ childId, familyId: user.familyId })
      return json({ ok: true })
    }

    // ══════════ HABITS ══════════

    // GET /children/:id/habits  → list habits assigned to child (with today's completion state)
    if (route.match(/^\/children\/[^/]+\/habits$/) && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const childId = route.split('/')[2]
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)

      // Verify child belongs to family
      const child = await db.collection('children').findOne({ id: childId, familyId: user.familyId })
      if (!child) return err('Anak tidak dijumpai', 404)

      const habits = await db.collection('habits')
        .find({ childId, familyId: user.familyId, active: { $ne: false } })
        .sort({ createdAt: 1 })
        .project({ _id: 0 })
        .toArray()

      // Attach today's claim status + rubric + pointsAwarded (needed by Kid Mode + parent-log UI)
      // For perPrayer habits, aggregate ALL session claims into sessionsClaimed[] array
      const todayStr = new Date().toISOString().slice(0, 10)
      const claims = await db.collection('habit_claims')
        .find({ childId, dateStr: todayStr })
        .project({ _id: 0, habitId: 1, status: 1, rubric: 1, pointsAwarded: 1, note: 1, session: 1 })
        .toArray()

      // Build per-habit maps: primary claim (daily) and session-claim map (perPrayer)
      const primaryClaimMap = {}
      const perPrayerClaimsMap = {}  // habitId → { session: claim }
      claims.forEach(c => {
        if (c.session) {
          if (!perPrayerClaimsMap[c.habitId]) perPrayerClaimsMap[c.habitId] = {}
          perPrayerClaimsMap[c.habitId][c.session] = c
        } else {
          primaryClaimMap[c.habitId] = c
        }
      })

      const enriched = habits.map(h => {
        if (isPerPrayerHabit(h)) {
          const perPrayerClaims = perPrayerClaimsMap[h.id] || {}
          const sessionsClaimed = Object.keys(perPrayerClaims)
          // Sum points across all claimed sessions (verified only)
          const totalPointsAwarded = Object.values(perPrayerClaims)
            .filter(c => c.status === 'verified' && typeof c.pointsAwarded === 'number')
            .reduce((sum, c) => sum + c.pointsAwarded, 0)
          return {
            ...h,
            recurring: 'perPrayer',        // Force expose to frontend even if DB missing field
            sessionsClaimed,               // ['subuh', 'zohor'] etc.
            perPrayerClaims,               // full per-session detail
            todayStatus: sessionsClaimed.length > 0 ? 'claimed' : 'pending',
            pointsAwarded: totalPointsAwarded || null,
          }
        }
        // Daily habit — existing behavior
        const c = primaryClaimMap[h.id]
        return {
          ...h,
          todayStatus: c?.status || 'pending',
          rubric: c?.rubric || null,
          pointsAwarded: c?.pointsAwarded ?? null,
          claimNote: c?.note || '',
        }
      })

      return json({ habits: enriched })
    }

    // POST /children/:id/habits  → assign a habit (from template or custom)
    if (route.match(/^\/children\/[^/]+\/habits$/) && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const childId = route.split('/')[2]
      const body = await request.json().catch(() => ({}))
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)

      const child = await db.collection('children').findOne({ id: childId, familyId: user.familyId })
      if (!child) return err('Anak tidak dijumpai', 404)

      if (!body.title?.trim()) return err('Tajuk habit diperlukan', 400)

      const habit = {
        id: crypto.randomUUID(),
        familyId: user.familyId,
        childId,
        templateId: body.templateId || null,   // if from template, keep reference
        category: body.category || 'ibadah',
        session: body.session || 'anytime',    // prayer-time anchor: subuh|zohor|asar|maghrib|isyak|sebelumTidur|anytime
        recurring: body.recurring === 'perPrayer' ? 'perPrayer' : 'daily',  // 'daily' (1x/day) or 'perPrayer' (5x/day)
        title: body.title.trim(),
        desc: body.desc || '',
        points: body.points ?? 10,
        frequency: body.frequency || 'daily',
        active: true,
        assignedBy: session.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('habits').insertOne(habit)
      const { _id, ...clean } = habit
      return json({ habit: clean })
    }

    // PATCH /habits/:id  → update habit
    if (route.match(/^\/habits\/[^/]+$/) && method === 'PATCH') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const habitId = route.split('/')[2]
      const body = await request.json().catch(() => ({}))
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)

      const allowed = ['title', 'desc', 'category', 'session', 'recurring', 'points', 'frequency', 'active']
      const $set = { updatedAt: new Date() }
      for (const k of allowed) if (k in body) $set[k] = body[k]
      if ('autoVerify' in body) {
        $set.autoVerify = !!body.autoVerify
        $set.trustOptOut = !body.autoVerify        // parent turned it off → don't auto re-enable
        if (body.autoVerify) { $set.trustSince = new Date(); $set.trustAuto = false }
      }

      const result = await db.collection('habits').updateOne(
        { id: habitId, familyId: user.familyId },
        { $set }
      )
      if (result.matchedCount === 0) return err('Habit tidak dijumpai', 404)
      const updated = await db.collection('habits').findOne({ id: habitId }, { projection: { _id: 0 } })
      return json({ habit: updated })
    }

    // DELETE /habits/:id
    if (route.match(/^\/habits\/[^/]+$/) && method === 'DELETE') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const habitId = route.split('/')[2]
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const result = await db.collection('habits').deleteOne({ id: habitId, familyId: user.familyId })
      if (result.deletedCount === 0) return err('Habit tidak dijumpai', 404)
      // Cascade delete related claims
      await db.collection('habit_claims').deleteMany({ habitId })
      return json({ ok: true })
    }

    // POST /habits/:id/claim  → child (Kid Mode) or parent (Parent Log) marks habit
    // Body: { childId?, status?: 'claimed'|'skipped'|'verified', rubric?: 'ihsan'|'sah'|'belum', note?, session? }
    //  - If rubric provided (parent-log mode): create as verified with rubric + pointsAwarded (writes verify_log too)
    //  - Otherwise: default 'claimed' → goes into verify queue (Kid Mode flow)
    //  - `session` used ONLY for perPrayer recurring habits — allows 5 independent claims/day
    if (route.match(/^\/habits\/[^/]+\/claim$/) && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const habitId = route.split('/')[2]
      const body = await request.json().catch(() => ({}))
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)

      const habit = await db.collection('habits').findOne({ id: habitId, familyId: user.familyId })
      if (!habit) return err('Habit tidak dijumpai', 404)

      const dateStr = body.dateStr || new Date().toISOString().slice(0, 10)
      const rubric = body.rubric
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : ''

      // Determine claim session (perPrayer habits scope claims by prayer session)
      const isPerPrayer = isPerPrayerHabit(habit)
      const claimSession = isPerPrayer && body.session ? String(body.session) : null
      // For perPrayer, session is required (unique per session per day)
      if (isPerPrayer && !claimSession) return err('Session required for per-prayer habits', 400)
      // Build the composite claim key (session included only for perPrayer)
      const claimKey = claimSession
        ? { habitId, dateStr, session: claimSession }
        : { habitId, dateStr, session: { $in: [null, undefined] } }

      // Parent-log inline verification: rubric provided → record as verified/deleted immediately
      if (rubric) {
        if (!['ihsan', 'sah', 'belum'].includes(rubric)) return err('Invalid rubric', 400)
        const prevClaim = await db.collection('habit_claims').findOne(claimKey)
        if (rubric === 'belum') {
          // Undo/delete existing claim if any
          await db.collection('habit_claims').deleteOne(claimKey)
          await applyMataDelta(db, habit.childId, prevClaim, null)
          await db.collection('verify_log').insertOne({
            habitId, dateStr, childId: habit.childId, familyId: user.familyId,
            rubric, note, points: 0, session: claimSession,
            verifiedBy: session.userId, verifiedAt: new Date(),
          })
          return json({ ok: true, rubric, points: 0, removed: true })
        }
        const basePts = Number(habit.points) || 0
        const points = rubric === 'ihsan' ? Math.round(basePts * 1.5) : basePts
        const claimData = {
          habitId,
          childId: habit.childId,
          familyId: habit.familyId,
          dateStr,
          session: claimSession,
          status: 'verified',
          rubric,
          note,
          pointsAwarded: points,
          excellence: rubric === 'ihsan',
          claimedAt: new Date(),
          claimedBy: session.userId,
          verifiedBy: session.userId,
          verifiedAt: new Date(),
        }
        // Upsert using positive key (session set to specific value for perPrayer, or null for daily)
        const upsertKey = claimSession
          ? { habitId, dateStr, session: claimSession }
          : { habitId, dateStr, session: null }
        await db.collection('habit_claims').updateOne(
          upsertKey,
          { $set: claimData },
          { upsert: true }
        )
        await applyMataDelta(db, habit.childId, prevClaim, claimData)
        await db.collection('verify_log').insertOne({
          habitId, dateStr, childId: habit.childId, familyId: user.familyId,
          rubric, note, points, session: claimSession,
          verifiedBy: session.userId, verifiedAt: new Date(),
        })
        const trusted = await checkAutoTrust(db, habit, dateStr)
        return json({ ok: true, rubric, points, excellence: rubric === 'ihsan', trusted })
      }

      // Regular claim (Kid Mode or plain toggle)
      const status = body.status || 'claimed'  // 'claimed' | 'verified' | 'rejected' | 'skipped'
      const claimData = {
        habitId,
        childId: habit.childId,
        familyId: habit.familyId,
        dateStr,
        session: claimSession,
        status,
        claimedAt: new Date(),
        claimedBy: session.userId,
      }
      const upsertKey = claimSession
        ? { habitId, dateStr, session: claimSession }
        : { habitId, dateStr, session: null }
      await db.collection('habit_claims').updateOne(
        upsertKey,
        { $set: claimData },
        { upsert: true }
      )
      // Mod Percaya: trusted habit → verify instantly as 'sah' (no parent action needed)
      if (habit.autoVerify && status === 'claimed') {
        const doc = await db.collection('habit_claims').findOne(upsertKey)
        const points = await verifyClaimDoc(db, { claim: doc, habit, rubric: 'sah', verifierId: 'trust', applyMataDelta, auto: true })
        return json({ ok: true, claim: { ...claimData, status: 'verified', rubric: 'sah', pointsAwarded: points, autoVerified: true }, autoVerified: true })
      }
      return json({ ok: true, claim: claimData })
    }

    // DELETE /habits/:id/claim  → undo today's claim (used by Kid Mode + parent toggle)
    // Query params: ?dateStr=YYYY-MM-DD&session=<sessionId>  (session used for perPrayer)
    // Only allowed if claim exists and status is 'claimed' (not yet verified) OR it's your own verified claim from parent-log
    if (route.match(/^\/habits\/[^/]+\/claim$/) && method === 'DELETE') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const habitId = route.split('/')[2]
      const url = new URL(request.url)
      const dateStr = url.searchParams.get('dateStr') || new Date().toISOString().slice(0, 10)
      const claimSession = url.searchParams.get('session') || null
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const claimKey = claimSession
        ? { habitId, dateStr, session: claimSession, familyId: user.familyId }
        : { habitId, dateStr, familyId: user.familyId, session: { $in: [null, undefined] } }
      const claim = await db.collection('habit_claims').findOne(claimKey)
      if (!claim) return json({ ok: true, removed: false })
      const deleteKey = claimSession
        ? { habitId, dateStr, session: claimSession }
        : { habitId, dateStr, session: { $in: [null, undefined] } }
      await db.collection('habit_claims').deleteOne(deleteKey)
      await applyMataDelta(db, claim.childId, claim, null)
      return json({ ok: true, removed: true })
    }

    // GET /verify-queue  → list pending claims across all children in family (count only)
    if (route === '/verify-queue' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ claims: [] })

      const todayStr = new Date().toISOString().slice(0, 10)
      const claims = await db.collection('habit_claims')
        .find({ familyId: user.familyId, status: 'claimed', dateStr: todayStr })
        .project({ _id: 0 })
        .toArray()
      return json({ claims })
    }

    // GET /verify-queue/items  → enriched pending items (with habit + child data joined)
    if (route === '/verify-queue/items' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ items: [] })

      const todayStr = new Date().toISOString().slice(0, 10)
      const claims = await db.collection('habit_claims')
        .find({ familyId: user.familyId, status: 'claimed', dateStr: todayStr })
        .sort({ claimedAt: -1 })
        .project({ _id: 0 })
        .toArray()

      if (claims.length === 0) return json({ items: [] })

      // Batch fetch related habits & children
      const habitIds = [...new Set(claims.map(c => c.habitId))]
      const childIds = [...new Set(claims.map(c => c.childId))]
      const [habits, childrenList] = await Promise.all([
        db.collection('habits').find({ id: { $in: habitIds } }).project({ _id: 0 }).toArray(),
        db.collection('children').find({ id: { $in: childIds } }).project({ _id: 0 }).toArray(),
      ])
      const habitMap = Object.fromEntries(habits.map(h => [h.id, h]))
      const childMap = Object.fromEntries(childrenList.map(c => [c.id, c]))

      const items = claims.map(c => ({
        claimId: `${c.habitId}__${c.dateStr}`,
        habitId: c.habitId,
        childId: c.childId,
        dateStr: c.dateStr,
        status: c.status,
        claimedAt: c.claimedAt,
        claimedBy: c.claimedBy,
        habit: habitMap[c.habitId] || null,
        child: childMap[c.childId] || null,
      })).filter(i => i.habit && i.child)

      return json({ items })
    }

    // POST /verify-queue/items/:claimId/verify  → apply rubric grade
    // Body: { rubric: 'ihsan' | 'sah' | 'belum', note?: string }
    // - ihsan: full points × 1.5 (rounded), status='verified', excellence=true
    // - sah:   full points × 1.0, status='verified'
    // - belum: 0 points, claim REMOVED (child can retry today)
    if (route.match(/^\/verify-queue\/items\/[^/]+\/verify$/) && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const parts = route.split('/')
      const claimId = parts[3]
      const [habitId, dateStr] = claimId.split('__')
      if (!habitId || !dateStr) return err('Invalid claim id', 400)

      const body = await request.json().catch(() => ({}))
      const rubric = body.rubric
      if (!['ihsan', 'sah', 'belum'].includes(rubric)) return err('Invalid rubric', 400)
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : ''

      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)

      const claim = await db.collection('habit_claims').findOne({ habitId, dateStr, familyId: user.familyId })
      if (!claim) return err('Claim not found', 404)
      if (claim.status !== 'claimed') return err('Claim already processed', 409)

      const habit = await db.collection('habits').findOne({ id: habitId, familyId: user.familyId })
      if (!habit) return err('Habit not found', 404)

      // 'belum' → remove claim so child can retry today
      if (rubric === 'belum') {
        await db.collection('habit_claims').deleteOne({ habitId, dateStr })
        await applyMataDelta(db, claim.childId, claim, null)
        // audit trail
        await db.collection('verify_log').insertOne({
          habitId, dateStr, childId: claim.childId, familyId: user.familyId,
          rubric, note, points: 0,
          verifiedBy: session.userId, verifiedAt: new Date(),
        })
        return json({ ok: true, rubric, points: 0, removed: true })
      }

      // 'ihsan' / 'sah'
      const basePts = Number(habit.points) || 0
      const points = rubric === 'ihsan' ? Math.round(basePts * 1.5) : basePts
      const nextClaim = {
        ...claim,
        status: 'verified',
        rubric,
        pointsAwarded: points,
        excellence: rubric === 'ihsan',
      }
      await db.collection('habit_claims').updateOne(
        { habitId, dateStr },
        { $set: {
            status: 'verified',
            rubric,
            note,
            pointsAwarded: points,
            excellence: rubric === 'ihsan',
            verifiedBy: session.userId,
            verifiedAt: new Date(),
          } }
      )
      await applyMataDelta(db, claim.childId, claim, nextClaim)
      await db.collection('verify_log').insertOne({
        habitId, dateStr, childId: claim.childId, familyId: user.familyId,
        rubric, note, points,
        verifiedBy: session.userId, verifiedAt: new Date(),
      })
      const trusted = await checkAutoTrust(db, habit, dateStr)

      return json({ ok: true, rubric, points, excellence: rubric === 'ihsan', trusted })
    }

    // POST /verify-queue/verify-all  { rubric?: 'sah'|'ihsan', claimIds?: string[], childId?: string }
    //   → Sahkan Pantas: verify every pending claim today (optionally filtered) in one tap.
    if (route === '/verify-queue/verify-all' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const rubric = body.rubric === 'ihsan' ? 'ihsan' : 'sah'
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const q = { familyId: user.familyId, status: 'claimed', dateStr: utcToday() }
      if (typeof body.childId === 'string') q.childId = body.childId
      let claims = await db.collection('habit_claims').find(q).toArray()
      if (Array.isArray(body.claimIds) && body.claimIds.length) {
        const want = new Set(body.claimIds.map(String))
        claims = claims.filter(c => want.has(`${c.habitId}__${c.dateStr}`) || want.has(`${c.habitId}__${c.dateStr}__${c.session}`))
      }
      const habits = await db.collection('habits').find({ id: { $in: [...new Set(claims.map(c => c.habitId))] }, familyId: user.familyId }).toArray()
      const hMap = Object.fromEntries(habits.map(h => [h.id, h]))
      let verified = 0, points = 0
      const trustedNow = []
      for (const claim of claims) {
        const habit = hMap[claim.habitId]
        if (!habit) continue
        points += await verifyClaimDoc(db, { claim, habit, rubric, verifierId: session.userId, applyMataDelta })
        verified++
      }
      for (const h of habits) if (await checkAutoTrust(db, h)) trustedNow.push({ habitId: h.id, title: h.title, childId: h.childId })
      return json({ ok: true, verified, points, rubric, trustedNow })
    }

    // ═══ Family Display Config ═══════════════════════════════════
    // Stored on families doc as `displayConfig`.
    // GET /family/display-config
    if (route === '/family/display-config' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ config: null })
      const family = await db.collection('families').findOne({ id: user.familyId })
      return json({ config: family?.displayConfig || null })
    }
    // POST /family/display-config  { photos, slideshowSec, showHabits, familyMotto, showHadith, showDoa,
    //   azanEnabled, azanId, azanFajrId, azanVolume, preAzanEnabled, preAzanMin }
    if (route === '/family/display-config' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      // Photos — array of {url, focalX%, focalY%, title} objects (with legacy string support)
      const photosRaw = Array.isArray(body.photos) ? body.photos.slice(0, 20) : []
      const photos = photosRaw
        .map(p => {
          if (typeof p === 'string' && p.trim() && p.length < 800) return { url: p.trim(), focalX: 50, focalY: 50, title: '' }
          if (p && typeof p === 'object' && typeof p.url === 'string' && p.url.length < 800) {
            return {
              url: p.url.trim(),
              focalX: typeof p.focalX === 'number' ? Math.max(0, Math.min(100, p.focalX)) : 50,
              focalY: typeof p.focalY === 'number' ? Math.max(0, Math.min(100, p.focalY)) : 50,
              title: typeof p.title === 'string' ? p.title.slice(0, 60) : '',
            }
          }
          return null
        })
        .filter(x => x && x.url)
      const slideshowSec = Math.min(60, Math.max(3, Number(body.slideshowSec) || 10))
      const showHabits = !!body.showHabits
      const showHadith = body.showHadith !== false
      const showDoa = body.showDoa !== false
      const familyMotto = String(body.familyMotto || '').trim().slice(0, 140)
      // Azan / audio config
      const azanEnabled = !!body.azanEnabled
      const azanId = String(body.azanId || 'makkah').trim().slice(0, 40)
      const azanFajrId = String(body.azanFajrId || 'fajr-makkah').trim().slice(0, 40)
      const azanVolume = Math.min(100, Math.max(0, Number(body.azanVolume ?? 80)))
      const preAzanEnabled = body.preAzanEnabled !== false
      const preAzanMin = [0, 5, 10, 15, 20, 30].includes(Number(body.preAzanMin)) ? Number(body.preAzanMin) : 10
      // Dim mode (night)
      const dimEnabled = !!body.dimEnabled
      const dimStartHour = Math.min(23, Math.max(0, Number(body.dimStartHour ?? 22)))
      const dimEndHour = Math.min(23, Math.max(0, Number(body.dimEndHour ?? 6)))
      const dimLevel = Math.min(100, Math.max(10, Number(body.dimLevel ?? 30)))
      // Background audio (MP3Quran / direct MP3 URL or playlist array)
      const bgAudioEnabled = !!body.bgAudioEnabled
      const bgAudioUrl = String(body.bgAudioUrl || '').trim().slice(0, 500)
      const bgAudioVolume = Math.min(100, Math.max(0, Number(body.bgAudioVolume ?? 25)))
      // Playlist: array of { url, title, surah?, reciter? } — max 150 items (full quran + extras)
      const bgAudioPlaylist = Array.isArray(body.bgAudioPlaylist)
        ? body.bgAudioPlaylist
            .filter(x => x && typeof x.url === 'string' && x.url.length < 500)
            .slice(0, 150)
            .map(x => ({
              url: String(x.url).trim(),
              title: String(x.title || '').slice(0, 100),
              surah: typeof x.surah === 'number' ? x.surah : undefined,
              reciter: typeof x.reciter === 'string' ? x.reciter.slice(0, 30) : undefined,
            }))
        : []
      // Display language override — force TV to render in this lang regardless of browser localStorage
      const validLangs = ['ms', 'en', 'id', 'ar']
      const displayLang = validLangs.includes(body.displayLang) ? body.displayLang : null
      const config = {
        photos, slideshowSec, showHabits, showHadith, showDoa, familyMotto,
        azanEnabled, azanId, azanFajrId, azanVolume, preAzanEnabled, preAzanMin,
        dimEnabled, dimStartHour, dimEndHour, dimLevel,
        bgAudioEnabled, bgAudioUrl, bgAudioPlaylist, bgAudioVolume,
        displayLang,
        updatedAt: new Date(),
      }
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      await db.collection('families').updateOne({ id: user.familyId }, { $set: { displayConfig: config } })
      return json({ ok: true, config })
    }

    // ═══ Family Display Mode (Prayer Times + ambient data) ══════════════
    // Aladhan API is used for prayer times. Free, no key, standard REST.
    // Prayer location is stored on families doc as { city, country, method, latitude?, longitude? }.

    // GET /family/prayer-location
    if (route === '/family/prayer-location' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ location: null })
      const family = await db.collection('families').findOne({ id: user.familyId })
      return json({ location: family?.prayerLocation || null })
    }

    // POST /family/prayer-location  { city, country, method?, latitude?, longitude? }
    if (route === '/family/prayer-location' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const city = String(body.city || '').trim().slice(0, 80)
      const country = String(body.country || '').trim().slice(0, 80)
      const methodId = Number(body.method) || 3  // 3 = Muslim World League
      const latitude = body.latitude != null ? Number(body.latitude) : null
      const longitude = body.longitude != null ? Number(body.longitude) : null
      if (!city || !country) return err('city and country required', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const loc = { city, country, method: methodId, latitude, longitude, updatedAt: new Date() }
      await db.collection('families').updateOne({ id: user.familyId }, { $set: { prayerLocation: loc } })
      return json({ ok: true, location: loc })
    }

    // GET /family/prayer-times  → today's prayer timings (cached daily per family)
    // Response: { date, timings: { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha }, location }
    if (route === '/family/prayer-times' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const family = await db.collection('families').findOne({ id: user.familyId })
      const loc = family?.prayerLocation
      if (!loc) return err('Prayer location not set', 404)

      // ═══ Compute LOCAL date at the user's location (fix bug: UTC date wrong for early morning) ═══
      // Malaysia is UTC+8; at 01:00 AM MY = 17:00 UTC previous day → UTC date is WRONG day.
      // Estimate timezone offset from longitude (each 15° = 1 hour). Aladhan returns times in
      // the location's local timezone, so we must request the correct LOCAL day.
      const lonForOffset = (loc.longitude != null) ? Number(loc.longitude) : 0
      const offsetHrs = Math.round(lonForOffset / 15)  // approx UTC offset for location
      const localMs = Date.now() + offsetHrs * 3600 * 1000
      const local = new Date(localMs)  // treat via getUTC* to read local components
      const localY = local.getUTCFullYear()
      const localM = local.getUTCMonth() + 1
      const localD = local.getUTCDate()
      const dateStr = `${localY}-${String(localM).padStart(2, '0')}-${String(localD).padStart(2, '0')}`

      // Check cache
      const cached = await db.collection('prayer_times_cache').findOne({
        familyId: user.familyId, dateStr,
      })
      if (cached) return json({ date: dateStr, timings: cached.timings, location: loc })

      // Fetch from Aladhan — use LOCAL day and include tune=0 for exact Aladhan output
      const dayParam = `${String(localD).padStart(2, '0')}-${String(localM).padStart(2, '0')}-${localY}`
      let url
      if (loc.latitude != null && loc.longitude != null) {
        url = `https://api.aladhan.com/v1/timings/${dayParam}?latitude=${loc.latitude}&longitude=${loc.longitude}&method=${loc.method || 3}&school=0`
      } else {
        url = `https://api.aladhan.com/v1/timingsByCity/${dayParam}?city=${encodeURIComponent(loc.city)}&country=${encodeURIComponent(loc.country)}&method=${loc.method || 3}&school=0`
      }
      try {
        const r = await fetch(url, { headers: { 'accept': 'application/json' } })
        if (!r.ok) return err('Aladhan API error', 502)
        const data = await r.json()
        const raw = data?.data?.timings || {}
        // Keep only the ones we display
        const timings = {
          Fajr: raw.Fajr, Sunrise: raw.Sunrise, Dhuhr: raw.Dhuhr,
          Asr: raw.Asr, Maghrib: raw.Maghrib, Isha: raw.Isha,
        }
        await db.collection('prayer_times_cache').updateOne(
          { familyId: user.familyId, dateStr },
          { $set: { familyId: user.familyId, dateStr, timings, fetchedAt: new Date() } },
          { upsert: true }
        )
        return json({ date: dateStr, timings, location: loc })
      } catch (e) {
        return err('Failed to fetch prayer times', 502)
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // WORLD ENGINE — Phaser 3 world state per child
    // ═══════════════════════════════════════════════════════════════════
    // Schema (collection: family_worlds):
    //   { id, childId, familyId, version, buildings: [], demeritCount, createdAt, updatedAt }
    //   buildings[]: { id, templateId, x, y, level, placedAt }
    //
    // GET  /world/:childId          → return state (auto-create with musalla seeded)
    // POST /world/:childId          → save full state (idempotent upsert)
    // POST /world/:childId/build    → append a new building { templateId, x, y }
    // POST /world/:childId/upgrade  → level up building by id
    // POST /world/:childId/demerit  → adjust demeritCount { delta }
    if (route.startsWith('/world/')) {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)

      const parts = route.split('/').filter(Boolean) // ['world', ':childId', ...]
      const childId = parts[1]
      const action = parts[2] || null
      // Verify the child belongs to this family
      const child = await db.collection('children').findOne(
        { id: childId, familyId: user.familyId },
        { projection: { _id: 0, id: 1, nickname: 1, ageBand: 1, favColor: 1 } }
      )
      if (!child) return err('child not found', 404)

      const worldsCol = db.collection('family_worlds')

      // Helper: fetch-or-seed world state for this child
      const loadOrSeed = async () => {
        // One-time migration: strip any auto-placed mosque landmarks that
        // may exist from previous auto-placement rules. Both retired:
        //   • surau           — Kaabah icon confused kids
        //   • masjid_landmark — name/shape clashed with Musalla L2 "Masjid"
        // Idempotent — $pull is a no-op once these are gone.
        await worldsCol.updateOne(
          { childId },
          { $pull: { buildings: { templateId: { $in: ['masjid_landmark', 'surau'] } } } }
        )

        // ─── Tasik landmark migration (v3, 2026-07-30) ─────────────
        // Every world gets a pre-placed natural lake at top-left corner
        // (13, 13), 4×4 footprint, locked=true. User confirmed testing
        // data may be wiped so we clear ALL non-tasik buildings on first
        // upgrade to v3. Once world.version === 3, migration is a no-op.
        const existingWorld = await worldsCol.findOne({ childId }, { projection: { _id: 0 } })
        if (existingWorld && (existingWorld.version || 1) < 3) {
          const tasikBuilding = {
            id: `bld-tasik-${childId}`,
            templateId: 'tasik',
            x: 13, y: 13,
            level: 1,
            locked: true,
            placedAt: new Date(),
          }
          await worldsCol.updateOne(
            { childId },
            {
              $set: {
                buildings: [tasikBuilding],  // WIPE test data, keep only tasik
                version: 3,
                updatedAt: new Date(),
              },
            }
          )
        }

        let world = await worldsCol.findOne({ childId }, { projection: { _id: 0 } })
        if (!world) {
          // NEW WORLD: seed with tasik already in place. Anak akan build
          // musalla di tengah dunia via ritual pertama.
          world = {
            id: `world-${childId}`,
            childId,
            familyId: user.familyId,
            version: 3,
            buildings: [{
              id: `bld-tasik-${childId}`,
              templateId: 'tasik',
              x: 13, y: 13,
              level: 1,
              locked: true,
              placedAt: new Date(),
            }],
            demeritCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          await worldsCol.insertOne(world)
        }
        return world
      }

      // GET /world/:childId
      if (!action && method === 'GET') {
        const world = await loadOrSeed()
        return json({ world, child })
      }

      // POST /world/:childId → replace full buildings array (used by auto-save)
      if (!action && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const update = { updatedAt: new Date() }
        if (Array.isArray(body.buildings)) update.buildings = body.buildings
        if (typeof body.demeritCount === 'number') update.demeritCount = Math.max(0, body.demeritCount)
        await loadOrSeed() // ensure exists
        await worldsCol.updateOne({ childId }, { $set: update })
        return json({ ok: true })
      }

      // POST /world/:childId/build → append single building
      // Dynamic world bounds: matches lib/worldEngine.js getCurrentBounds().
      // World is a CIRCULAR island (2026-07-26 update) whose radius grows
      // with building count. Radii: 10 (start) → 13 (5+) → 16 (10+) → 19 (15+).
      // Rectangle bounds still returned for iteration + backward compat.
      const worldBoundsFor = (buildings) => {
        const musalla = (buildings || []).find(b => b.templateId === 'musalla')
        const mx = musalla ? musalla.x : 17
        const my = musalla ? musalla.y : 17
        const count = (buildings || []).length
        const radius = count >= 15 ? 19 : count >= 10 ? 16 : count >= 5 ? 13 : 10
        const center = { x: mx + 3.5, y: my + 3.5 }   // heart of the island
        return {
          minX: Math.floor(center.x - radius - 1),
          maxX: Math.ceil(center.x + radius + 1),
          minY: Math.floor(center.y - radius - 1),
          maxY: Math.ceil(center.y + radius + 1),
          center, radius,
        }
      }
      // Every cell of a candidate footprint must sit inside the circle.
      // Uses Euclidean grid distance from the island's heart (musalla zone
      // center). Same formula as isCellInWorld() in worldEngine.js.
      const cellInCircle = (x, y, center, radius) => {
        const dx = x - center.x + 0.5
        const dy = y - center.y + 0.5
        return (dx * dx + dy * dy) <= (radius + 0.5) * (radius + 0.5)
      }
      const footprintInCircle = (x, y, w, h, bounds) => {
        if (!bounds.center || bounds.radius == null) return true
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            if (!cellInCircle(x + dx, y + dy, bounds.center, bounds.radius)) return false
          }
        }
        return true
      }

      // ─── Landmark auto-placement ─────────────────────────────────
      // (2026-07-25) — Auto-placed mosque landmarks (Surau @ 5, Masjid Kampung
      // @ 10) telah dibuang. Kedua-dua bertindih visual/nama dengan Musalla
      // upgrade path (Musalla → Masjid → Jami' Masjid) dan mengelirukan
      // kanak-kanak. Sekarang milestone kemajuan ditunjukkan melalui Musalla
      // upgrade path sahaja + pembesaran dunia (18×18 → 24 → 30 → 36 tiles).
      // Landmark auto-placement dilesenkan simpan struktur ini kosong supaya
      // mudah ditambah landmark lain (menara air, taman kota) nanti.
      const AUTO_LANDMARKS = []
      // Overlap check for a candidate (x,y,w,h) against every existing building
      // AND the musalla's reserved 8×8 zone. Effective footprint per building:
      //   - musalla → 8×8 (sacred waqf land reserve, no exceptions)
      //   - surau/masjid_landmark → their landmark footprint
      //   - other → BUILDING_TEMPLATES[t].tileSize (banglo 2×2, rumah_batu 2×2,
      //     rumah_kayu 1×1 etc — user requested this so bigger buildings
      //     never overlap adjacent placements).
      const cellsFree = (buildings, x, y, w, h) => {
        for (const bd of buildings) {
          const t = bd.templateId
          const tpl = BUILDING_TEMPLATES[t]
          const foot = (t === 'musalla')            ? { w: 8, h: 8 } :
                       (t === 'surau')              ? { w: 2, h: 2 } :
                       (t === 'masjid_landmark')    ? { w: 3, h: 3 } :
                       (tpl?.tileSize)              ? tpl.tileSize :
                       (t === 'kebun' || t === 'rumah') ? { w: 1, h: 1 } : { w: 1, h: 1 }
          if (x < bd.x + foot.w && x + w > bd.x && y < bd.y + foot.h && y + h > bd.y) return false
        }
        return true
      }
      const tryPlaceLandmarks = async (buildings) => {
        const musalla = buildings.find(b => b.templateId === 'musalla')
        if (!musalla) return { placed: [], buildings }
        // Count ONLY user-placed buildings (exclude musalla + past landmarks)
        const userCount = buildings.filter(b => b.templateId !== 'musalla' && b.templateId !== 'surau' && b.templateId !== 'masjid_landmark').length
        const bounds = worldBoundsFor(buildings)
        const placed = []
        for (const lm of AUTO_LANDMARKS) {
          const already = buildings.some(b => b.templateId === lm.templateId)
          if (already || userCount < lm.milestone) continue
          // Try each candidate anchor, first-free wins
          let target = null
          for (const c of lm.candidates) {
            const x = musalla.x + c.dx
            const y = musalla.y + c.dy
            if (x < bounds.minX || y < bounds.minY || x + lm.tileSize.w > bounds.maxX || y + lm.tileSize.h > bounds.maxY) continue
            if (!cellsFree(buildings, x, y, lm.tileSize.w, lm.tileSize.h)) continue
            target = { x, y }
            break
          }
          // Fallback: scan outward in a spiral from musalla until we find a free cell
          if (!target) {
            outer: for (let r = 3; r <= 12; r++) {
              for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                  if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
                  const x = musalla.x + dx
                  const y = musalla.y + dy
                  if (x < bounds.minX || y < bounds.minY || x + lm.tileSize.w > bounds.maxX || y + lm.tileSize.h > bounds.maxY) continue
                  if (!cellsFree(buildings, x, y, lm.tileSize.w, lm.tileSize.h)) continue
                  target = { x, y }
                  break outer
                }
              }
            }
          }
          if (!target) continue
          const landmarkBuilding = {
            id: `lm-${lm.templateId}-${Date.now()}`,
            templateId: lm.templateId,
            x: target.x, y: target.y,
            level: 1,
            placedAt: new Date(),
            isAutoLandmark: true,
          }
          buildings = [...buildings, landmarkBuilding]
          placed.push(landmarkBuilding)
        }
        return { placed, buildings }
      }

      if (action === 'build' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const { templateId, x, y } = body
        if (!templateId || typeof x !== 'number' || typeof y !== 'number') {
          return err('Missing templateId/x/y', 400)
        }
        // Block user attempts to build tasik — it's an auto-placed landmark.
        // The template is hidden in the sidebar, but this catches API-level
        // spoofing / stale clients.
        const tplToBuild = BUILDING_TEMPLATES[templateId]
        if (tplToBuild?.locked === true || tplToBuild?.hidden === true) {
          return err('Landmark ini adalah anugerah Allah — tidak boleh dibina manusia', 400)
        }
        await loadOrSeed()
        const world = await worldsCol.findOne({ childId })
        const buildings = world?.buildings || []
        // Bounds check: cell (and its footprint) must fit within current dynamic bounds.
        // TILE_SIZES = legacy hardcoded fallback for musalla/surau/masjid_landmark
        // (which don't live in BUILDING_TEMPLATES with matching keys). For all
        // other templates (banglo 2×2, rumah_batu 2×2, rumah_kayu 1×1, etc.)
        // we look up BUILDING_TEMPLATES[t].tileSize.
        const TILE_SIZES = {
          musalla: { w: 2, h: 2 },
          surau: { w: 2, h: 2 },
          masjid_landmark: { w: 3, h: 3 },
        }
        const footFor = (tid) => {
          if (TILE_SIZES[tid]) return TILE_SIZES[tid]
          const tpl = BUILDING_TEMPLATES[tid]
          return tpl?.tileSize || { w: 1, h: 1 }
        }
        // Sacred reserved footprint — musalla pre-reserves 8×8 (large buffer
        // so the tall Jami' Masjid L3 with 2 minarets doesn't visually block
        // houses behind it). Mosque now centers on this 8×8 zone (all levels
        // same position). Auto-landmarks reserve their own exact footprint.
        const RESERVED = {
          musalla: { w: 8, h: 8 },
          surau: { w: 2, h: 2 },
          masjid_landmark: { w: 3, h: 3 },
        }
        const sz = footFor(templateId)
        const b = worldBoundsFor(buildings)
        if (x < b.minX || y < b.minY || x + sz.w > b.maxX || y + sz.h > b.maxY) {
          return err('out of bounds', 400)
        }
        // ── Circular island membership ──────────────────────────
        // The world is a round island — every cell of the footprint must sit
        // inside the circle centered on the Musalla's sacred zone.
        if (!footprintInCircle(x, y, sz.w, sz.h, b)) {
          return err('outside island', 400)
        }
        // Reserved-zone overlap: reject if this placement overlaps any
        // building's RESERVED footprint (musalla's 8×8 sacred zone) or its
        // regular tile footprint (banglo 2×2 etc.).
        for (const bd of buildings) {
          const s = RESERVED[bd.templateId] || footFor(bd.templateId)
          const overlapsX = x < bd.x + s.w && x + sz.w > bd.x
          const overlapsY = y < bd.y + s.h && y + sz.h > bd.y
          if (overlapsX && overlapsY) {
            return err('cell reserved (sacred zone or building)', 409)
          }
        }
        const newBuilding = {
          id: `bld-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
          templateId, x, y, level: 1, placedAt: new Date(),
        }
        // Optimistically compute buildings AFTER the new insert, then decide
        // whether any milestone landmarks should also be auto-placed. This
        // keeps landmark placement authoritative on the server (no client
        // trust needed) and returns the new landmarks in the response so the
        // client can play a celebratory overlay.
        const afterInsert = [...buildings, newBuilding]
        const { placed: newLandmarks, buildings: withLandmarks } = await tryPlaceLandmarks(afterInsert)
        let finalBuildings = newLandmarks.length > 0 ? withLandmarks : afterInsert

        // ── AUTO-UPGRADE MUSALLA ──────────────────────────────────
        // Once rumah count crosses the required threshold (7 for L2, 15 for L3),
        // the musalla auto-upgrades — kid doesn't need to press any button.
        // Teaches the pedagogical loop: "the more houses/jemaah, the bigger
        // the mosque". Returned metadata triggers a celebratory notification
        // on the client with contextual language explaining the growth.
        let autoUpgrade = null
        const musallaBd = finalBuildings.find(b => b.templateId === 'musalla')
        if (musallaBd) {
          // Count rumah variants (all fall under 'rumah' category).
          const rumahCount = finalBuildings.filter(b => {
            const tpl = BUILDING_TEMPLATES[b.templateId]
            return tpl?.category === 'rumah'
          }).length
          const curLvl = musallaBd.level || 1
          const nextLvl = curLvl + 1
          const AUTO_REQS = { 2: 7, 3: 15 }
          if (nextLvl <= 3 && AUTO_REQS[nextLvl] && rumahCount >= AUTO_REQS[nextLvl]) {
            // Bump musalla level in the finalBuildings array so persistence
            // reflects the new level (same source-of-truth write below).
            finalBuildings = finalBuildings.map(b =>
              b.id === musallaBd.id ? { ...b, level: nextLvl } : b
            )
            autoUpgrade = {
              buildingId: musallaBd.id,
              fromLevel: curLvl,
              toLevel: nextLvl,
              rumahCount,
              levelName: nextLvl === 2 ? 'Masjid' : 'Jami\u2019 Masjid',
            }
          }
        }

        // Persist: use full replace if we auto-upgraded OR placed landmarks,
        // else the cheaper $push (just the one new building).
        if (autoUpgrade || newLandmarks.length > 0) {
          await worldsCol.updateOne(
            { childId },
            { $set: { buildings: finalBuildings, updatedAt: new Date() } }
          )
        } else {
          await worldsCol.updateOne(
            { childId },
            { $push: { buildings: newBuilding }, $set: { updatedAt: new Date() } }
          )
        }
        return json({ ok: true, building: newBuilding, newLandmarks, autoUpgrade })
      }

      // POST /world/:childId/upgrade → level up by building id
      if (action === 'upgrade' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const { buildingId } = body
        if (!buildingId) return err('Missing buildingId', 400)
        // Enforce progressive-unlock: musalla → masjid needs 7 houses, → jami masjid needs 15
        const world = await worldsCol.findOne({ childId })
        const target = (world?.buildings || []).find(b => b.id === buildingId)
        if (!target) return err('building not found', 404)
        // Only Musalla can be upgraded — user removed non-musalla upgrades on
        // 2026-07-25 ("kita sudah introduce binaan ikut bilangan mata, jadi
        // tak perlu lagi ada naik taraf binaan"). Other buildings max out at L1.
        if (target.templateId !== 'musalla') {
          return err('Only Musalla can be upgraded', 400)
        }
        const nextLevel = (target.level || 1) + 1
        if (nextLevel > 3) return err('already at max level', 400)
        // Musalla upgrade requirements from worldEngine.upgradeRequires
        // The requirement key 'rumah' means ANY house variant in the 'rumah'
        // category — rumah_kayu, rumah_batu, banglo. Falling back to string-
        // equality would never match since children build variants, not the
        // legacy 'rumah' base template.
        const MUSALLA_REQS = { 2: { rumah: 7 }, 3: { rumah: 15 } }
        if (MUSALLA_REQS[nextLevel]) {
          const reqs = MUSALLA_REQS[nextLevel]
          // Categorise every existing building so we can count by category
          // (fall back to templateId for older seeds that used raw 'rumah').
          const bldByCat = {}
          for (const b of (world.buildings || [])) {
            // Category is derived server-side via the same BUILDING_TEMPLATES
            // map used client-side (rumah_kayu → 'rumah', banglo → 'rumah').
            const tpl = BUILDING_TEMPLATES[b.templateId]
            const cat = tpl?.category || b.templateId
            bldByCat[cat] = (bldByCat[cat] || 0) + 1
          }
          for (const [catOrId, need] of Object.entries(reqs)) {
            const have = bldByCat[catOrId] || 0
            if (have < need) {
              return err(`Need ${need} ${catOrId} to upgrade (have ${have})`, 400)
            }
          }
        }
        const r = await worldsCol.updateOne(
          { childId, 'buildings.id': buildingId },
          { $inc: { 'buildings.$.level': 1 }, $set: { updatedAt: new Date() } }
        )
        if (r.matchedCount === 0) return err('building not found', 404)
        return json({ ok: true })
      }

      // POST /world/:childId/move → move an existing building to new grid cell { buildingId, x, y }
      // Rules: cannot move the Musalla (it's the anchor); target cell must not
      // overlap any other building's footprint. Uses BUILDING_TEMPLATES sizes.
      if (action === 'move' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const { buildingId, x, y } = body
        if (!buildingId || typeof x !== 'number' || typeof y !== 'number') {
          return err('Missing buildingId/x/y', 400)
        }
        await loadOrSeed()
        const world = await worldsCol.findOne({ childId })
        if (!world) return err('world not found', 404)
        const buildings = world.buildings || []
        const target = buildings.find(b => b.id === buildingId)
        if (!target) return err('building not found', 404)
        if (target.templateId === 'musalla') return err('Musalla cannot be moved', 400)
        // Auto-landmarks (Surau, Masjid, Tasik) are also sacred + fixed positions.
        if (target.templateId === 'surau' || target.templateId === 'masjid_landmark') {
          return err('Landmark cannot be moved', 400)
        }
        // Any building flagged `locked: true` (currently: tasik) is immutable.
        if (target.locked === true) {
          return err('Anugerah Allah tidak boleh dialihkan', 400)
        }

        // Footprint lookup — musalla/surau/masjid_landmark use hardcoded
        // legacy sizes; everything else (banglo 2×2, rumah_batu 2×2, etc.)
        // pulls its tileSize from BUILDING_TEMPLATES.
        const TILE_SIZES = {
          musalla: { w: 2, h: 2 },
          surau: { w: 2, h: 2 },
          masjid_landmark: { w: 3, h: 3 },
        }
        const footFor = (tid) => {
          if (TILE_SIZES[tid]) return TILE_SIZES[tid]
          const tpl = BUILDING_TEMPLATES[tid]
          return tpl?.tileSize || { w: 1, h: 1 }
        }
        const targetSize = footFor(target.templateId)
        // Dynamic bounds — matches lib/worldEngine.js. Musalla stays centered.
        const b = worldBoundsFor(buildings)
        if (x < b.minX || y < b.minY || x + targetSize.w > b.maxX || y + targetSize.h > b.maxY) {
          return err('out of bounds', 400)
        }
        // Circular island — footprint must be within the round world.
        if (!footprintInCircle(x, y, targetSize.w, targetSize.h, b)) {
          return err('outside island', 400)
        }
        // Overlap check (exclude the moving building itself). Also enforce
        // the sacred RESERVED zone: musalla reserves 8×8 (large buffer so
        // tall Jami' Masjid L3 with minarets doesn't block houses behind).
        // No other building may move into that sacred zone.
        const RESERVED = {
          musalla: { w: 8, h: 8 },
          surau: { w: 2, h: 2 },
          masjid_landmark: { w: 3, h: 3 },
        }
        for (const b of buildings) {
          if (b.id === buildingId) continue
          const s = RESERVED[b.templateId] || footFor(b.templateId)
          for (let dx = 0; dx < targetSize.w; dx++) {
            for (let dy = 0; dy < targetSize.h; dy++) {
              const tx = x + dx, ty = y + dy
              if (tx >= b.x && tx < b.x + s.w && ty >= b.y && ty < b.y + s.h) {
                return err('cell occupied', 409)
              }
            }
          }
        }
        await worldsCol.updateOne(
          { childId, 'buildings.id': buildingId },
          { $set: {
            'buildings.$.x': x,
            'buildings.$.y': y,
            updatedAt: new Date(),
          } }
        )
        return json({ ok: true })
      }

      // POST /world/:childId/demerit → adjust demerit count { delta, mataDeduct? }
      // Positive delta = parent flagging bad behavior → adds dark clouds.
      // Optional `mataDeduct` (positive integer) tells us HOW MUCH mataReward
      // to deduct — parent picks from a dropdown (5/10/20/50/100) in the
      // DemeritModal. If mataDeduct omitted, falls back to delta itself (1:1).
      // Build points (mataBina) are NEVER touched — those are earned through
      // habits and only spent constructing buildings.
      // Negative delta = istighfar cleanse — removes a cloud but does NOT
      // refund mataReward (spiritual mechanic: seeking forgiveness clears
      // the sin marker but doesn't restore what was already spent).
      if (action === 'demerit' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const delta = Number(body.delta) || 0
        // Clamp mata deduction to [0, 1000] to protect against garbage input.
        const mataDeduct = delta > 0
          ? Math.max(0, Math.min(1000, Number(body.mataDeduct ?? delta) || 0))
          : 0
        await loadOrSeed()
        await worldsCol.updateOne(
          { childId },
          [{ $set: {
            demeritCount: { $max: [0, { $add: [{ $ifNull: ['$demeritCount', 0] }, delta] }] },
            updatedAt: new Date(),
          } }]
        )
        // Deduct mataReward on POSITIVE demerit only. Aggregation pipeline
        // clamps at 0 so a child can never go negative.
        let mataReward = null
        if (delta > 0 && mataDeduct > 0) {
          const db2 = await getDb()
          await db2.collection('children').updateOne(
            { id: childId },
            [{ $set: {
              mataReward: { $max: [0, { $subtract: [{ $ifNull: ['$mataReward', 0] }, mataDeduct] }] },
            } }]
          )
          const c = await db2.collection('children').findOne({ id: childId }, { projection: { mataReward: 1 } })
          mataReward = c?.mataReward ?? 0
        }
        const updated = await worldsCol.findOne({ childId }, { projection: { demeritCount: 1 } })
        return json({
          ok: true,
          demeritCount: updated?.demeritCount || 0,
          ...(mataReward !== null ? { mataReward } : {}),
        })
      }
    }

    // GET /family/display-data  → bundle for ambient display
    // Returns { family, children[compact], streak, todayHabitsDone, todayHabitsTotal }
    if (route === '/family/display-data' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const family = await db.collection('families').findOne({ id: user.familyId }, { projection: { _id: 0, id: 1, familyName: 1, prayerLocation: 1, zikirCount: 1 } })
      const children = await db.collection('children')
        .find({ familyId: user.familyId })
        .project({ _id: 0, id: 1, nickname: 1, avatarId: 1, favColor: 1, mataBina: 1, mataReward: 1 })
        .toArray()

      // Today's habit progress per child
      const now = new Date()
      const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
      const childIds = children.map(c => c.id)
      const habits = await db.collection('habits').find({ childId: { $in: childIds } }).project({ _id: 0, id: 1, childId: 1 }).toArray()
      const habitsByChild = {}
      habits.forEach(h => { habitsByChild[h.childId] = (habitsByChild[h.childId] || 0) + 1 })

      const claimsToday = await db.collection('habit_claims').find({
        childId: { $in: childIds }, dateStr,
        status: { $in: ['claimed', 'verified'] },
      }).project({ _id: 0, childId: 1, status: 1 }).toArray()
      const doneByChild = {}
      claimsToday.forEach(c => { doneByChild[c.childId] = (doneByChild[c.childId] || 0) + 1 })

      const childrenOut = children.map(c => ({
        ...c,
        habitsTotal: habitsByChild[c.id] || 0,
        habitsDone: doneByChild[c.id] || 0,
      }))
      // Undone habits list (for display "belum siap" section)
      const undoneClaims = await db.collection('habit_claims').find({
        childId: { $in: childIds }, dateStr, status: 'verified', rubric: { $in: ['sah', 'ihsan'] }
      }).project({ _id: 0, habitId: 1, childId: 1, rubric: 1 }).toArray()
      const doneSet = new Set(undoneClaims.map(c => `${c.childId}:${c.habitId}`))
      const ihsanHabitSet = new Set(undoneClaims.filter(c => c.rubric === 'ihsan').map(c => `${c.childId}:${c.habitId}`))
      const allHabits = await db.collection('habits').find({ childId: { $in: childIds } })
        .project({ _id: 0, id: 1, childId: 1, title: 1, icon: 1, category: 1, i18n: 1, points: 1, session: 1, recurring: 1, templateId: 1 }).toArray()
      const undoneHabits = allHabits.filter(h => !doneSet.has(`${h.childId}:${h.id}`))

      // Also build sessionsClaimed map for perPrayer habits (needed by TV display Suggestion Card)
      const perPrayerClaimsForDisplay = await db.collection('habit_claims').find({
        childId: { $in: childIds }, dateStr,
        status: { $in: ['claimed', 'verified'] },
        session: { $exists: true, $ne: null },
      }).project({ _id: 0, habitId: 1, session: 1 }).toArray()
      const sessionsClaimedByHabit = {}
      perPrayerClaimsForDisplay.forEach(c => {
        if (!sessionsClaimedByHabit[c.habitId]) sessionsClaimedByHabit[c.habitId] = []
        if (!sessionsClaimedByHabit[c.habitId].includes(c.session)) {
          sessionsClaimedByHabit[c.habitId].push(c.session)
        }
      })

      // Group habits per child with status (for Skylight-style board)
      const habitsByChildDetail = {}
      for (const h of allHabits) {
        const key = `${h.childId}:${h.id}`
        let status = 'pending'
        if (ihsanHabitSet.has(key)) status = 'ihsan'
        else if (doneSet.has(key)) status = 'done'
        if (!habitsByChildDetail[h.childId]) habitsByChildDetail[h.childId] = []
        habitsByChildDetail[h.childId].push({
          id: h.id, title: h.title, icon: h.icon || '⭐',
          category: h.category, i18n: h.i18n, status,
          points: Number(h.points) || 0,
          session: h.session || null,
          recurring: h.recurring || (h.templateId === 'ib-10' ? 'perPrayer' : 'daily'),
          templateId: h.templateId || null,
          sessionsClaimed: sessionsClaimedByHabit[h.id] || [],
        })
      }
      // Sort each child's habits: pending first, then done, then ihsan at top
      Object.values(habitsByChildDetail).forEach(list => {
        list.sort((a, b) => {
          const order = { ihsan: 0, pending: 1, done: 2 }
          return (order[a.status] ?? 3) - (order[b.status] ?? 3)
        })
      })
      // Attach to children output
      childrenOut.forEach(c => { c.habits = habitsByChildDetail[c.id] || [] })

      // Ihsan Star: child with most ihsan-rated claims today (tiebreaker: highest mataBina)
      const ihsanCountByChild = {}
      const verifiedClaims = await db.collection('habit_claims').find({
        childId: { $in: childIds }, dateStr, status: 'verified', rubric: 'ihsan'
      }).project({ _id: 0, childId: 1 }).toArray()
      verifiedClaims.forEach(c => { ihsanCountByChild[c.childId] = (ihsanCountByChild[c.childId] || 0) + 1 })
      let ihsanStar = null
      const maxIhsan = Math.max(0, ...Object.values(ihsanCountByChild))
      if (maxIhsan > 0) {
        const topKids = childrenOut.filter(c => (ihsanCountByChild[c.id] || 0) === maxIhsan)
        // Tie-break by mataBina
        topKids.sort((a, b) => (b.mataBina || 0) - (a.mataBina || 0))
        const star = topKids[0]
        ihsanStar = { id: star.id, nickname: star.nickname, avatarId: star.avatarId, favColor: star.favColor, ihsanCount: maxIhsan }
      }

      // Zikir counter (family-level, resets daily)
      const zikirRaw = family?.zikirCount || {}
      const zikirToday = (zikirRaw.dateKey === dateStr) ? (zikirRaw.today || 0) : 0
      const zikirTotal = zikirRaw.total || 0

      return json({ family, children: childrenOut, undoneHabits, ihsanStar, zikir: { today: zikirToday, total: zikirTotal } })
    }

    // POST /family/zikir/tap  → increment family-shared zikir counter by 1 (auto-reset new day)

    // POST /family/tv-pair/generate  → parent creates a 6-digit code (valid 15 min) for TV pairing
    if (route === '/family/tv-pair/generate' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      // Invalidate any previous unused codes for this family
      await db.collection('tv_pair_codes').deleteMany({ familyId: user.familyId, usedAt: null })
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      await db.collection('tv_pair_codes').insertOne({
        code, familyId: user.familyId, createdBy: session.userId, createdAt: new Date(), expiresAt, usedAt: null,
      })
      return json({ ok: true, code, expiresAt })
    }

    // GET /family/tv-pair/current  → parent checks current active code
    if (route === '/family/tv-pair/current' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const row = await db.collection('tv_pair_codes').findOne({
        familyId: user.familyId, usedAt: null, expiresAt: { $gt: new Date() },
      }, { sort: { createdAt: -1 } })
      if (!row) return json({ code: null })
      return json({ code: row.code, expiresAt: row.expiresAt })
    }

    // POST /tv-pair/redeem  → TV enters code, gets session cookie (no auth required)
    if (route === '/tv-pair/redeem' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const code = String(body.code || '').trim().toUpperCase().slice(0, 8)
      if (!/^[0-9]{6}$/.test(code)) return err('Invalid code format', 400)
      const db = await getDb()
      const row = await db.collection('tv_pair_codes').findOne({ code, usedAt: null, expiresAt: { $gt: new Date() } })
      if (!row) return err('Code invalid or expired', 400)
      const creator = await db.collection('users').findOne({ id: row.createdBy })
      if (!creator) return err('Creator not found', 400)
      // Mark code as used
      await db.collection('tv_pair_codes').updateOne({ _id: row._id }, { $set: { usedAt: new Date() } })
      // Create session for TV (using creator's user identity, scoped by role)
      await createSession({ userId: creator.id, email: creator.email, familyId: creator.familyId, role: 'tv' })
      return json({ ok: true, familyId: creator.familyId })
    }

    if (route === '/family/zikir/tap' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const family = await db.collection('families').findOne({ id: user.familyId }, { projection: { _id: 0, zikirCount: 1 } })
      const now = new Date()
      const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
      const raw = family?.zikirCount || {}
      const today = (raw.dateKey === dateStr) ? (raw.today || 0) + 1 : 1
      const total = (raw.total || 0) + 1
      await db.collection('families').updateOne(
        { id: user.familyId },
        { $set: { zikirCount: { dateKey: dateStr, today, total, updatedAt: now } } }
      )
      return json({ ok: true, today, total })
    }

    // ═══ Quiz ══════════════════════════════════════════════════════
    // POST /quiz/start  { childId }
    // → Starts a new quiz session for a child (1 per day max).
    // → Returns { sessionId, questions: [{ id, prompt, choices, emoji, category }], total }
    //   NOTE: correctIdx is NEVER sent to client.
    if (route === '/quiz/start' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const childId = String(body.childId || '')
      if (!childId) return err('childId required', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const child = await db.collection('children').findOne({ id: childId, familyId: user.familyId })
      if (!child) return err('Child not found', 404)

      // Age band computation from dob
      let ageBand = '7-9'
      if (child.dob) {
        const age = Math.floor((Date.now() - new Date(child.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
        ageBand = age <= 6 ? '3-6' : age <= 9 ? '7-9' : '10-12'
      }

      // One quiz session per day per child
      const today = new Date()
      const dateStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
      const existingToday = await db.collection('quiz_sessions').findOne({ childId, dateStr })
      if (existingToday && existingToday.status === 'completed') {
        return err('Kuiz hari ini sudah selesai. Cuba lagi esok!', 429)
      }
      if (existingToday && existingToday.status === 'in_progress') {
        // Resume session
        const questions = existingToday.questionIds.map(id => QUIZ_QUESTIONS.find(q => q.id === id)).filter(Boolean)
        const clientQuestions = questions.map(q => ({
          id: q.id, prompt: q.prompt, choices: q.choices, emoji: q.emoji, category: q.category,
        }))
        return json({ sessionId: existingToday.id, questions: clientQuestions, total: questions.length, resumeAt: existingToday.answers?.length || 0 })
      }

      const pool = questionsForAge(ageBand)
      const picked = pickRandomQuestions(pool, QUESTIONS_PER_SESSION)
      if (picked.length === 0) return err('No questions available', 500)

      const rec = {
        id: `qz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        childId, familyId: user.familyId, dateStr, ageBand,
        questionIds: picked.map(q => q.id),
        answers: [], correctCount: 0, pointsAwarded: 0,
        status: 'in_progress',
        startedAt: new Date(),
      }
      await db.collection('quiz_sessions').insertOne(rec)

      const clientQuestions = picked.map(q => ({
        id: q.id, prompt: q.prompt, choices: q.choices, emoji: q.emoji, category: q.category,
      }))
      return json({ sessionId: rec.id, questions: clientQuestions, total: picked.length, resumeAt: 0 })
    }

    // POST /quiz/answer  { sessionId, questionId, choiceIdx }
    // → Records the answer & returns { correct, correctIdx, remaining }
    if (route === '/quiz/answer' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const sessionId = String(body.sessionId || '')
      const questionId = String(body.questionId || '')
      const choiceIdx = Number(body.choiceIdx)
      if (!sessionId || !questionId || !Number.isInteger(choiceIdx)) return err('Invalid payload', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const qs = await db.collection('quiz_sessions').findOne({ id: sessionId, familyId: user.familyId })
      if (!qs) return err('Session not found', 404)
      if (qs.status === 'completed') return err('Already completed', 409)
      // Ensure question belongs to this session and not double-answered
      if (!qs.questionIds.includes(questionId)) return err('Bad question for session', 400)
      const already = (qs.answers || []).some(a => a.questionId === questionId)
      if (already) return err('Already answered', 409)

      const q = QUIZ_QUESTIONS.find(x => x.id === questionId)
      if (!q) return err('Question not found', 404)
      const correct = choiceIdx === q.correctIdx
      const answer = { questionId, choiceIdx, correct, at: new Date() }
      const newAnswers = [...(qs.answers || []), answer]
      const newCorrectCount = qs.correctCount + (correct ? 1 : 0)

      await db.collection('quiz_sessions').updateOne(
        { id: sessionId },
        { $push: { answers: answer }, $set: { correctCount: newCorrectCount } }
      )

      const remaining = qs.questionIds.length - newAnswers.length
      return json({ correct, correctIdx: q.correctIdx, remaining, correctCount: newCorrectCount })
    }

    // POST /quiz/finish  { sessionId }
    // → Marks session completed, awards Mata Bina (not Mata Reward).
    if (route === '/quiz/finish' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const sessionId = String(body.sessionId || '')
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const qs = await db.collection('quiz_sessions').findOne({ id: sessionId, familyId: user.familyId })
      if (!qs) return err('Session not found', 404)
      if (qs.status === 'completed') {
        // Idempotent — return existing tally
        return json({ ok: true, correctCount: qs.correctCount, pointsAwarded: qs.pointsAwarded, total: qs.questionIds.length })
      }
      const pointsAwarded = qs.correctCount * POINTS_PER_CORRECT
      await db.collection('quiz_sessions').updateOne(
        { id: sessionId },
        { $set: { status: 'completed', completedAt: new Date(), pointsAwarded } }
      )
      // Grant Mata Bina to child (NOT Mata Reward — quiz only builds character)
      if (pointsAwarded > 0) {
        await db.collection('children').updateOne(
          { id: qs.childId, familyId: user.familyId },
          { $inc: { mataBina: pointsAwarded } }
        )
      }
      return json({ ok: true, correctCount: qs.correctCount, pointsAwarded, total: qs.questionIds.length })
    }

    // GET /quiz/status?childId=  → { doneToday: boolean, correctCount?, pointsAwarded? }
    if (route === '/quiz/status' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ doneToday: false })
      const url = new URL(request.url)
      const childId = url.searchParams.get('childId')
      if (!childId) return err('childId required', 400)
      const today = new Date()
      const dateStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
      const qs = await db.collection('quiz_sessions').findOne(
        { childId, dateStr, familyId: user.familyId },
        { projection: { _id: 0, status: 1, correctCount: 1, pointsAwarded: 1, questionIds: 1 } }
      )
      if (!qs) return json({ doneToday: false })
      return json({
        doneToday: qs.status === 'completed',
        inProgress: qs.status === 'in_progress',
        correctCount: qs.correctCount || 0,
        pointsAwarded: qs.pointsAwarded || 0,
        total: qs.questionIds?.length || 0,
      })
    }

    // ═══ Family Streak ═════════════════════════════════════════
    // GET /family/streak  → real-time family streak
    // Returns { streak, longestStreak, todayDone, days } where days is last 14 days.
    // Streak = consecutive days (ending today or yesterday if today not yet logged) with
    // at least ONE family child having a verified 'sah'|'ihsan' claim.
    // ══════════ ENGAGEMENT: digests, notification prefs, web push, cron ══════════
    // GET /digest/morning|night|weekly?lang=  → in-app cards (same content as push)
    if (route.match(/^\/digest\/(morning|night|weekly)$/) && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const kind = route.split('/')[2]
      const lang = new URL(request.url).searchParams.get('lang') || user.notifyPrefs?.lang || 'ms'
      const fn = kind === 'morning' ? buildMorningDigest : kind === 'night' ? buildNightDigest : buildWeeklyDigest
      return json(await fn(db, user.familyId, { lang, dateStr: utcToday() }))
    }

    // GET/POST /notify/prefs  { tz, lang, morning:{enabled,time}, night:{enabled,time}, weekly:{enabled} }
    if (route === '/notify/prefs' && (method === 'GET' || method === 'POST')) {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user) return err('unauthorized', 401)
      const subs = await db.collection('push_subs').countDocuments({ userId: session.userId })
      if (method === 'GET') return json({ prefs: { ...DEFAULT_PREFS, ...(user.notifyPrefs || {}) }, pushDevices: subs, vapid: !!process.env.VAPID_PUBLIC_KEY })
      const body = await request.json().catch(() => ({}))
      const prefs = sanitizePrefs(body, user.notifyPrefs)
      await db.collection('users').updateOne({ id: session.userId }, { $set: { notifyPrefs: prefs } })
      return json({ prefs, pushDevices: subs })
    }

    if (route === '/push/public-key' && method === 'GET') {
      return json({ publicKey: process.env.VAPID_PUBLIC_KEY || null })
    }

    // POST /push/subscribe { subscription:{endpoint,keys:{p256dh,auth}}, tz?, lang? }
    if (route === '/push/subscribe' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const sub = body.subscription || {}
      if (typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return err('Invalid subscription', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      await db.collection('push_subs').updateOne(
        { endpoint: sub.endpoint },
        { $set: { userId: session.userId, familyId: user?.familyId || null, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }, ua: String(request.headers.get('user-agent') || '').slice(0, 200), updatedAt: new Date() },
          $setOnInsert: { id: crypto.randomUUID(), createdAt: new Date() } },
        { upsert: true },
      )
      if (body.tz || body.lang) {
        const prefs = sanitizePrefs({ ...(user?.notifyPrefs || {}), tz: body.tz, lang: body.lang }, user?.notifyPrefs)
        await db.collection('users').updateOne({ id: session.userId }, { $set: { notifyPrefs: prefs } })
      }
      return json({ ok: true })
    }

    if (route === '/push/unsubscribe' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const db = await getDb()
      const q = { userId: session.userId }
      if (typeof body.endpoint === 'string') q.endpoint = body.endpoint
      const r = await db.collection('push_subs').deleteMany(q)
      return json({ ok: true, removed: r.deletedCount })
    }

    // POST /push/test { kind?: 'morning'|'night'|'weekly' } → send that digest now to my devices
    if (route === '/push/test' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const kind = ['morning', 'night', 'weekly'].includes(body.kind) ? body.kind : 'night'
      const fn = kind === 'morning' ? buildMorningDigest : kind === 'night' ? buildNightDigest : buildWeeklyDigest
      const d = await fn(db, user.familyId, { lang: user.notifyPrefs?.lang || 'ms', dateStr: utcToday() })
      const r = await pushToUser(db, session.userId, d.push)
      return json({ ok: true, ...r, push: d.push })
    }

    // POST /cron/digests — called every 15 min by the Emergent scheduler (.emergent/crons.yml)
    if (route === '/cron/digests' && method === 'POST') {
      // Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
      const secret = process.env.WEBHOOK_CRON_SECRET || ''
      const auth = request.headers.get('authorization') || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      const a = Buffer.from(token), b = Buffer.from(secret)
      if (!secret || a.length !== b.length || !nodeCrypto.timingSafeEqual(a, b)) return err('unauthorized', 401)
      const env = await request.json().catch(() => null)
      if (env === null || typeof env !== 'object') return err('Invalid body', 400)
      const runId = request.headers.get('x-webhook-id') || env.run_id || `run-${Date.now()}`
      const db = await getDb()
      try {
        await db.collection('cron_runs').insertOne({ _id: `digests:${runId}`, createdAt: new Date() })
      } catch (e) {
        if (e?.code === 11000) return json({ ok: true, duplicate: true }, 202)
        throw e
      }
      // Hand off — do not await (dispatcher only waits ~5s)
      runDigestCron(db)
        .then(r => db.collection('cron_runs').updateOne({ _id: `digests:${runId}` }, { $set: { result: r, doneAt: new Date() } }))
        .catch(e => console.error('digest cron failed', e))
      return json({ ok: true, accepted: true, runId }, 202)
    }

    // ══════════ ONBOARDING DIAGNOSIS ══════════
    // POST /onboarding/family { goals[], routine{bedtime,jemaah,meals} } → save family-level answers
    // POST /onboarding/complete { skipped?: bool } → mark onboarding done (stops auto-redirect)
    // POST /onboarding/child { childId?, profile{nickname,gender,avatarId,favColor}, age, school, practice{q_*:0..2}, templateIds[] }
    //      → create (or update) child, store diagnosis, auto-assign habit plan (skips duplicates)
    if (route.startsWith('/onboarding/') && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('Setup keluarga dulu', 400)
      const body = await request.json().catch(() => ({}))
      const families = db.collection('families')

      if (route === '/onboarding/family') {
        const validGoals = new Set(GOALS.map(g => g.id))
        const goals = (Array.isArray(body.goals) ? body.goals : []).filter(g => validGoals.has(g)).slice(0, 3)
        const r = body.routine || {}
        const routine = {
          bedtime: ['early', 'mid', 'late'].includes(r.bedtime) ? r.bedtime : null,
          jemaah: ['often', 'sometimes', 'rarely'].includes(r.jemaah) ? r.jemaah : null,
          meals: ['daily', 'sometimes', 'rarely'].includes(r.meals) ? r.meals : null,
        }
        await families.updateOne({ id: user.familyId }, {
          $set: { 'onboarding.goals': goals, 'onboarding.routine': routine, 'onboarding.updatedAt': new Date(), 'onboarding.by': session.userId },
        })
        return json({ ok: true, goals, routine })
      }

      if (route === '/onboarding/complete') {
        const field = body.skipped ? 'onboarding.skippedAt' : 'onboarding.completedAt'
        await families.updateOne({ id: user.familyId }, { $set: { [field]: new Date() } })
        return json({ ok: true })
      }

      if (route === '/onboarding/child') {
        const p = body.profile || {}
        const age = Math.max(3, Math.min(12, parseInt(body.age, 10) || 6))
        const practice = {}
        for (const q of PRACTICE_QUESTIONS) {
          const v = parseInt(body.practice?.[q.id], 10)
          practice[q.id] = Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 1
        }
        const school = ['none', 'morning', 'afternoon'].includes(body.school) ? body.school : 'none'
        const scores = scoreDiagnosis(practice)
        const diagnosis = { age, school, practice, ...scores, createdAt: new Date(), by: session.userId }
        const ageBand = bandFromAge(age)

        let child
        if (body.childId) {
          child = await db.collection('children').findOne({ id: body.childId, familyId: user.familyId }, { projection: { _id: 0 } })
          if (!child) return err('Anak tidak dijumpai', 404)
          const upd = { $set: { diagnosis, age: child.dob ? child.age : age, ageBand: child.dob ? child.ageBand : ageBand, updatedAt: new Date() } }
          // Keep history so parents can compare month-to-month (last 12 kept)
          if (child.diagnosis) upd.$push = { diagnosisHistory: { $each: [child.diagnosis], $slice: -12 } }
          await db.collection('children').updateOne({ id: child.id }, upd)
        } else {
          const nickname = (p.nickname || '').trim().slice(0, 30)
          if (!nickname) return err('Nama panggilan diperlukan', 400)
          child = {
            id: crypto.randomUUID(),
            familyId: user.familyId,
            nickname,
            dob: null,
            age,
            gender: p.gender === 'female' ? 'female' : 'male',
            ageBand,
            avatarId: typeof p.avatarId === 'string' ? p.avatarId : (p.gender === 'female' ? 'G01' : 'B01'),
            favColor: typeof p.favColor === 'string' ? p.favColor : 'green',
            preferredLang: ['ms', 'en', 'id', 'ar'].includes(body.lang) ? body.lang : 'ms',
            todayCompleted: 0, todayTotal: 0, lightLevel: 100, blackClouds: 0, buildingCount: 0,
            claimMode: 'parent',
            mataBina: 0, mataReward: 0,
            diagnosis,
            createdBy: session.userId,
            createdAt: new Date(), updatedAt: new Date(),
          }
          await db.collection('children').insertOne(child)
          delete child._id
        }

        // Auto-assign the habit plan (validated against templates, no duplicates)
        const existing = await db.collection('habits').find({ childId: child.id, active: { $ne: false } }).project({ templateId: 1 }).toArray()
        const have = new Set(existing.map(h => h.templateId).filter(Boolean))
        const ids = [...new Set((Array.isArray(body.templateIds) ? body.templateIds : []).filter(id => TEMPLATE_BY_ID[id] && !have.has(id)))].slice(0, 12)
        const now = new Date()
        const docs = ids.map(id => {
          const tpl = TEMPLATE_BY_ID[id]
          return {
            id: crypto.randomUUID(), familyId: user.familyId, childId: child.id, templateId: id,
            category: tpl.category, session: TEMPLATE_DEFAULT_SESSION[id] || 'anytime',
            recurring: TEMPLATE_DEFAULT_RECURRING[id] === 'perPrayer' ? 'perPrayer' : 'daily',
            title: tpl.title, desc: tpl.desc || '', points: tpl.points ?? 10, frequency: tpl.frequency || 'daily',
            active: true, source: 'diagnosis', assignedBy: session.userId, createdAt: now, updatedAt: now,
          }
        })
        if (docs.length) await db.collection('habits').insertMany(docs)
        const fresh = await db.collection('children').findOne({ id: child.id }, { projection: { _id: 0 } })
        const previous = Array.isArray(fresh?.diagnosisHistory) && fresh.diagnosisHistory.length ? fresh.diagnosisHistory[fresh.diagnosisHistory.length - 1] : null
        delete fresh.diagnosisHistory
        return json({ child: fresh, habitsCreated: docs.length, diagnosis, previous })
      }
      return err('Not found', 404)
    }

    // GET /family/report?days=7  → per-child daily habit stats for the Reports tab
    // Returns { range:{from,to,days}, dates[], children:[{id,nickname,avatarId,favColor,habitsTotal,
    //   daily:[{date,done,ihsan,points}], totals:{done,ihsan,points,claimedPending,activeDays}, topHabits[] }] }
    if (route === '/family/report' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const url = new URL(request.url)
      const days = Math.min(31, Math.max(1, parseInt(url.searchParams.get('days') || '7', 10) || 7))

      const fmt = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      const now = new Date()
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const dates = []
      for (let i = days - 1; i >= 0; i--) { const d = new Date(today); d.setUTCDate(d.getUTCDate() - i); dates.push(fmt(d)) }

      const children = await db.collection('children')
        .find({ familyId: user.familyId })
        .sort({ createdAt: 1 })
        .project({ _id: 0, id: 1, nickname: 1, avatarId: 1, favColor: 1, mataBina: 1, age: 1, ageBand: 1, gender: 1, diagnosis: 1, diagnosisHistory: { $slice: -1 } })
        .toArray()
      const childIds = children.map(c => c.id)
      const habits = childIds.length ? await db.collection('habits')
        .find({ childId: { $in: childIds }, active: { $ne: false } })
        .project({ _id: 0, id: 1, childId: 1, title: 1, icon: 1, i18n: 1 })
        .toArray() : []
      const claims = childIds.length ? await db.collection('habit_claims')
        .find({ childId: { $in: childIds }, dateStr: { $in: dates } })
        .project({ _id: 0, childId: 1, habitId: 1, dateStr: 1, status: 1, rubric: 1, pointsAwarded: 1 })
        .toArray() : []

      const habitById = Object.fromEntries(habits.map(h => [h.id, h]))
      const out = children.map(c => {
        const mine = claims.filter(cl => cl.childId === c.id)
        const daily = dates.map(date => {
          const dc = mine.filter(cl => cl.dateStr === date && cl.status === 'verified' && ['sah', 'ihsan'].includes(cl.rubric))
          return {
            date,
            done: dc.length,
            ihsan: dc.filter(cl => cl.rubric === 'ihsan').length,
            points: dc.reduce((s, cl) => s + (Number(cl.pointsAwarded) || 0), 0),
          }
        })
        const habitTally = {}
        mine.filter(cl => cl.status === 'verified' && ['sah', 'ihsan'].includes(cl.rubric))
          .forEach(cl => { habitTally[cl.habitId] = (habitTally[cl.habitId] || 0) + 1 })
        const topHabits = Object.entries(habitTally)
          .sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([hid, count]) => ({ id: hid, title: habitById[hid]?.title || '—', i18n: habitById[hid]?.i18n || null, icon: habitById[hid]?.icon || '⭐', count }))
        const { diagnosisHistory, ...rest } = c
        return {
          ...rest,
          previousDiagnosis: Array.isArray(diagnosisHistory) && diagnosisHistory.length ? diagnosisHistory[0] : null,
          habitsTotal: habits.filter(h => h.childId === c.id).length,
          daily,
          totals: {
            done: daily.reduce((s, d) => s + d.done, 0),
            ihsan: daily.reduce((s, d) => s + d.ihsan, 0),
            points: daily.reduce((s, d) => s + d.points, 0),
            activeDays: daily.filter(d => d.done > 0).length,
            claimedPending: mine.filter(cl => cl.status === 'claimed').length,
          },
          topHabits,
        }
      })
      return json({ range: { from: dates[0], to: dates[dates.length - 1], days }, dates, children: out })
    }

    if (route === '/family/streak' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ streak: 0, longestStreak: 0, todayDone: false, days: [] })

      const children = await db.collection('children').find({ familyId: user.familyId }).project({ id: 1 }).toArray()
      const childIds = children.map(c => c.id)
      if (childIds.length === 0) return json({ streak: 0, longestStreak: 0, todayDone: false, days: [] })

      const LOOKBACK = 400
      const now = new Date()
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const earliest = new Date(today); earliest.setUTCDate(earliest.getUTCDate() - LOOKBACK)

      const claims = await db.collection('habit_claims')
        .find({
          childId: { $in: childIds },
          status: 'verified',
          rubric: { $in: ['sah', 'ihsan'] },
          dateStr: { $exists: true },
        })
        .project({ dateStr: 1, _id: 0 })
        .toArray()

      const doneSet = new Set(claims.map(c => String(c.dateStr)))
      const fmt = (d) => {
        const y = d.getUTCFullYear()
        const m = String(d.getUTCMonth() + 1).padStart(2, '0')
        const day = String(d.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }

      const todayStr = fmt(today)
      const todayDone = doneSet.has(todayStr)

      // Current streak (grace: if today not yet logged, count from yesterday backwards)
      let streak = 0
      const cursor = new Date(today)
      if (!todayDone) cursor.setUTCDate(cursor.getUTCDate() - 1)
      while (streak <= LOOKBACK) {
        if (doneSet.has(fmt(cursor))) {
          streak++
          cursor.setUTCDate(cursor.getUTCDate() - 1)
        } else break
      }

      // Longest streak in the lookback window
      let longestStreak = 0, run = 0
      const walk = new Date(earliest)
      while (walk <= today) {
        if (doneSet.has(fmt(walk))) {
          run++
          if (run > longestStreak) longestStreak = run
        } else run = 0
        walk.setUTCDate(walk.getUTCDate() + 1)
      }

      // Last 14 days
      const days = []
      const past = new Date(today); past.setUTCDate(past.getUTCDate() - 13)
      const w = new Date(past)
      while (w <= today) {
        days.push({ date: fmt(w), done: doneSet.has(fmt(w)) })
        w.setUTCDate(w.getUTCDate() + 1)
      }

      return json({ streak, longestStreak, todayDone, days })
    }

    // ═══ Kid Mode PIN (scoped to family) ═══
    // PIN is 4 digits. Any signed-in parent in a family can set/change the PIN and verify it.
    // Stored on families doc as { pinHash: scryptHex, pinSalt: hex, pinSetAt: Date }.

    // GET /family/pin  → status only (no hash leak)
    if (route === '/family/pin' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const fam = await db.collection('families').findOne({ id: user.familyId }, { projection: { _id: 0, pinHash: 0, pinSalt: 0 } })
      return json({ hasPin: !!fam?.pinSetAt, pinSetAt: fam?.pinSetAt || null })
    }

    // POST /family/pin  → set or change PIN. Body: { pin: '1234', currentPin?: '9876' }
    // - If no PIN set yet: any parent may set it
    // - If PIN already set: must supply matching currentPin
    if (route === '/family/pin' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const pin = String(body.pin || '')
      if (!/^\d{4}$/.test(pin)) return err('PIN must be 4 digits', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const fam = await db.collection('families').findOne({ id: user.familyId })
      if (!fam) return err('Family not found', 404)
      if (fam.pinHash && fam.pinSalt) {
        const currentPin = String(body.currentPin || '')
        if (!/^\d{4}$/.test(currentPin)) return err('Current PIN required', 400)
        const currentHash = crypto.scryptSync(currentPin, fam.pinSalt, 32).toString('hex')
        if (currentHash !== fam.pinHash) return err('Current PIN incorrect', 403)
      }
      const salt = crypto.randomBytes(16).toString('hex')
      const hash = crypto.scryptSync(pin, salt, 32).toString('hex')
      await db.collection('families').updateOne(
        { id: user.familyId },
        { $set: { pinHash: hash, pinSalt: salt, pinSetAt: new Date() } }
      )
      return json({ ok: true, hasPin: true, pinSetAt: new Date() })
    }

    // POST /family/pin/verify  → check a PIN. Body: { pin }. Returns { ok } or 403.
    if (route === '/family/pin/verify' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const pin = String(body.pin || '')
      if (!/^\d{4}$/.test(pin)) return err('Invalid PIN format', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const fam = await db.collection('families').findOne({ id: user.familyId })
      if (!fam?.pinHash || !fam?.pinSalt) return err('PIN not set', 404)
      const hash = crypto.scryptSync(pin, fam.pinSalt, 32).toString('hex')
      if (hash !== fam.pinHash) return err('PIN incorrect', 403)
      return json({ ok: true })
    }

    // ═══ Reward Shop ═══
    // GET /rewards/catalog  → family-custom rewards (frontend joins with rewardTemplates.js for built-ins)
    if (route === '/rewards/catalog' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ custom: [] })
      const custom = await db.collection('rewards_custom')
        .find({ familyId: user.familyId })
        .sort({ createdAt: -1 })
        .project({ _id: 0 })
        .toArray()
      return json({ custom })
    }

    // ═══ Reward Proposals (kid → parent) ═══
    // POST /rewards/proposals  → kid (or parent-on-behalf) proposes a new custom reward
    // Body: { childId, title, desc?, cost, icon?, category? }
    if (route === '/rewards/proposals' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const childId = String(body.childId || '')
      const title = String(body.title || '').trim().slice(0, 80)
      const cost = Number(body.cost)
      if (!childId) return err('childId required', 400)
      if (!title) return err('Title required', 400)
      if (!Number.isInteger(cost) || cost < 1 || cost > 999) return err('Invalid cost', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const child = await db.collection('children').findOne({ id: childId, familyId: user.familyId })
      if (!child) return err('Child not found', 404)
      const rec = {
        id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        familyId: user.familyId,
        childId,
        title,
        desc: String(body.desc || '').trim().slice(0, 200),
        cost,
        icon: String(body.icon || '🎁').slice(0, 4),
        category: ['screen','food','learning','outing','activity','spiritual'].includes(body.category) ? body.category : 'activity',
        status: 'pending',   // pending | approved | rejected
        proposedAt: new Date(),
        proposedBy: session.userId,
      }
      await db.collection('reward_proposals').insertOne(rec)
      return json({ ok: true, proposal: rec })
    }

    // GET /rewards/proposals?childId=&status=  → list proposals
    if (route === '/rewards/proposals' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ proposals: [] })
      const url = new URL(request.url)
      const qChildId = url.searchParams.get('childId')
      const qStatus = url.searchParams.get('status')
      const q = { familyId: user.familyId }
      if (qChildId) q.childId = qChildId
      if (qStatus) q.status = qStatus
      const proposals = await db.collection('reward_proposals')
        .find(q)
        .sort({ proposedAt: -1 })
        .limit(100)
        .project({ _id: 0 })
        .toArray()
      return json({ proposals })
    }

    // PATCH /rewards/proposals/:id  → parent decide: { decision: 'approved'|'rejected', title?, desc?, cost?, icon?, category?, note? }
    // On approve, a custom reward is created (with any parent modifications) and proposal is stored with resulting rewardId.
    if (route.match(/^\/rewards\/proposals\/[^/]+$/) && method === 'PATCH') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const propId = route.split('/')[3]
      const body = await request.json().catch(() => ({}))
      const decision = body.decision
      if (!['approved', 'rejected'].includes(decision)) return err('Invalid decision', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const prop = await db.collection('reward_proposals').findOne({ id: propId, familyId: user.familyId })
      if (!prop) return err('Proposal not found', 404)
      if (prop.status !== 'pending') return err('Already decided', 409)

      const note = String(body.note || '').trim().slice(0, 200)
      const $set = { status: decision, decidedAt: new Date(), decidedBy: session.userId, decidedNote: note }

      if (decision === 'approved') {
        // Parent may adjust before approving
        // If title is explicitly provided (even as empty string), validate it; otherwise use prop.title
        const title = ('title' in body) 
          ? String(body.title).trim().slice(0, 80)
          : String(prop.title).trim().slice(0, 80)
        const desc  = String(body.desc  ?? prop.desc  ?? '').trim().slice(0, 200)
        const cost  = Number(body.cost ?? prop.cost)
        if (!title || !Number.isInteger(cost) || cost < 1 || cost > 999) return err('Invalid title/cost', 400)
        const icon  = String(body.icon || prop.icon || '🎁').slice(0, 4)
        const category = ['screen','food','learning','outing','activity','spiritual'].includes(body.category || prop.category)
          ? (body.category || prop.category) : 'activity'
        const rw = {
          id: `rw-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          familyId: user.familyId,
          title, desc, cost, icon, category,
          fromProposalId: prop.id,
          fromChildId: prop.childId,
          createdAt: new Date(),
          createdBy: session.userId,
        }
        await db.collection('rewards_custom').insertOne(rw)
        $set.resultingRewardId = rw.id
        $set.finalTitle = title
        $set.finalCost = cost
      }
      await db.collection('reward_proposals').updateOne({ id: propId }, { $set })
      const updated = await db.collection('reward_proposals').findOne({ id: propId }, { projection: { _id: 0 } })
      return json({ ok: true, proposal: updated })
    }

    // DELETE /rewards/proposals/:id  → kid (or parent) cancels their own pending proposal
    if (route.match(/^\/rewards\/proposals\/[^/]+$/) && method === 'DELETE') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const propId = route.split('/')[3]
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const prop = await db.collection('reward_proposals').findOne({ id: propId, familyId: user.familyId, status: 'pending' })
      if (!prop) return err('Not found or not pending', 404)
      await db.collection('reward_proposals').deleteOne({ id: propId })
      return json({ ok: true })
    }

    // POST /rewards/catalog  → add family-custom reward. body: { title, desc?, cost, icon?, category? }
    if (route === '/rewards/catalog' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const title = String(body.title || '').trim().slice(0, 80)
      const cost = Number(body.cost)
      if (!title) return err('Title required', 400)
      if (!Number.isInteger(cost) || cost < 1 || cost > 999) return err('Invalid cost', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const rec = {
        id: `rw-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        familyId: user.familyId,
        title,
        desc: String(body.desc || '').trim().slice(0, 200),
        cost,
        icon: String(body.icon || '🎁').slice(0, 4),
        category: ['screen','food','learning','outing','activity','spiritual'].includes(body.category) ? body.category : 'activity',
        createdAt: new Date(),
        createdBy: session.userId,
      }
      await db.collection('rewards_custom').insertOne(rec)
      return json({ ok: true, reward: rec })
    }

    // DELETE /rewards/catalog/:id
    if (route.match(/^\/rewards\/catalog\/[^/]+$/) && method === 'DELETE') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const id = route.split('/')[3]
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      await db.collection('rewards_custom').deleteOne({ id, familyId: user.familyId })
      return json({ ok: true })
    }

    // POST /rewards/request  → child (or parent-on-behalf) requests a reward
    // Body: { childId, rewardId, isTemplate: boolean, snapshot: { title, desc, cost, icon, category } }
    if (route === '/rewards/request' && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const body = await request.json().catch(() => ({}))
      const { childId, rewardId, isTemplate, snapshot } = body
      if (!childId || !rewardId || !snapshot?.title || !snapshot?.cost) return err('Invalid body', 400)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const child = await db.collection('children').findOne({ id: childId, familyId: user.familyId })
      if (!child) return err('Child not found', 404)
      const balance = Number(child.mataReward || 0)
      if (balance < snapshot.cost) return err('Not enough Mata Reward', 402)
      // Prevent duplicate pending request for same reward
      const existing = await db.collection('reward_requests').findOne({
        familyId: user.familyId, childId, rewardId, status: 'pending',
      })
      if (existing) return err('Already pending', 409)
      const rec = {
        id: `rr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        familyId: user.familyId,
        childId,
        rewardId,
        isTemplate: !!isTemplate,
        snapshot: {
          title: String(snapshot.title).slice(0, 80),
          desc:  String(snapshot.desc || '').slice(0, 200),
          cost:  Number(snapshot.cost),
          icon:  String(snapshot.icon || '🎁').slice(0, 4),
          category: snapshot.category || 'activity',
        },
        status: 'pending',
        requestedAt: new Date(),
        requestedBy: session.userId,
      }
      await db.collection('reward_requests').insertOne(rec)
      return json({ ok: true, request: rec })
    }

    // GET /rewards/requests  → list family requests. Query: ?childId=xxx&status=pending
    if (route === '/rewards/requests' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ requests: [] })
      const url = new URL(request.url)
      const qChildId = url.searchParams.get('childId')
      const qStatus = url.searchParams.get('status')
      const q = { familyId: user.familyId }
      if (qChildId) q.childId = qChildId
      if (qStatus) q.status = qStatus
      const requests = await db.collection('reward_requests')
        .find(q)
        .sort({ requestedAt: -1 })
        .limit(100)
        .project({ _id: 0 })
        .toArray()
      return json({ requests })
    }

    // POST /rewards/requests/:id/decide  body: { decision: 'approved'|'rejected', note? }
    if (route.match(/^\/rewards\/requests\/[^/]+\/decide$/) && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const reqId = route.split('/')[3]
      const body = await request.json().catch(() => ({}))
      const decision = body.decision
      if (!['approved', 'rejected'].includes(decision)) return err('Invalid decision', 400)
      const note = String(body.note || '').trim().slice(0, 200)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const rr = await db.collection('reward_requests').findOne({ id: reqId, familyId: user.familyId })
      if (!rr) return err('Request not found', 404)
      if (rr.status !== 'pending') return err('Already decided', 409)
      if (decision === 'approved') {
        // Deduct Mata Reward from child (atomically require sufficient balance)
        const upd = await db.collection('children').updateOne(
          { id: rr.childId, familyId: user.familyId, mataReward: { $gte: rr.snapshot.cost } },
          { $inc: { mataReward: -rr.snapshot.cost } }
        )
        if (upd.modifiedCount !== 1) return err('Not enough Mata Reward', 402)
      }
      await db.collection('reward_requests').updateOne(
        { id: reqId },
        { $set: { status: decision, decidedAt: new Date(), decidedBy: session.userId, decidedNote: note } }
      )
      return json({ ok: true, decision })
    }

    // POST /rewards/requests/:id/fulfill  → mark as delivered (approved → fulfilled)
    if (route.match(/^\/rewards\/requests\/[^/]+\/fulfill$/) && method === 'POST') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const reqId = route.split('/')[3]
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const rr = await db.collection('reward_requests').findOne({ id: reqId, familyId: user.familyId })
      if (!rr) return err('Request not found', 404)
      if (rr.status !== 'approved') return err('Only approved can be fulfilled', 409)
      await db.collection('reward_requests').updateOne(
        { id: reqId },
        { $set: { status: 'fulfilled', fulfilledAt: new Date(), fulfilledBy: session.userId } }
      )
      return json({ ok: true })
    }

    // DELETE /rewards/requests/:id  → cancel own pending request
    if (route.match(/^\/rewards\/requests\/[^/]+$/) && method === 'DELETE') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const reqId = route.split('/')[3]
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const rr = await db.collection('reward_requests').findOne({ id: reqId, familyId: user.familyId, status: 'pending' })
      if (!rr) return err('Not found or not pending', 404)
      await db.collection('reward_requests').deleteOne({ id: reqId })
      return json({ ok: true })
    }

    // ── unknown ──
    return err(`Route ${method} ${route} not found`, 404)
  } catch (e) {
    console.error('API Error:', e)
    return err(e.message || 'Internal server error', 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
