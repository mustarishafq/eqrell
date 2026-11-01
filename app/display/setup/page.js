'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, MapPin, Image as ImageIcon, Volume2 } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'
import { AZAN_BANK, AZAN_FAJR_BANK, getAzan } from '@/lib/azanBank'
import { BRAND } from '@/lib/brand'
import PhotoUploader from '@/components/eqrel/PhotoUploader'
import PhotoEditor from '@/components/eqrel/PhotoEditor'
import TVPreview from '@/components/eqrel/TVPreview'
import TVTutorialModal from '@/components/eqrel/TVTutorialModal'
import ConnectTVSection from '@/components/eqrel/ConnectTVSection'
import LocationPicker from '@/components/eqrel/LocationPicker'
import { QURAN_RECITERS, SURAH_LIST, ISLAMIC_PLAYLISTS, buildQuranUrl, buildIslamicPlaylist, resolveCustomPlaylist } from '@/lib/audioLibrary'

export default function DisplaySetupPage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [photos, setPhotos] = useState([])
  const [editingPhotoIdx, setEditingPhotoIdx] = useState(null)
  const [displayLang, setDisplayLang] = useState(null)  // null = follow browser/user lang, else override  // null | number
  const [photoInput, setPhotoInput] = useState('')
  const [slideshowSec, setSlideshowSec] = useState(10)
  const [showHabits, setShowHabits] = useState(true)
  const [showHadith, setShowHadith] = useState(true)
  const [showDoa, setShowDoa] = useState(true)
  const [familyMotto, setFamilyMotto] = useState('')
  const [prayerLocationSet, setPrayerLocationSet] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  // Azan
  const [azanEnabled, setAzanEnabled] = useState(false)
  const [azanId, setAzanId] = useState('makkah')
  const [azanFajrId, setAzanFajrId] = useState('fajr-makkah')
  const [azanVolume, setAzanVolume] = useState(80)
  const [preAzanEnabled, setPreAzanEnabled] = useState(true)
  const [preAzanMin, setPreAzanMin] = useState(10)
  // Dim mode
  const [dimEnabled, setDimEnabled] = useState(false)
  const [dimStartHour, setDimStartHour] = useState(22)
  const [dimEndHour, setDimEndHour] = useState(6)
  const [dimLevel, setDimLevel] = useState(30)
  // Background audio
  const [bgAudioEnabled, setBgAudioEnabled] = useState(false)
  const [bgAudioUrl, setBgAudioUrl] = useState('')
  const [bgAudioPlaylist, setBgAudioPlaylist] = useState([])  // array of resolved {url, title, ...} items
  const [bgAudioVolume, setBgAudioVolume] = useState(25)
  const [previewingId, setPreviewingId] = useState(null)
  const [showTVTutorial, setShowTVTutorial] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    (async () => {
      try {
        const [cRes, lRes] = await Promise.all([
          fetch('/api/family/display-config', { credentials: 'include' }),
          fetch('/api/family/prayer-location', { credentials: 'include' }),
        ])
        const cData = await cRes.json()
        const lData = await lRes.json()
        const c = cData.config
        if (c) {
        // Normalize photos to {url, focalX, focalY, title} objects (backward compat with legacy string[])
        setPhotos(Array.isArray(c.photos) ? c.photos.map(p => typeof p === 'string' ? { url: p, focalX: 50, focalY: 50, title: '' } : { url: p.url, focalX: p.focalX ?? 50, focalY: p.focalY ?? 50, title: p.title || '' }).filter(p => p.url) : [])
          setSlideshowSec(c.slideshowSec || 10)
          setShowHabits(!!c.showHabits)
          setShowHadith(c.showHadith !== false)
          setShowDoa(c.showDoa !== false)
          setFamilyMotto(c.familyMotto || '')
          setAzanEnabled(!!c.azanEnabled)
          setAzanId(c.azanId || 'makkah')
          setAzanFajrId(c.azanFajrId || 'fajr-makkah')
          setAzanVolume(typeof c.azanVolume === 'number' ? c.azanVolume : 80)
          setPreAzanEnabled(c.preAzanEnabled !== false)
          setPreAzanMin(typeof c.preAzanMin === 'number' ? c.preAzanMin : 10)
          setDimEnabled(!!c.dimEnabled)
          setDimStartHour(typeof c.dimStartHour === 'number' ? c.dimStartHour : 22)
          setDimEndHour(typeof c.dimEndHour === 'number' ? c.dimEndHour : 6)
          setDimLevel(typeof c.dimLevel === 'number' ? c.dimLevel : 30)
          setBgAudioEnabled(!!c.bgAudioEnabled)
          setBgAudioUrl(c.bgAudioUrl || '')
          setBgAudioPlaylist(Array.isArray(c.bgAudioPlaylist) ? c.bgAudioPlaylist : [])
        setDisplayLang(c.displayLang || null)
          setBgAudioVolume(typeof c.bgAudioVolume === 'number' ? c.bgAudioVolume : 25)
        }
        setPrayerLocationSet(!!lData.location)
        setCurrentLocation(lData.location || null)
      } finally { setLoading(false) }
    })()
  }, [])

  const addPhoto = () => {
    const url = photoInput.trim()
    if (!url) return
    if (!url.startsWith('http')) { return }
    setPhotos([...photos, { url, focalX: 50, focalY: 50, title: '' }])
    setPhotoInput('')
  }
  const removePhoto = (i) => setPhotos(photos.filter((_, idx) => idx !== i))

  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const [saveToast, setSaveToast] = useState(false)
  // Auto-launch Family Display after save. Persisted to localStorage.
  const [autoLaunchDisplay, setAutoLaunchDisplay] = useState(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const v = localStorage.getItem('eqrel-setup-autolaunch')
    if (v !== null) setAutoLaunchDisplay(v === '1')
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('eqrel-setup-autolaunch', autoLaunchDisplay ? '1' : '0')
  }, [autoLaunchDisplay])

  const save = async () => {
    const r = await fetch('/api/family/display-config', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos, slideshowSec, showHabits, showHadith, showDoa, familyMotto,
        azanEnabled, azanId, azanFajrId, azanVolume, preAzanEnabled, preAzanMin,
        dimEnabled, dimStartHour, dimEndHour, dimLevel,
        bgAudioEnabled, bgAudioUrl, bgAudioPlaylist, bgAudioVolume,
        displayLang,
      }),
    })
    if (r.ok) {
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      setPreviewReloadKey(Date.now())
      setSaveToast(true); setTimeout(() => setSaveToast(false), 4000)
      // Scroll to top so parent sees updated preview
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })

      // Auto-launch Family Display in a new window (or reuse existing).
      // MUST run synchronously in the click-triggered async chain so browsers
      // don't treat it as a popup and block it. Named target reuses the same
      // window if already opened (won't spam tabs on repeated saves).
      if (autoLaunchDisplay && typeof window !== 'undefined') {
        try {
          const w = window.open('/display', 'eqrel_family_display')
          if (w && typeof w.focus === 'function') w.focus()
        } catch (_) { /* popup blocked — user still has manual button */ }
      }
    }
  }

  const previewAzan = (id, isFajr = false) => {
    const azan = getAzan(id, isFajr)
    if (!azan) return
    if (previewingId === id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
      setPreviewingId(null)
      return
    }
    if (!audioRef.current) audioRef.current = new Audio()
    audioRef.current.src = azan.url
    audioRef.current.volume = azanVolume / 100
    audioRef.current.play().then(() => setPreviewingId(id)).catch(() => setPreviewingId(null))
    audioRef.current.onended = () => setPreviewingId(null)
  }

  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-emerald-800">{t.loading}</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-eq-cream via-white to-emerald-50">
      <div className="max-w-md mx-auto px-5 py-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.push('/?parent=1')} className="w-9 h-9 rounded-full bg-white/70 border border-emerald-200 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-emerald-800" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-emerald-900">{t.setup_title}</h1>
            <p className="text-xs text-emerald-800/60">{t.setup_sub}</p>
          </div>
          <img src={BRAND.mascot.default} alt="EQ" className="w-14 h-14 object-contain drop-shadow-md" />
        </div>

        {/* Brand welcome strip */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-3 mb-4 flex items-center gap-3 shadow-lg">
          <div className="text-xl">👋</div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-emerald-100 font-extrabold">{BRAND.mascotVoice.greet[lang] || BRAND.mascotVoice.greet.ms}</div>
            <div className="text-sm font-black leading-tight">{BRAND.name}</div>
          </div>
        </div>

        {/* TV Preview — always visible sticky */}
        <div className="mb-4 rounded-2xl bg-white/80 backdrop-blur border-2 border-emerald-200 p-3 shadow-lg">
          <TVPreview reloadKey={previewReloadKey} showOpenBtn={true} label={lang === 'ar' ? 'معاينة التلفاز' : lang === 'en' ? 'TV Preview (live)' : lang === 'id' ? 'Preview TV (langsung)' : 'Preview TV (langsung)'} />
          <p className="mt-2 text-[10px] text-emerald-800/60 italic text-center">
            {lang === 'ar' ? 'ستتحدث المعاينة بعد الحفظ' : lang === 'en' ? 'Preview updates after you save' : lang === 'id' ? 'Preview akan update setelah kamu save' : 'Preview akan update selepas tuan save'}
          </p>
        </div>

        {/* Save toast */}
        {saveToast && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-emerald-500 text-white px-4 py-2.5 shadow-2xl flex items-center gap-2 font-extrabold text-sm animate-in fade-in slide-in-from-top">
            <Save className="w-4 h-4" /> {lang === 'ar' ? 'تم الحفظ! المعاينة أعلاه' : lang === 'en' ? 'Saved! See preview above' : lang === 'id' ? 'Tersimpan! Lihat preview di atas' : 'Tersimpan! Lihat preview di atas'}
          </div>
        )}

        {/* Prayer location — opens picker modal (can change multiple times) */}
        <button onClick={() => setLocationPickerOpen(true)}
          className={`w-full mb-4 rounded-2xl border-2 p-3 flex items-center gap-3 ${prayerLocationSet ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 border-amber-300 hover:bg-amber-100 animate-pulse'} transition-colors`}>
          <MapPin className="w-5 h-5 text-emerald-700 flex-shrink-0" />
          <div className="flex-1 text-left">
            <div className="font-extrabold text-sm text-emerald-900">{t.setup_prayer_loc}</div>
            <div className="text-[11px] text-emerald-800/70">
              {prayerLocationSet
                ? `✓ ${currentLocation?.city || ''}, ${currentLocation?.country || ''} — ${lang === 'ar' ? 'اضغط للتغيير' : lang === 'en' ? 'tap to change' : 'ketuk untuk tukar'}`
                : t.setup_prayer_notset}
            </div>
          </div>
          <span className="text-emerald-700">→</span>
        </button>

        {/* Family photos */}
        <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4">
          <h2 className="font-extrabold text-emerald-900 text-sm mb-1 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> {t.setup_photos_title}
          </h2>
          <p className="text-[11px] text-emerald-800/60 mb-3">{t.setup_photos_sub}</p>

          {/* Primary: Direct upload from device (iOS + Android + Desktop) */}
          <PhotoUploader
            labels={{
              pick: t.setup_photo_upload,
              uploading: t.setup_photo_uploading,
              done: t.setup_photo_uploaded,
              tooLarge: t.setup_photo_toolarge,
              remove: t.setup_photo_remove,
            }}
            onUploaded={(urls) => {
              const newItems = urls.map(u => ({ url: u, focalX: 50, focalY: 50, title: '' }))
              setPhotos(prev => {
                const next = [...prev, ...newItems].slice(0, 20)
                // Auto-open editor for the first newly uploaded photo
                setTimeout(() => setEditingPhotoIdx(Math.min(prev.length, next.length - 1)), 300)
                return next
              })
            }}
          />
          <div className="mt-2 grid grid-cols-1 gap-0.5 text-[10px] text-emerald-800/60">
            <div>{t.setup_photo_helper_ios}</div>
            <div>{t.setup_photo_helper_android}</div>
          </div>

          {/* Fallback: URL paste */}
          <details className="mt-3 rounded-xl border border-eq-cream">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-emerald-800/80 select-none">
              {t.setup_photo_url}
            </summary>
            <div className="p-2 flex gap-2">
              <input value={photoInput} onChange={e => setPhotoInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPhoto()}
                placeholder="https://…"
                className="flex-1 rounded-xl border-2 border-eq-cream px-3 py-2 text-xs" />
              <button onClick={addPhoto} className="rounded-xl bg-emerald-500 text-white px-3 font-extrabold text-sm active:scale-95">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </details>

          {/* Photos grid — each thumbnail is clickable to edit position & title */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-eq-cream/50 group cursor-pointer"
                  onClick={() => setEditingPhotoIdx(i)}>
                  <img src={p.url} alt="" className="w-full h-full object-cover"
                    style={{ objectPosition: `${p.focalX ?? 50}% ${p.focalY ?? 50}%` }}
                    onError={(e) => { e.target.style.opacity = 0.3 }} />
                  {/* Focal point indicator dot */}
                  <div className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow-lg pointer-events-none"
                    style={{ left: `${p.focalX ?? 50}%`, top: `${p.focalY ?? 50}%`, background: '#00B894', boxShadow: '0 0 0 2px rgba(0,0,0,0.5)' }} />
                  <button onClick={(e) => { e.stopPropagation(); removePhoto(i) }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow-md active:scale-90">
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {p.title && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-[9px] font-black text-white truncate">
                      {p.title}
                    </div>
                  )}
                  {!p.title && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[9px] text-white/70 font-bold">
                      {i + 1}/{photos.length} · ✏️
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border-2 border-dashed border-eq-cream py-4 text-center text-xs text-emerald-800/50">
              {t.setup_photos_empty}
            </div>
          )}

          {photos.length > 1 && (
            <div className="mt-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">
                {t.setup_slideshow_speed}: <span className="text-emerald-700">{slideshowSec}s</span>
              </label>
              <input type="range" min={3} max={30} value={slideshowSec}
                onChange={e => setSlideshowSec(Number(e.target.value))}
                className="w-full accent-emerald-500 mt-1" />
            </div>
          )}
        </section>

        {/* Connect a TV — TV-first QR link (+ legacy phone code) */}
        <ConnectTVSection onHelp={() => setShowTVTutorial(true)} legacy={<TVPairCode />} />

        {/* Dim Mode */}
        <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4">
          <h2 className="font-extrabold text-emerald-900 text-sm mb-1 flex items-center gap-2">
            <span>🌙</span> {t.setup_dim_title}
          </h2>
          <p className="text-[11px] text-emerald-800/60 mb-3">{t.setup_dim_sub}</p>
          <ToggleRow label={t.setup_dim_enable} desc="" value={dimEnabled} onChange={setDimEnabled} />
          {dimEnabled && (
            <div className="mt-3 space-y-3 border-t border-eq-cream pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">{t.setup_dim_start}</label>
                  <select value={dimStartHour} onChange={e => setDimStartHour(Number(e.target.value))}
                    className="w-full mt-1 rounded-xl border-2 border-eq-cream px-2 py-1.5 text-xs">
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">{t.setup_dim_end}</label>
                  <select value={dimEndHour} onChange={e => setDimEndHour(Number(e.target.value))}
                    className="w-full mt-1 rounded-xl border-2 border-eq-cream px-2 py-1.5 text-xs">
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">
                  {t.setup_dim_level}: <span className="text-emerald-700">{dimLevel}%</span>
                </label>
                <input type="range" min={10} max={80} value={dimLevel}
                  onChange={e => setDimLevel(Number(e.target.value))}
                  className="w-full accent-emerald-500 mt-1" />
              </div>
            </div>
          )}
        </section>

        {/* Background Audio — Quran + Selawat + Custom URL */}
        <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4">
          <h2 className="font-extrabold text-emerald-900 text-sm mb-1 flex items-center gap-2">
            <span>🎵</span> {lang === 'ar' ? 'الصوت الخلفي' : lang === 'en' ? 'Background Audio' : 'Audio Latar Belakang'}
          </h2>
          <p className="text-[11px] text-emerald-800/60 mb-3">
            {lang === 'ar' ? 'Al-Quran / صلوات — بث مباشر بدون تخزين مؤقت' :
             lang === 'en' ? 'Al-Quran / Selawat — direct MP3 stream, zero buffering' :
             'Al-Quran / Selawat — direct MP3, tiada buffering'}
          </p>
          <ToggleRow label={t.setup_bg_audio_enable} desc="" value={bgAudioEnabled} onChange={setBgAudioEnabled} />
          {bgAudioEnabled && <BgAudioPicker url={bgAudioUrl} setUrl={setBgAudioUrl} playlist={bgAudioPlaylist} setPlaylist={setBgAudioPlaylist} volume={bgAudioVolume} setVolume={setBgAudioVolume} lang={lang} />}
        </section>

        {/* Toggles */}
        <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4 space-y-2">
          <ToggleRow label={t.setup_show_habits} desc={t.setup_show_habits_desc} value={showHabits} onChange={setShowHabits} />
          <ToggleRow label={t.setup_show_hadith} desc={t.setup_show_hadith_desc} value={showHadith} onChange={setShowHadith} />
          <ToggleRow label={t.setup_show_doa} desc={t.setup_show_doa_desc} value={showDoa} onChange={setShowDoa} />
        </section>

        {/* Azan & Audio */}
        <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4">
          <h2 className="font-extrabold text-emerald-900 text-sm mb-1 flex items-center gap-2">
            <Volume2 className="w-4 h-4" /> {t.setup_azan_title}
          </h2>
          <p className="text-[11px] text-emerald-800/60 mb-3">{t.setup_azan_sub}</p>

          <ToggleRow label={t.setup_azan_enable} desc={t.setup_azan_enable_desc} value={azanEnabled} onChange={setAzanEnabled} />

          {azanEnabled && (
            <div className="mt-3 space-y-3 border-t border-eq-cream pt-3">
              {/* Volume */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">
                  {t.setup_azan_volume}: <span className="text-emerald-700">{azanVolume}%</span>
                </label>
                <input type="range" min={0} max={100} value={azanVolume}
                  onChange={e => setAzanVolume(Number(e.target.value))}
                  className="w-full accent-emerald-500 mt-1" />
              </div>

              {/* Azan choice — 4 prayers */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">
                  {t.setup_azan_choice}
                </label>
                <div className="space-y-1.5">
                  {AZAN_BANK.map(az => (
                    <div key={az.id}
                      className={`flex items-center gap-2 rounded-xl border-2 p-2 transition-all ${azanId === az.id ? 'border-emerald-400 bg-emerald-50' : 'border-eq-cream bg-white'}`}>
                      <button onClick={() => setAzanId(az.id)} className="flex-1 text-left">
                        <div className="text-sm font-bold text-emerald-900">{az.label[lang] || az.label.ms}</div>
                      </button>
                      <button onClick={() => previewAzan(az.id, false)}
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg ${previewingId === az.id ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                        {previewingId === az.id ? t.setup_azan_stop : t.setup_azan_preview}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fajr azan choice */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">
                  {t.setup_azan_fajr_choice}
                </label>
                <p className="text-[10px] text-emerald-800/60 mb-1.5 italic">{t.setup_azan_fajr_note}</p>
                <div className="space-y-1.5">
                  {AZAN_FAJR_BANK.map(az => (
                    <div key={az.id}
                      className={`flex items-center gap-2 rounded-xl border-2 p-2 transition-all ${azanFajrId === az.id ? 'border-emerald-400 bg-emerald-50' : 'border-eq-cream bg-white'}`}>
                      <button onClick={() => setAzanFajrId(az.id)} className="flex-1 text-left">
                        <div className="text-sm font-bold text-emerald-900">{az.label[lang] || az.label.ms}</div>
                      </button>
                      <button onClick={() => previewAzan(az.id, true)}
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg ${previewingId === az.id ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                        {previewingId === az.id ? t.setup_azan_stop : t.setup_azan_preview}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pre-azan reminder */}
              <div className="border-t border-eq-cream pt-3">
                <ToggleRow label={t.setup_pre_azan_enable} desc={t.setup_pre_azan_enable_desc} value={preAzanEnabled} onChange={setPreAzanEnabled} />
                {preAzanEnabled && (
                  <div className="mt-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">
                      {t.setup_pre_azan_minutes}
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[5, 10, 15, 20, 30].map(m => (
                        <button key={m} onClick={() => setPreAzanMin(m)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${preAzanMin === m ? 'bg-emerald-500 text-white' : 'bg-eq-cream text-emerald-900'}`}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Family motto removed — replaced by per-photo title in PhotoEditor */}

        {/* Display Language Override */}
        <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4">
          <h2 className="font-extrabold text-emerald-900 text-sm mb-1 flex items-center gap-2">
            <span>🌐</span>
            {lang === 'ar' ? 'لغة عرض التلفزيون' : lang === 'en' ? 'TV Display Language' : lang === 'id' ? 'Bahasa Tampilan TV' : 'Bahasa Paparan TV'}
          </h2>
          <p className="text-[11px] text-emerald-800/60 mb-3">
            {lang === 'ar' ? 'تجاوز اللغة التي يعرضها التلفزيون (بغض النظر عن إعدادات المتصفح)' :
             lang === 'en' ? 'Override which language TV displays (regardless of browser settings)' :
             lang === 'id' ? 'Override bahasa TV (terlepas dari setting browser)' :
             'Override bahasa yang TV papar (tak kira setting browser)'}
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { code: null, label: lang === 'ar' ? 'تلقائي' : lang === 'en' ? 'Auto' : lang === 'id' ? 'Otomatis' : 'Auto', flag: '🌐' },
              { code: 'ms', label: 'Melayu', flag: '🇲🇾' },
              { code: 'en', label: 'English', flag: '🇬🇧' },
              { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
              { code: 'ar', label: 'العربية', flag: '🇸🇦' },
            ].map(opt => (
              <button key={opt.code || 'auto'} onClick={() => setDisplayLang(opt.code)}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition-all ${displayLang === opt.code ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-eq-cream bg-white hover:bg-emerald-50/50'}`}>
                <span className="text-xl leading-none">{opt.flag}</span>
                <span className="text-[10px] font-black text-emerald-900 leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-emerald-800/50 mt-2 italic">
            {lang === 'ar' ? '💡 "تلقائي" يتبع إعداد المستخدم من الدخول' :
             lang === 'en' ? '💡 "Auto" follows the user\'s login language setting' :
             lang === 'id' ? '💡 "Otomatis" mengikuti bahasa login pengguna' :
             '💡 "Auto" ikut setting bahasa user semasa login'}
          </p>
        </section>

        {/* Save + Preview */}
        <div className="pb-6 space-y-2">
          {/* Auto-launch toggle — controls whether Family Display opens after Save */}
          <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl bg-emerald-50/60 border border-emerald-100 px-3 py-2">
            <input
              type="checkbox"
              checked={autoLaunchDisplay}
              onChange={e => setAutoLaunchDisplay(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black text-emerald-900 leading-tight">
                {lang === 'ar' ? 'افتح شاشة العائلة تلقائياً بعد الحفظ' :
                 lang === 'en' ? 'Auto-open Family Display after Save' :
                 lang === 'id' ? 'Buka Family Display otomatis setelah simpan' :
                 'Auto-buka Family Display selepas Simpan'}
              </div>
              <div className="text-[9px] text-emerald-800/60 leading-tight mt-0.5">
                {lang === 'ar' ? 'ستفتح في تبويب جديد' :
                 lang === 'en' ? 'Opens in a new tab/window' :
                 lang === 'id' ? 'Terbuka di tab/jendela baru' :
                 'Buka dalam tab/tetingkap baru'}
              </div>
            </div>
          </label>

          <div className="flex gap-2">
            <button onClick={() => router.push('/display')}
              className="flex-1 rounded-2xl border-2 border-emerald-300 text-emerald-800 font-extrabold py-3 text-sm">
              {t.setup_preview}
            </button>
            <button onClick={save}
              className="flex-1 rounded-2xl bg-emerald-500 text-white font-extrabold py-3 text-sm flex items-center justify-center gap-1.5 active:scale-[0.99]">
              <Save className="w-4 h-4" /> {saved ? '✓ ' + t.device_saved : t.save}
            </button>
          </div>
        </div>
      </div>

      {/* TV Tutorial modal */}
      <TVTutorialModal open={showTVTutorial} onClose={() => setShowTVTutorial(false)} />

      {/* Location Picker modal */}
      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        currentLocation={currentLocation}
        lang={lang}
        onSaved={(newLoc) => {
          setCurrentLocation(newLoc)
          setPrayerLocationSet(true)
        }}
      />

      {/* Photo Editor modal — set focal point + title per photo */}
      <PhotoEditor
        open={editingPhotoIdx !== null}
        photo={editingPhotoIdx !== null ? photos[editingPhotoIdx] : null}
        onClose={() => setEditingPhotoIdx(null)}
        lang={lang}
        onSave={(updated) => {
          setPhotos(prev => prev.map((p, i) => i === editingPhotoIdx ? updated : p))
        }}
      />
    </div>
  )
}

const TVPairCode = () => {
  const [code, setCode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/family/tv-pair/current', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.code) setCode(d.code) }).catch(() => {})
  }, [])

  const generate = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/family/tv-pair/generate', { method: 'POST', credentials: 'include' })
      const d = await r.json()
      if (r.ok && d.code) setCode(d.code)
    } catch (e) { /* ignore */ }
    setLoading(false)
  }

  const copy = () => {
    if (code) {
      navigator.clipboard?.writeText(code)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    }
  }

  if (!code) {
    return (
      <button onClick={generate} disabled={loading}
        className="w-full rounded-xl bg-emerald-500 text-white font-extrabold py-3 text-sm active:scale-95 disabled:opacity-50">
        {loading ? 'Generating…' : '🔑 Generate TV code'}
      </button>
    )
  }

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 shadow-lg text-center">
        <div className="text-[10px] uppercase tracking-widest text-emerald-100 font-black mb-1">Pairing code (15 min)</div>
        <div className="text-5xl font-black tabular-nums tracking-widest my-1" style={{ letterSpacing: '0.3em' }}>{code}</div>
        <div className="flex gap-2 mt-3">
          <button onClick={copy} className="flex-1 rounded-lg bg-white/20 backdrop-blur px-3 py-1.5 text-xs font-extrabold active:scale-95">
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
          <button onClick={generate} disabled={loading} className="flex-1 rounded-lg bg-white/20 backdrop-blur px-3 py-1.5 text-xs font-extrabold active:scale-95">
            {loading ? '...' : '🔄 Regenerate'}
          </button>
        </div>
      </div>
      <ol className="mt-3 space-y-1 text-[11px] text-emerald-800/75 list-decimal list-inside">
        <li>Open the browser on the TV</li>
        <li>Go to <span className="font-bold font-mono">{typeof window !== 'undefined' ? window.location.host : 'eqrel.app'}/tv</span> → “I have a code from the app”</li>
        <li>Enter the code above → the TV opens the Family Display</li>
      </ol>
    </div>
  )
}


const ToggleRow = ({ label, desc, value, onChange }) => (
  <div className="flex items-start gap-3 py-1.5">
    <div className="flex-1">
      <div className="font-extrabold text-sm text-emerald-900">{label}</div>
      <div className="text-[11px] text-emerald-800/60 leading-tight">{desc}</div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition-all flex-shrink-0 ${value ? 'bg-emerald-500' : 'bg-eq-cream'} relative`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// BgAudioPicker — 4-tab picker: Quran / Preset / Custom Playlist / URL
// Direct MP3 sources, zero YouTube overhead
// Emits: url (single) + playlist (array of {url, title, surah?, reciter?})
// ═══════════════════════════════════════════════════════════════════════════
const BgAudioPicker = ({ url, setUrl, playlist, setPlaylist, volume, setVolume, lang }) => {
  const [tab, setTab] = useState(() => {
    if (Array.isArray(playlist) && playlist.length > 1) return 'playlist'
    if (url?.includes('mp3quran.net')) return 'quran'
    if (!url) return 'quran'
    return 'url'
  })
  // Quran tab state
  const [reciterId, setReciterId] = useState('sudais')
  const [surahMode, setSurahMode] = useState('full')  // 'full' | 'single'
  const [surahNumber, setSurahNumber] = useState(36)
  // Preset tab state
  const [presetId, setPresetId] = useState('jumaat')
  const [presetReciter, setPresetReciter] = useState('')  // '' = use recommended
  // Custom playlist tab state — array of items
  const [customItems, setCustomItems] = useState(() => Array.isArray(playlist) ? playlist.map(p => ({ ...p })) : [])
  const [pickerReciter, setPickerReciter] = useState('sudais')
  const [pickerSurah, setPickerSurah] = useState(1)
  // URL tab state
  const [customUrl, setCustomUrl] = useState(url && !url.includes('mp3quran.net') ? url : '')
  const previewAudioRef = useRef(null)
  const [previewing, setPreviewing] = useState(false)

  // Apply picker → build final URL + playlist
  useEffect(() => {
    let finalUrl = ''
    let finalPlaylist = []
    if (tab === 'quran') {
      const u = buildQuranUrl(reciterId, surahMode === 'single' ? surahNumber : 1)
      finalUrl = u || ''
      finalPlaylist = surahMode === 'full' && u ? [] : []  // full uses auto-next in player (MP3Quran regex)
    } else if (tab === 'preset') {
      const rid = presetReciter || ISLAMIC_PLAYLISTS.find(x => x.id === presetId)?.recommendedReciter
      finalPlaylist = buildIslamicPlaylist(presetId, rid)
      finalUrl = finalPlaylist[0]?.url || ''
    } else if (tab === 'playlist') {
      finalPlaylist = resolveCustomPlaylist(customItems)
      finalUrl = finalPlaylist[0]?.url || ''
    } else if (tab === 'url') {
      finalUrl = customUrl
    }
    setUrl(finalUrl)
    setPlaylist(finalPlaylist)
  }, [tab, reciterId, surahMode, surahNumber, presetId, presetReciter, customItems, customUrl])

  const preview = async () => {
    if (!url) return
    try {
      if (previewing && previewAudioRef.current) {
        previewAudioRef.current.pause()
        setPreviewing(false)
        return
      }
      const a = new Audio(url)
      a.volume = 0.6
      previewAudioRef.current = a
      await a.play()
      setPreviewing(true)
      a.onended = () => setPreviewing(false)
    } catch (e) { console.error('Preview error', e) }
  }

  // Custom playlist actions
  const addCustomItem = () => {
    const item = { type: 'surah', reciterId: pickerReciter, surahNumber: pickerSurah, title: SURAH_LIST.find(s => s.n === pickerSurah)?.ms + ' — ' + QURAN_RECITERS.find(r => r.id === pickerReciter)?.name }
    setCustomItems(prev => [...prev, item])
  }
  const removeCustomItem = (idx) => setCustomItems(prev => prev.filter((_, i) => i !== idx))
  const moveCustomItem = (idx, dir) => {
    setCustomItems(prev => {
      const arr = [...prev]
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= arr.length) return arr
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr
    })
  }
  const addPresetToCustom = () => {
    setCustomItems(prev => [...prev, { type: 'preset', playlistId: presetId, reciterId: presetReciter || undefined, title: ISLAMIC_PLAYLISTS.find(p => p.id === presetId)?.title.ms }])
  }

  const haramList = QURAN_RECITERS.filter(r => r.masjid === 'haram')
  const nabawiList = QURAN_RECITERS.filter(r => r.masjid === 'nabawi')
  const otherList = QURAN_RECITERS.filter(r => !r.masjid)

  const l = (o) => o[lang] || o.ms

  return (
    <div className="mt-3 space-y-3 border-t border-eq-cream pt-3">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-eq-cream/40 rounded-lg p-1">
        {[
          { k: 'quran',    label: '🎙 ' + (lang === 'ar' ? 'قرآن' : 'Al-Quran') },
          { k: 'preset',   label: '📚 ' + (lang === 'ar' ? 'مجموعات' : lang === 'en' ? 'Presets' : 'Preset') },
          { k: 'playlist', label: '🎧 ' + (lang === 'ar' ? 'قائمتي' : lang === 'en' ? 'My Playlist' : 'Playlist Saya') },
          { k: 'url',      label: '🔗 ' + (lang === 'ar' ? 'رابط' : 'URL') },
        ].map(x => (
          <button key={x.k} onClick={() => setTab(x.k)}
            className={`flex-1 min-w-[80px] py-1.5 rounded-md text-[11px] font-bold transition-all ${tab === x.k ? 'bg-white text-emerald-900 shadow-sm' : 'text-emerald-800/60'}`}>
            {x.label}
          </button>
        ))}
      </div>

      {/* ═══ QURAN TAB ═══ */}
      {tab === 'quran' && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">
            {lang === 'ar' ? 'القارئ' : lang === 'en' ? 'Reciter' : 'Qari'}
          </label>
          <select value={reciterId} onChange={e => setReciterId(e.target.value)}
            className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-xs bg-white">
            <optgroup label={lang === 'ar' ? '🕋 أئمة الحرم المكي' : '🕋 Imam Masjid Al-Haram'}>
              {haramList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </optgroup>
            <optgroup label={lang === 'ar' ? '🕌 أئمة المسجد النبوي' : '🕌 Imam Masjid An-Nabawi'}>
              {nabawiList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </optgroup>
            <optgroup label={lang === 'ar' ? '⭐ قراء مشهورون' : '⭐ Popular Reciters'}>
              {otherList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </optgroup>
          </select>
          <div className="flex gap-2 text-xs mt-2">
            <label className="flex-1 flex items-center gap-2 p-2 border-2 border-eq-cream rounded-lg cursor-pointer hover:bg-eq-cream/30">
              <input type="radio" checked={surahMode === 'full'} onChange={() => setSurahMode('full')} className="accent-emerald-500" />
              <div>
                <div className="font-bold text-emerald-900">{lang === 'ar' ? 'القرآن الكامل' : lang === 'en' ? 'Full Quran' : 'Al-Quran Penuh'}</div>
                <div className="text-[10px] text-emerald-800/60">1 → 114 auto</div>
              </div>
            </label>
            <label className="flex-1 flex items-center gap-2 p-2 border-2 border-eq-cream rounded-lg cursor-pointer hover:bg-eq-cream/30">
              <input type="radio" checked={surahMode === 'single'} onChange={() => setSurahMode('single')} className="accent-emerald-500" />
              <div>
                <div className="font-bold text-emerald-900">{lang === 'ar' ? 'سورة واحدة' : lang === 'en' ? 'Single Surah' : 'Satu Surah'}</div>
                <div className="text-[10px] text-emerald-800/60">Loop repeat</div>
              </div>
            </label>
          </div>
          {surahMode === 'single' && (
            <select value={surahNumber} onChange={e => setSurahNumber(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-xs bg-white">
              {SURAH_LIST.map(s => (
                <option key={s.n} value={s.n}>
                  {String(s.n).padStart(3, '0')}. {lang === 'ar' ? s.ar : lang === 'en' ? s.en : s.ms}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ═══ PRESET PLAYLIST TAB ═══ */}
      {tab === 'preset' && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">
            {lang === 'ar' ? 'اختر المناسبة' : lang === 'en' ? 'Choose Occasion' : 'Pilih Kegunaan'}
          </label>
          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
            {ISLAMIC_PLAYLISTS.map(p => (
              <button key={p.id} onClick={() => setPresetId(p.id)}
                className={`text-left p-2 rounded-lg border-2 transition-all ${presetId === p.id ? 'border-emerald-500 bg-emerald-50' : 'border-eq-cream bg-white hover:bg-emerald-50/50'}`}>
                <div className="flex items-start gap-1.5">
                  <span className="text-base flex-shrink-0">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black text-emerald-900 leading-tight">{l(p.title)}</div>
                    <div className="text-[9px] text-emerald-800/60 leading-tight line-clamp-2">{l(p.desc)}</div>
                    <div className="text-[8px] text-emerald-700/80 mt-0.5">
                      {p.stream
                        ? (lang === 'ar' ? '📻 بث مباشر' : lang === 'en' ? '📻 Live stream' : '📻 Stream langsung')
                        : `${p.surahs.length} ${lang === 'ar' ? 'سور' : 'surah'}`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Reciter override — only for surah-based presets (streams have their own reciter) */}
          {!ISLAMIC_PLAYLISTS.find(p => p.id === presetId)?.stream && (
            <div className="mt-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70 block mb-1">
                {lang === 'ar' ? 'تغيير القارئ' : lang === 'en' ? 'Override Reciter (optional)' : 'Tukar Qari (opsyenal)'}
              </label>
              <select value={presetReciter} onChange={e => setPresetReciter(e.target.value)}
                className="w-full rounded-xl border-2 border-eq-cream px-3 py-1.5 text-xs bg-white">
                <option value="">{lang === 'ar' ? 'مقترح' : lang === 'en' ? 'Recommended' : 'Guna cadangan'}</option>
                {QURAN_RECITERS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ═══ CUSTOM PLAYLIST BUILDER TAB ═══ */}
      {tab === 'playlist' && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">
            {lang === 'ar' ? 'أضف سورة' : lang === 'en' ? 'Add Surah to Playlist' : 'Tambah Surah ke Playlist'}
          </label>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
            <select value={pickerReciter} onChange={e => setPickerReciter(e.target.value)}
              className="rounded-xl border-2 border-eq-cream px-2 py-1.5 text-[11px] bg-white">
              {QURAN_RECITERS.map(r => <option key={r.id} value={r.id}>{r.name.replace('Sheikh ', '').substring(0, 22)}</option>)}
            </select>
            <select value={pickerSurah} onChange={e => setPickerSurah(Number(e.target.value))}
              className="rounded-xl border-2 border-eq-cream px-2 py-1.5 text-[11px] bg-white">
              {SURAH_LIST.map(s => (
                <option key={s.n} value={s.n}>{String(s.n).padStart(3, '0')}. {lang === 'ar' ? s.ar : s.ms}</option>
              ))}
            </select>
            <button type="button" onClick={addCustomItem}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm shadow">
              +
            </button>
          </div>

          {/* Quick add: preset playlist */}
          <div className="flex gap-1.5 items-center pt-1 border-t border-eq-cream/50">
            <select value={presetId} onChange={e => setPresetId(e.target.value)}
              className="flex-1 rounded-xl border-2 border-eq-cream px-2 py-1.5 text-[11px] bg-white">
              {ISLAMIC_PLAYLISTS.map(p => <option key={p.id} value={p.id}>{p.icon} {l(p.title)}</option>)}
            </select>
            <button type="button" onClick={addPresetToCustom}
              className="px-2 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shadow">
              + {lang === 'ar' ? 'مجموعة' : 'Preset'}
            </button>
          </div>

          {/* Current playlist items */}
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1">
              📝 {customItems.length} {lang === 'ar' ? 'عنصر' : lang === 'en' ? 'items' : 'item'} — {resolveCustomPlaylist(customItems).length} {lang === 'ar' ? 'مسار' : 'tracks'}
            </div>
            {customItems.length === 0 && (
              <div className="text-[10px] italic text-emerald-800/40 text-center py-3">
                {lang === 'ar' ? 'قائمة فارغة — أضف سورة أو مجموعة أعلاه' : lang === 'en' ? 'Empty — add surahs or presets above' : 'Kosong — tambah surah atau preset di atas'}
              </div>
            )}
            {customItems.map((it, i) => (
              <div key={i} className="flex items-center gap-1 p-1.5 bg-white border border-eq-cream rounded-lg">
                <span className="text-[9px] text-emerald-800/50 w-5 tabular-nums">{i + 1}.</span>
                <span className="text-xs">{it.type === 'preset' ? (ISLAMIC_PLAYLISTS.find(p => p.id === it.playlistId)?.icon || '📚') : '📖'}</span>
                <span className="flex-1 text-[10px] font-bold text-emerald-900 truncate">{it.title || (it.type === 'preset' ? 'Preset' : `Surah ${it.surahNumber}`)}</span>
                <button type="button" onClick={() => moveCustomItem(i, -1)} disabled={i === 0}
                  className="p-1 text-[10px] disabled:opacity-30 hover:bg-eq-cream rounded">↑</button>
                <button type="button" onClick={() => moveCustomItem(i, 1)} disabled={i === customItems.length - 1}
                  className="p-1 text-[10px] disabled:opacity-30 hover:bg-eq-cream rounded">↓</button>
                <button type="button" onClick={() => removeCustomItem(i)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded text-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ URL TAB ═══ */}
      {tab === 'url' && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">
            {lang === 'ar' ? 'رابط MP3' : 'MP3 URL'}
          </label>
          <input value={customUrl} onChange={e => setCustomUrl(e.target.value)}
            placeholder="https://.../file.mp3"
            className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-xs" />
          <p className="text-[10px] text-emerald-800/60 mt-1 italic">
            {lang === 'ar' ? 'MP3 مباشر فقط (.mp3, .ogg, .m4a)' :
             lang === 'en' ? 'Direct MP3 only (.mp3, .ogg, .m4a) — no YouTube' :
             'Direct MP3 sahaja (.mp3, .ogg, .m4a) — bukan YouTube'}
          </p>
        </div>
      )}

      {/* Preview + Volume */}
      <div className="flex items-center gap-2 pt-2 border-t border-eq-cream">
        <button type="button" onClick={preview}
          className={`px-3 py-2 rounded-lg text-xs font-bold shadow transition-all ${previewing ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
          {previewing ? '⏸ ' + (lang === 'ar' ? 'إيقاف' : 'Stop') : '▶️ ' + (lang === 'ar' ? 'معاينة' : 'Preview')}
        </button>
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70">
            🔊 {volume}%
          </label>
          <input type="range" min={0} max={100} value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="w-full accent-emerald-500" />
        </div>
      </div>
      {url && (
        <div className="text-[9px] text-emerald-800/50 font-mono break-all">
          🔗 {url.substring(0, 80)}{url.length > 80 ? '...' : ''}
        </div>
      )}
    </div>
  )
}
