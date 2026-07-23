'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, X, Navigation, Search } from 'lucide-react'

/**
 * LocationPicker — Modal for setting/changing prayer location.
 * Can be opened multiple times to update the location.
 *
 * Props:
 *   open: bool
 *   onClose: () => void
 *   onSaved: (location) => void
 *   currentLocation: {city, country, method, latitude, longitude} | null
 *   lang: 'ms' | 'en' | 'id' | 'ar'
 */

// Aladhan calculation methods — most common
const CALC_METHODS = [
  { id: 11, name: { ms: 'JAKIM Malaysia (Rasmi)', en: 'JAKIM Malaysia (Official)', id: 'JAKIM Malaysia', ar: 'الجاكيم ماليزيا' } },
  { id: 20, name: { ms: 'Kemenag Indonesia', en: 'Kemenag Indonesia', id: 'Kemenag Indonesia', ar: 'كيمناغ إندونيسيا' } },
  { id: 3,  name: { ms: 'Rabitah Alam Islami (MWL)', en: 'Muslim World League', id: 'Muslim World League', ar: 'رابطة العالم الإسلامي' } },
  { id: 4,  name: { ms: 'Ummul Qura, Makkah', en: 'Umm Al-Qura, Makkah', id: 'Ummul Qura, Makkah', ar: 'أم القرى مكة' } },
  { id: 5,  name: { ms: 'Mesir (Egyptian)', en: 'Egyptian General Authority', id: 'Mesir', ar: 'الهيئة المصرية' } },
  { id: 2,  name: { ms: 'ISNA (Amerika)', en: 'ISNA (North America)', id: 'ISNA (Amerika)', ar: 'إسنا (أمريكا)' } },
  { id: 8,  name: { ms: 'Kuwait (Gulf)', en: 'Kuwait / Gulf Region', id: 'Kuwait', ar: 'الكويت / الخليج' } },
  { id: 1,  name: { ms: 'Universiti Karachi', en: 'University of Karachi', id: 'Universitas Karachi', ar: 'جامعة كراتشي' } },
]

// Common Malaysian & Southeast Asian cities preset for quick pick
const CITY_PRESETS = [
  { city: 'Kuala Lumpur',  country: 'Malaysia',   method: 11 },
  { city: 'Petaling Jaya', country: 'Malaysia',   method: 11 },
  { city: 'Johor Bahru',   country: 'Malaysia',   method: 11 },
  { city: 'Penang',        country: 'Malaysia',   method: 11 },
  { city: 'Kota Bharu',    country: 'Malaysia',   method: 11 },
  { city: 'Kuching',       country: 'Malaysia',   method: 11 },
  { city: 'Kota Kinabalu', country: 'Malaysia',   method: 11 },
  { city: 'Jakarta',       country: 'Indonesia',  method: 20 },
  { city: 'Bandung',       country: 'Indonesia',  method: 20 },
  { city: 'Surabaya',      country: 'Indonesia',  method: 20 },
  { city: 'Singapore',     country: 'Singapore',  method: 11 },
  { city: 'Makkah',        country: 'Saudi Arabia', method: 4 },
  { city: 'Madinah',       country: 'Saudi Arabia', method: 4 },
  { city: 'Istanbul',      country: 'Turkey',     method: 3 },
]

export default function LocationPicker({ open, onClose, onSaved, currentLocation, lang = 'ms' }) {
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [method, setMethod] = useState(11)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setCity(currentLocation?.city || '')
      setCountry(currentLocation?.country || '')
      setMethod(currentLocation?.method || 11)
      setError(null)
    }
  }, [open, currentLocation])

  if (!open) return null

  const t = {
    title: {
      ms: currentLocation ? 'Tukar Lokasi Waktu Solat' : 'Tetapkan Lokasi Waktu Solat',
      en: currentLocation ? 'Change Prayer Location' : 'Set Prayer Location',
      id: currentLocation ? 'Ubah Lokasi Waktu Sholat' : 'Atur Lokasi Waktu Sholat',
      ar: currentLocation ? 'تغيير موقع الصلاة' : 'تعيين موقع الصلاة',
    },
    sub: {
      ms: 'Waktu solat akan dikira ikut lokasi ini',
      en: 'Prayer times calculated for this location',
      id: 'Waktu shalat akan dihitung dari lokasi ini',
      ar: 'يتم حساب أوقات الصلاة لهذا الموقع',
    },
    city: { ms: 'Bandar', en: 'City', id: 'Kota', ar: 'المدينة' },
    country: { ms: 'Negara', en: 'Country', id: 'Negara', ar: 'الدولة' },
    method: { ms: 'Kaedah Kiraan', en: 'Calculation Method', id: 'Metode Perhitungan', ar: 'طريقة الحساب' },
    quickPick: { ms: '📍 Pilih Pantas', en: '📍 Quick Pick', id: '📍 Pilih Cepat', ar: '📍 اختيار سريع' },
    useGps: { ms: 'Guna Lokasi GPS Peranti', en: 'Use Device GPS', id: 'Gunakan GPS Perangkat', ar: 'استخدم موقع الجهاز' },
    save: { ms: '💾 Simpan Lokasi', en: '💾 Save Location', id: '💾 Simpan Lokasi', ar: '💾 حفظ الموقع' },
    saving: { ms: 'Menyimpan...', en: 'Saving...', id: 'Menyimpan...', ar: 'جارٍ الحفظ...' },
    cancel: { ms: 'Batal', en: 'Cancel', id: 'Batal', ar: 'إلغاء' },
    gpsError: { ms: 'GPS tak tersedia atau permintaan ditolak', en: 'GPS unavailable or permission denied', id: 'GPS tidak tersedia atau ditolak', ar: 'الموقع غير متاح' },
  }
  const l = (o) => o[lang] || o.ms

  const useGps = () => {
    if (!navigator.geolocation) {
      setError(l(t.gpsError))
      return
    }
    setBusy(true); setError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          // Reverse geocode via Aladhan API-friendly method: submit lat/lng directly
          await save({ latitude, longitude, city: city || 'Auto', country: country || 'Auto', method })
        } catch (e) { setError(e.message); setBusy(false) }
      },
      () => { setError(l(t.gpsError)); setBusy(false) },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  const save = async (overrides = {}) => {
    setBusy(true); setError(null)
    try {
      const body = {
        city: overrides.city ?? city.trim(),
        country: overrides.country ?? country.trim(),
        method: overrides.method ?? method,
        latitude: overrides.latitude,
        longitude: overrides.longitude,
      }
      if (!body.city || !body.country) {
        setError(lang === 'ar' ? 'يرجى إدخال المدينة والدولة' : lang === 'en' ? 'Please enter city and country' : lang === 'id' ? 'Isi kota dan negara' : 'Sila isi bandar dan negara')
        setBusy(false); return
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
      setBusy(false)
    }
  }

  const applyPreset = (p) => {
    setCity(p.city)
    setCountry(p.country)
    setMethod(p.method)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 pointer-events-auto">
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
            {/* Quick presets */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1.5 block">
                {l(t.quickPick)}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {CITY_PRESETS.map(p => (
                  <button key={`${p.city}-${p.country}`} onClick={() => applyPreset(p)}
                    className={`text-left px-2.5 py-1.5 rounded-lg border-2 text-[11px] font-bold transition-all ${city === p.city && country === p.country ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-eq-cream bg-white hover:bg-emerald-50/50 text-emerald-800'}`}>
                    <div className="leading-tight">{p.city}</div>
                    <div className="text-[9px] opacity-60 leading-tight">{p.country}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-eq-cream pt-3 space-y-2">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">{l(t.city)}</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Kuala Lumpur"
                  className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">{l(t.country)}</label>
                <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Malaysia"
                  className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">{l(t.method)}</label>
                <select value={method} onChange={e => setMethod(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-sm bg-white focus:border-emerald-400 focus:outline-none">
                  {CALC_METHODS.map(m => <option key={m.id} value={m.id}>{l(m.name)}</option>)}
                </select>
              </div>
            </div>

            {/* GPS button */}
            <button type="button" onClick={useGps} disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-sm py-2 disabled:opacity-50">
              <Navigation className="w-4 h-4" /> {l(t.useGps)}
            </button>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs p-2">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-white border-t-2 border-emerald-100 p-4 flex gap-2 rounded-b-3xl">
            <button onClick={onClose} disabled={busy}
              className="flex-1 rounded-xl border-2 border-eq-cream text-emerald-800 font-bold text-sm py-2.5 hover:bg-eq-cream/30 disabled:opacity-50">
              {l(t.cancel)}
            </button>
            <button onClick={() => save()} disabled={busy || !city.trim() || !country.trim()}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-black text-sm py-2.5 shadow-lg disabled:opacity-50">
              {busy ? l(t.saving) : l(t.save)}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
