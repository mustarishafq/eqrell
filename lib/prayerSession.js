/**
 * EQrel — Prayer-time anchored session model
 *
 * Groups habits by Islamic time-of-day windows (Selepas Subuh, Selepas Zohor, etc.)
 * instead of clock-based (Pagi/Petang/Malam). Aligns habit rhythm with prayer times
 * which naturally shift with the seasons.
 *
 * Sessions:
 *   subuh        — Selepas Subuh (dawn → Zohor)
 *   zohor        — Selepas Zohor (noon → Asar)
 *   asar         — Selepas Asar (afternoon → Maghrib)
 *   maghrib      — Selepas Maghrib (sunset → Isyak)
 *   isyak        — Selepas Isyak (night, pre-bedtime)
 *   sebelumTidur — Sebelum tidur (final wind-down)
 *   anytime      — Sepanjang hari (no fixed anchor)
 */

export const SESSIONS = [
  { id: 'subuh',        icon: '🌅', order: 1, gradient: 'from-amber-300 to-orange-400',    color: '#F59E0B' },
  { id: 'zohor',        icon: '☀️', order: 2, gradient: 'from-yellow-300 to-amber-400',    color: '#EAB308' },
  { id: 'asar',         icon: '🌤️', order: 3, gradient: 'from-orange-300 to-amber-500',    color: '#F97316' },
  { id: 'maghrib',      icon: '🌇', order: 4, gradient: 'from-orange-400 to-rose-500',     color: '#EF4444' },
  { id: 'isyak',        icon: '🌙', order: 5, gradient: 'from-indigo-500 to-purple-600',   color: '#6366F1' },
  { id: 'sebelumTidur', icon: '⭐', order: 6, gradient: 'from-slate-600 to-indigo-800',    color: '#475569' },
  { id: 'anytime',      icon: '🕰️', order: 0, gradient: 'from-emerald-400 to-teal-500',    color: '#10B981' },
]

export const SESSION_BY_ID = Object.fromEntries(SESSIONS.map(s => [s.id, s]))

// Localised labels
export const SESSION_LABELS = {
  ms: {
    subuh:        'Selepas Subuh',
    zohor:        'Selepas Zohor',
    asar:         'Selepas Asar',
    maghrib:      'Selepas Maghrib',
    isyak:        'Selepas Isyak',
    sebelumTidur: 'Sebelum Tidur',
    anytime:      'Sepanjang Hari',
  },
  en: {
    subuh:        'After Fajr',
    zohor:        'After Zuhr',
    asar:         'After Asr',
    maghrib:      'After Maghrib',
    isyak:        'After Isha',
    sebelumTidur: 'Before Bed',
    anytime:      'Anytime today',
  },
  id: {
    subuh:        'Setelah Subuh',
    zohor:        'Setelah Zuhur',
    asar:         'Setelah Asar',
    maghrib:      'Setelah Magrib',
    isyak:        'Setelah Isya',
    sebelumTidur: 'Sebelum Tidur',
    anytime:      'Sepanjang Hari',
  },
  ar: {
    subuh:        'بعد الفجر',
    zohor:        'بعد الظهر',
    asar:         'بعد العصر',
    maghrib:      'بعد المغرب',
    isyak:        'بعد العشاء',
    sebelumTidur: 'قبل النوم',
    anytime:      'طوال اليوم',
  },
}

/** Locale-aware session label lookup. */
export function getSessionLabel(sessionId, lang = 'en') {
  const bank = SESSION_LABELS[lang] || SESSION_LABELS.ms
  return bank[sessionId] || SESSION_LABELS.ms[sessionId] || sessionId
}

/** Prayer sessions only (5 obligatory prayers) — used for per-prayer recurring habits */
export const PRAYER_SESSIONS = ['subuh', 'zohor', 'asar', 'maghrib', 'isyak']

/**
 * Templates that recur PER PRAYER (5x per day). Habit appears in each of the 5
 * prayer sessions and can be claimed independently in each.
 * Others default to `recurring: 'daily'` (1 claim/day).
 */
export const TEMPLATE_DEFAULT_RECURRING = {
  'ib-10': 'perPrayer',  // Wudhu betul — before each prayer
}

/**
 * Default session per template ID. Used when creating habit from template
 * or migrating legacy habits without a `session` field.
 */
export const TEMPLATE_DEFAULT_SESSION = {
  // Ibadah — prayer habits anchor to their own prayer
  'ib-01': 'subuh',        // Solat Subuh
  'ib-02': 'zohor',        // Solat Zohor
  'ib-03': 'asar',         // Solat Asar
  'ib-04': 'maghrib',      // Solat Maghrib
  'ib-05': 'isyak',        // Solat Isyak
  'ib-06': 'anytime',      // Doa sebelum makan
  'ib-07': 'sebelumTidur', // Doa sebelum tidur
  'ib-08': 'subuh',        // Doa bangun tidur
  'ib-09': 'maghrib',      // Muraja'ah Quran
  'ib-10': 'anytime',      // Wudhu betul

  // Akhlak — mostly anytime
  'ak-01': 'anytime',      // Beri salam
  'ak-02': 'subuh',        // Cium tangan (pagi & malam — anchor to Subuh + Isyak)
  'ak-03': 'anytime',      // Kongsi
  'ak-04': 'anytime',      // Terima kasih & maaf
  'ak-05': 'anytime',      // Bercakap sopan
  'ak-06': 'anytime',      // Tolong orang

  // Pembelajaran
  'pb-01': 'isyak',        // Baca buku 15 min (evening reading)
  'pb-02': 'maghrib',      // Baca Iqra
  'pb-03': 'asar',         // Homework
  'pb-04': 'maghrib',      // Cerita hari ini (family time)

  // Kesihatan
  'ks-01': 'anytime',      // Berus gigi 2x
  'ks-02': 'anytime',      // Cuci tangan
  'ks-03': 'subuh',        // Mandi & kemas (morning)
  'ks-04': 'sebelumTidur', // Tidur awal
  'ks-05': 'anytime',      // Kemas bilik

  // Keluarga
  'kg-01': 'anytime',      // Bantu ibu bapa
  'kg-02': 'asar',         // Main bersama (after school hours)
  'kg-03': 'maghrib',      // Makan bersama
  'kg-04': 'anytime',      // Peluk keluarga
  'kg-05': 'sebelumTidur', // Doa untuk keluarga
}

/**
 * Get default session for a habit. Uses templateId if available, otherwise
 * falls back to category-based defaults.
 */
export function inferSession(habit) {
  if (habit?.session) return habit.session
  if (habit?.templateId && TEMPLATE_DEFAULT_SESSION[habit.templateId]) {
    return TEMPLATE_DEFAULT_SESSION[habit.templateId]
  }
  // Category fallbacks
  const cat = habit?.category
  if (cat === 'ibadah') return 'anytime'
  return 'anytime'
}

/**
 * Determine if habit recurs per-prayer (5x/day) or once daily.
 * Priority: explicit habit.recurring → template default → 'daily'
 */
export function inferRecurring(habit) {
  if (habit?.recurring === 'multi') return Array.isArray(habit.sessions) && habit.sessions.length ? 'multi' : 'daily'
  if (habit?.recurring === 'perPrayer' || habit?.recurring === 'daily') return habit.recurring
  if (habit?.templateId && TEMPLATE_DEFAULT_RECURRING[habit.templateId]) {
    return TEMPLATE_DEFAULT_RECURRING[habit.templateId]
  }
  return 'daily'
}

/**
 * Determine current session window from clock (fallback when no prayer times).
 * Rough boundaries in local time:
 *   00:00–05:30  → sebelumTidur (late night)
 *   05:30–12:30  → subuh (post-dawn)
 *   12:30–15:30  → zohor
 *   15:30–18:30  → asar
 *   18:30–20:00  → maghrib
 *   20:00–22:00  → isyak
 *   22:00–24:00  → sebelumTidur
 */
export function currentSessionFromClock(now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes()
  if (mins < 5 * 60 + 30) return 'sebelumTidur'
  if (mins < 12 * 60 + 30) return 'subuh'
  if (mins < 15 * 60 + 30) return 'zohor'
  if (mins < 18 * 60 + 30) return 'asar'
  if (mins < 20 * 60) return 'maghrib'
  if (mins < 22 * 60) return 'isyak'
  return 'sebelumTidur'
}

/**
 * Determine current session from actual prayer times (preferred when available).
 * @param {Object} times - { fajr, dhuhr, asr, maghrib, isha } in "HH:MM" format
 * @param {Date} now
 */
export function currentSessionFromPrayerTimes(times, now = new Date()) {
  if (!times) return currentSessionFromClock(now)
  const toMin = (s) => {
    if (!s || typeof s !== 'string') return null
    const [h, m] = s.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const mins = now.getHours() * 60 + now.getMinutes()
  const fajr = toMin(times.fajr)
  const dhuhr = toMin(times.dhuhr)
  const asr = toMin(times.asr)
  const maghrib = toMin(times.maghrib)
  const isha = toMin(times.isha)

  // Fallback if any is missing
  if ([fajr, dhuhr, asr, maghrib, isha].some(v => v == null)) {
    return currentSessionFromClock(now)
  }

  // "Sebelum tidur" = last 90 min before typical bedtime (approx 90 min after Isha)
  const bedtimeStart = isha + 90

  if (mins < fajr) return 'sebelumTidur'
  if (mins < dhuhr) return 'subuh'
  if (mins < asr) return 'zohor'
  if (mins < maghrib) return 'asar'
  if (mins < isha) return 'maghrib'
  if (mins < bedtimeStart) return 'isyak'
  return 'sebelumTidur'
}

/**
 * Group habits by session, honoring existing category order within each session.
 * Per-prayer recurring habits are duplicated across all 5 prayer sessions, each with
 * their own claim status derived from `sessionsClaimed[]` on the habit.
 * @param {Array} habits - habit objects (may or may not have `session`)
 * @returns {Array} [{ sessionId, habits: [], done, total }] sorted by session order
 */
export function groupHabitsBySession(habits) {
  const groups = {}

  habits.forEach(h => {
    const recurring = inferRecurring(h)
    if (recurring === 'perPrayer' || recurring === 'multi') {
      // Duplicate across each of its sessions (5 prayers, or the parent's chosen times) with per-session claim status
      const sessionsClaimed = Array.isArray(h.sessionsClaimed) ? h.sessionsClaimed : []
      sessionsOfHabit(h).forEach(sid => {
        if (!groups[sid]) groups[sid] = []
        const claimedInThisSession = sessionsClaimed.includes(sid)
        // Clone habit with per-session context
        groups[sid].push({
          ...h,
          _sessionInstance: sid,
          _isPerPrayer: true,
          todayStatus: claimedInThisSession ? 'claimed' : 'pending',
        })
      })
    } else {
      const sid = inferSession(h)
      if (!groups[sid]) groups[sid] = []
      groups[sid].push(h)
    }
  })

  // Sort: anytime first, then chronological
  const order = ['anytime', 'subuh', 'zohor', 'asar', 'maghrib', 'isyak', 'sebelumTidur']
  const result = []
  order.forEach(sid => {
    if (!groups[sid]) return
    const list = groups[sid]
    // Sort within session: pending first, done last
    list.sort((a, b) => {
      const aDone = a.todayStatus === 'claimed' || a.todayStatus === 'verified'
      const bDone = b.todayStatus === 'claimed' || b.todayStatus === 'verified'
      return aDone === bDone ? 0 : aDone ? 1 : -1
    })
    const done = list.filter(h => h.todayStatus === 'claimed' || h.todayStatus === 'verified').length
    result.push({ sessionId: sid, habits: list, done, total: list.length, allDone: done === list.length })
  })
  return result
}

// ─────────── Multi-time habits ("Makan" → Pagi + Tengahari + Malam) ───────────
export const SLOT_ORDER = ['subuh', 'zohor', 'asar', 'maghrib', 'isyak', 'sebelumTidur']

/** Every session a habit repeats in (empty = once a day). */
export function sessionsOfHabit(habit) {
  const r = inferRecurring(habit)
  if (r === 'perPrayer') return PRAYER_SESSIONS
  if (r === 'multi') return SLOT_ORDER.filter(s => habit.sessions.includes(s))
  return []
}
export const isRepeatingHabit = (habit) => sessionsOfHabit(habit).length > 0

/** Session to claim for a repeating habit right now: current slot if it has one, else the latest slot already passed, else the first. */
export function claimSessionFor(habit, current = currentSessionFromClock()) {
  const list = sessionsOfHabit(habit)
  if (!list.length) return null
  if (list.includes(current)) return current
  const ci = SLOT_ORDER.indexOf(current)
  const passed = list.filter(s => SLOT_ORDER.indexOf(s) <= ci)
  return passed.length ? passed[passed.length - 1] : list[0]
}

/** "07:30" → "7:30 am" (or 24h for ms/id/ar). */
export function fmtClock(hhmm, lang = 'en') {
  if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (lang === 'en') return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
  return `${h}:${String(m).padStart(2, '0')}`
}
/** Optional exact clock time a parent set for one session of a habit. */
export const clockTimeOf = (habit, sessionId) => habit?.clockTimes?.[sessionId || habit?.session] || null
