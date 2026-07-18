'use client'

/**
 * EQrel Avatar v3 — Omar & Hana inspired style
 * --------------------------------------------
 * Design principles:
 *  - Round head (near-circle, not oval)
 *  - Big anime-dot eyes with clear white highlight
 *  - No nose (Omar & Hana signature)
 *  - Obvious rosy cheek blush
 *  - Small curved mouth
 *  - Clean thin outlines (not too heavy)
 *  - Hair snugs the head shape closely
 *
 * Props:
 *   type, skinTone, faceShape, eyeStyle, mouthStyle,
 *   freckles, hasGlasses, size, showBg, bgClass, ringColor
 */

export const SKIN_HEX = {
  light:  '#F7D6B4',
  medium: '#E6B48A',
  tan:    '#C48A5D',
  brown:  '#8B5A38',
}

export const SKIN_SHADOW = {
  light:  '#E5B892',
  medium: '#C6926A',
  tan:    '#A56E42',
  brown:  '#6B4028',
}

export const HAIR_HEX = {
  light:  '#2B1608',
  medium: '#1E0F04',
  tan:    '#180B03',
  brown:  '#0E0602',
}

const STROKE = '#1B0F08'
const STROKE_W = 1.2
const STROKE_W_THIN = 0.9

export const AVATAR_META = {
  // Male — hair variants
  'boy-hair-short':   { gender: 'male',   label: 'Rambut pendek',  bg: 'from-green-100 to-green-200' },
  'boy-hair-spiky':   { gender: 'male',   label: 'Rambut cacak',   bg: 'from-lime-100 to-lime-200' },
  'boy-hair-curly':   { gender: 'male',   label: 'Rambut kerinting',bg: 'from-emerald-100 to-emerald-200' },
  'boy-kopiah-white': { gender: 'male',   label: 'Kopiah putih',   bg: 'from-blue-100 to-blue-200' },
  'boy-kopiah-black': { gender: 'male',   label: 'Kopiah hitam',   bg: 'from-slate-100 to-slate-200' },
  'boy-songkok':      { gender: 'male',   label: 'Songkok',        bg: 'from-teal-100 to-teal-200' },
  'boy-serban':       { gender: 'male',   label: 'Serban',         bg: 'from-amber-100 to-amber-200' },
  'boy-cap':          { gender: 'male',   label: 'Topi',           bg: 'from-cyan-100 to-cyan-200' },
  // Female — hair variants
  'girl-hair-long':     { gender: 'female', label: 'Rambut panjang', bg: 'from-pink-100 to-pink-200' },
  'girl-hair-ponytail': { gender: 'female', label: 'Ekor kuda',      bg: 'from-rose-100 to-rose-200' },
  'girl-hair-bun':      { gender: 'female', label: 'Sanggul',        bg: 'from-fuchsia-100 to-fuchsia-200' },
  'girl-hijab-pink':    { gender: 'female', label: 'Hijab pink',   bg: 'from-pink-100 to-rose-200',    hijab: '#F48FB1', hijabDark: '#D97AA0' },
  'girl-hijab-purple':  { gender: 'female', label: 'Hijab ungu',   bg: 'from-purple-100 to-purple-200',hijab: '#B197FC', hijabDark: '#8E76E0' },
  'girl-hijab-teal':    { gender: 'female', label: 'Hijab teal',   bg: 'from-teal-100 to-emerald-200', hijab: '#4DB6AC', hijabDark: '#399389' },
  'girl-hijab-coral':   { gender: 'female', label: 'Hijab coral',  bg: 'from-orange-100 to-red-200',   hijab: '#FF8A80', hijabDark: '#E36961' },
  'girl-hijab-black':   { gender: 'female', label: 'Hijab hitam',  bg: 'from-slate-100 to-gray-300',   hijab: '#3E3E4F', hijabDark: '#252533' },
}

// Legacy alias map (for migrating older stored values)
export const LEGACY_TYPE_MAP = {
  'boy-hair':    'boy-hair-short',
  'boy-kopiah':  'boy-kopiah-white',
  'girl-hair':   'girl-hair-long',
  'girl-hijab':  'girl-hijab-purple',
}

// Face shapes — all now closer to circle (Omar & Hana style)
export const FACE_SHAPES = {
  normal: { rx: 25, ry: 26, cy: 54, cheekR: 4.0, label: 'Standard' },
  chubby: { rx: 28, ry: 26, cy: 55, cheekR: 5.2, label: 'Chubby' },
  slim:   { rx: 22, ry: 28, cy: 54, cheekR: 3.4, label: 'Kurus' },
  oval:   { rx: 23, ry: 29, cy: 54, cheekR: 3.6, label: 'Oval' },
}

// -------------------- FACE (no nose, big cheeks, round) --------------------
const Face = ({ skin, skinShadow, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const cheekY = s.cy + 8
  const earY = s.cy + 3
  const earRy = 4.5
  const earOffset = s.rx + 1

  return (
    <g>
      {/* neck */}
      <path
        d={`M 45 ${s.cy + s.ry - 3} L 45 90 L 55 90 L 55 ${s.cy + s.ry - 3} Z`}
        fill={skin} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round"
      />
      {/* neck shadow */}
      <path
        d={`M 45 ${s.cy + s.ry - 3} Q 50 ${s.cy + s.ry + 0.5} 55 ${s.cy + s.ry - 3}`}
        fill={skinShadow} opacity="0.55" stroke="none"
      />
      {/* ears (small, tucked in) */}
      <ellipse cx={50 - earOffset} cy={earY} rx="3" ry={earRy} fill={skin}
               stroke={STROKE} strokeWidth={STROKE_W} />
      <ellipse cx={50 + earOffset} cy={earY} rx="3" ry={earRy} fill={skin}
               stroke={STROKE} strokeWidth={STROKE_W} />
      <ellipse cx={50 - earOffset} cy={earY + 0.3} rx="1.1" ry="2" fill={skinShadow} opacity="0.55" />
      <ellipse cx={50 + earOffset} cy={earY + 0.3} rx="1.1" ry="2" fill={skinShadow} opacity="0.55" />

      {/* face — round */}
      <ellipse cx="50" cy={s.cy} rx={s.rx} ry={s.ry} fill={skin}
               stroke={STROKE} strokeWidth={STROKE_W} />

      {/* very subtle forehead shine */}
      <ellipse cx="42" cy={s.cy - s.ry * 0.55} rx="6" ry="3" fill="#FFFFFF" opacity="0.18" />

      {/* soft chin shadow */}
      <ellipse cx="50" cy={s.cy + s.ry - 6} rx={s.rx - 6} ry="2.5" fill={skinShadow} opacity="0.28" />

      {/* CHUBBY cheeks — clearly visible rosy blush */}
      <circle cx={50 - s.rx * 0.5} cy={cheekY} r={s.cheekR} fill="#F79999" opacity="0.65" />
      <circle cx={50 + s.rx * 0.5} cy={cheekY} r={s.cheekR} fill="#F79999" opacity="0.65" />
      {/* cheek highlight dot */}
      <circle cx={50 - s.rx * 0.5 - 1} cy={cheekY - 1} r="0.8" fill="#FFFFFF" opacity="0.5" />
      <circle cx={50 + s.rx * 0.5 - 1} cy={cheekY - 1} r="0.8" fill="#FFFFFF" opacity="0.5" />
    </g>
  )
}

// -------------------- EYES (BIG DOT + HIGHLIGHT — Omar Hana style) --------------------
const Eyes = ({ style, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy + 1
  const lx = 42, rx = 58

  if (style === 'sleepy') {
    return (
      <g stroke={STROKE} strokeWidth="1.8" fill="none" strokeLinecap="round">
        <path d={`M ${lx - 3} ${y} Q ${lx} ${y - 1.5} ${lx + 3} ${y}`} />
        <path d={`M ${rx - 3} ${y} Q ${rx} ${y - 1.5} ${rx + 3} ${y}`} />
      </g>
    )
  }
  if (style === 'sparkly') {
    // Extra-large sparkly version
    return (
      <g>
        {[lx, rx].map((x) => (
          <g key={x}>
            <circle cx={x} cy={y} r="3.8" fill={STROKE} />
            <circle cx={x + 1.2} cy={y - 1.4} r="1.4" fill="#FFFFFF" />
            <circle cx={x - 0.9} cy={y + 1.4} r="0.65" fill="#FFFFFF" />
          </g>
        ))}
      </g>
    )
  }
  // 'normal' — big anime dot (this is now the Omar & Hana default look)
  return (
    <g>
      {[lx, rx].map((x) => (
        <g key={x}>
          <circle cx={x} cy={y} r="3.2" fill={STROKE} />
          <circle cx={x + 1} cy={y - 1.2} r="1.15" fill="#FFFFFF" />
        </g>
      ))}
    </g>
  )
}

// Eyebrows (simple curved arcs above eyes)
const Eyebrows = ({ shape, color }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy - 6
  return (
    <g stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <path d={`M 38.5 ${y + 0.5} Q 42 ${y - 1.5} 45.5 ${y + 0.5}`} />
      <path d={`M 54.5 ${y + 0.5} Q 58 ${y - 1.5} 61.5 ${y + 0.5}`} />
    </g>
  )
}

// -------------------- MOUTH (simple, curved) --------------------
const Mouth = ({ style, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy + 13

  if (style === 'bigSmile') {
    return (
      <g>
        <path d={`M 44 ${y - 1} Q 50 ${y + 5} 56 ${y - 1} Q 50 ${y + 3.5} 44 ${y - 1} Z`}
              fill="#B8322A" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
        <path d={`M 46 ${y + 0.2} Q 50 ${y + 2.5} 54 ${y + 0.2}`}
              fill="#FFFFFF" stroke="none" />
      </g>
    )
  }
  if (style === 'small') {
    return (
      <path d={`M 47 ${y + 0.5} Q 50 ${y + 2.5} 53 ${y + 0.5}`}
            stroke={STROKE} strokeWidth="1.7" fill="none" strokeLinecap="round" />
    )
  }
  // smile default — cute curved
  return (
    <path d={`M 45 ${y - 0.5} Q 50 ${y + 3} 55 ${y - 0.5}`}
          stroke={STROKE} strokeWidth="1.9" fill="none" strokeLinecap="round" />
  )
}

const Freckles = ({ shape, skinShadow }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy + 4
  return (
    <g fill={skinShadow} opacity="0.75">
      <circle cx={44} cy={y} r="0.65" />
      <circle cx={47} cy={y + 1.5} r="0.55" />
      <circle cx={50} cy={y - 0.5} r="0.6" />
      <circle cx={53} cy={y + 1.2} r="0.6" />
      <circle cx={56} cy={y} r="0.65" />
    </g>
  )
}

const Glasses = ({ shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy + 1
  return (
    <g fill="none" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round">
      <circle cx={42} cy={y} r="5.6" />
      <circle cx={58} cy={y} r="5.6" />
      <line x1={47.6} y1={y} x2={52.4} y2={y} />
      <line x1={36.4} y1={y - 0.5} x2={33} y2={y - 1.5} strokeWidth="1.3" />
      <line x1={63.6} y1={y - 0.5} x2={67} y2={y - 1.5} strokeWidth="1.3" />
    </g>
  )
}

// ====================== HEADWEAR ======================

// -- Boy hair variants --
// Short (Omar-esque short combed hair)
const BoyHairShort = ({ hair, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry
  const lx = 50 - s.rx, rx = 50 + s.rx
  return (
    <g>
      <path
        d={`M ${lx - 1} ${topY + 14}
            C ${lx - 1} ${topY - 3}, ${rx + 1} ${topY - 3}, ${rx + 1} ${topY + 14}
            C ${rx - 5} ${topY + 8}, ${50 + 12} ${topY + 3}, 50 ${topY + 5}
            C ${50 - 12} ${topY + 3}, ${lx + 5} ${topY + 8}, ${lx - 1} ${topY + 14} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round"
      />
      {/* subtle strand */}
      <path d={`M ${50 - 8} ${topY + 6} Q 50 ${topY + 3} ${50 + 8} ${topY + 6}`}
            fill="none" stroke="#000" opacity="0.25" strokeWidth="0.6" />
    </g>
  )
}

// Spiky hair
const BoyHairSpiky = ({ hair, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry
  const lx = 50 - s.rx, rx = 50 + s.rx
  return (
    <g>
      {/* Base cap */}
      <path
        d={`M ${lx - 1} ${topY + 14}
            C ${lx - 1} ${topY + 2}, ${rx + 1} ${topY + 2}, ${rx + 1} ${topY + 14}
            C ${rx - 5} ${topY + 10}, ${50 + 10} ${topY + 6}, 50 ${topY + 7}
            C ${50 - 10} ${topY + 6}, ${lx + 5} ${topY + 10}, ${lx - 1} ${topY + 14} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round"
      />
      {/* Spikes */}
      <path
        d={`M ${lx + 4} ${topY + 4} L ${lx + 7} ${topY - 5} L ${lx + 10} ${topY + 3} Z
            M ${lx + 12} ${topY + 3} L ${lx + 16} ${topY - 8} L ${lx + 20} ${topY + 2} Z
            M ${50 - 3} ${topY + 3} L 50 ${topY - 10} L ${50 + 4} ${topY + 3} Z
            M ${rx - 20} ${topY + 3} L ${rx - 16} ${topY - 7} L ${rx - 12} ${topY + 3} Z
            M ${rx - 10} ${topY + 3} L ${rx - 6} ${topY - 5} L ${rx - 3} ${topY + 4} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round"
      />
    </g>
  )
}

// Curly hair — bumpy top
const BoyHairCurly = ({ hair, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry
  const lx = 50 - s.rx, rx = 50 + s.rx
  // Draw multiple overlapping circles for a curly look
  const bumps = [
    { cx: lx + 3, cy: topY + 6, r: 6 },
    { cx: lx + 11, cy: topY - 1, r: 7 },
    { cx: 50, cy: topY - 3, r: 7.5 },
    { cx: rx - 11, cy: topY - 1, r: 7 },
    { cx: rx - 3, cy: topY + 6, r: 6 },
    { cx: lx + 6, cy: topY + 10, r: 5 },
    { cx: rx - 6, cy: topY + 10, r: 5 },
  ]
  return (
    <g>
      {/* Base */}
      <path
        d={`M ${lx - 1} ${topY + 14}
            C ${lx - 1} ${topY + 4}, ${rx + 1} ${topY + 4}, ${rx + 1} ${topY + 14}
            C ${rx - 5} ${topY + 10}, ${50 + 10} ${topY + 6}, 50 ${topY + 7}
            C ${50 - 10} ${topY + 6}, ${lx + 5} ${topY + 10}, ${lx - 1} ${topY + 14} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round"
      />
      {/* curls */}
      {bumps.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={hair}
                stroke={STROKE} strokeWidth={STROKE_W} />
      ))}
    </g>
  )
}

// -- Kopiah, Songkok, Serban, Cap: same as before but tuned for round face --
const Kopiah = ({ color, isDark, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 2
  const lx = 50 - s.rx + 1
  const rx = 50 + s.rx - 1
  return (
    <g>
      <path
        d={`M ${lx} ${topY + 18}
            Q ${lx} ${topY - 1} 50 ${topY - 4}
            Q ${rx} ${topY - 1} ${rx} ${topY + 18}
            Q 50 ${topY + 14} ${lx} ${topY + 18} Z`}
        fill={color} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path d={`M ${lx + 2} ${topY + 15} Q 50 ${topY + 10} ${rx - 2} ${topY + 15}`}
            fill="none" stroke={isDark ? '#4A4A66' : '#B8B097'} strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="50" cy={topY - 3} r="1.5" fill={isDark ? '#4A4A66' : '#B8B097'} stroke={STROKE} strokeWidth="0.6" />
    </g>
  )
}

const Songkok = ({ shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 2
  const lx = 50 - s.rx + 1
  const rx = 50 + s.rx - 1
  return (
    <g>
      <path
        d={`M ${lx} ${topY + 18}
            L ${lx} ${topY + 2}
            Q ${lx} ${topY - 3} ${lx + 4} ${topY - 3}
            L ${rx - 4} ${topY - 3}
            Q ${rx} ${topY - 3} ${rx} ${topY + 2}
            L ${rx} ${topY + 18} Z`}
        fill="#151525" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <rect x={lx + 4} y={topY + 1} width="3" height="12" rx="1" fill="#2E2E44" opacity="0.7" />
      <rect x={lx + 8} y={topY + 2} width="1.5" height="9" rx="0.5" fill="#2E2E44" opacity="0.4" />
      <rect x={lx} y={topY + 15} width={rx - lx} height="3" fill="#0A0A18" stroke={STROKE} strokeWidth="0.6" />
      <path d={`M ${lx + 4} ${topY - 3} Q 50 ${topY - 5} ${rx - 4} ${topY - 3}`}
            fill="none" stroke="#3B3B55" strokeWidth="0.8" />
    </g>
  )
}

const Serban = ({ shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 3
  const lx = 50 - s.rx - 3
  const rx = 50 + s.rx + 3
  return (
    <g>
      <path
        d={`M ${lx} ${topY + 22}
            Q ${lx} ${topY - 4} 50 ${topY - 7}
            Q ${rx} ${topY - 4} ${rx} ${topY + 22} Z`}
        fill="#FBF9F1" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path d={`M ${lx + 2} ${topY + 10} Q 50 ${topY} ${rx - 2} ${topY + 10}`}
            fill="none" stroke="#D8D2BC" strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M ${lx + 4} ${topY + 18} Q 50 ${topY + 12} ${rx - 4} ${topY + 18}`}
            fill="none" stroke="#D8D2BC" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d={`M ${rx - 2} ${topY + 18} Q ${rx + 5} ${topY + 22} ${rx + 3} ${topY + 30}
            Q ${rx - 3} ${topY + 27} ${rx - 4} ${topY + 22} Z`}
        fill="#F0EAD1" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <circle cx="50" cy={topY - 3} r="1.5" fill="#00B894" stroke={STROKE} strokeWidth="0.5" />
    </g>
  )
}

const Cap = ({ shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 2
  const lx = 50 - s.rx + 1
  const rx = 50 + s.rx - 1
  return (
    <g>
      <path
        d={`M ${lx} ${topY + 18}
            Q ${lx} ${topY - 1} 50 ${topY - 5}
            Q ${rx} ${topY - 1} ${rx} ${topY + 18}
            Q 50 ${topY + 13} ${lx} ${topY + 18} Z`}
        fill="#2D9CDB" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path
        d={`M ${lx + 5} ${topY + 4} Q 50 ${topY} ${rx - 5} ${topY + 4}
            Q ${rx - 5} ${topY + 14} 50 ${topY + 11} Q ${lx + 5} ${topY + 14} ${lx + 5} ${topY + 4} Z`}
        fill="#1E85BF" opacity="0.55" />
      <path
        d={`M ${lx - 3} ${topY + 17}
            Q 50 ${topY + 25} ${rx + 12} ${topY + 17}
            Q ${rx + 14} ${topY + 21} ${rx + 12} ${topY + 23}
            Q 60 ${topY + 27} ${lx - 1} ${topY + 22} Z`}
        fill="#1E85BF" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <circle cx="50" cy={topY - 4} r="1.7" fill="#1E85BF" stroke={STROKE} strokeWidth="0.6" />
    </g>
  )
}

// -- Girl hair variants --
const GirlHairLong = ({ hair, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry
  const bottomY = s.cy + s.ry
  const lx = 50 - s.rx - 3
  const rx = 50 + s.rx + 3
  return (
    <g>
      {/* left strand */}
      <path
        d={`M ${lx + 3} ${topY + 8} Q ${lx - 3} ${bottomY + 5} ${lx + 2} ${bottomY + 12}
            L ${lx + 10} ${bottomY + 10} Q ${lx + 6} ${bottomY - 3} ${lx + 6} ${topY + 14} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* right strand */}
      <path
        d={`M ${rx - 3} ${topY + 8} Q ${rx + 3} ${bottomY + 5} ${rx - 2} ${bottomY + 12}
            L ${rx - 10} ${bottomY + 10} Q ${rx - 6} ${bottomY - 3} ${rx - 6} ${topY + 14} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* top scalp with center part */}
      <path
        d={`M ${lx + 2} ${topY + 15}
            C ${lx + 2} ${topY - 3}, ${rx - 2} ${topY - 3}, ${rx - 2} ${topY + 15}
            C ${rx - 6} ${topY + 10}, ${50 + 8} ${topY + 4}, 50 ${topY + 5}
            C ${50 - 8} ${topY + 4}, ${lx + 6} ${topY + 10}, ${lx + 2} ${topY + 15} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* fringe */}
      <path
        d={`M 40 ${topY + 12} Q 50 ${topY + 5} 60 ${topY + 12} Q 55 ${topY + 15} 50 ${topY + 13} Q 45 ${topY + 15} 40 ${topY + 12} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W_THIN} opacity="0.95" />
      {/* Yellow bow (Hana-inspired accent) */}
      <g transform={`translate(${rx - 6}, ${topY + 2})`}>
        <path d="M-4 0 L0 -3 L4 0 L4 4 L0 1 L-4 4 Z" fill="#FFD54F" stroke={STROKE} strokeWidth="0.6" />
        <circle cx="0" cy="0.5" r="1.2" fill="#F0B92B" stroke={STROKE} strokeWidth="0.5" />
      </g>
    </g>
  )
}

const GirlHairPonytail = ({ hair, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry
  const lx = 50 - s.rx - 2
  const rx = 50 + s.rx + 2
  return (
    <g>
      {/* ponytail on right side */}
      <path
        d={`M ${rx - 4} ${topY + 8}
            Q ${rx + 10} ${topY + 4} ${rx + 12} ${topY + 20}
            Q ${rx + 10} ${topY + 32} ${rx + 4} ${topY + 34}
            Q ${rx + 3} ${topY + 24} ${rx - 4} ${topY + 20} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Base hair */}
      <path
        d={`M ${lx} ${topY + 14}
            C ${lx} ${topY - 3}, ${rx} ${topY - 3}, ${rx} ${topY + 14}
            C ${rx - 4} ${topY + 9}, ${50 + 10} ${topY + 4}, 50 ${topY + 5}
            C ${50 - 10} ${topY + 4}, ${lx + 4} ${topY + 9}, ${lx} ${topY + 14} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* hair tie */}
      <ellipse cx={rx - 2} cy={topY + 9} rx="2.5" ry="1.5" fill="#FF6B9D" stroke={STROKE} strokeWidth="0.6" />
    </g>
  )
}

const GirlHairBun = ({ hair, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry
  const lx = 50 - s.rx - 2
  const rx = 50 + s.rx + 2
  return (
    <g>
      {/* Bun on top */}
      <circle cx="50" cy={topY - 4} r="7" fill={hair} stroke={STROKE} strokeWidth={STROKE_W} />
      <path d={`M 46 ${topY - 5} Q 50 ${topY - 7} 54 ${topY - 5}`}
            fill="none" stroke="#000" opacity="0.3" strokeWidth="0.7" />
      {/* Base hair */}
      <path
        d={`M ${lx} ${topY + 14}
            C ${lx} ${topY - 1}, ${rx} ${topY - 1}, ${rx} ${topY + 14}
            C ${rx - 4} ${topY + 9}, ${50 + 10} ${topY + 4}, 50 ${topY + 4}
            C ${50 - 10} ${topY + 4}, ${lx + 4} ${topY + 9}, ${lx} ${topY + 14} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Hair band around bun */}
      <path d={`M 42 ${topY - 1} Q 50 ${topY - 3} 58 ${topY - 1}`}
            fill="none" stroke="#EC4899" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  )
}

// Hijab (unchanged shape but face is rounder now — check overlap)
const Hijab = ({ color, colorDark, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 4
  const cy = s.cy
  return (
    <g>
      {/* Shoulder drape */}
      <path
        d={`M 10 92 L 10 ${cy + 15}
            Q 10 ${topY + 8} 24 ${topY}
            Q 50 ${topY - 8} 76 ${topY}
            Q 90 ${topY + 8} 90 ${cy + 15}
            L 90 92 Z`}
        fill={color} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Inner shade */}
      <path
        d={`M 22 ${cy + 20} Q 20 ${topY + 15} 30 ${topY + 5}
            Q 50 ${topY - 4} 70 ${topY + 5}
            Q 80 ${topY + 15} 78 ${cy + 20}`}
        fill="none" stroke={colorDark} strokeWidth="1.4" opacity="0.7" />
      {/* Face opening */}
      <path
        d={`M ${50 - s.rx - 2} ${cy + 5}
            Q ${50 - s.rx - 2} ${cy - s.ry} 50 ${cy - s.ry - 3}
            Q ${50 + s.rx + 2} ${cy - s.ry} ${50 + s.rx + 2} ${cy + 5}
            Q ${50 + s.rx + 2} ${cy + s.ry - 4} ${50 + s.rx - 3} ${cy + s.ry - 1}
            L ${50 - s.rx + 3} ${cy + s.ry - 1}
            Q ${50 - s.rx - 2} ${cy + s.ry - 4} ${50 - s.rx - 2} ${cy + 5} Z`}
        fill={color} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Pin */}
      <circle cx={50 + s.rx - 5} cy={cy - s.ry + 2} r="1.3" fill="#FFD54F" stroke={STROKE} strokeWidth="0.5" />
    </g>
  )
}

// -------------------- MAIN COMPONENT --------------------
export function Avatar({
  type = 'boy-hair-short',
  skinTone = 'light',
  faceShape = 'normal',
  eyeStyle = 'normal',        // 'normal' is now the big anime dot
  mouthStyle = 'smile',
  freckles = false,
  hasGlasses = false,
  size = 96,
  showBg = true,
  bgClass,
  ringColor,
}) {
  const resolvedType = LEGACY_TYPE_MAP[type] || type
  const meta = AVATAR_META[resolvedType] || AVATAR_META['boy-hair-short']
  const skin = SKIN_HEX[skinTone] || SKIN_HEX.light
  const skinShadow = SKIN_SHADOW[skinTone] || SKIN_SHADOW.light
  const hair = HAIR_HEX[skinTone] || HAIR_HEX.light
  const isHijab = resolvedType.startsWith('girl-hijab')
  const shape = FACE_SHAPES[faceShape] ? faceShape : 'normal'

  const renderHeadwear = () => {
    switch (resolvedType) {
      case 'boy-hair-short':    return <BoyHairShort hair={hair} shape={shape} />
      case 'boy-hair-spiky':    return <BoyHairSpiky hair={hair} shape={shape} />
      case 'boy-hair-curly':    return <BoyHairCurly hair={hair} shape={shape} />
      case 'boy-kopiah-white':  return <Kopiah color="#FFFFFF" isDark={false} shape={shape} />
      case 'boy-kopiah-black':  return <Kopiah color="#1F1F2E" isDark={true}  shape={shape} />
      case 'boy-songkok':       return <Songkok shape={shape} />
      case 'boy-serban':        return <Serban shape={shape} />
      case 'boy-cap':           return <Cap shape={shape} />
      case 'girl-hair-long':    return <GirlHairLong hair={hair} shape={shape} />
      case 'girl-hair-ponytail':return <GirlHairPonytail hair={hair} shape={shape} />
      case 'girl-hair-bun':     return <GirlHairBun hair={hair} shape={shape} />
      default:                  return null
    }
  }

  const svg = (
    <svg viewBox="0 0 100 100" width={size} height={size} className="block">
      {isHijab && <Hijab color={meta.hijab} colorDark={meta.hijabDark} shape={shape} />}
      <Face skin={skin} skinShadow={skinShadow} shape={shape} />
      {!isHijab && renderHeadwear()}
      <Eyebrows shape={shape} color={hair} />
      <Eyes style={eyeStyle} shape={shape} />
      <Mouth style={mouthStyle} shape={shape} />
      {freckles && <Freckles shape={shape} skinShadow={skinShadow} />}
      {hasGlasses && <Glasses shape={shape} />}
    </svg>
  )

  if (!showBg) return svg

  const wrapperStyle = ringColor
    ? { boxShadow: `0 0 0 3px ${ringColor}`, background: `linear-gradient(135deg, ${ringColor}22, ${ringColor}44)` }
    : undefined

  return (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br ${bgClass || meta.bg}`}
      style={{ width: size, height: size, ...wrapperStyle }}
    >
      {svg}
    </div>
  )
}

export default Avatar
