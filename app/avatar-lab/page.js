'use client'

/**
 * Avatar preview lab — internal design review page.
 * URL: /avatar-lab
 * Not linked in production nav. Used to review all avatar variants at a glance.
 */

import { useState } from 'react'
import { Avatar, AVATAR_META, FACE_SHAPES } from '@/components/eqrel/Avatar'

const SKIN_TONES = [
  { id: 'light',  label: 'Cerah',     hex: '#F5D5B5' },
  { id: 'medium', label: 'Sederhana', hex: '#E4B48C' },
  { id: 'tan',    label: 'Sawo',      hex: '#C48A5D' },
  { id: 'brown',  label: 'Gelap',     hex: '#8B5A38' },
]

const EYE_STYLES = [
  { id: 'normal',  label: 'Normal' },
  { id: 'sparkly', label: 'Sparkly' },
  { id: 'sleepy',  label: 'Sleepy' },
]

const MOUTH_STYLES = [
  { id: 'smile',    label: 'Senyum' },
  { id: 'bigSmile', label: 'Ketawa' },
  { id: 'small',    label: 'Kecil' },
]

const AVATAR_KEYS = Object.keys(AVATAR_META)

export default function AvatarLabPage() {
  const [type, setType] = useState('boy-kopiah-white')
  const [skinTone, setSkinTone] = useState('medium')
  const [faceShape, setFaceShape] = useState('normal')
  const [eyeStyle, setEyeStyle] = useState('sparkly')
  const [mouthStyle, setMouthStyle] = useState('smile')
  const [freckles, setFreckles] = useState(false)
  const [glasses, setGlasses] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-extrabold text-eq-ink mb-1">Avatar Lab 🎨</h1>
        <p className="text-sm text-eq-ink/60 mb-6">Chunky Cartoon v2 — preview lab (bukan production route)</p>

        {/* Big preview */}
        <div className="bg-white rounded-3xl shadow-eq-card p-6 mb-6 flex items-center justify-center">
          <Avatar
            type={type}
            skinTone={skinTone}
            faceShape={faceShape}
            eyeStyle={eyeStyle}
            mouthStyle={mouthStyle}
            freckles={freckles}
            hasGlasses={glasses}
            size={260}
            ringColor="#00B894"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Controls */}
          <div className="bg-white rounded-2xl p-4 shadow-eq-card space-y-4">
            <ControlGroup label="Bentuk muka">
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(FACE_SHAPES).map(([id, s]) => (
                  <button key={id} onClick={() => setFaceShape(id)}
                    className={`rounded-xl p-2 border-2 text-xs font-bold ${faceShape===id?'border-eq-green bg-eq-green/5 text-eq-green':'border-transparent bg-eq-cream/50 text-eq-ink'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </ControlGroup>

            <ControlGroup label="Warna kulit">
              <div className="grid grid-cols-4 gap-2">
                {SKIN_TONES.map((s) => (
                  <button key={s.id} onClick={() => setSkinTone(s.id)}
                    className={`rounded-xl p-2 border-2 flex flex-col items-center gap-1 ${skinTone===s.id?'border-eq-green bg-eq-green/5':'border-transparent bg-eq-cream/50'}`}>
                    <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{background: s.hex}} />
                    <div className="text-[10px] font-bold text-eq-ink">{s.label}</div>
                  </button>
                ))}
              </div>
            </ControlGroup>

            <ControlGroup label="Headwear / gaya">
              <div className="grid grid-cols-3 gap-2">
                {AVATAR_KEYS.map((k) => (
                  <button key={k} onClick={() => setType(k)}
                    className={`rounded-xl p-2 border-2 flex flex-col items-center gap-1 ${type===k?'border-eq-green bg-eq-green/5':'border-transparent bg-eq-cream/50'}`}>
                    <Avatar type={k} skinTone={skinTone} faceShape={faceShape}
                            eyeStyle="normal" mouthStyle="smile" size={44} />
                    <div className="text-[10px] font-bold text-eq-ink text-center leading-tight">{AVATAR_META[k].label}</div>
                  </button>
                ))}
              </div>
            </ControlGroup>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-eq-card space-y-4">
            <ControlGroup label="Gaya mata">
              <div className="grid grid-cols-3 gap-2">
                {EYE_STYLES.map((e) => (
                  <button key={e.id} onClick={() => setEyeStyle(e.id)}
                    className={`rounded-xl p-2 border-2 text-xs font-bold ${eyeStyle===e.id?'border-eq-green bg-eq-green/5 text-eq-green':'border-transparent bg-eq-cream/50 text-eq-ink'}`}>
                    {e.label}
                  </button>
                ))}
              </div>
            </ControlGroup>

            <ControlGroup label="Gaya mulut">
              <div className="grid grid-cols-3 gap-2">
                {MOUTH_STYLES.map((m) => (
                  <button key={m.id} onClick={() => setMouthStyle(m.id)}
                    className={`rounded-xl p-2 border-2 text-xs font-bold ${mouthStyle===m.id?'border-eq-green bg-eq-green/5 text-eq-green':'border-transparent bg-eq-cream/50 text-eq-ink'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </ControlGroup>

            <ControlGroup label="Aksesori">
              <div className="grid grid-cols-2 gap-2">
                <Toggle label="👓 Cermin mata" active={glasses} onClick={() => setGlasses(!glasses)} />
                <Toggle label="✨ Freckles" active={freckles} onClick={() => setFreckles(!freckles)} />
              </div>
            </ControlGroup>
          </div>
        </div>

        {/* Comparison strip - all face shapes with current settings */}
        <div className="bg-white rounded-2xl p-4 shadow-eq-card mt-6">
          <h3 className="text-sm font-extrabold text-eq-ink mb-3">Perbandingan bentuk muka (setting sekarang)</h3>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(FACE_SHAPES).map(([id, s]) => (
              <div key={id} className="flex flex-col items-center gap-1">
                <Avatar type={type} skinTone={skinTone} faceShape={id}
                        eyeStyle={eyeStyle} mouthStyle={mouthStyle}
                        freckles={freckles} hasGlasses={glasses} size={110} />
                <div className="text-xs font-bold text-eq-ink">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Full gallery — every headwear */}
        <div className="bg-white rounded-2xl p-4 shadow-eq-card mt-6">
          <h3 className="text-sm font-extrabold text-eq-ink mb-3">Semua headwear ({AVATAR_KEYS.length} varian)</h3>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            {AVATAR_KEYS.map((k) => (
              <div key={k} className="flex flex-col items-center gap-1">
                <Avatar type={k} skinTone={skinTone} faceShape={faceShape}
                        eyeStyle="sparkly" mouthStyle="smile" size={90} />
                <div className="text-[11px] font-bold text-eq-ink text-center">{AVATAR_META[k].label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ControlGroup({ label, children }) {
  return (
    <div>
      <div className="text-xs font-bold text-eq-ink mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function Toggle({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`rounded-xl px-3 py-2 border-2 text-xs font-bold flex items-center justify-between ${active?'border-eq-green bg-eq-green/5 text-eq-green':'border-transparent bg-eq-cream/50 text-eq-ink'}`}>
      <span>{label}</span>
      <span className={`w-8 h-4 rounded-full relative ${active?'bg-eq-green':'bg-eq-ink/20'}`}>
        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${active?'left-4':'left-0.5'}`} />
      </span>
    </button>
  )
}
