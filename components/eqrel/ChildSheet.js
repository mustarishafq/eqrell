'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, User, Trash2 } from 'lucide-react'
import { strings } from '@/lib/i18n/strings'

const AGE_BANDS = [
  { id: '3-4', label: '3–4 tahun', desc: 'Toddler' },
  { id: '5-6', label: '5–6 tahun', desc: 'Prasekolah' },
  { id: '7-9', label: '7–9 tahun', desc: 'Awal sekolah' },
  { id: '10-12', label: '10–12 tahun', desc: 'Pra-remaja' },
]

const AVATARS = [
  { id: 'boy-kopiah', emoji: '👦🏻', label: 'Boy 1', gender: 'male', bg: 'from-green-100 to-green-200' },
  { id: 'boy-2', emoji: '👦🏽', label: 'Boy 2', gender: 'male', bg: 'from-blue-100 to-blue-200' },
  { id: 'boy-3', emoji: '🧒🏻', label: 'Boy 3', gender: 'male', bg: 'from-teal-100 to-teal-200' },
  { id: 'girl-hijab', emoji: '👧🏻', label: 'Girl 1', gender: 'female', bg: 'from-purple-100 to-purple-200' },
  { id: 'girl-2', emoji: '👧🏽', label: 'Girl 2', gender: 'female', bg: 'from-pink-100 to-pink-200' },
  { id: 'girl-3', emoji: '🧕🏻', label: 'Girl 3', gender: 'female', bg: 'from-rose-100 to-rose-200' },
]

const LANGS = [
  { id: 'ms', label: 'Bahasa Malaysia' },
  { id: 'en', label: 'English' },
]

export function ChildSheet({ open, onClose, initial, onSave, onDelete }) {
  const isEdit = !!initial
  const [nickname, setNickname] = useState(initial?.nickname || '')
  const [ageBand, setAgeBand] = useState(initial?.ageBand || '5-6')
  const [avatarType, setAvatarType] = useState(initial?.avatarType || 'boy-kopiah')
  const [preferredLang, setPreferredLang] = useState(initial?.preferredLang || 'ms')

  useEffect(() => {
    if (open && initial) {
      setNickname(initial.nickname || '')
      setAgeBand(initial.ageBand || '5-6')
      setAvatarType(initial.avatarType || 'boy-kopiah')
      setPreferredLang(initial.preferredLang || 'ms')
    } else if (open && !initial) {
      setNickname('')
      setAgeBand('5-6')
      setAvatarType('boy-kopiah')
      setPreferredLang('ms')
    }
  }, [open, initial])

  const canSave = nickname.trim().length >= 2

  const handleSave = () => {
    if (!canSave) return
    const child = {
      id: initial?.id || `child-${Date.now()}`,
      nickname: nickname.trim(),
      ageBand,
      avatarType,
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
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-eq-ink/15 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2">
              <h2 className="text-eq-ink font-extrabold text-xl">
                {isEdit ? 'Kemaskini Anak' : 'Tambah Anak'}
              </h2>
              <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-eq-cream flex items-center justify-center">
                <X className="w-5 h-5 text-eq-ink/60" />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
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
                <p className="text-eq-ink/50 text-[11px] mt-1">Minimum 2 huruf</p>
              </div>

              {/* Age Band */}
              <div>
                <label className="text-eq-ink font-bold text-sm block mb-1.5">Kumpulan umur</label>
                <div className="grid grid-cols-2 gap-2">
                  {AGE_BANDS.map((band) => {
                    const isActive = ageBand === band.id
                    return (
                      <button
                        key={band.id}
                        onClick={() => setAgeBand(band.id)}
                        className={`text-left rounded-xl px-3 py-2.5 border-2 transition-all ${
                          isActive
                            ? 'bg-eq-green/10 border-eq-green shadow-eq-soft'
                            : 'bg-eq-cream/30 border-transparent hover:bg-eq-cream/60'
                        }`}
                      >
                        <div className={`font-bold text-sm ${isActive ? 'text-eq-green' : 'text-eq-ink'}`}>
                          {band.label}
                        </div>
                        <div className="text-eq-ink/50 text-[11px]">{band.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Avatar */}
              <div>
                <label className="text-eq-ink font-bold text-sm block mb-1.5">Avatar</label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map((av) => {
                    const isActive = avatarType === av.id
                    return (
                      <button
                        key={av.id}
                        onClick={() => setAvatarType(av.id)}
                        className={`aspect-square rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br ${av.bg} border-2 transition-all ${
                          isActive ? 'border-eq-green shadow-eq-glow scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        {av.emoji}
                        {isActive && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-eq-green rounded-full flex items-center justify-center ring-2 ring-white">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </div>
                        )}
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
                      ? 'bg-eq-green text-white shadow-eq-soft'
                      : 'bg-eq-ink/10 text-eq-ink/40 cursor-not-allowed'
                  }`}
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
