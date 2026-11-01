/**
 * EQrel Engagement — keeps parents consistent WITHOUT overwhelming them.
 *  • Mod Percaya (auto-trust): a habit verified 7 days in a row auto-verifies from then on
 *  • Sahkan Pantas: bulk verification helper
 *  • Digests: Niat Pagi (morning), Laporan Malam (night), Laporan Perubahan Mingguan (weekly)
 * Server-only (used by app/api route + cron).
 */
import { FAMILY_QUOTES } from '@/lib/familyQuotes'
import { getHabitTitle } from '@/lib/habitTemplates'

export const TRUST_DAYS = 7
const LANGS = ['ms', 'en', 'id', 'ar']
const P = (lang) => (LANGS.includes(lang) ? lang : 'en')
const pick4 = (lang, ms, en, id, ar) => ({ ms, en, id, ar })[P(lang)] ?? en

export const fmtDate = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
export const utcToday = () => fmtDate(new Date())
export const shiftDate = (dateStr, days) => { const d = new Date(`${dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return fmtDate(d) }
const habitTitle = (h, lang) => h?.i18n?.[lang]?.title || getHabitTitle(h, lang) || h?.title || '—'

/** Local date/time (YYYY-MM-DD, HH:MM, weekday 0-6) in an IANA timezone. */
export function localNow(tz, now = new Date()) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now).map(p => [p.type, p.value]))
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday: wd }
  } catch { return localNow('UTC', now) }
}

// ─────────────────────────── Verification ───────────────────────────
/**
 * Verify one claim doc (status 'claimed') → 'verified' with rubric sah|ihsan.
 * `applyMataDelta` is injected from the route (keeps world-currency logic in one place).
 */
export async function verifyClaimDoc(db, { claim, habit, rubric = 'sah', note = '', verifierId, applyMataDelta, auto = false }) {
  const basePts = Number(habit.points) || 0
  const points = rubric === 'ihsan' ? Math.round(basePts * 1.5) : basePts
  const patch = {
    status: 'verified', rubric, note, pointsAwarded: points, excellence: rubric === 'ihsan',
    verifiedBy: verifierId, verifiedAt: new Date(), ...(auto ? { autoVerified: true } : {}),
  }
  await db.collection('habit_claims').updateOne({ _id: claim._id }, { $set: patch })
  await applyMataDelta(db, claim.childId, claim, { ...claim, ...patch })
  await db.collection('verify_log').insertOne({
    habitId: habit.id, dateStr: claim.dateStr, childId: claim.childId, familyId: habit.familyId,
    rubric, note, points, session: claim.session ?? null, verifiedBy: verifierId, verifiedAt: new Date(), auto,
  })
  return points
}

/**
 * Mod Percaya — if the habit has a verified (sah/ihsan) claim on each of the last 7 days
 * (ending on `dateStr`), turn on autoVerify automatically. Parent opt-out is respected.
 */
export async function checkAutoTrust(db, habit, dateStr = utcToday()) {
  if (!habit || habit.autoVerify || habit.trustOptOut) return false
  const days = Array.from({ length: TRUST_DAYS }, (_, i) => shiftDate(dateStr, -i))
  const got = await db.collection('habit_claims').distinct('dateStr', {
    habitId: habit.id, dateStr: { $in: days }, status: 'verified', rubric: { $in: ['sah', 'ihsan'] },
  })
  if (got.length < TRUST_DAYS) return false
  await db.collection('habits').updateOne({ id: habit.id }, { $set: { autoVerify: true, trustSince: new Date(), trustAuto: true, updatedAt: new Date() } })
  await db.collection('family_events').insertOne({
    id: crypto.randomUUID(), familyId: habit.familyId, childId: habit.childId, habitId: habit.id,
    type: 'trust_on', title: habit.title, i18n: habit.i18n || null, createdAt: new Date(),
  })
  return true
}

// ─────────────────────────── Digests ───────────────────────────
async function familyContext(db, familyId) {
  const children = await db.collection('children').find({ familyId }).sort({ createdAt: 1 })
    .project({ _id: 0, id: 1, nickname: 1, avatarId: 1, favColor: 1, diagnosis: 1, planStartedAt: 1, createdAt: 1 }).toArray()
  const habits = children.length ? await db.collection('habits')
    .find({ childId: { $in: children.map(c => c.id) }, active: { $ne: false } })
    .project({ _id: 0, id: 1, childId: 1, title: 1, i18n: 1, templateId: 1, recurring: 1, autoVerify: 1, points: 1 }).toArray() : []
  return { children, habits }
}

const DIM_NAMES = {
  ibadah: { ms: 'Ibadah', en: 'Worship', id: 'Ibadah', ar: 'العبادة' },
  quran: { ms: 'Al-Quran', en: 'Quran', id: 'Al-Quran', ar: 'القرآن' },
  akhlak: { ms: 'Akhlak', en: 'Character', id: 'Akhlak', ar: 'الأخلاق' },
  kesihatan: { ms: 'Kebersihan', en: 'Self-care', id: 'Kebersihan', ar: 'النظافة' },
  keluarga: { ms: 'Disiplin', en: 'Discipline', id: 'Disiplin', ar: 'الانضباط' },
}
const dayIndex = (dateStr) => Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 86400000)
export const quoteFor = (dateStr, lang, offset = 0) => {
  const q = FAMILY_QUOTES[(dayIndex(dateStr) + offset) % FAMILY_QUOTES.length]
  return { text: q.text[P(lang)] || q.text.en || q.text.ms, source: q.source }
}

/** Night digest (also used mid-day as "so far"). */
/** Rota: who is on verification duty for a local weekday (null = both parents). */
export function dutyFor(family, weekday) {
  const r = family?.verifyRota
  if (!r || r.mode !== 'weekday') return null
  return r.days?.[String(weekday)] || null
}
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '—'

export async function buildNightDigest(db, familyId, { dateStr = utcToday(), lang = 'en', viewerId = null, weekday = null } = {}) {
  const { children, habits } = await familyContext(db, familyId)
  // ── Kongsi Pasangan: duty rota + who verified today ──
  const family = await db.collection('families').findOne({ id: familyId }, { projection: { _id: 0, verifyRota: 1 } })
  const parents = await db.collection('users').find({ familyId }).project({ _id: 0, id: 1, name: 1, picture: 1 }).toArray()
  const wd = Number.isInteger(weekday) ? weekday : new Date().getUTCDay()
  const dutyId = dutyFor(family, wd)
  const dutyUser = parents.find(u => u.id === dutyId) || null
  const logs = await db.collection('verify_log').find({ familyId, dateStr, rubric: { $in: ['sah', 'ihsan'] } }).project({ _id: 0, verifiedBy: 1 }).toArray()
  const team = parents.map(u => ({ id: u.id, name: firstName(u.name), picture: u.picture || null, count: logs.filter(l => l.verifiedBy === u.id).length }))
  const autoCount = logs.filter(l => l.verifiedBy === 'trust').length
  const duty = dutyUser ? { id: dutyUser.id, name: firstName(dutyUser.name), isMe: dutyUser.id === viewerId } : null
  const claims = children.length ? await db.collection('habit_claims')
    .find({ familyId, dateStr }).project({ _id: 0, childId: 1, habitId: 1, status: 1, rubric: 1, autoVerified: 1 }).toArray() : []
  const trustNews = await db.collection('family_events')
    .find({ familyId, type: 'trust_on', createdAt: { $gte: new Date(Date.now() - 3 * 86400000) } })
    .project({ _id: 0 }).sort({ createdAt: -1 }).limit(5).toArray()

  const kids = children.map(c => {
    const hs = habits.filter(h => h.childId === c.id)
    const mine = claims.filter(cl => cl.childId === c.id)
    const doneIds = new Set(mine.filter(cl => cl.status === 'verified' && ['sah', 'ihsan'].includes(cl.rubric)).map(cl => cl.habitId))
    return {
      id: c.id, nickname: c.nickname, avatarId: c.avatarId,
      total: hs.length,
      done: hs.filter(h => doneIds.has(h.id)).length,
      ihsan: mine.filter(cl => cl.rubric === 'ihsan').length,
      pending: mine.filter(cl => cl.status === 'claimed').length,
      auto: mine.filter(cl => cl.autoVerified).length,
    }
  })
  const tot = kids.reduce((a, k) => ({ done: a.done + k.done, total: a.total + k.total, pending: a.pending + k.pending }), { done: 0, total: 0, pending: 0 })
  const q = quoteFor(dateStr, lang, 5)
  const kidLine = kids.map(k => `${k.nickname} ${k.done}/${k.total}${k.ihsan ? '⭐' : ''}`).join(' · ')
  const title = pick4(lang,
    `🌙 Laporan Malam · ${tot.done}/${tot.total} habit siap`,
    `🌙 Tonight's Report · ${tot.done}/${tot.total} habits done`,
    `🌙 Laporan Malam · ${tot.done}/${tot.total} kebiasaan selesai`,
    `🌙 تقرير الليلة · ${tot.done}/${tot.total} عادات منجزة`)
  const pendingLine = tot.pending > 0
    ? pick4(lang, `${tot.pending} menunggu sahkan — siap dalam 10 saat.`, `${tot.pending} waiting — done in 10 seconds.`, `${tot.pending} menunggu verifikasi — selesai dalam 10 detik.`, `${tot.pending} بانتظار التحقق — تنتهي في ١٠ ثوانٍ.`)
    : pick4(lang, 'Semua sudah disahkan. Jazakallahu khairan!', 'All verified. Jazakallahu khairan!', 'Semua sudah diverifikasi. Jazakallahu khairan!', 'تم التحقق من الكل. جزاكم الله خيراً!')
  const praise = pick4(lang,
    'Masa yang anda luangkan malam ini ialah sedekah ilmu buat anak — pahala yang berterusan.',
    'The minutes you give tonight are a gift of knowledge to your child — a reward that keeps flowing.',
    'Waktu yang Anda luangkan malam ini adalah sedekah ilmu untuk anak — pahala yang terus mengalir.',
    'دقائقك الليلة صدقة علمٍ لطفلك — أجرٌ جارٍ بإذن الله.')
  let pushTitle = title, pushBody = `${kidLine}${kidLine ? '. ' : ''}${pendingLine}`, url = tot.pending > 0 ? '/?parent=1&quick=1' : '/?parent=1'
  if (duty && duty.isMe) {
    pushTitle = pick4(lang, `🌙 Giliran anda malam ini · ${tot.done}/${tot.total}`, `🌙 Your turn tonight · ${tot.done}/${tot.total}`, `🌙 Giliran Anda malam ini · ${tot.done}/${tot.total}`, `🌙 دورك الليلة · ${tot.done}/${tot.total}`)
  } else if (duty && !duty.isMe) {
    pushBody = `${kidLine}${kidLine ? '. ' : ''}${pick4(lang, `Giliran ${duty.name} malam ini — anda boleh berehat 🤝`, `It's ${duty.name}'s turn tonight — you can rest 🤝`, `Giliran ${duty.name} malam ini — Anda bisa istirahat 🤝`, `دور ${duty.name} الليلة — يمكنك الراحة 🤝`)}`
    url = '/?parent=1'
  }
  const teamLine = team.filter(m => m.count > 0).map(m => `${m.name} ${m.count}`).join(' · ')
  return {
    kind: 'night', dateStr, kids, totals: tot, trustNews, quote: q, praise, duty, team, autoCount, teamLine,
    push: { title: pushTitle, body: pushBody, url, tag: `night-${dateStr}` },
  }
}

/** Morning "Niat Pagi" digest. */
export async function buildMorningDigest(db, familyId, { dateStr = utcToday(), lang = 'en' } = {}) {
  const { children, habits } = await familyContext(db, familyId)
  const kids = children.map(c => {
    const focusKey = c.diagnosis?.focus?.[0]
    return {
      id: c.id, nickname: c.nickname, avatarId: c.avatarId,
      total: habits.filter(h => h.childId === c.id).length,
      focus: focusKey ? (DIM_NAMES[focusKey]?.[P(lang)] || null) : null,
    }
  })
  const q = quoteFor(dateStr, lang)
  const niat = pick4(lang,
    'Niatkan hari ini: "Ya Allah, aku mendidik anak-anakku kerana-Mu." Setiap peringatan lembut anda dicatat sebagai ibadah.',
    'Set today\'s intention: "O Allah, I raise my children for Your sake." Every gentle reminder is recorded as worship.',
    'Niatkan hari ini: "Ya Allah, aku mendidik anak-anakku karena-Mu." Setiap pengingat lembut Anda tercatat sebagai ibadah.',
    'انوِ اليوم: «اللهم إني أربّي أبنائي لوجهك». كل تذكير لطيف منك يُكتب عبادة.')
  const kidLine = kids.map(k => k.focus
    ? pick4(lang, `${k.nickname}: fokus ${k.focus}`, `${k.nickname}: focus on ${k.focus}`, `${k.nickname}: fokus ${k.focus}`, `${k.nickname}: التركيز على ${k.focus}`)
    : pick4(lang, `${k.nickname}: ${k.total} habit`, `${k.nickname}: ${k.total} habits`, `${k.nickname}: ${k.total} kebiasaan`, `${k.nickname}: ${k.total} عادات`)).join(' · ')
  const title = pick4(lang, '🌅 Niat Pagi untuk Ibu Bapa', '🌅 Morning Intention for Parents', '🌅 Niat Pagi untuk Orang Tua', '🌅 نية الصباح للوالدين')
  return {
    kind: 'morning', dateStr, kids, quote: q, niat,
    push: { title, body: `${q.text.slice(0, 110)}${q.text.length > 110 ? '…' : ''}${kidLine ? ' — ' + kidLine : ''}`, url: '/?parent=1', tag: `morning-${dateStr}` },
  }
}

/** Weekly "Laporan Perubahan" — this week (7 days ending dateStr) vs the 7 days before. Rule-based narrative. */
export async function buildWeeklyDigest(db, familyId, { dateStr = utcToday(), lang = 'en' } = {}) {
  const { children, habits } = await familyContext(db, familyId)
  const thisDays = Array.from({ length: 7 }, (_, i) => shiftDate(dateStr, -i))
  const prevDays = Array.from({ length: 7 }, (_, i) => shiftDate(dateStr, -7 - i))
  const claims = children.length ? await db.collection('habit_claims')
    .find({ familyId, dateStr: { $in: [...thisDays, ...prevDays] }, status: 'verified', rubric: { $in: ['sah', 'ihsan'] } })
    .project({ _id: 0, childId: 1, habitId: 1, dateStr: 1, rubric: 1 }).toArray() : []
  const inThis = new Set(thisDays), inPrev = new Set(prevDays)

  const kids = children.map(c => {
    const hs = habits.filter(h => h.childId === c.id)
    const mine = claims.filter(cl => cl.childId === c.id)
    const now = mine.filter(cl => inThis.has(cl.dateStr)), before = mine.filter(cl => inPrev.has(cl.dateStr))
    const pct = hs.length ? Math.round((now.length / (hs.length * 7)) * 100) : 0
    const pctPrev = hs.length ? Math.round((before.length / (hs.length * 7)) * 100) : 0
    const per = hs.map(h => ({
      h, now: now.filter(cl => cl.habitId === h.id).length, before: before.filter(cl => cl.habitId === h.id).length,
    }))
    const best = [...per].sort((a, b) => b.now - a.now)[0]
    const improved = [...per].map(x => ({ ...x, d: x.now - x.before })).sort((a, b) => b.d - a.d)[0]
    const struggle = [...per].sort((a, b) => a.now - b.now)[0]
    const delta = pct - pctPrev
    const n = c.nickname
    const lines = []
    const started = c.planStartedAt || c.createdAt
    const firstWeek = !!started && (Date.now() - new Date(started).getTime()) < 13 * 86400000 && before.length === 0
    if (firstWeek && hs.length > 0) {
      // No "last week" yet → compare with the Day-1 diagnosis instead of an empty 0%
      const dg = c.diagnosis
      lines.push(pick4(lang,
        `Minggu pertama selesai! ${n} siapkan ${now.length} habit (${pct}% konsisten).`,
        `First week complete! ${n} finished ${now.length} habits (${pct}% consistent).`,
        `Minggu pertama selesai! ${n} menyelesaikan ${now.length} kebiasaan (${pct}% konsisten).`,
        `اكتمل الأسبوع الأول! أنجز ${n} ${now.length} عادات (${pct}% مواظبة).`))
      if (dg) {
        const fk = dg.focus?.[0]
        const fName = fk ? (DIM_NAMES[fk]?.[P(lang)] || fk) : null
        lines.push(pick4(lang,
          `📋 Titik mula Hari 1: skor diagnosis ${dg.overall}/100${fName ? `, fokus ${fName}` : ''}. Diagnosis semula pada hari ke-30 akan tunjuk perubahannya.`,
          `📋 Day-1 starting point: diagnosis score ${dg.overall}/100${fName ? `, focus ${fName}` : ''}. The day-30 re-diagnosis will show the change.`,
          `📋 Titik awal Hari 1: skor diagnosis ${dg.overall}/100${fName ? `, fokus ${fName}` : ''}. Diagnosis ulang hari ke-30 akan menunjukkan perubahannya.`,
          `📋 نقطة البداية: درجة التشخيص ${dg.overall}/100${fName ? `، التركيز ${fName}` : ''}. سيُظهر تشخيص اليوم ٣٠ التغيّر.`))
      }
      if (best && best.now > 0) lines.push(pick4(lang, `🌟 Paling konsisten: ${habitTitle(best.h, lang)} (${best.now}/7 hari).`, `🌟 Most consistent: ${habitTitle(best.h, lang)} (${best.now}/7 days).`, `🌟 Paling konsisten: ${habitTitle(best.h, lang)} (${best.now}/7 hari).`, `🌟 الأكثر مواظبة: ${habitTitle(best.h, lang)} (${best.now}/7 أيام).`))
      return { id: c.id, nickname: n, avatarId: c.avatarId, pct, pctPrev, delta, doneThisWeek: now.length, lines, firstWeek: true }
    }
    if (hs.length === 0) {
      lines.push(pick4(lang, `${n} belum ada habit. Jalankan Diagnosis untuk pelan khas.`, `${n} has no habits yet. Run the Diagnosis for a personal plan.`, `${n} belum punya kebiasaan. Jalankan Diagnosis.`, `${n} ليس لديه عادات بعد. ابدأ التشخيص.`))
    } else {
      lines.push(delta > 0
        ? pick4(lang, `Alhamdulillah! Konsistensi ${n} naik ${delta}% kepada ${pct}% minggu ini.`, `Alhamdulillah! ${n}'s consistency rose ${delta}% to ${pct}% this week.`, `Alhamdulillah! Konsistensi ${n} naik ${delta}% menjadi ${pct}% minggu ini.`, `الحمد لله! ارتفعت مواظبة ${n} بنسبة ${delta}% إلى ${pct}% هذا الأسبوع.`)
        : delta < 0
          ? pick4(lang, `Minggu ini ${n} di ${pct}% (turun ${-delta}%). Tidak mengapa — setiap anak ada turun naik.`, `This week ${n} was at ${pct}% (down ${-delta}%). That's okay — every child has ups and downs.`, `Minggu ini ${n} di ${pct}% (turun ${-delta}%). Tidak apa-apa.`, `هذا الأسبوع ${n} عند ${pct}% (انخفاض ${-delta}%). لا بأس، لكل طفل صعود وهبوط.`)
          : pick4(lang, `${n} kekal stabil pada ${pct}% minggu ini.`, `${n} held steady at ${pct}% this week.`, `${n} tetap stabil di ${pct}% minggu ini.`, `${n} ثابت عند ${pct}% هذا الأسبوع.`))
      if (best && best.now > 0) lines.push(pick4(lang, `🌟 Paling konsisten: ${habitTitle(best.h, lang)} (${best.now}/7 hari).`, `🌟 Most consistent: ${habitTitle(best.h, lang)} (${best.now}/7 days).`, `🌟 Paling konsisten: ${habitTitle(best.h, lang)} (${best.now}/7 hari).`, `🌟 الأكثر مواظبة: ${habitTitle(best.h, lang)} (${best.now}/7 أيام).`))
      if (improved && improved.d > 0 && improved.h.id !== best?.h.id) lines.push(pick4(lang, `📈 Paling meningkat: ${habitTitle(improved.h, lang)} (+${improved.d} hari).`, `📈 Most improved: ${habitTitle(improved.h, lang)} (+${improved.d} days).`, `📈 Paling meningkat: ${habitTitle(improved.h, lang)} (+${improved.d} hari).`, `📈 الأكثر تحسناً: ${habitTitle(improved.h, lang)} (+${improved.d} أيام).`))
      if (struggle && struggle.now <= 2 && struggle.h.id !== best?.h.id) lines.push(pick4(lang, `💡 Cadangan: temani ${n} untuk "${habitTitle(struggle.h, lang)}" — buat bersama-sama 2–3 hari, kemudian puji usahanya.`, `💡 Tip: do "${habitTitle(struggle.h, lang)}" together with ${n} for 2–3 days, then praise the effort.`, `💡 Saran: temani ${n} untuk "${habitTitle(struggle.h, lang)}" 2–3 hari, lalu puji usahanya.`, `💡 اقتراح: شارك ${n} في «${habitTitle(struggle.h, lang)}» ٢–٣ أيام ثم امدح جهده.`))
    }
    return { id: c.id, nickname: n, avatarId: c.avatarId, pct, pctPrev, delta, doneThisWeek: now.length, lines }
  })
  const q = quoteFor(dateStr, lang, 3)
  const top = [...kids].sort((a, b) => b.delta - a.delta)[0]
  const title = pick4(lang, '📖 Laporan Perubahan Minggu Ini', '📖 This Week\'s Progress Story', '📖 Laporan Perubahan Minggu Ini', '📖 قصة تقدّم هذا الأسبوع')
  return {
    kind: 'weekly', dateStr, from: thisDays[6], to: thisDays[0], kids, quote: q,
    push: { title, body: top ? top.lines[0] : '', url: '/?parent=1&tab=reports', tag: `weekly-${dateStr}` },
  }
}

// ─────────────────────────── Notification prefs ───────────────────────────
export const DEFAULT_PREFS = { tz: 'Asia/Kuala_Lumpur', lang: 'en', morning: { enabled: true, time: '05:30' }, night: { enabled: true, time: '21:00' }, weekly: { enabled: true } }
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
export function sanitizePrefs(body = {}, prev = DEFAULT_PREFS) {
  const base = { ...DEFAULT_PREFS, ...(prev || {}) }
  let tz = typeof body.tz === 'string' ? body.tz : base.tz
  try { new Intl.DateTimeFormat('en', { timeZone: tz }) } catch { tz = base.tz }
  const slot = (k) => ({
    enabled: typeof body[k]?.enabled === 'boolean' ? body[k].enabled : base[k].enabled,
    time: HHMM.test(body[k]?.time || '') ? body[k].time : base[k].time,
  })
  return {
    tz, lang: LANGS.includes(body.lang) ? body.lang : base.lang,
    morning: slot('morning'), night: slot('night'),
    weekly: { enabled: typeof body.weekly?.enabled === 'boolean' ? body.weekly.enabled : base.weekly.enabled },
  }
}
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
/** Due if local time is within [time, time+59min] and not yet sent for that local date. */
export function isDue(slotTime, local, lastSent) {
  const diff = local.minutes - toMin(slotTime)
  return diff >= 0 && diff < 60 && lastSent !== local.date
}
