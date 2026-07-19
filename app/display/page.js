'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, Loader2, Settings } from 'lucide-react'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { useLang } from '@/lib/i18n/LangProvider'
import { HADITH_BANK, DOA_BANK } from '@/lib/islamicContent'

const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const PRAYER_EMOJI = { Fajr: '🌄', Sunrise: '☀️', Dhuhr: '🌞', Asr: '🌤️', Maghrib: '🌇', Isha: '🌙' }
const PRAYER_LABELS = {
  ms: { Fajr: 'Subuh', Sunrise: 'Syuruk', Dhuhr: 'Zohor', Asr: 'Asar', Maghrib: 'Maghrib', Isha: 'Isyak' },
  en: { Fajr: 'Fajr',  Sunrise: 'Sunrise', Dhuhr: 'Dhuhr', Asr: 'Asr',  Maghrib: 'Maghrib', Isha: 'Isha' },
  id: { Fajr: 'Subuh', Sunrise: 'Terbit',  Dhuhr: 'Zuhur', Asr: 'Ashar', Maghrib: 'Maghrib', Isha: 'Isya' },
  ar: { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' },
}

export default function DisplayPage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [now, setNow] = useState(new Date())
  const [config, setConfig] = useState(null)
  const [location, setLocation] = useState(null)
  const [prayers, setPrayers] = useState(null)
  const [display, setDisplay] = useState(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [hadithIdx, setHadithIdx] = useState(0)

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const load = useCallback(async () => {
    try {
      const [cRes, dRes, lRes] = await Promise.all([
        fetch('/api/family/display-config', { credentials: 'include' }),
        fetch('/api/family/display-data', { credentials: 'include' }),
        fetch('/api/family/prayer-location', { credentials: 'include' }),
      ])
      const cData = await cRes.json()
      const dData = await dRes.json()
      const lData = await lRes.json()
      setConfig(cData.config)
      setDisplay(dData)
      setLocation(lData.location)
      if (lData.location) {
        const pRes = await fetch('/api/family/prayer-times', { credentials: 'include' })
        if (pRes.ok) setPrayers(await pRes.json())
      }
    } catch (e) { /* ignore */ }
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t) }, [load])

  // Photo slideshow rotation
  const photos = config?.photos || []
  const slideshowSec = config?.slideshowSec || 10
  useEffect(() => {
    if (photos.length < 2) return
    const t = setInterval(() => setPhotoIdx(i => (i + 1) % photos.length), slideshowSec * 1000)
    return () => clearInterval(t)
  }, [photos.length, slideshowSec])

  // Hadith rotation (every 20s)
  useEffect(() => {
    const t = setInterval(() => setHadithIdx(i => i + 1), 20_000)
    return () => clearInterval(t)
  }, [])

  // Next prayer + countdown
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
    return null
  })()
  const countdown = (() => {
    if (!nextPrayer) return ''
    const ms = nextPrayer.at - now
    if (ms <= 0) return ''
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}j ${m}m` : `${m}m`
  })()

  const timeStr = now.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : lang, { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const labelFor = (k) => (PRAYER_LABELS[lang] || PRAYER_LABELS.ms)[k]

  const hadith = HADITH_BANK[hadithIdx % HADITH_BANK.length]
  const doa = DOA_BANK[hadithIdx % DOA_BANK.length]
  const hasPhotos = photos.length > 0

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-slate-950 text-white">
      {/* Photo slideshow background */}
      {hasPhotos ? (
        <AnimatePresence mode="wait">
          <motion.img
            key={photoIdx}
            src={photos[photoIdx]}
            alt=""
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900" />
      )}

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/70 pointer-events-none" />

      {/* Top prayer strip */}
      {prayers?.timings && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-black/40 backdrop-blur border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-2 grid grid-cols-6 gap-1">
            {PRAYER_KEYS.map(k => {
              const isNext = nextPrayer?.key === k
              return (
                <div key={k} className={`text-center py-1 rounded-lg transition-all ${isNext ? 'bg-amber-400/20 scale-105' : ''}`}>
                  <div className="text-lg leading-none">{PRAYER_EMOJI[k]}</div>
                  <div className={`text-[9px] uppercase tracking-wider ${isNext ? 'text-amber-200' : 'text-white/60'}`}>{labelFor(k)}</div>
                  <div className={`text-sm font-extrabold tabular-nums ${isNext ? 'text-white' : 'text-white/85'}`}>{prayers.timings[k]}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top-left back + setup */}
      <div className="absolute top-3 left-3 z-20 flex gap-2">
        <button onClick={() => router.push('/?parent=1')} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/20 hover:bg-white/20 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button onClick={() => router.push('/display/setup')} className="px-3 h-9 rounded-full bg-white/10 backdrop-blur border border-white/20 hover:bg-white/20 flex items-center gap-1.5 text-xs font-bold">
          <Settings className="w-3.5 h-3.5" /> {t.setup_title}
        </button>
        {!location && (
          <button onClick={() => router.push('/display?edit=1')} className="px-3 h-9 rounded-full bg-amber-500 text-slate-900 flex items-center gap-1.5 text-xs font-extrabold">
            <MapPin className="w-3.5 h-3.5" /> {t.display_setup_cta}
          </button>
        )}
      </div>

      {/* Center content — clock + date + next prayer + family motto */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center pt-20 pb-6 px-6 text-center">
        <div className="text-7xl md:text-9xl font-black tracking-tighter tabular-nums drop-shadow-2xl">
          {timeStr}
        </div>
        <div className="mt-1 text-base md:text-xl text-white/85 capitalize drop-shadow">{dateStr}</div>

        {nextPrayer && (
          <div className="mt-4 inline-flex items-center gap-2.5 rounded-2xl bg-white/15 backdrop-blur border border-white/25 px-4 py-2 shadow-lg">
            <span className="text-2xl">{PRAYER_EMOJI[nextPrayer.key]}</span>
            <div className="text-left">
              <div className="text-[9px] uppercase tracking-widest text-white/70">{t.display_next_prayer}</div>
              <div className="font-extrabold text-sm">
                {labelFor(nextPrayer.key)} <span className="text-amber-300">{nextPrayer.timeStr}</span>
              </div>
              {countdown && <div className="text-[10px] text-white/70">{t.display_in_prefix} {countdown}</div>}
            </div>
          </div>
        )}

        {config?.familyMotto && (
          <div className="mt-4 text-sm md:text-base italic text-amber-100 max-w-md drop-shadow">
            ✨ {config.familyMotto}
          </div>
        )}

        {/* Children rings */}
        {display?.children && display.children.length > 0 && (
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            {display.children.map(c => {
              const avatar = c.avatarId ? AVATAR_BY_ID[c.avatarId] : null
              const total = c.habitsTotal || 0
              const done = c.habitsDone || 0
              const pct = total > 0 ? done / total : 0
              return (
                <div key={c.id} className="flex flex-col items-center gap-1">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                      <circle cx="32" cy="32" r="28" fill="none" stroke={c.favColor || '#00B894'} strokeWidth="4"
                        strokeDasharray={`${pct * 175.9} 175.9`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-1.5 rounded-full overflow-hidden bg-white/10">
                      {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center text-xl">🧒</div>}
                    </div>
                  </div>
                  <div className="text-xs font-extrabold drop-shadow">{c.nickname}</div>
                  <div className="text-[10px] text-white/80 tabular-nums">{done}/{total}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Undone habits list */}
        {config?.showHabits && display?.undoneHabits && display.undoneHabits.length > 0 && (
          <div className="mt-5 max-w-md w-full rounded-2xl bg-black/40 backdrop-blur border border-white/15 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-amber-200 mb-2 text-center">
              {t.display_undone_title}
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {display.undoneHabits.slice(0, 6).map(h => (
                <div key={h.id} className="flex items-center gap-1.5 text-white/85">
                  <span>{h.icon || '•'}</span>
                  <span className="truncate">{h.i18n?.[lang]?.title || h.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom hadith / doa footer */}
      {(config?.showHadith || config?.showDoa) && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/50 backdrop-blur border-t border-white/10 px-6 py-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={hadithIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6 }}
              className="text-center text-sm text-white/90 max-w-2xl mx-auto"
            >
              {config.showHadith && hadithIdx % 2 === 0 ? (
                <><span className="text-amber-300">📖</span> {(hadith[lang] || hadith.ms)}</>
              ) : config.showDoa ? (
                <><span className="text-amber-300">🤲</span> {(doa[lang] || doa.ms)}</>
              ) : (
                <><span className="text-amber-300">📖</span> {(hadith[lang] || hadith.ms)}</>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
