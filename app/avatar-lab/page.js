'use client'

/**
 * Avatar Library — Cohort A pre-rendered set
 * View: /avatar-lab
 */

import { useState } from 'react'
import { BOY_AVATARS, GIRL_AVATARS } from '@/lib/avatars'

export default function AvatarLabPage() {
  const [selected, setSelected] = useState(null)

  const Card = ({ av }) => {
    const active = selected === av.id
    return (
      <button
        onClick={() => setSelected(av.id)}
        className={`relative rounded-2xl overflow-hidden border-2 transition-all bg-gradient-to-br from-amber-50 to-white ${
          active ? 'border-emerald-500 scale-105 shadow-lg' : 'border-transparent hover:scale-105'
        }`}
      >
        <img src={av.src} alt={av.id} className="w-full h-full object-contain" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[11px] font-bold text-center pt-4 pb-1">
          {av.id}
        </div>
        {active && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-white text-white text-xs font-bold">
            ✓
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-emerald-900">Avatar Library — Cohort A</h1>
            <p className="text-sm text-emerald-800/60">32 characters (16 boys + 16 girls). Klik untuk pilih.</p>
          </div>
          {selected && (
            <div className="bg-white rounded-2xl px-4 py-2 shadow-md flex items-center gap-2">
              <span className="text-xs text-emerald-800/60">Selected:</span>
              <span className="font-bold text-emerald-700">{selected}</span>
            </div>
          )}
        </div>

        {/* BOYS */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">👦</span>
            <h2 className="text-lg font-extrabold text-emerald-900">Lelaki ({BOY_AVATARS.length})</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {BOY_AVATARS.map((av) => (
              <Card key={av.id} av={av} />
            ))}
          </div>
        </section>

        {/* GIRLS */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">👧</span>
            <h2 className="text-lg font-extrabold text-emerald-900">Perempuan ({GIRL_AVATARS.length})</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {GIRL_AVATARS.map((av) => (
              <Card key={av.id} av={av} />
            ))}
          </div>
        </section>

        {/* Preview big */}
        {selected && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-3xl shadow-2xl p-4 flex items-center gap-4 border-2 border-emerald-500">
            <img
              src={[...BOY_AVATARS, ...GIRL_AVATARS].find((a) => a.id === selected)?.src}
              alt={selected}
              className="w-24 h-24 object-contain"
            />
            <div>
              <div className="text-xs text-emerald-800/60">Avatar ID</div>
              <div className="text-2xl font-extrabold text-emerald-700">{selected}</div>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-emerald-600 hover:underline mt-1"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
