'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LogIn, Copy, Check } from 'lucide-react'
import { OnboardingScaffold } from '@/components/eqrel/OnboardingScaffold'

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
    <OnboardingScaffold showMascot={false} showQuote={false}>
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
      </div>
    </OnboardingScaffold>
  )

  return (
    <OnboardingScaffold showMascot={true} showQuote={true} mascotSize={92}>
      <div className="bg-white rounded-3xl shadow-xl p-5 border-2 border-emerald-100">
        <h2 className="text-lg font-extrabold text-emerald-900 text-center leading-tight">
          Selamat datang, {me.name.split(' ')[0]}! 🌙
        </h2>
        <p className="text-emerald-800/60 text-xs text-center mt-1 mb-4">
          Setup keluarga anda untuk mula
        </p>

        {/* Role picker */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block mb-1.5">
            Anda ialah
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'ibu',  emoji: '👩', label: 'Ibu',  hint: 'Mama' },
              { id: 'bapa', emoji: '👨', label: 'Bapa', hint: 'Papa' },
            ].map(r => (
              <button key={r.id}
                onClick={() => setRole(r.id)}
                className={`rounded-2xl py-2.5 px-3 border-2 transition-all ${
                  role === r.id
                    ? 'border-emerald-500 bg-emerald-50 scale-[1.02] shadow-sm'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}>
                <div className="text-2xl leading-none mb-0.5">{r.emoji}</div>
                <div className={`font-extrabold text-sm ${role === r.id ? 'text-emerald-700' : 'text-gray-700'}`}>{r.label}</div>
                <div className="text-[10px] opacity-60 leading-none">{r.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Mode picker */}
        {mode === 'choose' && (
          <div className="space-y-2">
            <button onClick={() => setMode('create')}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white rounded-2xl py-3 font-extrabold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.99]">
              <Plus className="w-4 h-4" strokeWidth={3} /> Cipta keluarga baru
            </button>
            <button onClick={() => setMode('join')}
              className="w-full bg-white border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-2xl py-3 font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.99]">
              <LogIn className="w-4 h-4" strokeWidth={3} /> Sertai keluarga sedia ada
            </button>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
              <p className="text-amber-900 text-[11px] leading-relaxed">
                💡 <b>Cipta</b> jika anda parent pertama. <b>Sertai</b> jika pasangan anda dah cipta akaun.
              </p>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-lg">✨</span>
              <p className="text-emerald-900 text-[11px] leading-relaxed">
                Kod keluarga 6-huruf akan dijana. Kongsi dengan pasangan supaya boleh sertai bersama.
              </p>
            </div>
            <button onClick={submit} disabled={busy}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white rounded-2xl py-3 font-extrabold text-sm shadow-md disabled:opacity-50 active:scale-[0.99]">
              {busy ? 'Sedang cipta…' : `Cipta keluarga saya (${role === 'ibu' ? 'Ibu' : 'Bapa'})`}
            </button>
            <button onClick={() => setMode('choose')} className="w-full text-emerald-700 text-xs py-1 font-semibold">
              ← Balik
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block mb-1">Kod keluarga</label>
              <input
                type="text"
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                placeholder="ABCD23"
                maxLength={6}
                autoCapitalize="characters"
                className="w-full bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:bg-white outline-none rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-[0.3em] text-emerald-900 uppercase"
              />
            </div>
            <button onClick={submit} disabled={busy || familyCode.length !== 6}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl py-3 font-extrabold text-sm shadow-md disabled:opacity-50 active:scale-[0.99]">
              {busy ? 'Menyertai…' : `Sertai keluarga sebagai ${role === 'ibu' ? 'Ibu' : 'Bapa'}`}
            </button>
            <button onClick={() => setMode('choose')} className="w-full text-emerald-700 text-xs py-1 font-semibold">
              ← Balik
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-2.5 text-red-700 text-xs text-center font-semibold">
            {error}
          </div>
        )}
      </div>
    </OnboardingScaffold>
  )
}
