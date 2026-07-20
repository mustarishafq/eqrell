'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, Settings, Volume2, VolumeX } from 'lucide-react'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { useLang } from '@/lib/i18n/LangProvider'
import { HADITH_BANK, DOA_BANK } from '@/lib/islamicContent'
import { getAzan, PRE_AZAN_CHIME_URL } from '@/lib/azanBank'
import { BRAND } from '@/lib/brand'
import BigMascot from '@/components/eqrel/BigMascot'
import { formatHijri, getHijri } from '@/lib/hijri'
import { getEventForDate, getMonthlyContext } from '@/lib/islamicCalendar'

const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const PRAYER_LABELS = {
  ms: { Fajr: 'Subuh', Sunrise: 'Syuruk', Dhuhr: 'Zohor', Asr: 'Asar', Maghrib: 'Maghrib', Isha: 'Isyak' },
  en: { Fajr: 'Fajr',  Sunrise: 'Sunrise', Dhuhr: 'Dhuhr', Asr: 'Asr',  Maghrib: 'Maghrib', Isha: 'Isha' },
  id: { Fajr: 'Subuh', Sunrise: 'Terbit',  Dhuhr: 'Zuhur', Asr: 'Ashar', Maghrib: 'Maghrib', Isha: 'Isya' },
  ar: { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' },
}
const AZAN_TRIGGER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export default function DisplayPage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [now, setNow] = useState(new Date())
  const [config, setConfig] = useState(null)
  const [location, setLocation] = useState(null)
  const [prayers, setPrayers] = useState(null)
  const [display, setDisplay] = useState(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [bubbleIdx, setBubbleIdx] = useState(0)
  // Audio (azan)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [azanPlaying, setAzanPlaying] = useState(null)
  const [preAzanNotice, setPreAzanNotice] = useState(null)
  const [celebrateBoost, setCelebrateBoost] = useState(false) // triggered when new ihsan star detected
  const [prevStarId, setPrevStarId] = useState(null)
  const audioRef = useRef(null)
  const playedTodayRef = useRef(new Set())
  const preChimedTodayRef = useRef(new Set())

  useEffect(() => { const tt = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(tt) }, [])

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
  useEffect(() => { load(); const tt = setInterval(load, 60_000); return () => clearInterval(tt) }, [load])

  // Photo slideshow rotation
  const photos = config?.photos || []
  const slideshowSec = config?.slideshowSec || 10
  useEffect(() => {
    if (photos.length < 2) return
    const tt = setInterval(() => setPhotoIdx(i => (i + 1) % photos.length), slideshowSec * 1000)
    return () => clearInterval(tt)
  }, [photos.length, slideshowSec])

  // Mascot bubble rotation (every 15s)
  useEffect(() => {
    const tt = setInterval(() => setBubbleIdx(i => i + 1), 15_000)
    return () => clearInterval(tt)
  }, [])

  // Next prayer & countdown
  const nextPrayer = useMemo(() => {
    if (!prayers?.timings) return null
    for (const k of PRAYER_KEYS) {
      const time = prayers.timings[k]; if (!time) continue
      const [h, m] = time.split(':').map(Number)
      const target = new Date(now); target.setHours(h, m, 0, 0)
      if (target > now) return { key: k, at: target, timeStr: time }
    }
    return null
  }, [prayers, now])
  const countdown = useMemo(() => {
    if (!nextPrayer) return ''
    const ms = nextPrayer.at - now
    if (ms <= 0) return ''
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}j ${m}m` : `${m}m`
  }, [nextPrayer, now])

  // Detect when a prayer time was passed (mark done)
  const passedPrayers = useMemo(() => {
    if (!prayers?.timings) return new Set()
    const done = new Set()
    for (const k of PRAYER_KEYS) {
      const time = prayers.timings[k]; if (!time) continue
      const [h, m] = time.split(':').map(Number)
      const target = new Date(now); target.setHours(h, m, 0, 0)
      if (target <= now) done.add(k)
    }
    return done
  }, [prayers, now])

  const timeStr = now.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : lang, { hour: '2-digit', minute: '2-digit', hour12: false })
  const dayStr  = now.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'long' })
  const dateStr = now.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'long', year: 'numeric' })
  const hijriStr = formatHijri(now, lang)
  const hijri = getHijri(now)
  const todayEvent = hijri ? getEventForDate(hijri.month, hijri.day) : null
  const monthContext = hijri ? getMonthlyContext(hijri.month) : null
  const labelFor = (k) => (PRAYER_LABELS[lang] || PRAYER_LABELS.ms)[k]

  // Trigger celebration when a NEW ihsan star appears
  useEffect(() => {
    const sid = display?.ihsanStar?.id
    if (sid && sid !== prevStarId && prevStarId !== null) {
      setCelebrateBoost(true)
      setTimeout(() => setCelebrateBoost(false), 12_000)
    }
    setPrevStarId(sid || null)
  }, [display?.ihsanStar?.id])

  // ═══ Azan auto-play logic ═══
  const playAzan = useCallback((prayerKey) => {
    if (!config?.azanEnabled || !audioUnlocked) return
    const isFajr = prayerKey === 'Fajr'
    const azan = getAzan(isFajr ? config.azanFajrId : config.azanId, isFajr)
    if (!azan) return
    if (!audioRef.current) audioRef.current = new Audio()
    audioRef.current.src = azan.url
    audioRef.current.volume = (config.azanVolume ?? 80) / 100
    audioRef.current.play().then(() => {
      setAzanPlaying({ key: prayerKey, label: labelFor(prayerKey) })
    }).catch(() => {})
    audioRef.current.onended = () => setAzanPlaying(null)
    audioRef.current.onerror = () => setAzanPlaying(null)
  }, [config, audioUnlocked, lang])

  const playChime = useCallback(() => {
    if (!audioUnlocked) return
    try {
      const chime = new Audio(PRE_AZAN_CHIME_URL)
      chime.volume = ((config?.azanVolume ?? 80) / 100) * 0.6
      chime.play().catch(() => {})
    } catch (e) { /* ignore */ }
  }, [audioUnlocked, config])

  useEffect(() => {
    if (!prayers?.timings || !config?.azanEnabled) return
    const dateKey = now.toISOString().slice(0, 10)
    const nowMs = now.getTime()
    for (const k of AZAN_TRIGGER_KEYS) {
      const time = prayers.timings[k]; if (!time) continue
      const [h, m] = time.split(':').map(Number)
      const target = new Date(now); target.setHours(h, m, 0, 0)
      const diff = nowMs - target.getTime()
      const marker = `${dateKey}_${k}`
      if (diff >= 0 && diff < 2000 && !playedTodayRef.current.has(marker)) {
        playedTodayRef.current.add(marker)
        playAzan(k)
      }
      if (config.preAzanEnabled && config.preAzanMin > 0) {
        const preTarget = target.getTime() - config.preAzanMin * 60 * 1000
        const preDiff = nowMs - preTarget
        const preMarker = `${dateKey}_${k}_pre`
        if (preDiff >= 0 && preDiff < 2000 && !preChimedTodayRef.current.has(preMarker)) {
          preChimedTodayRef.current.add(preMarker)
          playChime()
          setPreAzanNotice({ key: k, minutes: config.preAzanMin })
          setTimeout(() => setPreAzanNotice(null), 15000)
        }
      }
    }
  }, [now, prayers, config, playAzan, playChime])

  const unlockAudio = () => {
    try {
      const a = new Audio()
      a.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAA'
      a.volume = 0; a.play().catch(() => {})
    } catch (e) { /* ignore */ }
    setAudioUnlocked(true)
  }
  const stopAzan = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    setAzanPlaying(null)
  }

  const hasPhotos = photos.length > 0
  const hourNow = now.getHours()
  const isNightHour = hourNow >= 23 || hourNow < 5

  // ═══ Determine mascot mood + bubble content ═══
  const { mascotMood, bubble } = useMemo(() => {
    // Priority 1: Azan playing → prayer mood
    if (azanPlaying) {
      return {
        mascotMood: 'praying',
        bubble: {
          keyId: `azan-${azanPlaying.key}`,
          variant: 'prayer',
          intro: BRAND.mascotVoice.hadith[lang]?.replace(/…/g, '') || 'Waktu solat',
          message: `${azanPlaying.label} — ${lang === 'ar' ? 'حان وقت الصلاة' : lang === 'en' ? 'Time for prayer' : lang === 'id' ? 'Saatnya sholat' : 'Sudah masuk waktu solat'}`,
        }
      }
    }
    // Priority 2: Pre-azan notice
    if (preAzanNotice) {
      return {
        mascotMood: 'listening',
        bubble: {
          keyId: `pre-${preAzanNotice.key}`,
          variant: 'prayer',
          intro: t.display_pre_azan_soon(preAzanNotice.minutes, labelFor(preAzanNotice.key)),
          message: lang === 'ar' ? 'استعدوا للصلاة' : lang === 'en' ? 'Get ready for prayer' : lang === 'id' ? 'Bersiap untuk sholat' : 'Bersedia untuk solat',
        }
      }
    }
    // Priority 3: Celebration (new ihsan star)
    if (celebrateBoost && display?.ihsanStar) {
      const s = display.ihsanStar
      const msg = lang === 'ar' ? `أحسنت يا ${s.nickname}!` : lang === 'en' ? `MashaAllah ${s.nickname}!` : lang === 'id' ? `MasyaAllah ${s.nickname}!` : `MashaAllah ${s.nickname}!`
      return {
        mascotMood: 'celebrate',
        bubble: {
          keyId: `celeb-${s.id}`,
          variant: 'celebrate',
          intro: t.display_ihsan_star_title,
          message: `${msg} ${t.display_ihsan_star_sub(s.ihsanCount)}`,
        }
      }
    }
    // Priority 4: Night mood → sleeping
    if (isNightHour) {
      const rotate = bubbleIdx % 2
      if (rotate === 0 && config?.showDoa) {
        const doa = DOA_BANK[bubbleIdx % DOA_BANK.length]
        return {
          mascotMood: 'sleeping',
          bubble: {
            keyId: `doa-${bubbleIdx}`,
            variant: 'doa',
            intro: BRAND.mascotVoice.doa[lang] || BRAND.mascotVoice.doa.ms,
            message: doa[lang] || doa.ms,
          }
        }
      }
      return {
        mascotMood: 'sleeping',
        bubble: {
          keyId: `night-${bubbleIdx}`,
          variant: 'doa',
          intro: BRAND.mascotVoice.greet[lang] || BRAND.mascotVoice.greet.ms,
          message: lang === 'ar' ? 'تصبحون على خير 🌙' : lang === 'en' ? 'Good night 🌙' : lang === 'id' ? 'Selamat malam 🌙' : 'Selamat malam 🌙',
        }
      }
    }
    // Priority 5: Default rotation — Hadith → Doa → Greet
    const enableHadith = config?.showHadith !== false
    const enableDoa = config?.showDoa !== false
    const options = []
    if (enableHadith) options.push('hadith')
    if (enableDoa) options.push('doa')
    options.push('greet')
    const pick = options[bubbleIdx % options.length]
    if (pick === 'hadith') {
      const h = HADITH_BANK[bubbleIdx % HADITH_BANK.length]
      return {
        mascotMood: 'idle',
        bubble: {
          keyId: `h-${bubbleIdx}`,
          variant: 'hadith',
          intro: BRAND.mascotVoice.hadith[lang] || BRAND.mascotVoice.hadith.ms,
          message: h[lang] || h.ms,
        }
      }
    }
    if (pick === 'doa') {
      const d = DOA_BANK[bubbleIdx % DOA_BANK.length]
      return {
        mascotMood: 'praying',
        bubble: {
          keyId: `d-${bubbleIdx}`,
          variant: 'doa',
          intro: BRAND.mascotVoice.doa[lang] || BRAND.mascotVoice.doa.ms,
          message: d[lang] || d.ms,
        }
      }
    }
    // Greeting fallback
    const greetings = {
      ms: 'Semoga hari yang penuh berkat!',
      en: 'May your day be blessed!',
      id: 'Semoga harimu berkah!',
      ar: 'أسأل الله أن يبارك يومكم!',
    }
    return {
      mascotMood: 'greeting',
      bubble: {
        keyId: `g-${bubbleIdx}`,
        variant: 'greet',
        intro: BRAND.mascotVoice.greet[lang] || BRAND.mascotVoice.greet.ms,
        message: greetings[lang] || greetings.ms,
      }
    }
  }, [azanPlaying, preAzanNotice, celebrateBoost, display?.ihsanStar, config, bubbleIdx, isNightHour, lang, t])

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-slate-950 text-white flex flex-col">
      {/* ═══ AMBIENT BACKGROUND (dim, blurred) ═══ */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-emerald-950" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 pointer-events-none" />

      {/* ═══ TOP HEADER: EQrel + prayer strip ═══ */}
      <header className="relative z-20 flex items-stretch gap-2 px-3 pt-3">
        {/* EQrel wordmark */}
        <div className="flex items-center gap-2 rounded-2xl bg-white/8 backdrop-blur border border-white/15 pl-2 pr-3 h-14">
          <img src={BRAND.mascot.default} alt="EQ" className="w-10 h-10 object-contain drop-shadow" />
          <div className="flex flex-col leading-tight">
            <span className="text-base font-black tracking-tight">{BRAND.name}</span>
            <span className="text-[9px] uppercase tracking-widest text-white/60 font-bold">{BRAND.tagline[lang] || BRAND.tagline.ms}</span>
          </div>
        </div>

        {/* Prayer strip (integrated with next prayer, no emojis, no countdown chip) */}
        {prayers?.timings ? (
          <div className="flex-1 rounded-2xl bg-white/8 backdrop-blur border border-white/15 px-2 h-14 flex items-center gap-1">
            {PRAYER_KEYS.map(k => {
              const isNext = nextPrayer?.key === k
              const isPassed = passedPrayers.has(k) && !isNext
              return (
                <div key={k}
                  className={`flex-1 flex flex-col items-center justify-center rounded-xl h-11 transition-all ${isNext ? 'bg-gradient-to-br from-amber-400/40 to-orange-500/40 ring-2 ring-amber-300/70 scale-105' : ''}`}>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isNext ? 'text-amber-100' : isPassed ? 'text-white/40' : 'text-white/85'}`}>{labelFor(k)}</span>
                    {isPassed && <span className="text-emerald-300 text-[10px]">✓</span>}
                  </div>
                  <div className={`text-xs font-extrabold tabular-nums ${isNext ? 'text-white' : isPassed ? 'text-white/40 line-through' : 'text-white/80'}`}>{prayers.timings[k]}</div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex-1 rounded-2xl bg-white/8 backdrop-blur border border-white/15 flex items-center justify-center gap-2 px-4 h-14">
            <MapPin className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-bold text-white/80">{t.display_setup_cta || 'Set location'}</span>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => router.push('/?parent=1')} className="w-11 h-11 rounded-2xl bg-white/8 backdrop-blur border border-white/15 hover:bg-white/15 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={() => router.push('/display/setup')} className="w-11 h-11 rounded-2xl bg-white/8 backdrop-blur border border-white/15 hover:bg-white/15 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </button>
          {config?.azanEnabled && !audioUnlocked && (
            <button onClick={unlockAudio}
              className="px-2.5 h-11 rounded-2xl bg-emerald-500 text-white flex items-center gap-1 text-[11px] font-extrabold animate-pulse">
              <Volume2 className="w-3.5 h-3.5" /> {(t.display_enable_audio || '').replace('🔊', '').trim()}
            </button>
          )}
        </div>
      </header>

      {/* ═══ AZAN PLAYING BANNER (overlay) ═══ */}
      {azanPlaying && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40">
          <div className="rounded-2xl bg-emerald-500/95 backdrop-blur border-2 border-emerald-300 shadow-2xl px-4 py-3 flex items-center gap-3">
            <div className="text-3xl animate-pulse">🕌</div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-100 font-bold">{t.display_azan_playing}</div>
              <div className="text-lg font-black text-white leading-tight">{azanPlaying.label}</div>
            </div>
            <button onClick={stopAzan} className="ml-2 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
              <VolumeX className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ MAIN 3-COLUMN GRID ═══ */}
      <main className="relative z-10 px-3 pt-3 pb-3 grid grid-cols-12 gap-3" style={{ minHeight: 'calc(100vh - 74px - 220px)' }}>

        {/* LEFT COLUMN — Time + Date + Hijri + Next Prayer + Sirah (compact vertical) */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 flex flex-col gap-3">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur border border-white/10 shadow-2xl p-5 text-center">
            <div className="text-5xl md:text-6xl lg:text-7xl font-black tabular-nums drop-shadow tracking-tighter leading-none">{timeStr}</div>
            <div className="mt-3 text-sm md:text-base text-white/85 capitalize font-bold">{dayStr}</div>
            <div className="mt-0.5 text-xs md:text-sm text-white/70">{dateStr}</div>
            {hijriStr && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs md:text-sm text-amber-200/90 font-semibold" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                🌙 {hijriStr}
              </div>
            )}
            {nextPrayer && countdown && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[9px] uppercase tracking-widest text-white/50 font-black leading-none">
                  {lang === 'ar' ? 'الصلاة القادمة' : lang === 'en' ? 'Next Prayer' : lang === 'id' ? 'Sholat Berikutnya' : 'Solat Seterusnya'}
                </div>
                <div className="mt-1.5 flex items-baseline justify-center gap-1.5">
                  <div className="text-base md:text-lg font-black text-amber-100 leading-none">{labelFor(nextPrayer.key)}</div>
                  <div className="text-[10px] text-white/50 tabular-nums leading-none">{nextPrayer.timeStr}</div>
                </div>
                <div className="mt-1 text-xl md:text-2xl font-black text-amber-300 tabular-nums leading-none">{countdown}</div>
              </div>
            )}
          </div>

          {/* Islamic event / Sirah card */}
          {(todayEvent || monthContext) && (
            <div className="rounded-3xl bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-yellow-500/10 backdrop-blur border-2 border-amber-300/30 shadow-2xl p-4">
              <div className="text-[10px] uppercase tracking-widest text-amber-200 font-black mb-1.5 flex items-center gap-1">
                <span className="text-base">✨</span>
                {todayEvent
                  ? (lang === 'ar' ? 'اليوم في التاريخ' : lang === 'en' ? 'Today in History' : lang === 'id' ? 'Hari ini dalam Sejarah' : 'Hari Ini dalam Sirah')
                  : (lang === 'ar' ? 'هذا الشهر' : lang === 'en' ? 'This Month' : lang === 'id' ? 'Bulan ini' : 'Bulan Ini')}
              </div>
              {todayEvent ? (
                <>
                  <div className="text-sm md:text-base font-black text-amber-100 leading-tight" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    {todayEvent.title[lang] || todayEvent.title.ms}
                  </div>
                  <div className="mt-1.5 text-[11px] text-amber-100/75 leading-snug" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    {todayEvent.desc[lang] || todayEvent.desc.ms}
                  </div>
                </>
              ) : monthContext && (
                <div className="text-[11px] text-amber-100/85 leading-snug italic" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  {monthContext[lang] || monthContext.ms}
                </div>
              )}
            </div>
          )}

          {/* Kids progress rings */}
          {display?.children && display.children.length > 0 && (
            <div className="rounded-3xl bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur border border-white/10 shadow-2xl p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/60 font-black text-center mb-3">
                {lang === 'ar' ? 'الأبناء' : lang === 'en' ? 'Kids' : 'Anak-anak'}
              </div>
              <div className="flex justify-center flex-wrap gap-3">
                {display.children.map(c => {
                  const avatar = c.avatarId ? AVATAR_BY_ID[c.avatarId] : null
                  const total = c.habitsTotal || 0
                  const done = c.habitsDone || 0
                  const pct = total > 0 ? done / total : 0
                  return (
                    <div key={c.id} className="flex flex-col items-center gap-1">
                      <div className="relative w-14 h-14">
                        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                          <circle cx="32" cy="32" r="28" fill="none" stroke={c.favColor || '#00B894'} strokeWidth="5"
                            strokeDasharray={`${pct * 175.9} 175.9`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-1.5 rounded-full overflow-hidden bg-white/10">
                          {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
                            <div className="w-full h-full flex items-center justify-center text-lg">🧒</div>}
                        </div>
                      </div>
                      <div className="text-[11px] font-black leading-none">{c.nickname}</div>
                      <div className="text-[10px] text-white/70 tabular-nums leading-none">{done}/{total}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        {/* CENTER — Family Photo Slideshow (MAIN FOCAL) */}
        <section className="col-span-12 md:col-span-6 lg:col-span-7 flex flex-col gap-3">
          <div className="relative flex-1 rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900 min-h-[300px] md:min-h-[440px]">
            {hasPhotos ? (
              <AnimatePresence mode="wait">
                <motion.img
                  key={photoIdx}
                  src={photos[photoIdx]}
                  alt=""
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 1.4 }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </AnimatePresence>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-purple-900/60 to-emerald-900/40">
                <div className="text-6xl opacity-60">📸</div>
                <div className="text-sm text-white/70 max-w-xs text-center px-4">
                  {lang === 'ar' ? 'أضف صور العائلة في الإعدادات' : lang === 'en' ? 'Add family photos in Setup' : lang === 'id' ? 'Tambah foto keluarga di pengaturan' : 'Tambah gambar keluarga dalam tetapan'}
                </div>
                <button onClick={() => router.push('/display/setup')}
                  className="mt-1 px-4 py-2 rounded-xl bg-emerald-500 text-white font-extrabold text-sm hover:bg-emerald-400">
                  {t.setup_title || 'Setup'}
                </button>
              </div>
            )}

            {/* Photo overlay: family motto at bottom */}
            {config?.familyMotto && (
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 pt-16">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-amber-300/80 font-black">✨ {lang === 'ar' ? 'شعار العائلة' : lang === 'en' ? 'Family Motto' : lang === 'id' ? 'Motto Keluarga' : 'Motto Keluarga'}</div>
                  <div className="mt-1 text-lg md:text-xl italic text-amber-100 font-bold drop-shadow-lg">
                    “{config.familyMotto}”
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN — Ihsan Star + Zikir + Undone habits */}
        <aside className="col-span-12 md:col-span-3 flex flex-col gap-3">
          {/* Ihsan Star */}
          {display?.ihsanStar && (() => {
            const star = display.ihsanStar
            const avatar = star.avatarId ? AVATAR_BY_ID[star.avatarId] : null
            return (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="rounded-3xl bg-gradient-to-br from-amber-500/25 via-orange-500/25 to-yellow-500/25 backdrop-blur border-2 border-amber-300/50 shadow-2xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-amber-200 font-black mb-2 flex items-center gap-1">
                  <span className="text-lg">🌟</span> {t.display_ihsan_star_title}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white/15 border-4" style={{ borderColor: star.favColor || '#FFB703' }}>
                    {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center text-2xl">🧒</div>}
                    <motion.div
                      className="absolute -bottom-1 -right-1 text-2xl"
                      animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}>🌟</motion.div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-white leading-tight">{star.nickname}</div>
                    <div className="text-xs text-amber-100/85">{t.display_ihsan_star_sub(star.ihsanCount)}</div>
                  </div>
                </div>
              </motion.div>
            )
          })()}

          {/* Zikir (read-only ambient) */}
          {display?.zikir && (
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500/25 via-teal-500/25 to-cyan-500/25 backdrop-blur border-2 border-emerald-300/50 shadow-2xl p-4">
              <div className="text-[10px] uppercase tracking-widest text-emerald-200 font-black mb-2 flex items-center gap-1">
                <span className="text-lg">📿</span> {t.display_zikir_title}
              </div>
              <div className="flex items-baseline gap-2">
                <motion.div
                  key={display.zikir.today}
                  initial={{ scale: 1.3, color: '#FFD54A' }}
                  animate={{ scale: 1, color: '#ffffff' }}
                  transition={{ duration: 0.5 }}
                  className="text-4xl md:text-5xl font-black tabular-nums leading-none">
                  {(display.zikir.today || 0).toLocaleString(lang === 'ar' ? 'ar-EG' : lang)}
                </motion.div>
                <div className="text-[10px] uppercase tracking-widest text-emerald-100/80 font-bold">{t.display_zikir_sub_today}</div>
              </div>
              {display.zikir.total > (display.zikir.today || 0) && (
                <div className="mt-1 text-[10px] text-emerald-100/60">
                  {t.display_zikir_sub_total}: <span className="font-bold text-emerald-100/90">{display.zikir.total.toLocaleString(lang === 'ar' ? 'ar-EG' : lang)}</span>
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-emerald-300/20 text-[10px] text-emerald-100/70 italic leading-tight">
                {lang === 'ar' ? 'اضغط للذكر من هاتف كل فرد' : lang === 'en' ? 'Everyone taps zikir from their own phone' : lang === 'id' ? 'Semua tap zikir dari HP masing-masing' : 'Semua orang tap zikir dari phone masing-masing'}
              </div>
            </div>
          )}

          {/* Undone habits */}
          {config?.showHabits && display?.undoneHabits && display.undoneHabits.length > 0 && (
            <div className="rounded-3xl bg-slate-900/70 backdrop-blur border border-white/10 shadow-2xl p-4 flex-1 min-h-0">
              <div className="text-[10px] uppercase tracking-widest text-amber-200 font-black mb-2 flex items-center gap-1">
                <span className="text-lg">📋</span> {t.display_undone_title}
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs">
                {display.undoneHabits.slice(0, 8).map(h => (
                  <div key={h.id} className="flex items-center gap-1.5 text-white/85">
                    <span>{h.icon || '•'}</span>
                    <span className="truncate">{h.i18n?.[lang]?.title || h.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* ═══ BIG MASCOT bottom footer strip — full width dedicated area ═══ */}
      <footer className="relative z-30 mt-auto">
        <div className="bg-gradient-to-t from-black/60 via-black/40 to-transparent pt-4 pb-2">
          <BigMascot
            mood={mascotMood}
            bubble={bubble}
            lang={lang}
            size={180}
          />
        </div>
      </footer>

      {/* Pre-azan notice (small overlay) */}
      {preAzanNotice && !azanPlaying && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40">
          <div className="rounded-2xl bg-amber-500/95 backdrop-blur border-2 border-amber-300 shadow-2xl px-4 py-2.5 flex items-center gap-2">
            <div className="text-2xl">⏰</div>
            <div className="text-sm font-extrabold text-white">
              {t.display_pre_azan_soon(preAzanNotice.minutes, labelFor(preAzanNotice.key))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
