import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { createSession, getSession, destroySession, generateFamilyCode } from '@/lib/session'
import crypto from 'node:crypto'

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
      const todayStr = new Date().toISOString().slice(0, 10)
      const claims = await db.collection('habit_claims')
        .find({ childId, dateStr: todayStr })
        .project({ _id: 0, habitId: 1, status: 1, rubric: 1, pointsAwarded: 1, note: 1 })
        .toArray()
      const claimMap = Object.fromEntries(claims.map(c => [c.habitId, c]))
      const enriched = habits.map(h => {
        const c = claimMap[h.id]
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

      const allowed = ['title', 'desc', 'category', 'points', 'frequency', 'active']
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
    // Body: { childId?, status?: 'claimed'|'skipped'|'verified', rubric?: 'ihsan'|'sah'|'belum', note? }
    //  - If rubric provided (parent-log mode): create as verified with rubric + pointsAwarded (writes verify_log too)
    //  - Otherwise: default 'claimed' → goes into verify queue (Kid Mode flow)
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

      // Parent-log inline verification: rubric provided → record as verified/deleted immediately
      if (rubric) {
        if (!['ihsan', 'sah', 'belum'].includes(rubric)) return err('Invalid rubric', 400)
        const prevClaim = await db.collection('habit_claims').findOne({ habitId, dateStr })
        if (rubric === 'belum') {
          // Undo/delete existing claim if any
          await db.collection('habit_claims').deleteOne({ habitId, dateStr })
          await applyMataDelta(db, habit.childId, prevClaim, null)
          await db.collection('verify_log').insertOne({
            habitId, dateStr, childId: habit.childId, familyId: user.familyId,
            rubric, note, points: 0,
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
        await db.collection('habit_claims').updateOne(
          { habitId, dateStr },
          { $set: claimData },
          { upsert: true }
        )
        await applyMataDelta(db, habit.childId, prevClaim, claimData)
        await db.collection('verify_log').insertOne({
          habitId, dateStr, childId: habit.childId, familyId: user.familyId,
          rubric, note, points,
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
        status,
        claimedAt: new Date(),
        claimedBy: session.userId,
      }
      await db.collection('habit_claims').updateOne(
        { habitId, dateStr },
        { $set: claimData },
        { upsert: true }
      )
      return json({ ok: true, claim: claimData })
    }

    // DELETE /habits/:id/claim  → undo today's claim (used by Kid Mode + parent toggle)
    // Only allowed if claim exists and status is 'claimed' (not yet verified) OR it's your own verified claim from parent-log
    if (route.match(/^\/habits\/[^/]+\/claim$/) && method === 'DELETE') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const habitId = route.split('/')[2]
      const dateStr = new URL(request.url).searchParams.get('dateStr') || new Date().toISOString().slice(0, 10)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return err('No family', 400)
      const claim = await db.collection('habit_claims').findOne({ habitId, dateStr, familyId: user.familyId })
      if (!claim) return json({ ok: true, removed: false })
      await db.collection('habit_claims').deleteOne({ habitId, dateStr })
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
    // GET /rewards/catalog  → union of family-custom + built-in template ids (frontend joins with rewardTemplates.js)
    if (route === '/rewards/catalog' && method === 'GET') {
      const session = await getSession()
      if (!session) return err('unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: session.userId })
      if (!user?.familyId) return json({ templates: [], custom: [] })
      const custom = await db.collection('rewards_custom')
        .find({ familyId: user.familyId })
        .project({ _id: 0 })
        .toArray()
      return json({ custom })
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
