'use client'

/**
 * Family Display Mode — ambient landscape screen for family device.
 *
 * Shows: big clock + date, prayer times (Aladhan API), next-prayer countdown,
 * per-child today progress rings. Auto-refreshes every 60s.
 *
 * Requires: prayerLocation set on family. Provides inline setup if missing.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { useLang } from '@/lib/i18n/LangProvider'
import { useRouter } from 'next/navigation'

const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const PRAYER_EMOJI = { Fajr: '🌄', Sunrise: '☀️', Dhuhr: '🌞', Asr: '🌤️', Maghrib: '🌇', Isha: '🌙' }
const PRAYER_LABEL_MS = { Fajr: 'Subuh', Sunrise: 'Syuruk', Dhuhr: 'Zohor', Asr: 'Asar', Maghrib: 'Maghrib', Isha: 'Isyak' }
const PRAYER_LABEL_EN = { Fajr: 'Fajr',  Sunrise: 'Sunrise', Dhuhr: 'Dhuhr', Asr: 'Asr',  Maghrib: 'Maghrib', Isha: 'Isha' }
const PRAYER_LABEL_ID = { Fajr: 'Subuh', Sunrise: 'Terbit',  Dhuhr: 'Zuhur', Asr: 'Ashar', Maghrib: 'Maghrib', Isha: 'Isya' }
const PRAYER_LABEL_AR = { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' }

function labelFor(key, lang) {
  return ({ ms: PRAYER_LABEL_MS, en: PRAYER_LABEL_EN, id: PRAYER_LABEL_ID, ar: PRAYER_LABEL_AR }[lang] || PRAYER_LABEL_MS)[key]
}

export default function DisplayPage() {
  const router = useRouter()
  const { t, lang } = useLang()

  const [now, setNow] = useState(new Date())
  const [location, setLocation] = useState(null)
  const [prayers, setPrayers] = useState(null)   // { timings, date }
  const [display, setDisplay] = useState(null)   // { family, children[] }
  const [loading, setLoading] = useState(true)
  const [locOpen, setLocOpen] = useState(false)

  // Refresh clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Refresh data every 60s
  const load = useCallback(async () => {
    try {
      const [dRes, lRes] = await Promise.all([
        fetch('/api/family/display-data', { credentials: 'include' }),
        fetch('/api/family/prayer-location', { credentials: 'include' }),
      ])
      const dData = await dRes.json()
      const lData = await lRes.json()
      setDisplay(dData)
      setLocation(lData.location)

      if (lData.location) {
        const pRes = await fetch('/api/family/prayer-times', { credentials: 'include' })
        if (pRes.ok) setPrayers(await pRes.json())
        else setPrayers(null)
      }
    } catch (e) { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  // Compute next prayer + countdown
  const nextPrayer = (() => {
    if (!prayers?.timings) return null
    for (const k of PRAYER_KEYS) {
      const time = prayers.timings[k]
      if (!time) continue
      const [h, m] = time.split(':').map(Number)
      const target = new Date(now)
      target.setHours(h, m, 0, 0)
      if (target > now) return { key: k, at: target, timeStr: time }
    }
    // All prayers passed → next is tomorrow's Fajr
    return null
  })()

  const timeStr = now.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : lang, { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const countdownStr = (() => {
    if (!nextPrayer) return ''
    const diffMs = nextPrayer.at - now
    if (diffMs <= 0) return ''
    const h = Math.floor(diffMs / 3600000)
    const m = Math.floor((diffMs % 3600000) / 60000)
    return h > 0 ? `${h}j ${m}m` : `${m}m`
  })()

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white overflow-hidden relative">
      {/* Stars background */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px), radial-gradient(circle at 40% 80%, white 1px, transparent 1px)`,
        backgroundSize: '80px 80px, 120px 120px, 100px 100px',
      }} />

      {/* Back button + edit location */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={() => router.push('/?parent=1')}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur border border-white/20 hover:bg-white/20 flex items-center justify-center"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setLocOpen(true)}
          className="px-3 h-10 rounded-full bg-white/10 backdrop-blur border border-white/20 hover:bg-white/20 flex items-center gap-2 text-sm"
          aria-label="Edit location"
        >
          <MapPin className="w-4 h-4" />
          <span className="truncate max-w-[120px]">{location?.city || t.display_setup_cta}</span>
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/70" />
        </div>
      )}

      <div className="relative z-10 min-h-screen flex flex-col p-8">
        {/* Center clock + date */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-8xl md:text-9xl font-black tracking-tighter tabular-nums drop-shadow-lg">
            {timeStr}
          </div>
          <div className="mt-2 text-lg md:text-xl text-white/70 capitalize">
            {dateStr}
          </div>

          {nextPrayer && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur border border-white/20 px-5 py-3">
              <span className="text-3xl">{PRAYER_EMOJI[nextPrayer.key]}</span>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-widest text-white/60">{t.display_next_prayer}</div>
                <div className="text-lg font-extrabold">
                  {labelFor(nextPrayer.key, lang)} <span className="text-amber-300">{nextPrayer.timeStr}</span>
                </div>
                {countdownStr && <div className="text-xs text-white/60">{t.display_in_prefix} {countdownStr}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Prayer times row */}
        {prayers?.timings && (
          <div className="grid grid-cols-6 gap-2 mb-6">
            {PRAYER_KEYS.map(k => {
              const isNext = nextPrayer?.key === k
              return (
                <div
                  key={k}
                  className={`rounded-2xl px-2 py-3 text-center border transition-all ${
                    isNext ? 'bg-amber-400/20 border-amber-300 shadow-lg scale-105' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="text-2xl mb-1">{PRAYER_EMOJI[k]}</div>
                  <div className={`text-[10px] uppercase tracking-wider ${isNext ? 'text-amber-200' : 'text-white/60'}`}>
                    {labelFor(k, lang)}
                  </div>
                  <div className={`text-base font-extrabold tabular-nums ${isNext ? 'text-white' : 'text-white/90'}`}>
                    {prayers.timings[k]}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Children row */}
        {display?.children && display.children.length > 0 && (
          <div className="flex justify-center gap-4 flex-wrap">
            {display.children.map(c => {
              const avatar = c.avatarId ? AVATAR_BY_ID[c.avatarId] : null
              const total = c.habitsTotal || 0
              const done = c.habitsDone || 0
              const pct = total > 0 ? (done / total) : 0
              const color = c.favColor || '#00B894'
              return (
                <div key={c.id} className="flex flex-col items-center gap-1.5">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                      <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                      <circle cx="40" cy="40" r="35" fill="none" stroke={color} strokeWidth="5"
                        strokeDasharray={`${pct * 219.9} 219.9`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-2 rounded-full overflow-hidden bg-white/10">
                      {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center text-2xl">🧒</div>}
                    </div>
                  </div>
                  <div className="text-sm font-extrabold">{c.nickname}</div>
                  <div className="text-xs text-white/70 tabular-nums">{done}/{total}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* No location prompt */}
        {!location && !loading && (
          <div className="text-center mt-6">
            <p className="text-white/70 text-sm mb-3">{t.display_no_location}</p>
            <button
              onClick={() => setLocOpen(true)}
              className="rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold px-6 py-2.5 text-sm"
            >{t.display_setup_cta}</button>
          </div>
        )}
      </div>

      <LocationEditor
        open={locOpen}
        current={location}
        onClose={() => setLocOpen(false)}
        onSaved={async () => { setLocOpen(false); await load() }}
        t={t}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
const LocationEditor = ({ open, current, onClose, onSaved, t }) => {
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [method, setMethod] = useState(3)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setCity(current?.city || '')
      setCountry(current?.country || '')
      setMethod(current?.method || 3)
      setErr('')
    }
  }, [open, current])

  const save = async () => {
    if (!city.trim() || !country.trim()) { setErr(t.display_form_required); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/family/prayer-location', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: city.trim(), country: country.trim(), method }),
      })
      if (r.ok) onSaved()
      else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Failed') }
    } finally { setBusy(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white text-eq-ink rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-5">
              <h3 className="text-lg font-extrabold text-emerald-900 mb-1">{t.display_location_title}</h3>
              <p className="text-xs text-emerald-800/60 mb-4">{t.display_location_sub}</p>

              <label className="block mb-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1">{t.display_city_label}</div>
                <input value={city} onChange={e => setCity(e.target.value)}
                  placeholder="Kuala Lumpur"
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm" />
              </label>
              <label className="block mb-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1">{t.display_country_label}</div>
                <input value={country} onChange={e => setCountry(e.target.value)}
                  placeholder="Malaysia"
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm" />
              </label>
              <label className="block mb-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1">{t.display_method_label}</div>
                <select value={method} onChange={e => setMethod(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm bg-white">
                  <option value={3}>Muslim World League (default)</option>
                  <option value={17}>Kemenag (Indonesia)</option>
                  <option value={2}>ISNA (North America)</option>
                  <option value={5}>Egyptian General Authority</option>
                  <option value={1}>University of Islamic Sciences, Karachi</option>
                  <option value={11}>Majlis Ugama Islam Singapura</option>
                  <option value={12}>Union Organization Islamic de France</option>
                  <option value={13}>Diyanet İşleri Başkanlığı (Turkey)</option>
                </select>
              </label>
              {err && <div className="text-xs text-red-600 mb-2">{err}</div>}
              <div className="flex gap-2 mt-4">
                <button onClick={onClose} className="flex-1 rounded-xl border-2 border-eq-cream py-2 text-sm font-bold">{t.cancel}</button>
                <button onClick={save} disabled={busy}
                  className="flex-1 rounded-xl bg-emerald-500 text-white py-2 text-sm font-extrabold active:scale-[0.99] disabled:opacity-50">
                  {busy ? '…' : t.save}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
