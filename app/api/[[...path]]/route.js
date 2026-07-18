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

      // Attach today's claim status
      const todayStr = new Date().toISOString().slice(0, 10)
      const claims = await db.collection('habit_claims')
        .find({ childId, dateStr: todayStr })
        .project({ _id: 0, habitId: 1, status: 1 })
        .toArray()
      const claimMap = Object.fromEntries(claims.map(c => [c.habitId, c.status]))
      const enriched = habits.map(h => ({ ...h, todayStatus: claimMap[h.id] || 'pending' }))

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

    // POST /habits/:id/claim  → child (or parent testing) marks habit as claimed for today
    // Body: { childId, status: 'claimed' | 'skipped' }
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
      // Upsert (one claim per habit per day)
      await db.collection('habit_claims').updateOne(
        { habitId, dateStr },
        { $set: claimData },
        { upsert: true }
      )
      return json({ ok: true, claim: claimData })
    }

    // GET /verify-queue  → list pending claims across all children in family
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
