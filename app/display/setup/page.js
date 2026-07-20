'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, MapPin, Image as ImageIcon, Volume2 } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'
import { AZAN_BANK, AZAN_FAJR_BANK, getAzan } from '@/lib/azanBank'
import { BRAND } from '@/lib/brand'
import PhotoUploader from '@/components/eqrel/PhotoUploader'
import TVPreview from '@/components/eqrel/TVPreview'

export default function DisplaySetupPage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [photos, setPhotos] = useState([])
  const [photoInput, setPhotoInput] = useState('')
  const [slideshowSec, setSlideshowSec] = useState(10)
  const [showHabits, setShowHabits] = useState(true)
  const [showHadith, setShowHadith] = useState(true)
  const [showDoa, setShowDoa] = useState(true)
  const [familyMotto, setFamilyMotto] = useState('')
  const [prayerLocationSet, setPrayerLocationSet] = useState(false)
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
  const [bgAudioVolume, setBgAudioVolume] = useState(25)
  const [previewingId, setPreviewingId] = useState(null)
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
          setPhotos(c.photos || [])
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
          setBgAudioVolume(typeof c.bgAudioVolume === 'number' ? c.bgAudioVolume : 25)
        }
        setPrayerLocationSet(!!lData.location)
      } finally { setLoading(false) }
    })()
  }, [])

  const addPhoto = () => {
    const url = photoInput.trim()
    if (!url) return
    if (!url.startsWith('http')) { return }
    setPhotos([...photos, url])
    setPhotoInput('')
  }
  const removePhoto = (i) => setPhotos(photos.filter((_, idx) => idx !== i))

  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const [saveToast, setSaveToast] = useState(false)

  const save = async () => {
    const r = await fetch('/api/family/display-config', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos, slideshowSec, showHabits, showHadith, showDoa, familyMotto,
        azanEnabled, azanId, azanFajrId, azanVolume, preAzanEnabled, preAzanMin,
        dimEnabled, dimStartHour, dimEndHour, dimLevel,
        bgAudioEnabled, bgAudioUrl, bgAudioVolume,
      }),
    })
    if (r.ok) {
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      setPreviewReloadKey(Date.now())
      setSaveToast(true); setTimeout(() => setSaveToast(false), 4000)
      // Scroll to top so parent sees updated preview
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
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
            <div className="text-sm font-black leading-tight">{BRAND.name} — {BRAND.tagline[lang] || BRAND.tagline.ms}</div>
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

        {/* Prayer location shortcut */}
        <button onClick={() => router.push('/display')}
          className={`w-full mb-4 rounded-2xl border-2 p-3 flex items-center gap-3 ${prayerLocationSet ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-300'}`}>
          <MapPin className="w-5 h-5 text-emerald-700 flex-shrink-0" />
          <div className="flex-1 text-left">
            <div className="font-extrabold text-sm text-emerald-900">{t.setup_prayer_loc}</div>
            <div className="text-[11px] text-emerald-800/70">{prayerLocationSet ? t.setup_prayer_set : t.setup_prayer_notset}</div>
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
            onUploaded={(urls) => setPhotos(prev => [...prev, ...urls].slice(0, 20))}
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

          {/* Photos grid */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              {photos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-eq-cream/50 group">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0.3 }} />
                  <button onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow-md active:scale-90">
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[9px] text-white/90 font-bold">
                    {i + 1}/{photos.length}
                  </div>
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

        {/* Background Audio (YouTube) */}
        <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4">
          <h2 className="font-extrabold text-emerald-900 text-sm mb-1 flex items-center gap-2">
            <span>🎵</span> {t.setup_bg_audio_title}
          </h2>
          <p className="text-[11px] text-emerald-800/60 mb-3">{t.setup_bg_audio_sub}</p>
          <ToggleRow label={t.setup_bg_audio_enable} desc="" value={bgAudioEnabled} onChange={setBgAudioEnabled} />
          {bgAudioEnabled && (
            <div className="mt-3 space-y-3 border-t border-eq-cream pt-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">
                  {t.setup_bg_audio_url}
                </label>
                <input value={bgAudioUrl} onChange={e => setBgAudioUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=… or /playlist?list=…"
                  className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-xs" />
                <p className="text-[10px] text-emerald-800/60 mt-1 italic">{t.setup_bg_audio_helper}</p>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">
                  {t.setup_bg_audio_volume}: <span className="text-emerald-700">{bgAudioVolume}%</span>
                </label>
                <input type="range" min={0} max={100} value={bgAudioVolume}
                  onChange={e => setBgAudioVolume(Number(e.target.value))}
                  className="w-full accent-emerald-500 mt-1" />
              </div>
            </div>
          )}
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

        {/* Family motto */}
        <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4">
          <h2 className="font-extrabold text-emerald-900 text-sm mb-1">✨ {t.setup_motto_title}</h2>
          <p className="text-[11px] text-emerald-800/60 mb-2">{t.setup_motto_sub}</p>
          <input value={familyMotto} onChange={e => setFamilyMotto(e.target.value)} maxLength={140}
            placeholder={t.setup_motto_placeholder}
            className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-sm" />
        </section>

        {/* Save + Preview */}
        <div className="flex gap-2 pb-6">
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
