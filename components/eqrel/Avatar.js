'use client'

/**
 * EQrel Chunky Cartoon Avatar (v2)
 * -------------------------------------
 * Islamic-first modular SVG avatar built for kids 3-12.
 * Style: chunky cartoon (thick outlines, playful, warm) — Duolingo/Toca Boca inspired.
 *
 * Modular pieces:
 *   - face shape: normal | chubby | slim | oval
 *   - skin tone:  light | medium | tan | brown
 *   - hair color: derived from skin tone
 *   - headwear:   see AVATAR_META keys
 *   - eyes:       normal | sparkly | sleepy
 *   - mouth:      smile | bigSmile | small
 *   - freckles:   boolean
 *   - glasses:    boolean
 */

export const SKIN_HEX = {
  light:  '#F5D5B5',
  medium: '#E4B48C',
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
  light:  '#3A2415',
  medium: '#2E1B0F',
  tan:    '#26140A',
  brown:  '#180C05',
}

const STROKE = '#2A1810'
const STROKE_W = 1.4
const STROKE_W_THIN = 1.0

export const AVATAR_META = {
  'boy-hair':         { gender: 'male',   label: 'Rambut',       bg: 'from-green-100 to-green-200' },
  'boy-kopiah-white': { gender: 'male',   label: 'Kopiah putih', bg: 'from-blue-100 to-blue-200' },
  'boy-kopiah-black': { gender: 'male',   label: 'Kopiah hitam', bg: 'from-slate-100 to-slate-200' },
  'boy-songkok':      { gender: 'male',   label: 'Songkok',      bg: 'from-teal-100 to-teal-200' },
  'boy-serban':       { gender: 'male',   label: 'Serban',       bg: 'from-amber-100 to-amber-200' },
  'boy-cap':          { gender: 'male',   label: 'Topi',         bg: 'from-cyan-100 to-cyan-200' },
  'girl-hair':        { gender: 'female', label: 'Rambut',       bg: 'from-pink-100 to-pink-200' },
  'girl-hijab-pink':  { gender: 'female', label: 'Hijab pink',   bg: 'from-pink-100 to-rose-200',    hijab: '#F48FB1', hijabDark: '#D97AA0' },
  'girl-hijab-purple':{ gender: 'female', label: 'Hijab ungu',   bg: 'from-purple-100 to-purple-200',hijab: '#B197FC', hijabDark: '#8E76E0' },
  'girl-hijab-teal':  { gender: 'female', label: 'Hijab teal',   bg: 'from-teal-100 to-emerald-200', hijab: '#4DB6AC', hijabDark: '#399389' },
  'girl-hijab-coral': { gender: 'female', label: 'Hijab coral',  bg: 'from-orange-100 to-red-200',   hijab: '#FF8A80', hijabDark: '#E36961' },
  'girl-hijab-black': { gender: 'female', label: 'Hijab hitam',  bg: 'from-slate-100 to-gray-300',   hijab: '#3E3E4F', hijabDark: '#252533' },
}

export const FACE_SHAPES = {
  normal: { rx: 22, ry: 26, cy: 55, cheekR: 3.5, label: 'Standard' },
  chubby: { rx: 26, ry: 25, cy: 56, cheekR: 4.8, label: 'Chubby' },
  slim:   { rx: 19, ry: 28, cy: 55, cheekR: 2.8, label: 'Kurus' },
  oval:   { rx: 21, ry: 29, cy: 55, cheekR: 3.0, label: 'Oval' },
}

// -------------------- FEATURES --------------------
const Face = ({ skin, skinShadow, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const cheekY = s.cy + 8
  const earY = s.cy + 2
  const earRy = 5.5
  const earOffset = s.rx + 2
  return (
    <g>
      <path d={`M 44 ${s.cy + s.ry - 2} L 44 88 L 56 88 L 56 ${s.cy + s.ry - 2} Z`}
            fill={skin} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path d={`M 44 ${s.cy + s.ry - 2} Q 50 ${s.cy + s.ry + 1.5} 56 ${s.cy + s.ry - 2}`}
            fill={skinShadow} opacity="0.5" stroke="none" />
      <ellipse cx={50 - earOffset} cy={earY} rx="4" ry={earRy} fill={skin}
               stroke={STROKE} strokeWidth={STROKE_W} />
      <ellipse cx={50 + earOffset} cy={earY} rx="4" ry={earRy} fill={skin}
               stroke={STROKE} strokeWidth={STROKE_W} />
      <ellipse cx={50 - earOffset} cy={earY + 0.5} rx="1.6" ry="2.5" fill={skinShadow} opacity="0.6" />
      <ellipse cx={50 + earOffset} cy={earY + 0.5} rx="1.6" ry="2.5" fill={skinShadow} opacity="0.6" />
      <ellipse cx="50" cy={s.cy} rx={s.rx} ry={s.ry} fill={skin}
               stroke={STROKE} strokeWidth={STROKE_W} />
      <ellipse cx="50" cy={s.cy + s.ry - 5} rx={s.rx - 5} ry="3" fill={skinShadow} opacity="0.35" />
      <circle cx={50 - s.rx * 0.55} cy={cheekY} r={s.cheekR} fill="#F8A5A5" opacity="0.55" />
      <circle cx={50 + s.rx * 0.55} cy={cheekY} r={s.cheekR} fill="#F8A5A5" opacity="0.55" />
      <path d={`M 50 ${s.cy + 3} Q 51 ${s.cy + 5.5} 50 ${s.cy + 6.5} Q 49 ${s.cy + 5.5} 50 ${s.cy + 3}`}
            fill={skinShadow} opacity="0.55" />
    </g>
  )
}

const Eyes = ({ style, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy - 1
  const lx = 43, rx = 57
  if (style === 'sparkly') {
    return (
      <g>
        {[lx, rx].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx="2.6" ry="3.2" fill={STROKE} />
            <circle cx={x + 0.9} cy={y - 1} r="1" fill="#FFFFFF" />
            <circle cx={x - 0.7} cy={y + 1.1} r="0.5" fill="#FFFFFF" />
          </g>
        ))}
      </g>
    )
  }
  if (style === 'sleepy') {
    return (
      <g stroke={STROKE} strokeWidth="1.7" fill="none" strokeLinecap="round">
        <path d={`M ${lx - 3} ${y + 0.3} Q ${lx} ${y - 1.3} ${lx + 3} ${y + 0.3}`} />
        <path d={`M ${rx - 3} ${y + 0.3} Q ${rx} ${y - 1.3} ${rx + 3} ${y + 0.3}`} />
      </g>
    )
  }
  return (
    <g>
      {[lx, rx].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx="2" ry="2.7" fill={STROKE} />
          <circle cx={x + 0.6} cy={y - 0.8} r="0.7" fill="#FFFFFF" />
        </g>
      ))}
    </g>
  )
}

const Eyebrows = ({ shape, color }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy - 6
  return (
    <g stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round">
      <path d={`M 40 ${y + 0.5} Q 43 ${y - 0.8} 46 ${y + 0.5}`} />
      <path d={`M 54 ${y + 0.5} Q 57 ${y - 0.8} 60 ${y + 0.5}`} />
    </g>
  )
}

const Mouth = ({ style, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy + 12
  if (style === 'bigSmile') {
    return (
      <g>
        <path d={`M 42 ${y - 1} Q 50 ${y + 6} 58 ${y - 1} Q 50 ${y + 4} 42 ${y - 1}`}
              fill="#C0392B" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
        <path d={`M 44 ${y + 0.5} Q 50 ${y + 3} 56 ${y + 0.5}`}
              fill="#FFFFFF" stroke="none" opacity="0.7" />
      </g>
    )
  }
  if (style === 'small') {
    return (
      <path d={`M 47 ${y + 1} Q 50 ${y + 3} 53 ${y + 1}`}
            stroke={STROKE} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    )
  }
  return (
    <path d={`M 45 ${y} Q 50 ${y + 4} 55 ${y}`}
          stroke={STROKE} strokeWidth="1.7" fill="none" strokeLinecap="round" />
  )
}

const Freckles = ({ shape, skinShadow }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy + 3
  return (
    <g fill={skinShadow} opacity="0.7">
      <circle cx={44} cy={y} r="0.6" />
      <circle cx={47} cy={y + 1.5} r="0.5" />
      <circle cx={50} cy={y - 0.5} r="0.55" />
      <circle cx={53} cy={y + 1.2} r="0.55" />
      <circle cx={56} cy={y} r="0.6" />
    </g>
  )
}

const Glasses = ({ shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const y = s.cy - 1
  return (
    <g fill="none" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round">
      <rect x={38} y={y - 4} width={10} height={8} rx="3" />
      <rect x={52} y={y - 4} width={10} height={8} rx="3" />
      <line x1={48} y1={y} x2={52} y2={y} />
      <line x1={38} y1={y - 1} x2={34} y2={y - 2} strokeWidth="1.3" />
      <line x1={62} y1={y - 1} x2={66} y2={y - 2} strokeWidth="1.3" />
    </g>
  )
}

// -------------------- HEADWEAR --------------------
const BoyHair = ({ hair, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry
  const leftX = 50 - s.rx
  const rightX = 50 + s.rx
  return (
    <path
      d={`M ${leftX - 1} ${topY + 18}
          C ${leftX - 1} ${topY - 2}, ${rightX + 1} ${topY - 2}, ${rightX + 1} ${topY + 18}
          C ${rightX - 4} ${topY + 12}, ${50 + 10} ${topY + 6}, 50 ${topY + 8}
          C ${50 - 10} ${topY + 6}, ${leftX + 4} ${topY + 12}, ${leftX - 1} ${topY + 18} Z`}
      fill={hair}
      stroke={STROKE}
      strokeWidth={STROKE_W}
      strokeLinejoin="round"
    />
  )
}

const Kopiah = ({ color, isDark, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 2
  const leftX = 50 - s.rx + 1
  const rightX = 50 + s.rx - 1
  return (
    <g>
      <path
        d={`M ${leftX} ${topY + 20}
            Q ${leftX} ${topY} 50 ${topY - 3}
            Q ${rightX} ${topY} ${rightX} ${topY + 20}
            Q 50 ${topY + 16} ${leftX} ${topY + 20} Z`}
        fill={color} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path d={`M ${leftX + 2} ${topY + 17} Q 50 ${topY + 12} ${rightX - 2} ${topY + 17}`}
            fill="none" stroke={isDark ? '#4A4A66' : '#B8B097'} strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="50" cy={topY - 2} r="1.4" fill={isDark ? '#4A4A66' : '#B8B097'} stroke={STROKE} strokeWidth="0.6" />
    </g>
  )
}

const Songkok = ({ shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 2
  const leftX = 50 - s.rx + 1
  const rightX = 50 + s.rx - 1
  return (
    <g>
      <path
        d={`M ${leftX} ${topY + 20}
            L ${leftX} ${topY + 2}
            Q ${leftX} ${topY - 3} ${leftX + 4} ${topY - 3}
            L ${rightX - 4} ${topY - 3}
            Q ${rightX} ${topY - 3} ${rightX} ${topY + 2}
            L ${rightX} ${topY + 20} Z`}
        fill="#151525" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <rect x={leftX + 4} y={topY + 1} width="3" height="14" rx="1" fill="#2E2E44" opacity="0.7" />
      <rect x={leftX + 8} y={topY + 2} width="1.5" height="10" rx="0.5" fill="#2E2E44" opacity="0.4" />
      <rect x={leftX} y={topY + 17} width={rightX - leftX} height="3" fill="#0A0A18" stroke={STROKE} strokeWidth="0.6" />
      <path d={`M ${leftX + 4} ${topY - 3} Q 50 ${topY - 5} ${rightX - 4} ${topY - 3}`}
            fill="none" stroke="#3B3B55" strokeWidth="0.8" />
    </g>
  )
}

const Serban = ({ shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 3
  const leftX = 50 - s.rx - 3
  const rightX = 50 + s.rx + 3
  return (
    <g>
      <path
        d={`M ${leftX} ${topY + 24}
            Q ${leftX} ${topY - 5} 50 ${topY - 8}
            Q ${rightX} ${topY - 5} ${rightX} ${topY + 24} Z`}
        fill="#FBF9F1" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path d={`M ${leftX + 2} ${topY + 12} Q 50 ${topY + 2} ${rightX - 2} ${topY + 12}`}
            fill="none" stroke="#D8D2BC" strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M ${leftX + 4} ${topY + 20} Q 50 ${topY + 14} ${rightX - 4} ${topY + 20}`}
            fill="none" stroke="#D8D2BC" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d={`M ${rightX - 2} ${topY + 20} Q ${rightX + 5} ${topY + 24} ${rightX + 3} ${topY + 34}
            Q ${rightX - 3} ${topY + 30} ${rightX - 4} ${topY + 24} Z`}
        fill="#F0EAD1" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <circle cx="50" cy={topY - 4} r="1.6" fill="#00B894" stroke={STROKE} strokeWidth="0.6" />
    </g>
  )
}

const Cap = ({ shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 2
  const leftX = 50 - s.rx + 1
  const rightX = 50 + s.rx - 1
  return (
    <g>
      <path
        d={`M ${leftX} ${topY + 20}
            Q ${leftX} ${topY} 50 ${topY - 4}
            Q ${rightX} ${topY} ${rightX} ${topY + 20}
            Q 50 ${topY + 15} ${leftX} ${topY + 20} Z`}
        fill="#2D9CDB" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path
        d={`M ${leftX + 5} ${topY + 6} Q 50 ${topY + 1} ${rightX - 5} ${topY + 6}
            Q ${rightX - 5} ${topY + 16} 50 ${topY + 13} Q ${leftX + 5} ${topY + 16} ${leftX + 5} ${topY + 6} Z`}
        fill="#1E85BF" opacity="0.55" />
      <path
        d={`M ${leftX - 3} ${topY + 19}
            Q 50 ${topY + 28} ${rightX + 12} ${topY + 19}
            Q ${rightX + 14} ${topY + 23} ${rightX + 12} ${topY + 25}
            Q 60 ${topY + 30} ${leftX - 1} ${topY + 24} Z`}
        fill="#1E85BF" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <circle cx="50" cy={topY - 3} r="1.7" fill="#1E85BF" stroke={STROKE} strokeWidth="0.6" />
    </g>
  )
}

const GirlHair = ({ hair, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry
  const bottomY = s.cy + s.ry
  const leftX = 50 - s.rx - 2
  const rightX = 50 + s.rx + 2
  return (
    <g>
      <path
        d={`M ${leftX} ${topY + 10} Q ${leftX - 3} ${bottomY + 4} ${leftX + 2} ${bottomY + 10}
            L ${leftX + 8} ${bottomY + 8} Q ${leftX + 5} ${bottomY - 4} ${leftX + 4} ${topY + 15} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path
        d={`M ${rightX} ${topY + 10} Q ${rightX + 3} ${bottomY + 4} ${rightX - 2} ${bottomY + 10}
            L ${rightX - 8} ${bottomY + 8} Q ${rightX - 5} ${bottomY - 4} ${rightX - 4} ${topY + 15} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path
        d={`M ${leftX} ${topY + 18}
            C ${leftX} ${topY - 4}, ${rightX} ${topY - 4}, ${rightX} ${topY + 18}
            C ${rightX - 4} ${topY + 12}, ${50 + 8} ${topY + 6}, 50 ${topY + 7}
            C ${50 - 8} ${topY + 6}, ${leftX + 4} ${topY + 12}, ${leftX} ${topY + 18} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path
        d={`M 40 ${topY + 12} Q 50 ${topY + 6} 60 ${topY + 12} Q 55 ${topY + 15} 50 ${topY + 14} Q 45 ${topY + 15} 40 ${topY + 12} Z`}
        fill={hair} stroke={STROKE} strokeWidth={STROKE_W_THIN} opacity="0.9" />
    </g>
  )
}

const Hijab = ({ color, colorDark, shape }) => {
  const s = FACE_SHAPES[shape] || FACE_SHAPES.normal
  const topY = s.cy - s.ry - 4
  const cy = s.cy
  return (
    <g>
      <path
        d={`M 12 92 L 12 ${cy + 15}
            Q 12 ${topY + 10} 25 ${topY + 2}
            Q 50 ${topY - 6} 75 ${topY + 2}
            Q 88 ${topY + 10} 88 ${cy + 15}
            L 88 92 Z`}
        fill={color} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path
        d={`M 22 ${cy + 20} Q 20 ${topY + 15} 30 ${topY + 5}
            Q 50 ${topY - 4} 70 ${topY + 5}
            Q 80 ${topY + 15} 78 ${cy + 20}`}
        fill="none" stroke={colorDark} strokeWidth="1.4" opacity="0.7" />
      <path
        d={`M ${50 - s.rx - 3} ${cy + 4}
            Q ${50 - s.rx - 3} ${cy - s.ry - 2} 50 ${cy - s.ry - 4}
            Q ${50 + s.rx + 3} ${cy - s.ry - 2} ${50 + s.rx + 3} ${cy + 4}
            Q ${50 + s.rx + 3} ${cy + s.ry - 6} ${50 + s.rx - 2} ${cy + s.ry - 2}
            L ${50 - s.rx + 2} ${cy + s.ry - 2}
            Q ${50 - s.rx - 3} ${cy + s.ry - 6} ${50 - s.rx - 3} ${cy + 4} Z`}
        fill={color} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <circle cx={50 + s.rx - 4} cy={cy - s.ry + 3} r="1.2" fill="#FFD54F" stroke={STROKE} strokeWidth="0.5" />
    </g>
  )
}

// -------------------- MAIN COMPONENT --------------------
export function Avatar({
  type = 'boy-hair',
  skinTone = 'light',
  faceShape = 'normal',
  eyeStyle = 'sparkly',
  mouthStyle = 'smile',
  freckles = false,
  hasGlasses = false,
  size = 96,
  showBg = true,
  bgClass,
  ringColor,
}) {
  const meta = AVATAR_META[type] || AVATAR_META['boy-hair']
  const skin = SKIN_HEX[skinTone] || SKIN_HEX.light
  const skinShadow = SKIN_SHADOW[skinTone] || SKIN_SHADOW.light
  const hair = HAIR_HEX[skinTone] || HAIR_HEX.light
  const isHijab = type.startsWith('girl-hijab')
  const shape = FACE_SHAPES[faceShape] ? faceShape : 'normal'

  const renderHeadwear = () => {
    switch (type) {
      case 'boy-hair':          return <BoyHair hair={hair} shape={shape} />
      case 'boy-kopiah-white':  return <Kopiah color="#FFFFFF" isDark={false} shape={shape} />
      case 'boy-kopiah-black':  return <Kopiah color="#1F1F2E" isDark={true}  shape={shape} />
      case 'boy-songkok':       return <Songkok shape={shape} />
      case 'boy-serban':        return <Serban shape={shape} />
      case 'boy-cap':           return <Cap shape={shape} />
      case 'girl-hair':         return <GirlHair hair={hair} shape={shape} />
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
