'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, X, Navigation, Check } from 'lucide-react'

/**
 * LocationPicker — Simplified GPS-first modal
 * Detect via device GPS + reverse geocode, then user confirms method + saves.
 * Can be reopened multiple times to update the location.
 */

const CALC_METHODS = [
  { id: 11, name: { ms: 'JAKIM Malaysia (Rasmi)', en: 'JAKIM Malaysia (Official)', id: 'JAKIM Malaysia', ar: 'الجاكيم ماليزيا' } },
  { id: 20, name: { ms: 'Kemenag Indonesia', en: 'Kemenag Indonesia', id: 'Kemenag Indonesia', ar: 'كيمناغ إندونيسيا' } },
  { id: 3,  name: { ms: 'Rabitah Alam Islami (MWL)', en: 'Muslim World League', id: 'Muslim World League', ar: 'رابطة العالم الإسلامي' } },
  { id: 4,  name: { ms: 'Ummul Qura, Makkah', en: 'Umm Al-Qura, Makkah', id: 'Ummul Qura, Makkah', ar: 'أم القرى مكة' } },
  { id: 5,  name: { ms: 'Mesir (Egyptian)', en: 'Egyptian General Authority', id: 'Mesir', ar: 'الهيئة المصرية' } },
  { id: 2,  name: { ms: 'ISNA (Amerika Utara)', en: 'ISNA (North America)', id: 'ISNA (Amerika)', ar: 'إسنا (أمريكا)' } },
  { id: 8,  name: { ms: 'Kuwait (Gulf)', en: 'Kuwait / Gulf Region', id: 'Kuwait', ar: 'الكويت / الخليج' } },
  { id: 1,  name: { ms: 'Universiti Karachi', en: 'University of Karachi', id: 'Universitas Karachi', ar: 'جامعة كراتشي' } },
]

// BigDataCloud reverse geocode — free, no API key, CORS-friendly
const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`)
    if (!res.ok) throw new Error('Reverse geocode failed')
    const data = await res.json()
    return {
      city: data.city || data.locality || data.principalSubdivision || 'Unknown',
      country: data.countryName || 'Unknown',
    }
  } catch (e) {
    return { city: 'Detected', country: 'Location' }
  }
}

export default function LocationPicker({ open, onClose, onSaved, currentLocation, lang = 'ms' }) {
  const [method, setMethod] = useState(11)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detected, setDetected] = useState(null)  // { city, country, latitude, longitude }
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setMethod(currentLocation?.method || 11)
      // Pre-populate detected if there's a current location
      if (currentLocation?.city) {
        setDetected({
          city: currentLocation.city,
          country: currentLocation.country,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          isCurrent: true,
        })
      } else {
        setDetected(null)
      }
      setError(null)
      setSaving(false)
      setDetecting(false)
    }
  }, [open, currentLocation])

  if (!open) return null

  const l = (o) => o[lang] || o.ms
  const t = {
    title:    { ms: currentLocation ? 'Tukar Lokasi Waktu Solat' : 'Tetapkan Lokasi Waktu Solat', en: currentLocation ? 'Change Prayer Location' : 'Set Prayer Location', id: currentLocation ? 'Ubah Lokasi' : 'Atur Lokasi', ar: currentLocation ? 'تغيير الموقع' : 'تعيين الموقع' },
    sub:      { ms: 'Waktu solat akan dikira ikut lokasi ini', en: 'Prayer times calculated for this location', id: 'Waktu shalat dihitung dari lokasi ini', ar: 'يتم حساب أوقات الصلاة لهذا الموقع' },
    method:   { ms: 'Kaedah Kiraan', en: 'Calculation Method', id: 'Metode Perhitungan', ar: 'طريقة الحساب' },
    detect:   { ms: '📍 Guna Lokasi Semasa Saya', en: '📍 Use My Current Location', id: '📍 Gunakan Lokasi Saya', ar: '📍 استخدم موقعي الحالي' },
    detecting:{ ms: 'Mengesan lokasi...', en: 'Detecting location...', id: 'Mendeteksi lokasi...', ar: 'جارٍ تحديد الموقع...' },
    detected: { ms: 'Lokasi Dikesan', en: 'Location Detected', id: 'Lokasi Terdeteksi', ar: 'تم تحديد الموقع' },
    coords:   { ms: 'Koordinat', en: 'Coordinates', id: 'Koordinat', ar: 'الإحداثيات' },
    save:     { ms: '💾 Simpan Lokasi', en: '💾 Save Location', id: '💾 Simpan Lokasi', ar: '💾 حفظ الموقع' },
    saving:   { ms: 'Menyimpan...', en: 'Saving...', id: 'Menyimpan...', ar: 'جارٍ الحفظ...' },
    cancel:   { ms: 'Batal', en: 'Cancel', id: 'Batal', ar: 'إلغاء' },
    retry:    { ms: '🔄 Cuba Semula', en: '🔄 Try Again', id: '🔄 Coba Lagi', ar: '🔄 حاول مرة أخرى' },
    gpsError: { ms: 'GPS tak tersedia atau kebenaran ditolak. Sila aktifkan GPS dan izinkan akses lokasi.', en: 'GPS unavailable or permission denied. Please enable GPS and allow location access.', id: 'GPS tidak tersedia atau ditolak.', ar: 'الموقع غير متاح أو تم رفضه' },
  }

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError(l(t.gpsError))
      return
    }
    setDetecting(true); setError(null); setDetected(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const geo = await reverseGeocode(latitude, longitude)
        setDetected({ city: geo.city, country: geo.country, latitude, longitude, isCurrent: false })
        setDetecting(false)
      },
      (err) => {
        console.warn('GPS error', err)
        setError(l(t.gpsError))
        setDetecting(false)
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 }
    )
  }

  const save = async () => {
    if (!detected) return
    setSaving(true); setError(null)
    try {
      const body = {
        city: detected.city,
        country: detected.country,
        method,
        latitude: detected.latitude,
        longitude: detected.longitude,
      }
      const res = await fetch('/api/family/prayer-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      if (onSaved) onSaved(data.location)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
        <motion.div
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}>

          {/* Header */}
          <div className="sticky top-0 bg-white border-b-2 border-emerald-100 p-4 flex items-center gap-2 rounded-t-3xl">
            <MapPin className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-black text-emerald-900 text-base leading-tight">{l(t.title)}</div>
              <div className="text-[11px] text-emerald-800/60">{l(t.sub)}</div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <X className="w-5 h-5 text-emerald-700" />
            </button>
          </div>

          <div className="p-4 space-y-4">

            {/* Detect location button — PRIMARY action */}
            {!detected && !detecting && (
              <button onClick={detectLocation}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-black text-base py-4 shadow-lg transition-all">
                <Navigation className="w-5 h-5" />
                {l(t.detect)}
              </button>
            )}

            {/* Detecting spinner */}
            {detecting && (
              <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 py-6 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full border-4 border-emerald-300 border-t-emerald-600 animate-spin" />
                <div className="text-emerald-900 font-bold text-sm">{l(t.detecting)}</div>
              </div>
            )}

            {/* Detected result card */}
            {detected && !detecting && (
              <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                    <Check className="w-6 h-6 text-white" strokeWidth={3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-widest font-black text-emerald-700 mb-0.5">
                      {l(t.detected)}
                    </div>
                    <div className="text-lg font-black text-emerald-900 leading-tight">
                      📍 {detected.city}
                    </div>
                    <div className="text-sm font-bold text-emerald-800/80 leading-tight">
                      {detected.country}
                    </div>
                    {detected.latitude != null && detected.longitude != null && (
                      <div className="mt-2 text-[10px] text-emerald-800/60 font-mono">
                        {l(t.coords)}: {Number(detected.latitude).toFixed(4)}°, {Number(detected.longitude).toFixed(4)}°
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={detectLocation} disabled={detecting}
                  className="mt-3 w-full text-[11px] font-bold text-emerald-700 hover:text-emerald-900 py-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50">
                  🔄 {lang === 'ar' ? 'اكتشف مرة أخرى' : lang === 'en' ? 'Detect again' : lang === 'id' ? 'Deteksi ulang' : 'Kesan semula'}
                </button>
              </div>
            )}

            {/* Method dropdown (always visible) */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">{l(t.method)}</label>
              <select value={method} onChange={e => setMethod(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-eq-cream px-3 py-2.5 text-sm bg-white focus:border-emerald-400 focus:outline-none">
                {CALC_METHODS.map(m => <option key={m.id} value={m.id}>{l(m.name)}</option>)}
              </select>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs p-3">
                <div className="font-bold mb-0.5">⚠️ {lang === 'ar' ? 'خطأ' : 'Error'}</div>
                <div>{error}</div>
                <button onClick={detectLocation} className="mt-2 text-red-800 underline font-bold">{l(t.retry)}</button>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-white border-t-2 border-emerald-100 p-4 flex gap-2 rounded-b-3xl">
            <button onClick={onClose} disabled={saving}
              className="flex-1 rounded-xl border-2 border-eq-cream text-emerald-800 font-bold text-sm py-2.5 hover:bg-eq-cream/30 disabled:opacity-50">
              {l(t.cancel)}
            </button>
            <button onClick={save} disabled={saving || !detected}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-black text-sm py-2.5 shadow-lg disabled:opacity-50">
              {saving ? l(t.saving) : l(t.save)}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
