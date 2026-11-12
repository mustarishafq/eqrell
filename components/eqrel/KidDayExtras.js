'use client'
// Kid Mode extras: "My Day" picture timeline + habit reminders opt-in on the child's own device.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { SESSION_BY_ID, groupHabitsBySession, currentSessionFromClock, currentSessionFromPrayerTimes, fmtClock, clockTimeOf } from '@/lib/prayerSession'
import { HABIT_CATEGORIES } from '@/lib/habitTemplates'
import { pushSupported, enablePush, currentSubscription, isIOS, isStandalone } from '@/lib/pushClient'

const L = (lang, ms, en, id, ar) => (lang === 'ms' ? ms : lang === 'id' ? id : lang === 'ar' ? ar : en)
const DAY_SLOTS = ['subuh', 'zohor', 'asar', 'maghrib', 'isyak', 'sebelumTidur']
const SLOT_NAME = {
  subuh: ['Pagi', 'Morning', 'Pagi', 'الصباح'],
  zohor: ['Tengahari', 'Midday', 'Siang', 'الظهيرة'],
  asar: ['Petang', 'Afternoon', 'Sore', 'العصر'],
  maghrib: ['Senja', 'Evening', 'Senja', 'المغرب'],
  isyak: ['Malam', 'Night', 'Malam', 'الليل'],
  sebelumTidur: ['Tidur', 'Bedtime', 'Tidur', 'النوم'],
}
const slotName = (sid, lang) => L(lang, ...(SLOT_NAME[sid] || [sid, sid, sid, sid]))
const isDone = (h) => h.todayStatus === 'claimed' || h.todayStatus === 'verified'

/**
 * DayTimeline — the child's day as pictures: Morning → Bedtime, each stop shows its habits as icons,
 * a ✓ when done, the exact time if a parent set one, and a "Now" pin on the current part of the day.
 */
export function DayTimeline({ habits = [], lang = 'en', timings = null, onPick }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])
  // Keep the "Now" stop in view on narrow screens (scroll only the timeline strip, never the page)
  useEffect(() => {
    const id = setTimeout(() => {
      const btn = document.querySelector('[data-timeline-now="1"]')
      const strip = btn?.closest('[data-timeline-strip]')
      if (btn && strip) strip.scrollLeft = Math.max(0, btn.offsetLeft - (strip.clientWidth - btn.clientWidth) / 2)
    }, 300)
    return () => clearTimeout(id)
  }, [])
  const groups = groupHabitsBySession(habits)
  const anytime = groups.find(g => g.sessionId === 'anytime')
  const cur = timings ? currentSessionFromPrayerTimes(timings, now) : currentSessionFromClock(now)
  const stops = DAY_SLOTS.map(sid => ({ sid, g: groups.find(x => x.sessionId === sid) })).filter(x => x.g)
  if (stops.length === 0) return null
  const curIdx = DAY_SLOTS.indexOf(cur)
  const totalDone = groups.reduce((n, g) => n + g.done, 0), total = groups.reduce((n, g) => n + g.total, 0)

  return (
    <div className="mt-4 rounded-3xl bg-white/80 border border-emerald-100 shadow-sm p-3" data-testid="kid-day-timeline">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-[12px] font-black text-emerald-900">🗓️ {L(lang, 'Hari Saya', 'My Day', 'Hariku', 'يومي')}</div>
        <div className="text-[11px] font-black text-emerald-700">{totalDone}/{total} ✓</div>
      </div>
      <div className="relative overflow-x-auto no-scrollbar -mx-1 px-1" data-timeline-strip>
        <div className="flex items-start gap-1 min-w-max pt-3">
          {stops.map(({ sid, g }, i) => {
            const meta = SESSION_BY_ID[sid]
            const idx = DAY_SLOTS.indexOf(sid)
            const isNow = sid === cur
            const past = idx < curIdx
            const allDone = g.total > 0 && g.done === g.total
            const clocks = g.habits.map(h => clockTimeOf(h, h._sessionInstance || sid)).filter(Boolean).sort()
            return (
              <div key={sid} className="flex items-start">
                {i > 0 && <div className={`mt-7 w-4 h-1 rounded-full ${past || isNow ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                <button onClick={() => onPick?.(sid)} data-testid={`timeline-${sid}`} data-timeline-now={isNow ? '1' : undefined}
                  className={`relative w-[74px] flex flex-col items-center rounded-2xl pt-1.5 pb-2 px-1 transition-all active:scale-95 ${isNow ? 'bg-amber-50 ring-2 ring-amber-400' : ''}`}>
                  {isNow && (
                    <motion.span initial={{ y: -2 }} animate={{ y: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 1.6 }}
                      className="absolute -top-2.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-[9px] font-black text-amber-950 shadow">
                      {L(lang, 'SEKARANG', 'NOW', 'SEKARANG', 'الآن')}
                    </motion.span>
                  )}
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${meta?.gradient || 'from-emerald-400 to-teal-500'} flex items-center justify-center text-2xl shadow-md ${past && !allDone ? 'opacity-60' : ''}`}>
                    {allDone ? '✅' : meta?.icon}
                  </div>
                  <div className="mt-1 text-[10px] font-black text-emerald-950 leading-tight text-center">{slotName(sid, lang)}</div>
                  {clocks[0] && <div className="text-[9px] font-bold text-amber-700">⏰ {fmtClock(clocks[0], lang)}</div>}
                  <div className="mt-1 flex flex-wrap justify-center gap-0.5 max-w-[66px]">
                    {g.habits.slice(0, 6).map(h => (
                      <span key={`${h.id}-${h._sessionInstance || ''}`} title={h.title}
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${isDone(h) ? 'bg-emerald-100 ring-1 ring-emerald-400' : 'bg-gray-100'}`}>
                        {isDone(h) ? '✓' : (h.icon || HABIT_CATEGORIES[h.category]?.icon || '⭐')}
                      </span>
                    ))}
                    {g.habits.length > 6 && <span className="text-[9px] font-black text-emerald-800">+{g.habits.length - 6}</span>}
                  </div>
                  <div className={`mt-1 text-[9px] font-black ${allDone ? 'text-emerald-600' : 'text-emerald-900/50'}`}>{g.done}/{g.total}</div>
                </button>
              </div>
            )
          })}
        </div>
      </div>
      {anytime && anytime.total > 0 && (
        <button onClick={() => onPick?.('anytime')} className="mt-2 w-full rounded-xl bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 flex items-center justify-between" data-testid="timeline-anytime">
          <span>🕰️ {L(lang, 'Bila-bila masa hari ini', 'Anytime today', 'Kapan saja hari ini', 'في أي وقت اليوم')}</span>
          <span className="font-black">{anytime.done}/{anytime.total}</span>
        </button>
      )}
    </div>
  )
}

/** Opt-in card shown only on a child's own linked device: "Remind me at my habit times". */
export function KidReminderCard({ kidDevice, lang = 'en', hasTimedHabits = false }) {
  const [state, setState] = useState('checking')   // checking | off | on | unsupported | denied | needsInstall | busy
  useEffect(() => {
    if (!kidDevice) return
    if (!pushSupported()) { setState(isIOS() && !isStandalone() ? 'needsInstall' : 'unsupported'); return }
    if (Notification.permission === 'denied') { setState('denied'); return }
    currentSubscription().then(sub => setState(sub && Notification.permission === 'granted' ? 'on' : 'off')).catch(() => setState('off'))
  }, [kidDevice])
  if (!kidDevice || !hasTimedHabits || state === 'checking' || state === 'on' || state === 'unsupported') return null
  const turnOn = async () => {
    setState('busy')
    try { await enablePush({ lang }); setState('on') } catch (e) { setState(e?.message === 'denied' ? 'denied' : 'off') }
  }
  return (
    <div className="mt-4 rounded-3xl bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200 px-4 py-3 flex items-center gap-3" data-testid="kid-reminder-card">
      <span className="text-3xl">🔔</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-black text-emerald-950 leading-tight">{L(lang, 'Ingatkan saya ikut jam', 'Remind me at my times', 'Ingatkan aku sesuai jam', 'ذكّرني في أوقاتي')}</div>
        <div className="text-[11px] text-emerald-900/70 leading-snug">
          {state === 'denied'
            ? L(lang, 'Notifikasi disekat — minta Ibu/Ayah benarkan dalam tetapan peranti.', 'Notifications are blocked — ask a parent to allow them in device settings.', 'Notifikasi diblokir — minta orang tua mengizinkan di pengaturan.', 'الإشعارات محظورة — اطلب من والديك السماح بها.')
            : state === 'needsInstall'
              ? L(lang, 'Pasang EQrel ke skrin utama dahulu untuk dapat peringatan.', 'Add EQrel to the Home Screen first to get reminders.', 'Pasang EQrel ke layar utama dulu.', 'أضف EQrel إلى الشاشة الرئيسية أولاً.')
              : L(lang, 'Contoh: "⏰ Masa untuk sarapan!" pada 7:30 pagi.', 'E.g. "⏰ Time for breakfast!" at 7:30 am.', 'Contoh: "⏰ Waktunya sarapan!" jam 7:30.', 'مثال: «⏰ حان وقت الفطور!» الساعة ٧:٣٠.')}
        </div>
      </div>
      {(state === 'off' || state === 'busy') && (
        <button onClick={turnOn} disabled={state === 'busy'} data-testid="kid-reminder-on"
          className="flex-shrink-0 rounded-2xl bg-emerald-500 text-white text-[12px] font-black px-3 py-2 active:scale-95 disabled:opacity-50">
          {state === 'busy' ? '…' : L(lang, 'Hidupkan', 'Turn on', 'Nyalakan', 'تفعيل')}
        </button>
      )}
    </div>
  )
}
