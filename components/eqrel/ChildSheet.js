'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Trash2, Calendar } from 'lucide-react'
import { BOY_AVATARS, GIRL_AVATARS, AVATAR_BY_ID, DEFAULT_BOY_ID, DEFAULT_GIRL_ID } from '@/lib/avatars'

const FAVOURITE_COLORS = [
  { id: 'green',  hex: '#00B894', label: 'Hijau' },
  { id: 'yellow', hex: '#FFB703', label: 'Kuning' },
  { id: 'orange', hex: '#FF8A00', label: 'Oren' },
  { id: 'coral',  hex: '#FF5D6E', label: 'Coral' },
  { id: 'blue',   hex: '#2D9CDB', label: 'Biru' },
  { id: 'purple', hex: '#9C7BD9', label: 'Ungu' },
  { id: 'pink',   hex: '#EC4899', label: 'Pink' },
  { id: 'fresh',  hex: '#4CAF50', label: 'Fresh' },
]

const LANGS = [
  { id: 'ms', label: 'Bahasa Malaysia' },
  { id: 'en', label: 'English' },
]

const GENDERS = [
  { id: 'male',   label: 'Lelaki' },
  { id: 'female', label: 'Perempuan' },
]

// -------- Age helpers (kept exported for backward compat with page.js) --------
export function calculateAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function ageBandFromAge(age) {
  if (age == null || age < 0) return '5-6'
  if (age <= 4) return '3-4'
  if (age <= 6) return '5-6'
  if (age <= 9) return '7-9'
  return '10-12'
}

const BAND_LABEL = {
  '3-4':   'Toddler (3–4)',
  '5-6':   'Prasekolah (5–6)',
  '7-9':   'Awal sekolah (7–9)',
  '10-12': 'Pra-remaja (10–12)',
}

export function ChildSheet({ open, onClose, initial, onSave, onDelete }) {
  const isEdit = !!initial
  const [nickname, setNickname] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('male')
  const [avatarId, setAvatarId] = useState(DEFAULT_BOY_ID)
  const [favColor, setFavColor] = useState('green')
  const [preferredLang, setPreferredLang] = useState('ms')

  useEffect(() => {
    if (open && initial) {
      setNickname(initial.nickname || '')
      setDob(initial.dob || '')
      const g = initial.gender || 'male'
      setGender(g)
      // migrate legacy — if avatarId missing, fall back to default per gender
      setAvatarId(initial.avatarId || (g === 'female' ? DEFAULT_GIRL_ID : DEFAULT_BOY_ID))
      setFavColor(initial.favColor || 'green')
      setPreferredLang(initial.preferredLang || 'ms')
    } else if (open && !initial) {
      setNickname('')
      setDob('')
      setGender('male')
      setAvatarId(DEFAULT_BOY_ID)
      setFavColor('green')
      setPreferredLang('ms')
    }
  }, [open, initial])

  // Keep avatar in sync when gender toggled (new-child mode only)
  useEffect(() => {
    if (!initial) {
      setAvatarId(gender === 'female' ? DEFAULT_GIRL_ID : DEFAULT_BOY_ID)
    }
  }, [gender, initial])

  const age = calculateAge(dob)
  const ageBand = ageBandFromAge(age)
  const canSave = nickname.trim().length >= 2 && dob

  const selectedAvatar = AVATAR_BY_ID[avatarId] || (gender === 'female' ? GIRL_AVATARS[0] : BOY_AVATARS[0])
  const selectedColor = FAVOURITE_COLORS.find(c => c.id === favColor) || FAVOURITE_COLORS[0]
  const avatarPool = gender === 'female' ? GIRL_AVATARS : BOY_AVATARS

  const handleSave = () => {
    if (!canSave) return
    const child = {
      id: initial?.id || `child-${Date.now()}`,
      nickname: nickname.trim(),
      dob,
      gender,
      ageBand,
      avatarId,
      favColor,
      preferredLang,
      todayCompleted: initial?.todayCompleted ?? 0,
      todayTotal: initial?.todayTotal ?? 0,
      lightLevel: initial?.lightLevel ?? 100,
      blackClouds: initial?.blackClouds ?? 0,
      buildingCount: initial?.buildingCount ?? 0,
    }
    onSave(child)
    onClose()
  }

  const today = new Date().toISOString().split('T')[0]
  const minDob = new Date(new Date().getFullYear() - 20, 0, 1).toISOString().split('T')[0]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-eq-ink/15 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 py-2">
              <h2 className="text-eq-ink font-extrabold text-xl">
                {isEdit ? 'Kemaskini Anak' : 'Tambah Anak'}
              </h2>
              <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-eq-cream flex items-center justify-center">
                <X className="w-5 h-5 text-eq-ink/60" />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* LIVE PREVIEW */}
              <div className="flex flex-col items-center pt-1">
                <div
                  className="relative rounded-full flex items-center justify-center shadow-eq-card overflow-hidden bg-gradient-to-br from-white to-amber-50"
                  style={{
                    width: 116,
                    height: 116,
                    border: `3px solid ${selectedColor.hex}`,
                    boxShadow: `0 6px 24px ${selectedColor.hex}44`,
                  }}
                >
                  <img
                    src={selectedAvatar.src}
                    alt={selectedAvatar.id}
                    className="w-full h-full object-contain"
                    style={{ objectPosition: 'center top' }}
                  />
                </div>
                {nickname && (
                  <div className="mt-2 font-extrabold text-lg" style={{ color: selectedColor.hex }}>
                    {nickname}
                  </div>
                )}
              </div>

              {/* Nickname */}
              <div>
                <label className="text-eq-ink font-bold text-sm block mb-1.5">Nama panggilan</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Contoh: Adam, Aisyah, Yusuf..."
                  className="w-full bg-eq-cream/50 border-2 border-transparent focus:border-eq-green focus:bg-white outline-none rounded-xl px-4 py-3 text-eq-ink placeholder:text-eq-ink/40 font-medium transition-all"
                  maxLength={20}
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="text-eq-ink font-bold text-sm block mb-1.5">Tarikh lahir</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    min={minDob}
                    max={today}
                    className="w-full bg-eq-cream/50 border-2 border-transparent focus:border-eq-green focus:bg-white outline-none rounded-xl px-4 py-3 text-eq-ink font-medium transition-all appearance-none"
                    style={{ colorScheme: 'light' }}
                  />
                  <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-eq-ink/40 pointer-events-none" />
                </div>
                {age !== null && age >= 0 && (
                  <div className="mt-2 bg-eq-green/10 border border-eq-green/20 rounded-xl px-3 py-2 flex items-center justify-between">
                    <div className="text-eq-ink text-sm">
                      <span className="font-bold">{age} tahun</span>
                      <span className="text-eq-ink/60"> · Kumpulan </span>
                      <span className="font-bold text-eq-green">{BAND_LABEL[ageBand]}</span>
                    </div>
                    <span className="text-lg">✨</span>
                  </div>
                )}
              </div>

              {/* Gender */}
              <div>
                <label className="text-eq-ink font-bold text-sm block mb-1.5">Jantina</label>
                <div className="grid grid-cols-2 gap-2">
                  {GENDERS.map((g) => {
                    const isActive = gender === g.id
                    return (
                      <button
                        key={g.id}
                        onClick={() => setGender(g.id)}
                        className={`rounded-xl px-3 py-2.5 border-2 transition-all font-bold text-sm ${
                          isActive
                            ? 'bg-eq-green/10 border-eq-green text-eq-green'
                            : 'bg-eq-cream/30 border-transparent text-eq-ink hover:bg-eq-cream/60'
                        }`}
                      >
                        {g.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Avatar Picker — 32 characters */}
              <div>
                <label className="text-eq-ink font-bold text-sm block mb-1.5">
                  Pilih karakter ({avatarPool.length})
                </label>
                <p className="text-eq-ink/50 text-[11px] mb-2">
                  Pilih yang paling menyerupai anak anda 💛
                </p>
                <div className="grid grid-cols-4 gap-2 max-h-[280px] overflow-y-auto p-1 -m-1">
                  {avatarPool.map((av) => {
                    const isActive = avatarId === av.id
                    return (
                      <button
                        key={av.id}
                        onClick={() => setAvatarId(av.id)}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-gradient-to-br from-white to-amber-50 ${
                          isActive
                            ? 'border-eq-green scale-105 shadow-lg'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={av.src}
                          alt={av.id}
                          className="w-full h-full object-contain"
                          style={{ objectPosition: 'center top' }}
                          loading="lazy"
                        />
                        {isActive && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-eq-green rounded-full flex items-center justify-center ring-2 ring-white">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Favourite Color */}
              <div>
                <label className="text-eq-ink font-bold text-sm block mb-1.5">Warna kegemaran ✨</label>
                <p className="text-eq-ink/50 text-[11px] mb-2">Warna dunia & progress ring anak</p>
                <div className="grid grid-cols-8 gap-2">
                  {FAVOURITE_COLORS.map((c) => {
                    const isActive = favColor === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setFavColor(c.id)}
                        aria-label={c.label}
                        className={`aspect-square rounded-full transition-all ${isActive ? 'ring-4 ring-white scale-110 shadow-eq-card' : 'opacity-60 hover:opacity-100'}`}
                        style={{ background: c.hex, boxShadow: isActive ? `0 0 0 3px ${c.hex}, 0 4px 12px ${c.hex}66` : undefined }}
                      >
                        {isActive && <Check className="w-4 h-4 text-white mx-auto" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="text-eq-ink font-bold text-sm block mb-1.5">Bahasa pilihan</label>
                <div className="grid grid-cols-2 gap-2">
                  {LANGS.map((lang) => {
                    const isActive = preferredLang === lang.id
                    return (
                      <button
                        key={lang.id}
                        onClick={() => setPreferredLang(lang.id)}
                        className={`rounded-xl px-3 py-2.5 border-2 transition-all font-bold text-sm ${
                          isActive
                            ? 'bg-eq-green/10 border-eq-green text-eq-green'
                            : 'bg-eq-cream/30 border-transparent text-eq-ink hover:bg-eq-cream/60'
                        }`}
                      >
                        {lang.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className={`w-full font-extrabold py-3.5 rounded-2xl text-base active:scale-[0.99] transition-all ${
                    canSave
                      ? 'text-white shadow-eq-soft'
                      : 'bg-eq-ink/10 text-eq-ink/40 cursor-not-allowed'
                  }`}
                  style={canSave ? { background: selectedColor.hex } : undefined}
                >
                  {isEdit ? 'Simpan Perubahan' : 'Tambah Anak'}
                </button>
                {isEdit && onDelete && (
                  <button
                    onClick={() => {
                      if (confirm(`Padam ${nickname}? Progres akan hilang.`)) {
                        onDelete(initial.id)
                        onClose()
                      }
                    }}
                    className="w-full text-eq-coral font-bold py-2.5 text-sm hover:bg-eq-coral/5 rounded-xl active:scale-[0.99] flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Padam anak ini
                  </button>
                )}
              </div>

              <div className="h-4" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
