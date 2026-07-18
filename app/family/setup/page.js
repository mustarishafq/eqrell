'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, Plus, LogIn } from 'lucide-react'

export default function FamilySetupPage() {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [mode, setMode] = useState('choose')  // choose | create | join
  const [role, setRole] = useState('ibu')
  const [familyCode, setFamilyCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.replace('/login'); return }
        setMe(d.user)
        if (d.user && d.family && !d.needsFamilySetup) router.replace('/')
      })
      .catch(() => router.replace('/login'))
  }, [router])

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const body = { role }
      if (mode === 'join') body.familyCode = familyCode.trim().toUpperCase()
      const res = await fetch('/api/family/create-or-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal')
      router.replace('/')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!me) return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl p-6 max-w-md w-full"
      >
        <div className="text-center mb-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto mb-3 flex items-center justify-center">
            <Users className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-emerald-900">Selamat datang, {me.name.split(' ')[0]}!</h1>
          <p className="text-emerald-800/60 text-sm mt-1">Setup keluarga anda untuk mula</p>
        </div>

        {/* Role picker */}
        <div className="mb-4">
          <label className="text-sm font-bold text-emerald-900 block mb-2">Anda ialah:</label>
          <div className="grid grid-cols-2 gap-2">
            {[{id: 'ibu', label: '👩 Ibu', hint: 'Mama'}, {id: 'bapa', label: '👨 Bapa', hint: 'Papa'}].map(r => (
              <button key={r.id}
                onClick={() => setRole(r.id)}
                className={`rounded-2xl py-3 px-4 border-2 font-bold transition-all ${
                  role === r.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700 scale-[1.02]'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                <div>{r.label}</div>
                <div className="text-[11px] opacity-70 font-normal mt-0.5">{r.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Mode picker */}
        {mode === 'choose' && (
          <div className="space-y-2">
            <button onClick={() => setMode('create')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 shadow-lg">
              <Plus className="w-5 h-5" /> Cipta keluarga baru
            </button>
            <button onClick={() => setMode('join')}
              className="w-full bg-white border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2">
              <LogIn className="w-5 h-5" /> Sertai keluarga sedia ada
            </button>
            <p className="text-[11px] text-center text-emerald-800/50 mt-2">
              Cipta keluarga jika anda parent pertama. Sertai jika pasangan anda dah cipta akaun.
            </p>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              ✨ Kod keluarga akan dijana selepas ini. Kongsi kod dengan pasangan supaya boleh sertai.
            </div>
            <button onClick={submit} disabled={busy}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-3.5 font-bold shadow-lg disabled:opacity-50">
              {busy ? 'Sedang cipta…' : 'Cipta keluarga saya'}
            </button>
            <button onClick={() => setMode('choose')} className="w-full text-emerald-700 text-sm py-2 font-semibold">
              ← Balik
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-bold text-emerald-900 block mb-1.5">Kod keluarga</label>
              <input
                type="text"
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                placeholder="Contoh: ABCD23"
                maxLength={6}
                className="w-full bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 outline-none rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-emerald-900 uppercase"
              />
            </div>
            <button onClick={submit} disabled={busy || familyCode.length !== 6}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-3.5 font-bold shadow-lg disabled:opacity-50">
              {busy ? 'Menyertai…' : 'Sertai keluarga'}
            </button>
            <button onClick={() => setMode('choose')} className="w-full text-emerald-700 text-sm py-2 font-semibold">
              ← Balik
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm text-center">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  )
}
