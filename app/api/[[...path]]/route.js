import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { createSession, getSession, destroySession, generateFamilyCode } from '@/lib/session'
import { QUIZ_QUESTIONS, questionsForAge, pickRandomQuestions, POINTS_PER_CORRECT, QUESTIONS_PER_SESSION } from '@/lib/quizBank'
import { TEMPLATE_DEFAULT_RECURRING } from '@/lib/prayerSession'
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
        return json({ ok: true, rubric, points, excellence: rubric === 'ihsan' })
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

      return json({ ok: true, rubric, points, excellence: rubric === 'ihsan' })
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
        let world = await worldsCol.findOne({ childId }, { projection: { _id: 0 } })
        if (!world) {
          // Seed with Musalla NOT yet built — anak akan trigger ritual bina Musalla
          // Musalla pre-gazetted position (center) is passed via config on client
          world = {
            id: `world-${childId}`,
            childId,
            familyId: user.familyId,
            version: 1,
            buildings: [],
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
      // Dynamic world bounds: matches lib/worldEngine.js getWorldBounds().
      // World starts 18×18 and expands to 24/30/36 based on building count,
      // centered on Musalla's actual position.
      const worldBoundsFor = (buildings) => {
        const musalla = (buildings || []).find(b => b.templateId === 'musalla')
        const mx = musalla ? musalla.x : 17
        const my = musalla ? musalla.y : 17
        const count = (buildings || []).length
        const size = count >= 15 ? 36 : count >= 10 ? 30 : count >= 5 ? 24 : 18
        const half = Math.floor(size / 2)
        return {
          minX: mx - half + 1, maxX: mx + half + 1,
          minY: my - half + 1, maxY: my + half + 1,
        }
      }

      // ─── Landmark auto-placement ─────────────────────────────────
      // After every successful build, if the child has crossed a milestone
      // (5 user-placed buildings → Surau, 10 → Masjid), auto-place the
      // landmark at the first free candidate cell around the Musalla. We
      // COUNT only user-placed buildings, so Musalla + past auto-landmarks
      // don't inflate the count.
      const AUTO_LANDMARKS = [
        { templateId: 'surau',           tileSize: { w: 2, h: 2 }, milestone: 5,
          // Candidate anchors relative to Musalla (positive = right/down)
          candidates: [ {dx: -3, dy: -3}, {dx:  5, dy: -3}, {dx: -3, dy:  5}, {dx:  5, dy:  5}, {dx: -3, dy:  1}, {dx:  5, dy:  1} ] },
        { templateId: 'masjid_landmark', tileSize: { w: 3, h: 3 }, milestone: 10,
          candidates: [ {dx:  5, dy: -3}, {dx: -4, dy: -3}, {dx:  5, dy:  5}, {dx: -4, dy:  5}, {dx:  5, dy:  1}, {dx: -4, dy:  1} ] },
      ]
      // Overlap check for a candidate (x,y,w,h) against every existing building
      // AND the musalla's reserved 4×4 zone (RESERVED map, defined below).
      const cellsFree = (buildings, x, y, w, h) => {
        for (const bd of buildings) {
          const t = bd.templateId
          // Reuse the RESERVED/TILE_SIZES defined below in the build block
          const foot = (t === 'musalla')            ? { w: 4, h: 4 } :
                       (t === 'surau')              ? { w: 2, h: 2 } :
                       (t === 'masjid_landmark')    ? { w: 3, h: 3 } :
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
        await loadOrSeed()
        const world = await worldsCol.findOne({ childId })
        const buildings = world?.buildings || []
        // Bounds check: cell (and its footprint) must fit within current dynamic bounds
        const TILE_SIZES = {
          musalla: { w: 2, h: 2 },
          surau: { w: 2, h: 2 },
          masjid_landmark: { w: 3, h: 3 },
          rumah: { w: 1, h: 1 }, kebun: { w: 1, h: 1 },
        }
        // Sacred reserved footprint — musalla pre-reserves 4×4 for future
        // upgrade to Masjid (3×3) and Jami' Masjid (4×4), so no other
        // building can occupy the growth zone. Auto-landmarks (Surau/Masjid)
        // reserve their own exact footprint so user builds can't overlap.
        const RESERVED = {
          musalla: { w: 4, h: 4 },
          surau: { w: 2, h: 2 },
          masjid_landmark: { w: 3, h: 3 },
        }
        const sz = TILE_SIZES[templateId] || { w: 1, h: 1 }
        const b = worldBoundsFor(buildings)
        if (x < b.minX || y < b.minY || x + sz.w > b.maxX || y + sz.h > b.maxY) {
          return err('out of bounds', 400)
        }
        // Reserved-zone overlap: reject if this placement overlaps any
        // building's RESERVED footprint (musalla's 4×4 sacred zone).
        for (const bd of buildings) {
          const s = RESERVED[bd.templateId] || TILE_SIZES[bd.templateId] || { w: 1, h: 1 }
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
        if (newLandmarks.length > 0) {
          // Replace buildings array entirely so both the new building AND the
          // landmark(s) are saved atomically.
          await worldsCol.updateOne(
            { childId },
            { $set: { buildings: withLandmarks, updatedAt: new Date() } }
          )
        } else {
          await worldsCol.updateOne(
            { childId },
            { $push: { buildings: newBuilding }, $set: { updatedAt: new Date() } }
          )
        }
        return json({ ok: true, building: newBuilding, newLandmarks })
      }

      // POST /world/:childId/upgrade → level up by building id
      if (action === 'upgrade' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const { buildingId } = body
        if (!buildingId) return err('Missing buildingId', 400)
        // Enforce progressive-unlock: musalla → masjid needs 3 houses, → jami masjid needs 8
        const world = await worldsCol.findOne({ childId })
        const target = (world?.buildings || []).find(b => b.id === buildingId)
        if (!target) return err('building not found', 404)
        const nextLevel = (target.level || 1) + 1
        // Musalla upgrade requirements from worldEngine.upgradeRequires
        const MUSALLA_REQS = { 2: { rumah: 3 }, 3: { rumah: 8 } }
        if (target.templateId === 'musalla' && MUSALLA_REQS[nextLevel]) {
          const reqs = MUSALLA_REQS[nextLevel]
          for (const [tid, need] of Object.entries(reqs)) {
            const have = (world.buildings || []).filter(b => b.templateId === tid).length
            if (have < need) {
              return err(`Need ${need} ${tid} to upgrade (have ${have})`, 400)
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
        // Auto-landmarks (Surau, Masjid) are also sacred + fixed positions.
        if (target.templateId === 'surau' || target.templateId === 'masjid_landmark') {
          return err('Landmark cannot be moved', 400)
        }

        // Simple footprint check — treat all non-musalla buildings as 1x1 for now,
        // matching current template sizes. Overlap detection tests all cells.
        // (Musalla is 2x2, so we skip its own id AND allow moving next to it.)
        const TILE_SIZES = {
          musalla: { w: 2, h: 2 },
          surau: { w: 2, h: 2 },
          masjid_landmark: { w: 3, h: 3 },
          rumah: { w: 1, h: 1 }, kebun: { w: 1, h: 1 },
        }
        const targetSize = TILE_SIZES[target.templateId] || { w: 1, h: 1 }
        // Dynamic bounds — matches lib/worldEngine.js. Musalla stays centered.
        const b = worldBoundsFor(buildings)
        if (x < b.minX || y < b.minY || x + targetSize.w > b.maxX || y + targetSize.h > b.maxY) {
          return err('out of bounds', 400)
        }
        // Overlap check (exclude the moving building itself). Also enforce
        // the sacred RESERVED zone: even though the musalla itself is 2×2,
        // it reserves a 4×4 footprint for future upgrades — no other
        // building may move into that sacred growth area.
        const RESERVED = {
          musalla: { w: 4, h: 4 },
          surau: { w: 2, h: 2 },
          masjid_landmark: { w: 3, h: 3 },
        }
        for (const b of buildings) {
          if (b.id === buildingId) continue
          const s = RESERVED[b.templateId] || TILE_SIZES[b.templateId] || { w: 1, h: 1 }
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

      // POST /world/:childId/demerit → adjust demerit count { delta }
      if (action === 'demerit' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const delta = Number(body.delta) || 0
        await loadOrSeed()
        await worldsCol.updateOne(
          { childId },
          [{ $set: {
            demeritCount: { $max: [0, { $add: [{ $ifNull: ['$demeritCount', 0] }, delta] }] },
            updatedAt: new Date(),
          } }]
        )
        const updated = await worldsCol.findOne({ childId }, { projection: { demeritCount: 1 } })
        return json({ ok: true, demeritCount: updated?.demeritCount || 0 })
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
