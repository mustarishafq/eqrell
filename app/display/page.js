'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, Settings, Volume2, VolumeX, Moon, Sun } from 'lucide-react'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { useLang } from '@/lib/i18n/LangProvider'
import { HADITH_BANK, DOA_BANK } from '@/lib/islamicContent'
import { getAzan, PRE_AZAN_CHIME_URL } from '@/lib/azanBank'
import { BRAND } from '@/lib/brand'
import BigMascot from '@/components/eqrel/BigMascot'
import YouTubeBgPlayer from '@/components/eqrel/YouTubeBgPlayer'
import { useWakeLock } from '@/lib/useWakeLock'
import TVPreview from '@/components/eqrel/TVPreview'
import HabitBoard from '@/components/eqrel/HabitBoard'
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
  const searchParams = useSearchParams()
  const isPreview = searchParams?.get('preview') === '1'
  const forceTv = searchParams?.get('tv') === '1'

  // Portrait detection — if phone in portrait & not forced TV mode, show scaled TV preview
  const [isPortrait, setIsPortrait] = useState(false)
  useEffect(() => {
    if (forceTv) return
    const check = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      // Portrait if height > width AND width is phone-sized (<900px)
      setIsPortrait(h > w && w < 900)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [forceTv])

  const [now, setNow] = useState(new Date())
  const [config, setConfig] = useState(null)

  // Prevent TV screensaver — keep screen awake while /display is mounted
  useWakeLock(true)
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

  // ═══ CLOCK TIMER — 15s refresh instead of 1s ═══
  // Clock display shows HH:MM (no seconds), so 15s cadence is imperceptible.
  // Reduces re-renders 15× on weak TV browsers → less CPU spikes → less YouTube stream drop
  useEffect(() => {
    const tt = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(tt)
  }, [])

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
  const rawPhotos = config?.photos || []
  // Cloudinary auto-optimize for weak TV browsers (Android China etc):
  //   f_auto → WebP/AVIF, q_auto → adaptive quality, w_1280 → 720p max width,
  //   c_limit → don't upscale small images. Big perf win vs w_1920 originals.
  const photos = rawPhotos.map(url =>
    typeof url === 'string' && url.includes('/upload/') && !url.includes('/upload/f_')
      ? url.replace('/upload/', '/upload/f_auto,q_auto:eco,w_1280,c_limit/')
      : url
  )
  const slideshowSec = config?.slideshowSec || 10
  useEffect(() => {
    if (photos.length < 2) return
    const tt = setInterval(() => setPhotoIdx(i => (i + 1) % photos.length), slideshowSec * 1000)
    return () => clearInterval(tt)
  }, [photos.length, slideshowSec])

  // Preload NEXT + AFTER-NEXT photos for smoother transitions (TV browsers need extra buffer)
  useEffect(() => {
    if (photos.length < 2) return
    for (let offset = 1; offset <= 2; offset++) {
      const nextIdx = (photoIdx + offset) % photos.length
      const preloadImg = new Image()
      preloadImg.decoding = 'async'
      preloadImg.src = photos[nextIdx]
    }
  }, [photoIdx, photos])

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
    if (!config?.azanEnabled || !audioUnlocked || isPreview) return
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
  }, [config, audioUnlocked, lang, isPreview])

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
      // 20s tolerance window (matches 15s clock cadence). playedTodayRef guarantees single-play per day.
      if (diff >= 0 && diff < 20_000 && !playedTodayRef.current.has(marker)) {
        playedTodayRef.current.add(marker)
        playAzan(k)
      }
      if (config.preAzanEnabled && config.preAzanMin > 0) {
        const preTarget = target.getTime() - config.preAzanMin * 60 * 1000
        const preDiff = nowMs - preTarget
        const preMarker = `${dateKey}_${k}_pre`
        if (preDiff >= 0 && preDiff < 20_000 && !preChimedTodayRef.current.has(preMarker)) {
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

  // ═══ Dim mode logic (auto-dim during scheduled night hours) ═══
  const [manualDim, setManualDim] = useState(false)
  const isInDimWindow = (() => {
    if (!config?.dimEnabled) return false
    const h = now.getHours()
    const s = config.dimStartHour ?? 22
    const e = config.dimEndHour ?? 6
    // Handle overnight window (e.g., 22 → 6)
    if (s === e) return false
    if (s < e) return h >= s && h < e
    return h >= s || h < e
  })()
  const dimActive = isInDimWindow || manualDim
  const dimBrightness = dimActive ? ((config?.dimLevel ?? 30) / 100) : 1

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
    // Priority 5: Default rotation — Hadith → Doa → Sirah → Greet
    const enableHadith = config?.showHadith !== false
    const enableDoa = config?.showDoa !== false
    const hasSirah = !!(todayEvent || monthContext)
    const options = []
    if (enableHadith) options.push('hadith')
    if (enableDoa) options.push('doa')
    if (hasSirah) options.push('sirah')
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
    if (pick === 'sirah') {
      // Today's Islamic event takes priority over monthly context
      if (todayEvent) {
        const intro = lang === 'ar' ? 'اليوم في التاريخ' : lang === 'en' ? 'Today in History' : lang === 'id' ? 'Hari ini dalam Sejarah' : 'Hari Ini dalam Sirah'
        const title = todayEvent.title[lang] || todayEvent.title.ms
        const desc = todayEvent.desc[lang] || todayEvent.desc.ms
        return {
          mascotMood: 'idle',
          bubble: {
            keyId: `sirah-day-${bubbleIdx}`,
            variant: 'hadith',
            intro: `✨ ${intro}`,
            message: `${title} — ${desc}`,
          }
        }
      }
      if (monthContext) {
        const intro = lang === 'ar' ? 'هذا الشهر' : lang === 'en' ? 'This Month' : lang === 'id' ? 'Bulan ini' : 'Bulan Ini'
        const msg = monthContext[lang] || monthContext.ms
        return {
          mascotMood: 'idle',
          bubble: {
            keyId: `sirah-mo-${bubbleIdx}`,
            variant: 'hadith',
            intro: `✨ ${intro}`,
            message: msg,
          }
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
  }, [azanPlaying, preAzanNotice, celebrateBoost, display?.ihsanStar, config, bubbleIdx, isNightHour, lang, t, todayEvent, monthContext])

  // ═══ Portrait phone: render as scaled TV preview instead of broken layout ═══
  if (isPortrait) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => router.push('/?parent=1')} className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <img src={BRAND.mascot.default} alt="EQ" className="w-8 h-8" />
            <div>
              <div className="text-sm font-black leading-none">{BRAND.name}</div>
              <div className="text-[9px] uppercase tracking-widest font-bold leading-none mt-0.5" style={{ color: '#FFB703' }}>{BRAND.tagline[lang] || BRAND.tagline.ms}</div>
            </div>
          </div>
        </div>

        <div className="mb-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 p-3">
          <div className="text-xs font-bold text-emerald-100 mb-1">📺 {lang === 'ar' ? 'شاشة العائلة مصممة للتلفاز' : lang === 'en' ? 'Family Display is designed for TV' : lang === 'id' ? 'Family Display didesain untuk TV' : 'Family Display direka untuk TV'}</div>
          <div className="text-[11px] text-emerald-100/75 leading-snug">
            {lang === 'ar' ? 'هذه معاينة صغيرة لما سيظهر على التلفاز. اذهب للإعدادات لتخصيصها.' :
              lang === 'en' ? 'Below is a preview of what will show on your TV. Open Setup to customise.' :
              lang === 'id' ? 'Di bawah adalah preview yang akan tampil di TV kamu. Buka Setup untuk sesuaikan.' :
              'Di bawah adalah preview apa yang akan keluar di TV. Buka Setup untuk sesuaikan.'}
          </div>
        </div>

        <TVPreview src="/display?preview=1&tv=1" label={lang === 'ar' ? 'معاينة التلفاز' : 'TV Preview'} showOpenBtn={false} />

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => router.push('/display/setup')}
            className="rounded-xl bg-emerald-500 py-3 font-extrabold text-sm text-white active:scale-95 shadow-lg">
            ⚙️ {t.setup_title || 'Setup'}
          </button>
          <button onClick={() => router.push('/display?tv=1')}
            className="rounded-xl py-3 font-extrabold text-sm text-slate-900 active:scale-95 shadow-lg"
            style={{ backgroundColor: '#FFB703' }}>
            📺 {lang === 'ar' ? 'فتح للتلفاز' : lang === 'en' ? 'Open TV Mode' : 'Buka Mod TV'}
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-slate-900/50 border border-white/10 p-3 text-[11px] text-white/70 leading-snug">
          💡 <span className="font-bold text-white/85">{lang === 'ar' ? 'كيف تعرض على التلفاز؟' : lang === 'en' ? 'How to cast to TV?' : 'Cara paparkan ke TV?'}</span>
          <ol className="mt-1 space-y-0.5 list-decimal list-inside">
            <li>{lang === 'en' ? 'Open Chrome on Smart TV / Chromecast' : 'Buka Chrome di Smart TV / Chromecast'}</li>
            <li>{lang === 'en' ? 'Visit the URL above' : 'Lawat URL di atas'}</li>
            <li>{lang === 'en' ? 'Or use Google Cast from this phone' : 'Atau guna Google Cast dari phone ini'}</li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full relative overflow-hidden text-white flex flex-col" style={{ backgroundColor: '#0a1f1c', fontSize: 'clamp(14px, 1.4vmin + 0.4vw, 30px)', filter: `brightness(${dimBrightness})`, transition: 'filter 0.8s ease-in-out' }}>
      {/* ═══ YouTube background audio (hidden, skipped in preview) ═══ */}
      {!isPreview && config?.bgAudioEnabled && (config?.bgAudioUrl || (Array.isArray(config?.bgAudioPlaylist) && config.bgAudioPlaylist.length > 0)) && (
        <YouTubeBgPlayer
          url={config.bgAudioUrl}
          playlist={config.bgAudioPlaylist}
          enabled={config.bgAudioEnabled}
          volume={config.bgAudioVolume ?? 25}
          audioUnlocked={audioUnlocked}
          duckForAzan={!!azanPlaying || !!preAzanNotice}
        />
      )}
      {/* ═══ AMBIENT BACKGROUND — EQrel brand emerald/teal ═══ */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900" />
      <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at top left, rgba(0,184,148,0.3), transparent 60%), radial-gradient(ellipse at bottom right, rgba(255,183,3,0.15), transparent 60%)' }} />

      {/* ═══ TOP HEADER: EQrel branded logo + prayer strip + nav ═══ */}
      <header className="relative z-20 flex items-stretch gap-2 px-3 pt-3 flex-shrink-0">
        {/* EQrel logo — image FILLS entire card edge-to-edge with rounded corners */}
        <div className="flex items-center bg-white h-14 rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
          <img
            src="/eqrel-logo-full.png"
            alt="EQrel — Build Habits. Grow Iman."
            className="h-14 w-auto block"
            style={{ backgroundColor: '#FFFFFF', display: 'block' }}
          />
        </div>

        {/* Prayer strip — no emojis, no countdown chip */}
        {prayers?.timings ? (
          <div className="flex-1 rounded-2xl bg-emerald-900/50 backdrop-blur border border-emerald-400/25 px-2 h-14 flex items-center gap-1 shadow-lg">
            {PRAYER_KEYS.map(k => {
              const isNext = nextPrayer?.key === k
              const isPassed = passedPrayers.has(k) && !isNext
              return (
                <div key={k}
                  className={`flex-1 flex flex-col items-center justify-center rounded-xl h-11 transition-all ${isNext ? 'ring-2 scale-105' : ''}`}
                  style={isNext ? { background: 'linear-gradient(135deg, rgba(255,183,3,0.35), rgba(255,183,3,0.15))', boxShadow: '0 0 0 2px rgba(255,183,3,0.6)' } : {}}>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isNext ? '' : isPassed ? 'text-white/40' : 'text-white/85'}`} style={isNext ? { color: '#FFB703' } : {}}>{labelFor(k)}</span>
                    {isPassed && <span className="text-emerald-300 text-[10px]">✓</span>}
                  </div>
                  <div className={`text-xs font-extrabold tabular-nums ${isNext ? 'text-white' : isPassed ? 'text-white/40 line-through' : 'text-white/80'}`}>{prayers.timings[k]}</div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex-1 rounded-2xl bg-emerald-900/50 backdrop-blur border border-emerald-400/25 flex items-center justify-center gap-2 px-4 h-14 shadow-lg">
            <MapPin className="w-4 h-4" style={{ color: '#FFB703' }} />
            <span className="text-sm font-bold text-white/85">{t.display_setup_cta || 'Set location'}</span>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => router.push('/?parent=1')} className="w-11 h-11 rounded-2xl bg-emerald-900/50 backdrop-blur border border-emerald-400/25 hover:bg-emerald-800/60 flex items-center justify-center shadow-lg">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={() => router.push('/display/setup')} className="w-11 h-11 rounded-2xl bg-emerald-900/50 backdrop-blur border border-emerald-400/25 hover:bg-emerald-800/60 flex items-center justify-center shadow-lg">
            <Settings className="w-4 h-4" />
          </button>
          {/* Manual dim toggle */}
          <button onClick={() => setManualDim(v => !v)}
            className={`w-11 h-11 rounded-2xl backdrop-blur border flex items-center justify-center shadow-lg transition-all ${dimActive ? 'bg-slate-800/90 border-slate-500/50' : 'bg-emerald-900/50 border-emerald-400/25 hover:bg-emerald-800/60'}`}
            title={dimActive ? 'Terangkan' : 'Redupkan'}>
            {dimActive ? <Sun className="w-4 h-4" style={{ color: '#FFB703' }} /> : <Moon className="w-4 h-4" />}
          </button>
          {/* Small header audio button removed — big centered overlay is the primary unlock CTA */}
        </div>
      </header>

      {/* Full-screen audio unlock overlay — BIG centered button on family photo (visible & easy tap) */}
      {(config?.azanEnabled || config?.bgAudioEnabled) && !audioUnlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <button onClick={unlockAudio}
            className="pointer-events-auto rounded-3xl shadow-2xl border-4 border-white/40 px-10 py-8 flex flex-col items-center gap-3 text-slate-900 font-black animate-pulse hover:scale-105 transition-transform"
            style={{ backgroundColor: '#FFB703', minWidth: 320 }}>
            <Volume2 className="w-14 h-14" />
            <div className="text-2xl font-black">
              {lang === 'ar' ? 'اضغط لتفعيل الصوت' : lang === 'en' ? 'Tap to enable audio' : lang === 'id' ? 'Sentuh untuk aktifkan suara' : 'Tekan untuk bunyi audio'}
            </div>
            <div className="text-[11px] font-bold opacity-70 max-w-xs text-center leading-tight">
              {lang === 'ar' ? 'مطلوب مرة واحدة لتشغيل الأذان وتلاوة القرآن (سياسة المتصفح)' :
               lang === 'en' ? 'Required once to play Azan & Quran recitation (browser policy)' :
               lang === 'id' ? 'Diperlukan sekali untuk memutar Azan & bacaan Al-Quran (kebijakan browser)' :
               'Perlu tekan sekali untuk main Azan & bacaan Al-Quran (polisi browser)'}
            </div>
          </button>
        </div>
      )}

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

      {/* Zikir moved back into left column as a proper card below Time+NextPrayer — see aside below */}

      {/* ═══ MAIN 3-COLUMN GRID — flex-1, no scroll ═══ */}
      <main className="relative z-10 px-3 pt-3 pb-2 grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">

        {/* LEFT COLUMN — FLEX: Time card shrinks if space tight, Zikir NEVER shrinks (flex-shrink-0 protected) */}
        <aside
          className="col-span-12 md:col-span-3 lg:col-span-3 xl:col-span-2 flex flex-col gap-2.5 min-h-0 overflow-hidden pb-2">
          <div className="rounded-3xl bg-emerald-950/60 backdrop-blur border border-emerald-400/20 shadow-2xl p-3 text-center min-h-0 overflow-hidden" style={{ flexShrink: 1 }}>
            <div className="font-black tabular-nums drop-shadow tracking-tighter leading-none" style={{ fontSize: 'clamp(2rem, 4.5vw, 5rem)', color: '#FFF8E7' }}>{timeStr}</div>
            <div className="mt-2 text-sm md:text-base capitalize font-bold" style={{ color: '#FFF8E7', opacity: 0.9 }}>{dayStr}</div>
            <div className="mt-0.5 text-xs md:text-sm text-white/70">{dateStr}</div>
            {hijriStr && (
              <div className="mt-2 pt-2 border-t border-emerald-400/20 text-xs md:text-sm font-semibold" style={{ color: '#FFB703' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                🌙 {hijriStr}
              </div>
            )}
            {nextPrayer && countdown && (
              <div className="mt-2 pt-2 border-t border-emerald-400/20">
                <div className="text-[9px] uppercase tracking-widest text-white/50 font-black leading-none">
                  {lang === 'ar' ? 'الصلاة القادمة' : lang === 'en' ? 'Next Prayer' : lang === 'id' ? 'Sholat Berikutnya' : 'Solat Seterusnya'}
                </div>
                <div className="mt-1 flex items-baseline justify-center gap-1.5">
                  <div className="text-base md:text-lg font-black leading-none" style={{ color: '#FFF8E7' }}>{labelFor(nextPrayer.key)}</div>
                  <div className="text-[10px] text-white/60 tabular-nums leading-none">{nextPrayer.timeStr}</div>
                </div>
                <div className="mt-1 font-black tabular-nums leading-none" style={{ color: '#FFB703', fontSize: 'clamp(1.25rem, 2vw, 2rem)' }}>{countdown}</div>
              </div>
            )}
          </div>

          {/* Sirah/Islamic event now shown inside mascot dialog rotation — no standalone card */}
          {/* Kids progress card removed — already shown in Family Habit Board on the right */}

          {/* Zikir — compact card, flex-shrink-0 (NEVER shrinks — always fully visible) */}
          {display?.zikir && (
            <div className="rounded-3xl bg-emerald-950/60 backdrop-blur border border-emerald-400/20 shadow-2xl px-3 py-2 text-center flex-shrink-0">
              <div className="text-[10px] uppercase tracking-widest font-black flex items-center justify-center gap-1.5" style={{ color: '#00B894' }}>
                <motion.span
                  className="text-sm leading-none"
                  animate={{ rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>📿</motion.span>
                {t.display_zikir_title}
              </div>
              <div className="mt-1 flex items-baseline justify-center gap-2 leading-none">
                <motion.span
                  key={display.zikir.today}
                  initial={{ scale: 1.25 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="font-black tabular-nums drop-shadow tracking-tight"
                  style={{ fontSize: 'clamp(1.75rem, 3vw, 3rem)', color: '#FFF8E7' }}>
                  {(display.zikir.today || 0).toLocaleString(lang === 'ar' ? 'ar-EG' : lang)}
                </motion.span>
                <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: '#FFF8E7', opacity: 0.75 }}>
                  {t.display_zikir_sub_today}
                </span>
              </div>
              {display.zikir.total > (display.zikir.today || 0) && (
                <div className="mt-0.5 text-[9px]" style={{ color: '#FFF8E7', opacity: 0.55 }}>
                  {t.display_zikir_sub_total}: <span className="font-bold tabular-nums" style={{ color: '#00B894' }}>
                    {display.zikir.total.toLocaleString(lang === 'ar' ? 'ar-EG' : lang)}
                  </span>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CENTER — Family Photo Slideshow (MAIN FOCAL) */}
        <section className="col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-7 flex flex-col gap-2.5 min-h-0 overflow-hidden">
          <div className="relative flex-1 rounded-3xl overflow-hidden shadow-2xl border border-emerald-400/20 bg-emerald-950/40 min-h-0">
            {hasPhotos ? (
              <AnimatePresence mode="wait">
                <motion.img
                  key={photoIdx}
                  src={photos[photoIdx]}
                  alt=""
                  loading="eager"
                  decoding="async"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ willChange: 'opacity' }}
                />
              </AnimatePresence>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: 'linear-gradient(135deg, rgba(0,184,148,0.15), rgba(255,183,3,0.08))' }}>
                <div className="text-6xl opacity-60">📸</div>
                <div className="text-sm max-w-xs text-center px-4" style={{ color: '#FFF8E7', opacity: 0.8 }}>
                  {lang === 'ar' ? 'أضف صور العائلة في الإعدادات' : lang === 'en' ? 'Add family photos in Setup' : lang === 'id' ? 'Tambah foto keluarga di pengaturan' : 'Tambah gambar keluarga dalam tetapan'}
                </div>
                <button onClick={() => router.push('/display/setup')}
                  className="mt-1 px-4 py-2 rounded-xl text-slate-900 font-extrabold text-sm hover:scale-105 transition-transform shadow-lg"
                  style={{ backgroundColor: '#FFB703' }}>
                  {t.setup_title || 'Setup'}
                </button>
              </div>
            )}

            {/* Photo overlay: family motto at bottom */}
            {config?.familyMotto && (
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-14">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest font-black" style={{ color: '#FFB703' }}>✨ {lang === 'ar' ? 'شعار العائلة' : lang === 'en' ? 'Family Motto' : lang === 'id' ? 'Motto Keluarga' : 'Motto Keluarga'}</div>
                  <div className="mt-1 text-lg md:text-xl italic font-bold drop-shadow-lg" style={{ color: '#FFF8E7' }}>
                    “{config.familyMotto}”
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN — Ihsan Star + Family Habit Board (Skylight-style) */}
        <aside className="col-span-12 md:col-span-3 xl:col-span-3 flex flex-col gap-2.5 min-h-0 overflow-hidden">
          {/* Ihsan Star */}
          {display?.ihsanStar && (() => {
            const star = display.ihsanStar
            const avatar = star.avatarId ? AVATAR_BY_ID[star.avatarId] : null
            return (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="rounded-3xl backdrop-blur border-2 shadow-2xl p-3 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(255,183,3,0.28), rgba(255,183,3,0.12))', borderColor: 'rgba(255,183,3,0.5)' }}>
                <div className="text-[10px] uppercase tracking-widest font-black mb-1.5 flex items-center gap-1" style={{ color: '#FFB703' }}>
                  <span className="text-lg">🌟</span> {t.display_ihsan_star_title}
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/15 border-4 flex-shrink-0" style={{ borderColor: star.favColor || '#FFB703' }}>
                    {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center text-2xl">🧒</div>}
                    <motion.div
                      className="absolute -bottom-1 -right-1 text-xl"
                      animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}>🌟</motion.div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-black leading-tight truncate" style={{ color: '#FFF8E7' }}>{star.nickname}</div>
                    <div className="text-[11px] leading-tight" style={{ color: '#FFF8E7', opacity: 0.75 }}>{t.display_ihsan_star_sub(star.ihsanCount)}</div>
                  </div>
                </div>
              </motion.div>
            )
          })()}

          {/* Family Habit Board (Skylight-inspired) */}
          {config?.showHabits !== false && display?.children && display.children.length > 0 && (
            <HabitBoard
              kids={display.children}
              lang={lang}
              title={lang === 'ar' ? 'لوحة عادات العائلة' : lang === 'en' ? 'Family Habit Board' : lang === 'id' ? 'Papan Kebiasaan Keluarga' : 'Papan Habit Keluarga'}
            />
          )}
        </aside>
      </main>

      {/* ═══ BIG MASCOT bottom footer strip — full width dedicated area ═══ */}
      <footer className="relative z-30 flex-shrink-0">
        <div className="bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-3 pb-2" style={{ height: '190px' }}>
          <BigMascot
            mood={mascotMood}
            bubble={bubble}
            lang={lang}
            size={160}
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
