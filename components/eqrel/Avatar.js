'use client'

/**
 * SVG-based Avatar renderer for EQrel.
 * Renders accurate Islamic-first headwear (kopiah, songkok, serban, hijab)
 * instead of generic emoji.
 *
 * Props:
 *  - type: one of AVATAR_TYPES keys (e.g. 'boy-kopiah-white')
 *  - skinTone: 'light' | 'medium' | 'tan' | 'brown'
 *  - hasGlasses: boolean
 *  - size: pixel size (default 96)
 *  - bg: optional tailwind gradient class for outer circle (falls back to type default)
 *  - showBg: whether to wrap in a circular gradient background (default true)
 */

export const SKIN_HEX = {
  light: '#F5D5B5',
  medium: '#E4B48C',
  tan: '#C48A5D',
  brown: '#8B5A38',
}

export const HAIR_HEX = {
  light: '#3A2415',
  medium: '#2E1B0F',
  tan: '#26140A',
  brown: '#1B0E06',
}

export const AVATAR_META = {
  // Male
  'boy-hair':         { gender: 'male',   label: 'Rambut',         bg: 'from-green-100 to-green-200' },
  'boy-kopiah-white': { gender: 'male',   label: 'Kopiah putih',   bg: 'from-blue-100 to-blue-200' },
  'boy-kopiah-black': { gender: 'male',   label: 'Kopiah hitam',   bg: 'from-slate-100 to-slate-200' },
  'boy-songkok':      { gender: 'male',   label: 'Songkok',        bg: 'from-teal-100 to-teal-200' },
  'boy-serban':       { gender: 'male',   label: 'Serban',         bg: 'from-amber-100 to-amber-200' },
  'boy-cap':          { gender: 'male',   label: 'Topi',           bg: 'from-cyan-100 to-cyan-200' },
  // Female
  'girl-hair':        { gender: 'female', label: 'Rambut',         bg: 'from-pink-100 to-pink-200' },
  'girl-hijab-pink':  { gender: 'female', label: 'Hijab pink',     bg: 'from-pink-100 to-rose-200',   hijab: '#F48FB1' },
  'girl-hijab-purple':{ gender: 'female', label: 'Hijab ungu',     bg: 'from-purple-100 to-purple-200', hijab: '#B197FC' },
  'girl-hijab-teal':  { gender: 'female', label: 'Hijab teal',     bg: 'from-teal-100 to-emerald-200', hijab: '#4DB6AC' },
  'girl-hijab-coral': { gender: 'female', label: 'Hijab coral',    bg: 'from-orange-100 to-red-200',  hijab: '#FF8A80' },
  'girl-hijab-black': { gender: 'female', label: 'Hijab hitam',    bg: 'from-slate-100 to-gray-300',  hijab: '#3E3E4F' },
}

// ---------- FACE PIECES ----------
const Face = ({ skin }) => (
  <>
    {/* neck */}
    <path d="M42 78 L42 88 L58 88 L58 78 Z" fill={skin} />
    {/* face oval */}
    <ellipse cx="50" cy="55" rx="22" ry="26" fill={skin} />
    {/* ears */}
    <ellipse cx="27" cy="57" rx="4" ry="6" fill={skin} />
    <ellipse cx="73" cy="57" rx="4" ry="6" fill={skin} />
    {/* subtle cheek */}
    <circle cx="39" cy="63" r="3" fill="#F8AFAF" opacity="0.35" />
    <circle cx="61" cy="63" r="3" fill="#F8AFAF" opacity="0.35" />
  </>
)

const EyesMouth = () => (
  <>
    {/* eyes */}
    <ellipse cx="42" cy="55" rx="1.7" ry="2.3" fill="#2A1810" />
    <ellipse cx="58" cy="55" rx="1.7" ry="2.3" fill="#2A1810" />
    {/* eye highlights */}
    <circle cx="42.5" cy="54.3" r="0.6" fill="#fff" />
    <circle cx="58.5" cy="54.3" r="0.6" fill="#fff" />
    {/* smile */}
    <path d="M45 66 Q50 70 55 66" stroke="#5A2C1F" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </>
)

const Glasses = () => (
  <g>
    <circle cx="42" cy="55" r="5.2" fill="none" stroke="#2A1810" strokeWidth="1.4" />
    <circle cx="58" cy="55" r="5.2" fill="none" stroke="#2A1810" strokeWidth="1.4" />
    <line x1="47.2" y1="55" x2="52.8" y2="55" stroke="#2A1810" strokeWidth="1.4" />
    {/* temple hints */}
    <line x1="36.8" y1="55" x2="33.5" y2="54.5" stroke="#2A1810" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="63.2" y1="55" x2="66.5" y2="54.5" stroke="#2A1810" strokeWidth="1.2" strokeLinecap="round" />
  </g>
)

// ---------- HEADWEAR ----------

// Short boy hair (visible in front, sides trimmed)
const BoyHair = ({ hair }) => (
  <path
    d="M28 44 C28 24, 72 24, 72 44 C68 38, 60 34, 50 35 C40 34, 32 38, 28 44 Z"
    fill={hair}
  />
)

// Kopiah = dome/skullcap that sits round on top of head
const Kopiah = ({ color, stroke }) => (
  <g>
    <path
      d="M28 40 Q28 22 50 20 Q72 22 72 40 Q60 36 50 36 Q40 36 28 40 Z"
      fill={color}
      stroke={stroke}
      strokeWidth="0.8"
    />
    {/* subtle woven texture line */}
    <path d="M32 38 Q50 30 68 38" fill="none" stroke={stroke} strokeWidth="0.4" opacity="0.5" />
  </g>
)

// Songkok = Malay tall flat-top velvet cap
const Songkok = () => (
  <g>
    {/* body */}
    <path
      d="M28 40 L28 25 Q28 20 32 20 L68 20 Q72 20 72 25 L72 40 Z"
      fill="#1A1A2A"
    />
    {/* top edge highlight */}
    <path d="M28 25 Q50 22 72 25" fill="none" stroke="#3B3B55" strokeWidth="1" />
    {/* velvet shine */}
    <rect x="32" y="24" width="3" height="14" fill="#2E2E44" opacity="0.6" rx="1" />
    {/* bottom band */}
    <rect x="28" y="38" width="44" height="2.5" fill="#0F0F1C" />
  </g>
)

// Serban = wrapped turban, larger, layered with a small tail
const Serban = () => (
  <g>
    {/* main dome */}
    <path
      d="M22 42 Q22 18 50 15 Q78 18 78 42 Z"
      fill="#F7F5EF"
      stroke="#D9D5C6"
      strokeWidth="0.8"
    />
    {/* wrap line 1 */}
    <path d="M23 32 Q50 22 77 32" fill="none" stroke="#D9D5C6" strokeWidth="1.5" strokeLinecap="round" />
    {/* wrap line 2 */}
    <path d="M25 40 Q50 34 75 40" fill="none" stroke="#D9D5C6" strokeWidth="1.2" strokeLinecap="round" />
    {/* tail on the side */}
    <path d="M75 38 Q82 40 80 48 Q76 46 74 42 Z" fill="#F0EBD9" stroke="#D9D5C6" strokeWidth="0.6" />
    {/* small green button (Islamic accent) */}
    <circle cx="50" cy="20" r="1.4" fill="#00B894" />
  </g>
)

// Baseball cap = crown + curved brim to one side
const Cap = () => (
  <g>
    {/* crown */}
    <path
      d="M30 42 Q30 24 50 22 Q70 24 70 42 Q60 38 50 38 Q40 38 30 42 Z"
      fill="#2D9CDB"
    />
    {/* front panel accent */}
    <path d="M40 26 Q50 22 60 26 L60 38 Q50 34 40 38 Z" fill="#1E85BF" opacity="0.5" />
    {/* brim */}
    <path
      d="M28 41 Q50 47 82 41 Q84 44 82 46 Q60 51 30 45 Z"
      fill="#1E85BF"
    />
    {/* button on top */}
    <circle cx="50" cy="22" r="1.6" fill="#1E85BF" />
  </g>
)

// Long girl hair (framing face + shoulder-length strands)
const GirlHair = ({ hair }) => (
  <g>
    {/* top scalp */}
    <path
      d="M25 48 C25 22, 75 22, 75 48 C70 42, 60 38, 50 38 C40 38, 30 42, 25 48 Z"
      fill={hair}
    />
    {/* left strand */}
    <path d="M25 48 Q22 65 26 82 L32 80 Q30 65 32 50 Z" fill={hair} />
    {/* right strand */}
    <path d="M75 48 Q78 65 74 82 L68 80 Q70 65 68 50 Z" fill={hair} />
    {/* fringe hint */}
    <path d="M38 34 Q50 30 62 34 Q56 38 50 38 Q44 38 38 34 Z" fill={hair} opacity="0.85" />
  </g>
)

// Hijab = fabric covering hair + draping around face and shoulders
const Hijab = ({ color }) => {
  // Slightly darker shade for shadow
  const shadow = color + 'CC'
  return (
    <g>
      {/* back / shoulder drape */}
      <path
        d="M14 92 L14 70 Q14 40 25 30 Q50 12 75 30 Q86 40 86 70 L86 92 Z"
        fill={color}
      />
      {/* face opening — cut back a bit so face oval shows */}
      <path
        d="M28 55 Q28 30 50 26 Q72 30 72 55 Q72 68 68 74 Q64 78 60 79 L40 79 Q36 78 32 74 Q28 68 28 55 Z"
        fill={color}
      />
      {/* inner fold (lighter tone at edge) */}
      <path
        d="M32 55 Q32 34 50 30 Q68 34 68 55"
        fill="none"
        stroke={shadow}
        strokeWidth="1.2"
        opacity="0.6"
      />
      {/* pin (subtle) */}
      <circle cx="50" cy="30" r="0.9" fill="#FFD54F" />
    </g>
  )
}

// ---------- MAIN COMPONENT ----------
export function Avatar({
  type = 'boy-hair',
  skinTone = 'light',
  hasGlasses = false,
  size = 96,
  showBg = true,
  bgClass,
  ringColor,
}) {
  const meta = AVATAR_META[type] || AVATAR_META['boy-hair']
  const skin = SKIN_HEX[skinTone] || SKIN_HEX.light
  const hair = HAIR_HEX[skinTone] || HAIR_HEX.light

  // A hijab covers the face oval — face is drawn INSIDE the hijab opening
  const isHijab = type.startsWith('girl-hijab')

  const renderHeadwear = () => {
    switch (type) {
      case 'boy-hair':          return <BoyHair hair={hair} />
      case 'boy-kopiah-white':  return <Kopiah color="#FFFFFF" stroke="#C9C4B4" />
      case 'boy-kopiah-black':  return <Kopiah color="#1F1F2E" stroke="#0A0A14" />
      case 'boy-songkok':       return <Songkok />
      case 'boy-serban':        return <Serban />
      case 'boy-cap':           return <Cap />
      case 'girl-hair':         return <GirlHair hair={hair} />
      case 'girl-hijab-pink':
      case 'girl-hijab-purple':
      case 'girl-hijab-teal':
      case 'girl-hijab-coral':
      case 'girl-hijab-black':  return <Hijab color={meta.hijab} />
      default:                  return <BoyHair hair={hair} />
    }
  }

  const wrapperStyle = ringColor
    ? { boxShadow: `0 0 0 3px ${ringColor}` , background: `linear-gradient(135deg, ${ringColor}22, ${ringColor}44)` }
    : undefined

  const svg = (
    <svg viewBox="0 0 100 100" width={size} height={size} className="block">
      {/* Face first (hijab will overlap edges) */}
      {!isHijab && <Face skin={skin} />}
      {isHijab && (
        <>
          {/* Hijab back layer */}
          <Hijab color={meta.hijab} />
          {/* Face on top of hijab (inside opening) */}
          <ellipse cx="50" cy="55" rx="20" ry="24" fill={skin} />
          <circle cx="39" cy="63" r="3" fill="#F8AFAF" opacity="0.35" />
          <circle cx="61" cy="63" r="3" fill="#F8AFAF" opacity="0.35" />
        </>
      )}

      {/* Headwear (skip for hijab types since already rendered) */}
      {!isHijab && renderHeadwear()}

      {/* Eyes + mouth always on top */}
      <EyesMouth />

      {/* Glasses on top of eyes */}
      {hasGlasses && <Glasses />}
    </svg>
  )

  if (!showBg) return svg

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
