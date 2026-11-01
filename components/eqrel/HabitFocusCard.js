'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { HABIT_CATEGORIES, getCategoryLabel, getHabitTitle } from '@/lib/habitTemplates'
import { getSessionLabel, groupHabitsBySession, currentSessionFromClock, currentSessionFromPrayerTimes } from '@/lib/prayerSession'

const pick = (lang) => (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)

// EQrel CI palette only — solid colours, no gradients/tints (brand: lib/brand.js + tailwind eq-*)
const CI = { green: '#00B894', yellow: '#FFB703', coral: '#FF5D6E', blue: '#2D9CDB', orange: '#FF8A00', ink: '#0F2E25', cream: '#FFF8E7', white: '#FFFFFF' }
// Time-of-day accent (session chip) — every value is a CI colour
const ACCENT = { subuh: CI.orange, zohor: CI.yellow, asar: CI.orange, maghrib: CI.coral, isyak: CI.blue, sebelumTidur: CI.blue, anytime: CI.green }
const ICON = { subuh: '🌅', zohor: '☀️', asar: '🌤️', maghrib: '🌇', isyak: '🌙', sebelumTidur: '⭐', anytime: '🕰️' }
const ORDER = ['subuh', 'zohor', 'asar', 'maghrib', 'isyak', 'sebelumTidur']
const START_KEY = { subuh: 'Fajr', zohor: 'Dhuhr', asar: 'Asr', maghrib: 'Maghrib', isyak: 'Isha' }

const isDone = (h) => h.todayStatus === 'claimed' || h.todayStatus === 'verified'
const hhmm = (s) => (typeof s === 'string' ? s.slice(0, 5) : null)

function cheer(sessionId, L) {
  return ({
    subuh: L('Mulakan hari dengan Bismillah ✨', 'Start your day with Bismillah ✨', 'Mulai harimu dengan Bismillah ✨', 'ابدأ يومك ببسم الله ✨'),
    zohor: L('Rehat tengah hari, jangan lupa Allah 🤍', 'Midday break — remember Allah 🤍', 'Istirahat siang, ingat Allah 🤍', 'استراحة الظهر — اذكر الله 🤍'),
    asar: L('Petang yang ceria — jom buat kebaikan!', 'Happy afternoon — let’s do good!', 'Sore yang ceria — ayo berbuat baik!', 'عصر سعيد — هيا نفعل الخير!'),
    maghrib: L('Matahari terbenam — masa berkumpul keluarga 🌇', 'Sunset — family time 🌇', 'Matahari terbenam — waktu keluarga 🌇', 'الغروب — وقت العائلة 🌇'),
    isyak: L('Malam yang tenang — tutup hari dengan baik 🌙', 'A calm night — end the day well 🌙', 'Malam yang tenang 🌙', 'ليلة هادئة 🌙'),
    sebelumTidur: L('Masa bersedia tidur — baca doa ya ⭐', 'Getting ready for bed — say your du’a ⭐', 'Siap tidur — baca doa ya ⭐', 'وقت النوم — اقرأ الدعاء ⭐'),
    anytime: L('Satu kebaikan kecil hari ini 💚', 'One small good deed today 💚', 'Satu kebaikan kecil hari ini 💚', 'عمل خير صغير اليوم 💚'),
  })[sessionId]
}

/**
 * Kid Mode "Now" card — TV-style, time-aware. Shows the ONE habit to do right now
 * (based on prayer-time windows), a big "I did it" button, and what's up next.
 */
export default function HabitFocusCard({ habits = [], lang = 'en', t, busyHabit, onClaim, onOpenWorld, timings = null }) {
  const L = pick(lang)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(i) }, [])

  const norm = useMemo(() => (timings ? {
    fajr: hhmm(timings.Fajr), dhuhr: hhmm(timings.Dhuhr), asr: hhmm(timings.Asr), maghrib: hhmm(timings.Maghrib), isha: hhmm(timings.Isha),
  } : null), [timings])
  const sessionId = norm ? currentSessionFromPrayerTimes(norm, now) : currentSessionFromClock(now)

  const { focus, upNext, done, total, allDoneToday } = useMemo(() => {
    const groups = groupHabitsBySession(habits)
    const g = groups.find(x => x.sessionId === sessionId)
    const any = groups.find(x => x.sessionId === 'anytime')
    const list = g?.habits || []
    const rank = (a, b) => (b.core ? 1 : 0) - (a.core ? 1 : 0) || (b.points || 0) - (a.points || 0)
    const pendingHere = list.filter(h => !isDone(h)).sort(rank)
    const pendingAny = (any?.habits || []).filter(h => !isDone(h)).sort(rank)
    const queue = [...pendingHere, ...pendingAny]
    const allPending = groups.flatMap(x => x.habits).filter(h => !isDone(h))
    return {
      focus: queue[0] || null,
      upNext: queue.slice(1, 3),
      done: list.filter(isDone).length,
      total: list.length,
      allDoneToday: habits.length > 0 && allPending.length === 0,
    }
  }, [habits, sessionId])

  // Next window (for the "Next: … at 19:21" line)
  const nextId = sessionId === 'anytime' ? null : ORDER[ORDER.indexOf(sessionId) + 1] || null
  const nextAt = nextId && START_KEY[nextId] ? hhmm(timings?.[START_KEY[nextId]]) : null
  const accent = ACCENT[sessionId] || CI.green
  const accentInk = accent === CI.yellow ? CI.ink : CI.white
  const clock = now.toLocaleTimeString(lang === 'ar' ? 'ar' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  const sessionLabel = getSessionLabel(sessionId, lang)

  if (!habits.length) return null

  const busyKey = focus ? (focus._isPerPrayer ? `${focus.id}::${focus._sessionInstance}` : focus.id) : null
  const busy = !!busyKey && busyHabit === busyKey
  const cat = focus ? (HABIT_CATEGORIES[focus.category] || HABIT_CATEGORIES.ibadah) : null
  const focusFromAnytime = focus && !(groupHabitsBySession(habits).find(x => x.sessionId === sessionId)?.habits || []).some(h => h.id === focus.id && h._sessionInstance === focus._sessionInstance)

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="mt-4 relative overflow-hidden rounded-[28px] shadow-eq-card border-4"
      style={{ backgroundColor: CI.ink, borderColor: CI.green, color: CI.white }} data-testid="kid-focus-card" data-session={sessionId}>

      <div className="relative p-4">
        {/* Top bar: LIVE · session · clock */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: CI.coral, color: CI.white }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: CI.white }} /> {L('Sekarang', 'Now', 'Sekarang', 'الآن')}
          </span>
          <span className="rounded-full px-2.5 py-1 text-[12px] font-extrabold truncate" style={{ backgroundColor: accent, color: accentInk }} data-testid="kid-focus-session">{ICON[sessionId]} {sessionLabel}</span>
          <span className="ml-auto text-lg font-black tabular-nums" style={{ color: CI.yellow }} data-testid="kid-focus-clock">{clock}</span>
        </div>
        <div className="mt-1.5 text-[12px] font-semibold" style={{ color: CI.cream }}>{cheer(sessionId, L)}</div>

        <AnimatePresence mode="wait">
          {focus ? (
            <motion.div key={busyKey} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-[72px] h-[72px] rounded-3xl flex items-center justify-center text-4xl flex-shrink-0" style={{ backgroundColor: CI.cream }}>{cat.icon}</div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: CI.green }}>
                    {focusFromAnytime ? L('Boleh buat bila-bila', 'Anytime habit', 'Kapan saja', 'في أي وقت') : L('Fokus sekarang', 'Focus now', 'Fokus sekarang', 'ركّز الآن')}
                  </div>
                  <div className="text-2xl font-black leading-tight" data-testid="kid-focus-title">
                    {getHabitTitle(focus, lang)} {focus.core && <span className="text-lg align-middle">🕌</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-extrabold">
                    <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: CI.green, color: CI.white }}>{getCategoryLabel(focus.category, t)}</span>
                    <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: CI.yellow, color: CI.ink }}>+{focus.points} {t?.habits_points_word || 'pts'}</span>
                  </div>
                </div>
              </div>

              <button onClick={() => onClaim?.(focus)} disabled={busy} data-habit-card-id={busyKey} data-testid="kid-focus-done-btn"
                className="mt-4 w-full rounded-2xl py-4 text-lg font-black active:scale-[0.97] transition-transform disabled:opacity-70 inline-flex items-center justify-center gap-2" style={{ backgroundColor: CI.yellow, color: CI.ink }}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-6 h-6" strokeWidth={3} />}
                {L('Saya dah buat!', 'I did it!', 'Aku sudah!', 'فعلتُها!')}
              </button>
            </motion.div>
          ) : (
            <motion.div key="alldone" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 text-center" data-testid="kid-focus-alldone">
              <div className="text-5xl">{allDoneToday ? '🏆' : '🎉'}</div>
              <div className="mt-1 text-xl font-black">
                {allDoneToday
                  ? L('MasyaAllah! Semua habit hari ini siap!', 'MashaAllah! All of today’s habits are done!', 'MasyaAllah! Semua kebiasaan hari ini selesai!', 'ما شاء الله! أنجزت كل عادات اليوم!')
                  : L(`Semua siap untuk ${sessionLabel}!`, `All done for ${sessionLabel}!`, `Semua selesai untuk ${sessionLabel}!`, `أنجزت كل شيء لـ ${sessionLabel}!`)}
              </div>
              {!allDoneToday && nextId && (
                <div className="mt-1 text-[13px] font-semibold" style={{ color: CI.cream }} data-testid="kid-focus-next-window">
                  {L('Seterusnya', 'Next', 'Berikutnya', 'التالي')}: {ICON[nextId]} {getSessionLabel(nextId, lang)}{nextAt ? ` · ${nextAt}` : ''}
                </div>
              )}
              <button onClick={onOpenWorld} data-testid="kid-focus-world"
                className="mt-4 w-full rounded-2xl py-3.5 text-base font-black active:scale-[0.97]" style={{ backgroundColor: CI.yellow, color: CI.ink }}>
                🌍 {L('Jom bina di dunia saya', 'Go build in my world', 'Ayo bangun di duniaku', 'هيا نبني في عالمي')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session progress + up next */}
        <div className="mt-4 flex items-center gap-3">
          {total > 0 && (
            <div className="flex items-center gap-1" data-testid="kid-focus-progress" aria-label={`${done}/${total}`}>
              {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
                <span key={i} className={`h-2 rounded-full transition-all ${i < done ? 'w-5' : 'w-2'}`} style={{ backgroundColor: i < done ? CI.yellow : CI.green }} />
              ))}
              <span className="ml-1 text-[11px] font-black" style={{ color: CI.cream }}>{done}/{total}</span>
            </div>
          )}
          {nextAt && focus && (
            <span className="ml-auto text-[11px] font-bold whitespace-nowrap" style={{ color: CI.cream }}>{ICON[nextId]} {hhmm(nextAt)}</span>
          )}
        </div>
        {upNext.length > 0 && (
          <div className="mt-3" data-testid="kid-focus-next">
            <div className="text-[10px] font-black uppercase tracking-widest mb-1.5 px-1" style={{ color: CI.green }}>{L('Selepas ini', 'Up next', 'Berikutnya', 'التالي')}</div>
            <div className="space-y-1.5">
              {upNext.map(h => {
                const c = HABIT_CATEGORIES[h.category] || HABIT_CATEGORIES.ibadah
                return (
                  <button key={`${h.id}::${h._sessionInstance || ''}`} onClick={() => onClaim?.(h)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left active:scale-[0.98]" style={{ backgroundColor: CI.cream, color: CI.ink }}>
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: CI.white }}>{c.icon}</span>
                    <span className="flex-1 min-w-0 text-[13px] font-extrabold truncate">{getHabitTitle(h, lang)}</span>
                    <span className="text-[11px] font-black rounded-full px-2 py-0.5" style={{ backgroundColor: CI.yellow, color: CI.ink }}>+{h.points}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  )
}
