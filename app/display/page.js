'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
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
import LocationPicker from '@/components/eqrel/LocationPicker'
import DisplayLoadingSplash from '@/components/eqrel/DisplayLoadingSplash'
import { strings as I18N_STRINGS } from '@/lib/i18n/strings'
import { formatHijri, getHijri } from '@/lib/hijri'
import { getEventForDate, getMonthlyContext } from '@/lib/islamicCalendar'

const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

// Format 24h "HH:MM" → 12h "h:MM AM/PM" for display
const to12h = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string') return hhmm
  const parts = hhmm.split(':')
  if (parts.length < 2) return hhmm
  let h = parseInt(parts[0], 10)
  const m = parts[1].padStart(2, '0')
  if (isNaN(h)) return hhmm
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${suffix}`
}
const PRAYER_LABELS = {
  ms: { Fajr: 'Subuh', Sunrise: 'Syuruk', Dhuhr: 'Zohor', Asr: 'Asar', Maghrib: 'Maghrib', Isha: 'Isyak' },
  en: { Fajr: 'Fajr',  Sunrise: 'Sunrise', Dhuhr: 'Dhuhr', Asr: 'Asr',  Maghrib: 'Maghrib', Isha: 'Isha' },
  id: { Fajr: 'Subuh', Sunrise: 'Terbit',  Dhuhr: 'Zuhur', Asr: 'Ashar', Maghrib: 'Maghrib', Isha: 'Isya' },
  ar: { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' },
}
const AZAN_TRIGGER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

function DisplayPageInner() {
  const router = useRouter()
  const { t: tBase, lang: userLang } = useLang()
  const [config, setConfig] = useState(null)
  // Display language override — if config.displayLang set, TV uses that; else follow user's login lang
  const lang = (config?.displayLang && ['ms', 'en', 'id', 'ar'].includes(config.displayLang)) ? config.displayLang : userLang
  const t = I18N_STRINGS[lang] || tBase
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
  // (config state declared at top of component with lang override)

  // Prevent TV screensaver — keep screen awake while /display is mounted
  useWakeLock(true)
  const [location, setLocation] = useState(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
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

  // loaded: first successful load done (config may legitimately be null for new families)
  // loadError: 'auth' | 'nofamily' | 'network' | 'timeout' — only shown before first success
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const loadedRef = useRef(false)
  const load = useCallback(async () => {
    const ctrl = new AbortController()
    const abortT = setTimeout(() => ctrl.abort(), 15_000)
    const opts = { credentials: 'include', signal: ctrl.signal }
    const safeJson = async (r) => { try { return await r.json() } catch { return {} } }
    try {
      const [cRes, dRes, lRes] = await Promise.all([
        fetch('/api/family/display-config', opts),
        fetch('/api/family/display-data', opts),
        fetch('/api/family/prayer-location', opts),
      ])
      if (cRes.status === 401 || dRes.status === 401) {
        if (!loadedRef.current) setLoadError('auth')
        return
      }
      if (!dRes.ok) {
        if (!loadedRef.current) setLoadError(dRes.status === 400 ? 'nofamily' : 'network')
        return
      }
      const cData = cRes.ok ? await safeJson(cRes) : {}
      const dData = await safeJson(dRes)
      const lData = lRes.ok ? await safeJson(lRes) : {}
      setConfig(cData?.config ?? null)
      setDisplay(dData)
      setLocation(lData?.location ?? null)
      loadedRef.current = true
      setLoaded(true)
      setLoadError(null)
      if (lData?.location) {
        try {
          const pRes = await fetch('/api/family/prayer-times', opts)
          if (pRes.ok) setPrayers(await pRes.json())
        } catch { /* prayer times optional */ }
      }
    } catch (e) {
      if (!loadedRef.current) setLoadError(e?.name === 'AbortError' ? 'timeout' : 'network')
    } finally {
      clearTimeout(abortT)
    }
  }, [])
  useEffect(() => { load(); const tt = setInterval(load, 60_000); return () => clearInterval(tt) }, [load])
  const retryLoad = useCallback(() => { setLoadError(null); load() }, [load])

  // ═══ Boot splash — show a motivational quote until data is ready ═══
  // Splash logic:
  //   1. isDataReady: config AND display are non-null (family + kids loaded).
  //   2. minSplashElapsed: guarantees splash shows for at least 2.2s so users
  //      can read the quote. Prevents jarring flash on fast networks.
  //   3. splashGone: after fade-out (~700ms), we can unmount for good.
  const [minSplashElapsed, setMinSplashElapsed] = useState(false)
  const [splashGone, setSplashGone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), 2200)
    return () => clearTimeout(t)
  }, [])
  // NOTE: config can be null for families that never saved display settings —
  // readiness is driven by `loaded`, not by config being non-null.
  const isDataReady = loaded && display !== null
  const splashVisible = !(isDataReady && minSplashElapsed) && !loadError

  // Photo slideshow rotation — supports both legacy string[] and new {url, focalX, focalY, title}[]
  const rawPhotos = (config?.photos || []).map(p => typeof p === 'string' ? { url: p, focalX: 50, focalY: 50, title: '' } : p).filter(p => p?.url)
  // Cloudinary auto-optimize for weak TV browsers (Android China etc):
  //   f_auto → WebP/AVIF, q_auto → adaptive quality, w_1280 → 720p max width,
  //   c_limit → don't upscale small images. Big perf win vs w_1920 originals.
  const photos = rawPhotos.map(p => ({
    ...p,
    url: typeof p.url === 'string' && p.url.includes('/upload/') && !p.url.includes('/upload/f_')
      ? p.url.replace('/upload/', '/upload/f_auto,q_auto:eco,w_1280,c_limit/')
      : p.url
  }))
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
      preloadImg.src = photos[nextIdx].url
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
            <img src="/assets/brand/eqrel_logo.webp" alt="EQrel" className="h-9 w-auto object-contain" />
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

  // ═══ Load error screen — never leave the family stuck on the splash ═══
  if (loadError && !loaded) {
    const L = (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'en' ? en : lang === 'id' ? id : ms)
    const errInfo = {
      auth: {
        icon: '🔐',
        title: L('Sesi anda telah tamat', 'Your session has ended', 'Sesi kamu telah berakhir', 'انتهت الجلسة'),
        desc: L('Sila log masuk semula untuk membuka Paparan Keluarga.', 'Please sign in again to open the Family Display.', 'Silakan masuk lagi untuk membuka Tampilan Keluarga.', 'يرجى تسجيل الدخول مرة أخرى.'),
      },
      nofamily: {
        icon: '👨‍👩‍👧',
        title: L('Keluarga belum disediakan', 'Family not set up yet', 'Keluarga belum disiapkan', 'لم يتم إعداد العائلة بعد'),
        desc: L('Lengkapkan profil keluarga di Papan Ibu Bapa dahulu.', 'Complete your family profile in the Parent Dashboard first.', 'Lengkapi profil keluarga di Dasbor Orang Tua dulu.', 'أكمل ملف العائلة أولاً.'),
      },
      timeout: {
        icon: '⏳',
        title: L('Sambungan terlalu perlahan', 'Connection is too slow', 'Koneksi terlalu lambat', 'الاتصال بطيء جداً'),
        desc: L('Data keluarga mengambil masa terlalu lama. Semak internet dan cuba lagi.', 'Family data took too long. Check your internet and try again.', 'Data keluarga terlalu lama dimuat. Periksa internet dan coba lagi.', 'استغرق التحميل وقتاً طويلاً. تحقق من الإنترنت.'),
      },
      network: {
        icon: '📡',
        title: L('Gagal memuatkan Paparan Keluarga', 'Could not load the Family Display', 'Gagal memuat Tampilan Keluarga', 'تعذّر تحميل شاشة العائلة'),
        desc: L('Berlaku masalah semasa mengambil data keluarga. Sila cuba lagi.', 'Something went wrong while loading family data. Please try again.', 'Terjadi masalah saat memuat data keluarga. Silakan coba lagi.', 'حدث خطأ أثناء التحميل. حاول مرة أخرى.'),
      },
    }[loadError] || {}
    return (
      <div data-testid="display-load-error" className="min-h-screen w-full flex items-center justify-center p-6 text-center"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{ background: 'radial-gradient(1400px 900px at 30% 20%, #0d5b4e 0%, #063f36 45%, #021d18 100%)', color: '#FFF8E7' }}>
        <div className="max-w-lg w-full rounded-3xl border-2 p-8 backdrop-blur-md"
          style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,183,3,0.35)' }}>
          <img src="/assets/brand/eqrel_logo.webp" alt="EQrel" className="h-14 w-auto mx-auto mb-5 object-contain" />
          <div className="text-5xl mb-3">{errInfo.icon}</div>
          <h1 className="text-2xl md:text-3xl font-black mb-2">{errInfo.title}</h1>
          <p className="text-sm md:text-base opacity-75 mb-6 leading-relaxed">{errInfo.desc}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {loadError === 'auth' ? (
              <button data-testid="display-error-login" onClick={() => router.push('/')}
                className="rounded-xl px-6 py-3 font-extrabold text-slate-900 active:scale-95 shadow-lg" style={{ backgroundColor: '#FFB703' }}>
                {L('Log Masuk', 'Sign In', 'Masuk', 'تسجيل الدخول')}
              </button>
            ) : (
              <button data-testid="display-error-retry" onClick={retryLoad}
                className="rounded-xl px-6 py-3 font-extrabold text-slate-900 active:scale-95 shadow-lg" style={{ backgroundColor: '#FFB703' }}>
                🔄 {L('Cuba Lagi', 'Try Again', 'Coba Lagi', 'حاول مرة أخرى')}
              </button>
            )}
            <button data-testid="display-error-back" onClick={() => router.push('/?parent=1')}
              className="rounded-xl px-6 py-3 font-extrabold bg-white/10 border border-white/20 active:scale-95">
              {L('Kembali', 'Go Back', 'Kembali', 'رجوع')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full relative overflow-hidden text-white flex flex-col" style={{ backgroundColor: '#0a1f1c', fontSize: 'clamp(14px, 1.4vmin + 0.4vw, 30px)', filter: `brightness(${dimBrightness})`, transition: 'filter 0.8s ease-in-out' }}>
      {/* ═══ BOOT SPLASH — Motivational quote while data loads ═══ */}
      {!splashGone && (
        <DisplayLoadingSplash
          lang={lang}
          familyName={display?.family?.familyName}
          visible={splashVisible}
          onGone={() => setSplashGone(true)}
        />
      )}
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
        {/* EQrel logo — image already includes tagline, no overlay text needed */}
        <div className="flex items-center bg-white h-14 rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
          <img
            src="/assets/brand/eqrel_logo.webp"
            alt="EQrel"
            className="h-14 w-auto block"
            style={{ backgroundColor: '#FFFFFF', display: 'block' }}
          />
        </div>

        {/* Prayer strip — click anywhere to change location */}
        {prayers?.timings ? (
          <button onClick={() => setLocationPickerOpen(true)}
            className="flex-1 rounded-2xl bg-emerald-900/50 backdrop-blur border border-emerald-400/25 hover:bg-emerald-800/60 transition-colors px-2 h-14 flex items-center gap-1 shadow-lg cursor-pointer"
            title={lang === 'ar' ? 'اضغط لتغيير الموقع' : lang === 'en' ? 'Click to change location' : 'Klik untuk tukar lokasi'}>
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
                  <div className={`text-xs font-extrabold tabular-nums ${isNext ? 'text-white' : isPassed ? 'text-white/40 line-through' : 'text-white/80'}`}>{to12h(prayers.timings[k])}</div>
                </div>
              )
            })}
          </button>
        ) : (
          <button onClick={() => setLocationPickerOpen(true)}
            className="flex-1 rounded-2xl bg-emerald-900/50 backdrop-blur border border-emerald-400/25 hover:bg-emerald-800/60 transition-colors flex items-center justify-center gap-2 px-4 h-14 shadow-lg cursor-pointer animate-pulse">
            <MapPin className="w-4 h-4" style={{ color: '#FFB703' }} />
            <span className="text-sm font-bold text-white/85">{t.display_setup_cta || 'Set location'}</span>
          </button>
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
                  <div className="text-[10px] text-white/60 tabular-nums leading-none">{to12h(nextPrayer.timeStr)}</div>
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
                  src={photos[photoIdx].url}
                  alt=""
                  loading="eager"
                  decoding="async"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    willChange: 'opacity',
                    objectPosition: `${photos[photoIdx].focalX ?? 50}% ${photos[photoIdx].focalY ?? 50}%`,
                  }}
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

            {/* Photo caption/title overlay — replaces Family Motto */}
            {hasPhotos && photos[photoIdx]?.title && (
              <motion.div
                key={`title-${photoIdx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-14">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-black drop-shadow-lg" style={{ color: '#FFF8E7', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                    {photos[photoIdx].title}
                  </div>
                </div>
              </motion.div>
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

      {/* Location Picker Modal — can be reopened multiple times */}
      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        currentLocation={location}
        lang={lang}
        onSaved={async (newLoc) => {
          setLocation(newLoc)
          // Re-fetch prayer times with new location
          try {
            const pRes = await fetch('/api/family/prayer-times', { credentials: 'include' })
            if (pRes.ok) setPrayers(await pRes.json())
          } catch (_) { /* ignore */ }
        }}
      />
    </div>
  )
}

// useSearchParams() must sit under a <Suspense> boundary for Next.js 15
// static prerender (`next build`). Fallback mirrors the boot splash look.
export default function DisplayPage() {
  return (
    <Suspense fallback={<DisplayLoadingSplash lang="ms" visible />}>
      <DisplayPageInner />
    </Suspense>
  )
}
