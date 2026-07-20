'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Tv, ArrowRight } from 'lucide-react'
import { BRAND } from '@/lib/brand'

export default function TVPairPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!/^[0-9]{6}$/.test(code)) { setErr('Sila masukkan 6 digit kod'); return }
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/tv-pair/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const d = await r.json()
      if (r.ok && d.ok) {
        // Redirect to full TV display
        router.push('/display?tv=1')
      } else {
        setErr(d.error || 'Kod tidak sah atau tamat tempoh')
      }
    } catch (e) {
      setErr('Ralat sambungan')
    }
    setLoading(false)
  }

  const handleDigit = (d) => {
    if (code.length < 6) setCode(c => c + d)
  }
  const del = () => setCode(c => c.slice(0, -1))

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white">
      <div className="max-w-md w-full">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={BRAND.mascot.default} alt="EQ" className="w-16 h-16 drop-shadow-2xl" />
          <div>
            <div className="text-3xl font-black tracking-tight">{BRAND.name}</div>
            <div className="text-xs uppercase tracking-widest font-bold" style={{ color: '#FFB703' }}>Family Display Pairing</div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/8 backdrop-blur border border-white/15 p-6 shadow-2xl">
          <div className="text-center mb-5">
            <Tv className="w-10 h-10 mx-auto mb-2" style={{ color: '#FFB703' }} />
            <h1 className="text-xl font-black">Masukkan Kod TV</h1>
            <p className="text-sm text-white/70 mt-1">Buka Setup di phone → Cast to TV → Salin kod 6-digit</p>
          </div>

          {/* Code display */}
          <div className="flex justify-center gap-2 mb-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}
                className={`w-10 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black tabular-nums transition-all ${code[i] ? 'bg-white/20 border-white/60' : 'bg-white/5 border-white/20'}`}
                style={code[i] ? { color: '#FFB703' } : {}}>
                {code[i] || ''}
              </div>
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button key={d} onClick={() => handleDigit(d)}
                className="h-14 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xl font-black active:scale-95">
                {d}
              </button>
            ))}
            <button onClick={del}
              className="h-14 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-black active:scale-95">⌫</button>
            <button onClick={() => handleDigit('0')}
              className="h-14 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xl font-black active:scale-95">0</button>
            <button onClick={submit} disabled={loading || code.length !== 6}
              className="h-14 rounded-xl text-slate-900 text-sm font-black active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1"
              style={{ backgroundColor: '#FFB703' }}>
              {loading ? '...' : <><ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>

          {err && (
            <div className="rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-sm p-2 text-center">
              {err}
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-white/50">
          Kod tamat tempoh 15 minit selepas dijana
        </div>
      </div>
    </div>
  )
}
