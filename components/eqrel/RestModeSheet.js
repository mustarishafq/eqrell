'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { pick } from '@/components/eqrel/tabs/tabUtils'

const locale = (lang) => (lang === 'ar' ? 'ar' : lang === 'ms' ? 'ms-MY' : lang === 'id' ? 'id-ID' : 'en-GB')
const fmtDate = (d, lang) => new Date(d).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short' })
const isoDay = (d) => d.toISOString().slice(0, 10)
const todayIso = () => isoDay(new Date())
const plusDays = (n) => isoDay(new Date(Date.now() + n * 86400000))
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000) + 1

const reasonEmoji = (r) => (r === 'musafir' ? '✈️' : '🛌')

/** Mod Musafir & Hari Rehat — pause other habits + freeze streaks (whole family or one child). Solat Teras stays on. */
export function RestModeSheet({ open, onClose, lang = 'en', onChanged, initialChildId = null }) {
  const L = pick(lang)
  const [state, setState] = useState(undefined)      // { restMode, children }
  const [who, setWho] = useState('family')            // 'family' | childId
  const [reason, setReason] = useState('musafir')
  const [endDate, setEndDate] = useState(plusDays(2)) // inclusive last rest day
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => fetch('/api/family/rest-mode', { credentials: 'include' })
    .then(r => (r.ok ? r.json() : { restMode: null, children: [] }))
    .then(d => setState({ restMode: d.restMode || null, children: d.children || [] }))
    .catch(() => setState({ restMode: null, children: [] }))

  useEffect(() => {
    if (!open) return
    setError(''); setState(undefined); setWho(initialChildId || 'family'); setEndDate(plusDays(2))
    load()
  }, [open, initialChildId])

  const kids = state?.children || []
  const restingKids = kids.filter(k => k.restMode)
  const freeKids = kids.filter(k => !k.restMode)
  const famRest = state?.restMode || null
  const days = Math.max(1, Math.min(14, daysBetween(todayIso(), endDate)))
  const whoName = who === 'family' ? null : kids.find(k => k.id === who)?.nickname

  // If the selected child is already resting, fall back to family
  useEffect(() => { if (who !== 'family' && state && !freeKids.some(k => k.id === who)) setWho('family') }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/family/rest-mode', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, until: endDate, ...(who !== 'family' ? { childId: who } : {}) }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'Something went wrong'); return }
      await load(); onChanged?.()
    } finally { setBusy(false) }
  }
  const end = async (childId = null) => {
    setBusy(true); setError('')
    try {
      await fetch('/api/family/rest-mode/end', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childId ? { childId } : {}),
      })
      await load(); onChanged?.()
    } finally { setBusy(false) }
  }

  const ActiveCard = ({ rest, name, onEnd, testId }) => (
    <div className="bg-white rounded-2xl p-4 shadow-eq-card" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="text-3xl">{reasonEmoji(rest.reason)}</div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-eq-ink leading-tight">
            {name ? `${name} · ` : ''}{rest.reason === 'musafir' ? L('Mod Musafir aktif', 'Travel mode is on', 'Mode safar aktif', 'وضع السفر مفعّل') : L('Hari Rehat aktif', 'Rest days are on', 'Hari istirahat aktif', 'أيام الراحة مفعّلة')}
          </div>
          <div className="text-[12px] text-eq-ink/60">{fmtDate(rest.from, lang)} – {fmtDate(rest.to, lang)} · {L('tamat sendiri', 'ends automatically', 'berakhir otomatis', 'ينتهي تلقائياً')}</div>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[12px] font-bold text-emerald-800">🕌 {L('Solat Teras tetap aktif', 'Core prayers stay on', 'Sholat inti tetap aktif', 'الصلاة الأساسية مستمرة')}{rest.reason === 'musafir' ? ` — ${L('boleh jamak & qasar', 'you may combine & shorten', 'boleh jamak & qashar', 'يجوز الجمع والقصر')}` : ''}</div>
      <button onClick={onEnd} disabled={busy} data-testid={`${testId}-end`} className="mt-3 w-full rounded-2xl py-3 bg-white border-2 border-emerald-500 text-emerald-700 font-extrabold text-sm disabled:opacity-50 active:scale-[0.98]">
        {name
          ? L(`${name} dah sedia — sambung habit`, `${name} is back — resume habits`, `${name} sudah siap — lanjutkan`, `${name} عاد — استئناف العادات`)
          : L('Kami dah pulang — sambung semua habit', "We're back — resume all habits", 'Kami sudah pulang — lanjutkan', 'عدنا — استئناف العادات')}
      </button>
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="rest-sheet">
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
            className="w-full sm:max-w-md bg-eq-warm rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto p-4 space-y-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-100 flex items-center justify-center text-2xl">✈️</div>
              <div className="flex-1">
                <h2 className="font-extrabold text-lg text-eq-ink leading-tight">{L('Mod Musafir & Hari Rehat', 'Travel & Rest Days', 'Mode Safar & Hari Istirahat', 'وضع السفر والراحة')}</h2>
                <p className="text-[11px] text-eq-ink/60">{L('Rehat tanpa rasa bersalah — streak dibekukan, bukan diputuskan.', 'Rest without guilt — streaks are frozen, not broken.', 'Istirahat tanpa rasa bersalah — streak dibekukan.', 'استرح دون ذنب — السلسلة مُجمّدة لا مكسورة.')}</p>
              </div>
              <button onClick={onClose} aria-label="close" data-testid="rest-close" className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            {state === undefined ? <div className="h-40 rounded-2xl bg-white/70 animate-pulse" /> : (
              <>
                {famRest && <ActiveCard rest={famRest} onEnd={() => end()} testId="rest-active" />}
                {!famRest && restingKids.map(k => (
                  <ActiveCard key={k.id} rest={k.restMode} name={k.nickname} onEnd={() => end(k.id)} testId={`rest-active-${k.id}`} />
                ))}

                {!famRest && (
                  <div className="space-y-3" data-testid="rest-form">
                    {restingKids.length > 0 && (
                      <div className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50 pt-1">{L('Mulakan rehat baharu', 'Start another rest', 'Mulai istirahat baru', 'ابدأ راحة جديدة')}</div>
                    )}
                    <div className="bg-white rounded-2xl p-3 shadow-eq-card">
                      <div className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50 mb-2">{L('Siapa berehat?', 'Who is resting?', 'Siapa yang istirahat?', 'من يستريح؟')}</div>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setWho('family')} data-testid="rest-who-family"
                          className={`px-3.5 py-2 rounded-full text-sm font-extrabold ${who === 'family' ? 'bg-sky-500 text-white' : 'bg-eq-warm text-eq-ink/70'}`}>
                          👨‍👩‍👧 {L('Seluruh keluarga', 'Whole family', 'Seluruh keluarga', 'كل العائلة')}
                        </button>
                        {freeKids.map(k => (
                          <button key={k.id} onClick={() => setWho(k.id)} data-testid={`rest-who-${k.id}`}
                            className={`px-3.5 py-2 rounded-full text-sm font-extrabold ${who === k.id ? 'bg-sky-500 text-white' : 'bg-eq-warm text-eq-ink/70'}`}>
                            {k.nickname || '—'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[['musafir', '✈️', L('Bermusafir', 'Travelling', 'Bepergian', 'مسافرون'), L('Balik kampung, bercuti, umrah', 'Hometown, holiday, umrah', 'Mudik, liburan, umrah', 'زيارة، عطلة، عمرة')],
                        ['rehat', '🛌', L('Hari Rehat', 'Rest days', 'Hari istirahat', 'أيام راحة'), L('Majlis, sibuk, kurang sihat', 'Events, busy days, feeling unwell', 'Acara, sibuk, kurang sehat', 'مناسبات، انشغال، مرض خفيف')]].map(([k, e, t, sub]) => (
                        <button key={k} onClick={() => setReason(k)} data-testid={`rest-reason-${k}`}
                          className={`text-left rounded-2xl border-2 p-3 ${reason === k ? 'border-sky-500 bg-white shadow' : 'border-gray-200 bg-white/60'}`}>
                          <div className="text-2xl">{e}</div>
                          <div className="font-extrabold text-sm text-eq-ink mt-1">{t}</div>
                          <div className="text-[11px] text-eq-ink/55 leading-snug">{sub}</div>
                        </button>
                      ))}
                    </div>

                    <div className="bg-white rounded-2xl p-3 shadow-eq-card">
                      <div className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50 mb-2">{L('Sehingga bila?', 'Until when?', 'Sampai kapan?', 'حتى متى؟')}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 5, 7, 14].map(n => (
                          <button key={n} onClick={() => setEndDate(plusDays(n - 1))} data-testid={`rest-days-${n}`}
                            className={`px-3.5 py-2 rounded-full text-sm font-extrabold ${days === n ? 'bg-sky-500 text-white' : 'bg-eq-warm text-eq-ink/70'}`}>
                            {n} {n === 1 ? L('hari', 'day', 'hari', 'يوم') : L('hari', 'days', 'hari', 'أيام')}
                          </button>
                        ))}
                      </div>
                      <label className="mt-2.5 flex items-center gap-2 text-[12px] font-bold text-eq-ink/70">
                        📅 {L('Atau pilih tarikh akhir', 'Or pick the last day', 'Atau pilih tanggal akhir', 'أو اختر آخر يوم')}
                        <input type="date" value={endDate} min={todayIso()} max={plusDays(13)} data-testid="rest-end-date"
                          onChange={e => e.target.value && setEndDate(e.target.value)}
                          className="ml-auto rounded-xl border border-gray-200 bg-eq-warm px-2 py-1.5 text-[13px] font-extrabold text-eq-ink" />
                      </label>
                      <div className="mt-2 text-[12px] text-sky-800 font-bold" data-testid="rest-summary">
                        {fmtDate(todayIso(), lang)} – {fmtDate(endDate, lang)} · {days} {days === 1 ? L('hari', 'day', 'hari', 'يوم') : L('hari', 'days', 'hari', 'أيام')} · {L('boleh tamatkan awal bila-bila masa', 'you can end it early anytime', 'bisa diakhiri kapan saja', 'يمكنك الإنهاء مبكراً')}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/80 p-3 text-[12px] text-eq-ink/75 leading-snug space-y-1">
                      <div>⏸ {L('Habit lain dijeda — anak tak rasa “gagal”.', 'Other habits pause — no one feels like they “failed”.', 'Kebiasaan lain dijeda.', 'تتوقف العادات الأخرى.')}</div>
                      <div>❄️ {L('Streak & Mod Percaya dibekukan.', 'Streaks & Trust Mode are frozen.', 'Streak & Mode Percaya dibekukan.', 'السلسلة ووضع الثقة مجمّدة.')}</div>
                      <div>🌤️ {L('Kampung kekal cerah — tiada awan gelap.', 'The village stays bright — no dark clouds.', 'Desa tetap cerah — tanpa awan gelap.', 'تبقى القرية مشرقة — بلا غيوم داكنة.')}</div>
                      <div className="font-bold text-emerald-800">🕌 {L('Solat Teras tetap aktif — solat tidak gugur ketika musafir (jamak & qasar).', 'Core prayers stay on — prayer is not dropped when travelling (combine & shorten).', 'Sholat inti tetap aktif (jamak & qashar).', 'الصلاة الأساسية مستمرة (الجمع والقصر).')}</div>
                    </div>

                    {error && <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-[12px] font-bold text-red-700" data-testid="rest-error">{error}</div>}

                    <button onClick={start} disabled={busy} data-testid="rest-start"
                      className="w-full rounded-2xl py-3.5 bg-gradient-to-r from-sky-500 to-sky-600 text-white font-extrabold text-sm shadow-lg disabled:opacity-50 active:scale-[0.98]">
                      {reasonEmoji(reason)} {whoName
                        ? L(`Mulakan untuk ${whoName} · ${days} hari`, `Start for ${whoName} · ${days} day${days > 1 ? 's' : ''}`, `Mulai untuk ${whoName} · ${days} hari`, `ابدأ لـ ${whoName} · ${days} أيام`)
                        : L(`Mulakan ${days} hari`, `Start ${days} day${days > 1 ? 's' : ''}`, `Mulai ${days} hari`, `ابدأ ${days} أيام`)}
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Small banner shown on parent Home while any rest (family or per child) is active. */
export function RestModeBanner({ lang = 'en', refreshKey, onOpen }) {
  const L = pick(lang)
  const [state, setState] = useState(null)
  useEffect(() => {
    fetch('/api/family/rest-mode', { credentials: 'include' }).then(r => (r.ok ? r.json() : {})).then(d => setState(d)).catch(() => {})
  }, [refreshKey])
  const items = useMemo(() => {
    if (!state) return []
    if (state.restMode) return [{ name: null, rest: state.restMode }]
    return (state.children || []).filter(k => k.restMode).map(k => ({ name: k.nickname, rest: k.restMode }))
  }, [state])
  if (!items.length) return null
  const first = items[0]
  const label = (r) => (r.reason === 'musafir' ? L('Mod Musafir', 'Travel mode', 'Mode safar', 'وضع السفر') : L('Hari Rehat', 'Rest days', 'Hari istirahat', 'أيام الراحة'))
  return (
    <button onClick={onOpen} data-testid="rest-banner"
      className="w-full text-left rounded-3xl bg-gradient-to-r from-sky-50 to-white border border-sky-100 px-4 py-3 flex items-center gap-3 shadow-eq-card flex-shrink-0 active:scale-[0.99]">
      <span className="text-2xl">{reasonEmoji(first.rest.reason)}</span>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-sm text-sky-900 truncate">
          {items.map(it => `${it.name ? `${it.name} · ` : ''}${label(it.rest)} · ${L('hingga', 'until', 'hingga', 'حتى')} ${fmtDate(it.rest.to, lang)}`).join('  •  ')}
        </div>
        <div className="text-[11px] text-sky-900/60">{L('Streak dibekukan · 🕌 Solat Teras tetap aktif', 'Streaks frozen · 🕌 Core prayers stay on', 'Streak dibekukan · 🕌 Sholat tetap', 'السلسلة مجمّدة · 🕌 الصلاة مستمرة')}</div>
      </div>
      <span className="text-sky-500 font-black">›</span>
    </button>
  )
}

/** Kid-facing banner (Kid Mode home). `rest` comes from GET /children/:id/habits → restMode. */
export function KidRestBanner({ rest, lang = 'en' }) {
  const L = pick(lang)
  if (!rest) return null
  const travel = rest.reason === 'musafir'
  return (
    <div className="mt-4 rounded-3xl bg-gradient-to-r from-sky-50 to-amber-50 border border-sky-100 px-4 py-3 flex items-center gap-3" data-testid="kid-rest-banner">
      <span className="text-3xl">{reasonEmoji(rest.reason)}</span>
      <div className="text-[13px] text-sky-900 font-semibold leading-snug">
        {travel
          ? L('Musafir! Habit lain berehat dulu, streak kamu selamat ❄️. Jangan lupa solat — boleh jamak & qasar 🕌', 'Travel time! Other habits are resting and your streak is safe ❄️. Keep your prayers — you may combine & shorten 🕌', 'Waktunya safar! Kebiasaan lain istirahat, streak aman ❄️. Tetap sholat ya 🕌', 'وقت السفر! العادات الأخرى في راحة وسلسلتك آمنة ❄️. حافظ على صلاتك 🕌')
          : L('Hari Rehat! Habit lain berehat dulu, streak kamu selamat ❄️. Solat tetap jalan ya 🕌', 'Rest days! Other habits are resting and your streak is safe ❄️. Prayers keep going 🕌', 'Hari istirahat! Streak kamu aman ❄️. Sholat tetap jalan ya 🕌', 'أيام راحة! سلسلتك آمنة ❄️. الصلاة مستمرة 🕌')}
        <span className="block text-[11px] text-sky-900/60 mt-0.5">{L('Hingga', 'Until', 'Hingga', 'حتى')} {fmtDate(rest.to, lang)}</span>
      </div>
    </div>
  )
}

/** Calm "travel ambience" overlay for the World while resting — pointer-events none. */
export function RestWorldAmbience({ rest, lang = 'en' }) {
  const L = pick(lang)
  if (!rest) return null
  const travel = rest.reason === 'musafir'
  const floaters = travel ? ['🏮', '✨', '🏮', '✨', '🏮'] : ['✨', '🌙', '✨', '⭐', '✨']
  return (
    <div className="pointer-events-none absolute inset-0 z-[7] overflow-hidden" aria-hidden="true" data-testid="world-rest-ambience">
      {/* Soft golden-hour wash */}
      <div className="absolute inset-0" style={{ background: travel
        ? 'linear-gradient(180deg, rgba(255,214,153,0.22) 0%, rgba(255,236,200,0.08) 40%, transparent 70%)'
        : 'linear-gradient(180deg, rgba(186,214,255,0.22) 0%, rgba(220,232,255,0.08) 40%, transparent 70%)' }} />
      {/* Plane gliding across the sky (travel) */}
      {travel && (
        <motion.div className="absolute top-[14%] text-3xl" initial={{ x: '-10vw' }} animate={{ x: '110vw' }}
          transition={{ duration: 26, repeat: Infinity, ease: 'linear', repeatDelay: 6 }}>✈️</motion.div>
      )}
      {floaters.map((e, i) => (
        <motion.div key={i} className="absolute text-xl" style={{ left: `${12 + i * 18}%`, bottom: '-6%' }}
          animate={{ y: ['0vh', '-90vh'], opacity: [0, 0.9, 0] }}
          transition={{ duration: 16 + i * 2, repeat: Infinity, delay: i * 3, ease: 'easeOut' }}>{e}</motion.div>
      ))}
      <div className="absolute top-14 left-1/2 -translate-x-1/2">
        <div className="rounded-full bg-white/85 backdrop-blur px-4 py-1.5 shadow text-[12px] font-extrabold text-sky-900 whitespace-nowrap" data-testid="world-rest-chip">
          {travel ? '✈️ ' : '🛌 '}{travel
            ? L('Kampung berehat semasa kamu musafir', 'Your village rests while you travel', 'Desamu istirahat saat kamu safar', 'قريتك تستريح أثناء سفرك')
            : L('Kampung berehat bersama kamu', 'Your village is resting with you', 'Desamu istirahat bersamamu', 'قريتك تستريح معك')}
        </div>
      </div>
    </div>
  )
}
