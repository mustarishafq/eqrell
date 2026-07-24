'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Package } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { haptic } from '@/lib/feedback'
import {
  BUILDING_TEMPLATES, BUILDING_LIST, MUSALLA_ANCHOR,
  ISLAMIC_PHRASES, getBuildingName, WORLD_SIZE,
} from '@/lib/worldEngine'

// Phaser must be client-only — dynamic import prevents SSR crash
const WorldCanvas = dynamic(() => import('@/components/eqrel/WorldCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-white">
      <div className="text-center">
        <div className="text-4xl mb-2">🕌</div>
        <div className="text-sm opacity-70">Memuatkan dunia...</div>
      </div>
    </div>
  ),
})

// ═══════════════════════════════════════════════════════════════════════════
// WorldPage — /world?childId=xxx
// Hosts the Phaser canvas + React overlays (build menu, rituals, onboarding).
// ═══════════════════════════════════════════════════════════════════════════
function WorldPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const childId = searchParams.get('childId')
  const [lang] = useState('ms') // TODO: hook to user pref
  const [child, setChild] = useState(null)
  const [worldState, setWorldState] = useState(null)
  const [loading, setLoading] = useState(true)

  // Onboarding shown ONLY once per child, persisted to localStorage
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)

  // Ritual state — bismillah/alhamdulillah overlays
  const [ritual, setRitual] = useState(null) // {phase: 'bismillah'|'building'|'alhamdulillah', templateId}
  const [pickingTemplate, setPickingTemplate] = useState(null) // templateId user is placing
  const [dragMode, setDragMode] = useState(false) // false = tap-to-place (auto)

  // ─── Load world ───────────────────────────────────────────
  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/world/${childId}`, { credentials: 'include' })
      if (r.ok) {
        const data = await r.json()
        setWorldState(data.world)
        setChild(data.child)
        // If no musalla yet, show onboarding (first visit)
        const hasMusalla = (data.world.buildings || []).some(b => b.templateId === 'musalla')
        if (!hasMusalla) {
          const seen = typeof window !== 'undefined' &&
                       localStorage.getItem(`eqrel-world-onboarding-${childId}`) === '1'
          if (!seen) setShowOnboarding(true)
        }
      }
    } finally { setLoading(false) }
  }, [childId])
  useEffect(() => { load() }, [load])

  // ─── Build handler ────────────────────────────────────────
  const executeBuild = async (templateId, gridX, gridY) => {
    // Ritual: bismillah → animation → alhamdulillah → save
    setRitual({ phase: 'bismillah', templateId })
    haptic.select()
  }

  const confirmBismillah = async () => {
    if (!ritual) return
    haptic.tap()
    const templateId = ritual.templateId
    let gridX, gridY
    if (templateId === 'musalla') {
      gridX = MUSALLA_ANCHOR.x
      gridY = MUSALLA_ANCHOR.y
    } else {
      // Use auto-place algorithm to pick a good cell
      const cell = autoPlace(templateId, worldState.buildings)
      if (!cell) {
        setRitual(null)
        alert('Tiada ruang lagi. Bina level up building sedia ada dulu!')
        return
      }
      gridX = cell.x; gridY = cell.y
    }
    setRitual({ phase: 'building', templateId, x: gridX, y: gridY })

    // Fake construction delay (visual animation on Phaser side)
    await new Promise(r => setTimeout(r, 2000))

    // Persist to server
    try {
      const r = await fetch(`/api/world/${childId}/build`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, x: gridX, y: gridY }),
      })
      if (r.ok) {
        haptic.ihsan()
        setRitual({ phase: 'alhamdulillah', templateId, x: gridX, y: gridY })
        await load() // reload state; canvas will re-render buildings + villagers
        setTimeout(() => {
          setRitual(null)
          setPickingTemplate(null)
        }, 2500)
      } else {
        haptic.locked()
        setRitual(null)
      }
    } catch (e) {
      setRitual(null)
    }
  }

  const dismissRitual = () => setRitual(null)

  // ─── Auto-place algorithm ─────────────────────────────────
  // Find nearest empty cell in a spiral radiating out from musalla anchor.
  const autoPlace = (templateId, existingBuildings) => {
    const occupied = new Set(existingBuildings.map(b => `${b.x},${b.y}`))
    const musalla = existingBuildings.find(b => b.templateId === 'musalla')
    const anchor = musalla ? { x: musalla.x, y: musalla.y } : MUSALLA_ANCHOR
    // Musalla footprint is 2×2 — mark those as occupied for placement purposes
    if (musalla) {
      for (let dx = 0; dx < 2; dx++)
        for (let dy = 0; dy < 2; dy++)
          occupied.add(`${musalla.x + dx},${musalla.y + dy}`)
    }
    // Prefer distance 2-4 for houses (close to masjid but breathing room)
    // and 3-5 for orchards (outer ring)
    const minR = templateId === 'kebun' ? 3 : 2
    const maxR = templateId === 'kebun' ? 5 : 4
    for (let r = minR; r <= maxR; r++) {
      // Try all cells at Manhattan distance r
      const candidates = []
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue
          const x = anchor.x + dx
          const y = anchor.y + dy
          if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) continue
          if (!occupied.has(`${x},${y}`)) candidates.push({ x, y })
        }
      }
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)]
      }
    }
    // Fallback: any empty cell
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        if (!occupied.has(`${x},${y}`)) return { x, y }
      }
    }
    return null
  }

  // ─── Sidebar action ───────────────────────────────────────
  const onSelectBuilding = (templateId) => {
    const hasMusalla = (worldState?.buildings || []).some(b => b.templateId === 'musalla')
    if (templateId !== 'musalla' && !hasMusalla) {
      haptic.locked()
      return
    }
    executeBuild(templateId)
  }

  // ─── UI ────────────────────────────────────────────────────
  if (!childId) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-emerald-50">
        <div className="text-center">
          <p className="text-emerald-800 mb-4">Sila pilih anak dari Kid Mode.</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold">Balik</button>
        </div>
      </div>
    )
  }

  const buildings = worldState?.buildings || []
  const hasMusalla = buildings.some(b => b.templateId === 'musalla')
  const musalla = buildings.find(b => b.templateId === 'musalla')

  return (
    <div className="fixed inset-0 overflow-hidden" style={{
      background: 'radial-gradient(1200px 800px at 50% 30%, #a8dda8 0%, #6eaa6e 45%, #2d5c3a 100%)',
    }}>
      {/* Phaser canvas */}
      <div className="absolute inset-0">
        {!loading && worldState && (
          <WorldCanvas childId={childId} worldState={worldState} onEvent={() => {}} />
        )}
      </div>

      {/* Header — back button + title */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between pointer-events-none">
        <button
          onClick={() => router.push('/kid?childId=' + childId)}
          className="pointer-events-auto flex items-center gap-1 rounded-xl bg-white/85 backdrop-blur px-3 py-2 text-emerald-900 font-black text-sm shadow active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> Balik
        </button>
        <div className="pointer-events-none text-center">
          <div className="text-white font-black text-lg drop-shadow-lg">
            🌍 Dunia {child?.nickname || 'Kamu'}
          </div>
          <div className="text-white/80 text-xs">
            {buildings.length} binaan · {musalla ? `Musalla level ${musalla.level}` : 'Bina Musalla dulu'}
          </div>
        </div>
        <div className="w-16" /> {/* balance for centering */}
      </div>

      {/* Sidebar — Build menu */}
      <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
        <div className="pointer-events-auto bg-white/90 backdrop-blur rounded-2xl border-2 border-white/60 shadow-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-emerald-700" />
            <div className="text-xs font-black uppercase tracking-wider text-emerald-900">
              Bina Binaan
            </div>
            {hasMusalla && (
              <label className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-800/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dragMode}
                  onChange={e => setDragMode(e.target.checked)}
                  className="w-3 h-3 accent-emerald-500"
                />
                Drag mode
              </label>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {BUILDING_LIST.map(t => {
              const isBuilt = buildings.some(b => b.templateId === t.id)
              const isLocked = t.id !== 'musalla' && !hasMusalla
              const isMusallaFirst = t.id === 'musalla' && !isBuilt
              return (
                <button
                  key={t.id}
                  onClick={() => !isLocked && (t.id !== 'musalla' || !isBuilt) && onSelectBuilding(t.id)}
                  disabled={isLocked || (t.id === 'musalla' && isBuilt)}
                  className={`relative rounded-xl border-2 p-2 text-left transition-all active:scale-95
                    ${isLocked ? 'opacity-40 border-gray-200 bg-gray-50' :
                      isMusallaFirst ? 'border-amber-400 bg-amber-50 animate-pulse' :
                      'border-emerald-300 bg-white hover:bg-emerald-50/60'}`}
                >
                  <div className="text-2xl leading-none mb-1">{t.icon}</div>
                  <div className="text-[10px] font-black text-emerald-900 leading-tight">
                    {t.name[lang]}
                  </div>
                  <div className="text-[9px] text-emerald-700/70">
                    {t.cost === 0 ? 'PERCUMA' : `${t.cost} mata`}
                  </div>
                  {isMusallaFirst && (
                    <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">
                      MULA
                    </div>
                  )}
                  {isLocked && <div className="absolute inset-0 flex items-center justify-center text-xl">🔒</div>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Ritual overlays */}
      <AnimatePresence>
        {ritual?.phase === 'bismillah' && (
          <BismillahOverlay
            templateId={ritual.templateId}
            lang={lang}
            onConfirm={confirmBismillah}
            onCancel={dismissRitual}
          />
        )}
        {ritual?.phase === 'building' && <BuildingProgressOverlay />}
        {ritual?.phase === 'alhamdulillah' && (
          <AlhamdulillahOverlay templateId={ritual.templateId} lang={lang} />
        )}
      </AnimatePresence>

      {/* Onboarding — hijrah story cards */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingOverlay
            step={onboardingStep}
            setStep={setOnboardingStep}
            childName={child?.nickname}
            lang={lang}
            onComplete={() => {
              if (typeof window !== 'undefined')
                localStorage.setItem(`eqrel-world-onboarding-${childId}`, '1')
              setShowOnboarding(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function WorldPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-emerald-900 flex items-center justify-center text-white">Memuatkan…</div>}>
      <WorldPageInner />
    </Suspense>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

const OnboardingOverlay = ({ step, setStep, childName, lang, onComplete }) => {
  const cards = [
    { icon: '🕋', title: 'Kisah Hijrah', text: 'Rasulullah ﷺ hijrah dari Makkah ke Madinah kerana Allah.' },
    { icon: '🏗️', title: 'Bina Masjid Dulu', text: 'Perkara PERTAMA yang Baginda ﷺ buat: bina Masjid Quba — masjid pertama dalam Islam.' },
    { icon: '💚', title: `Sekarang Giliran ${childName || 'Kamu'}`, text: 'Bina Musalla di dunia kamu. Ini akan jadi pusat keluarga & komuniti.' },
  ]
  const c = cards[step] || cards[0]
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'rgba(6, 63, 54, 0.92)' }}
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full bg-white rounded-3xl p-6 text-center shadow-2xl"
      >
        <div className="text-6xl mb-3">{c.icon}</div>
        <div className="text-xl font-black text-emerald-900 mb-2">{c.title}</div>
        <p className="text-emerald-800 leading-relaxed mb-6">{c.text}</p>
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {cards.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-emerald-500' : 'w-2 bg-emerald-200'}`} />
          ))}
        </div>
        <button
          onClick={() => step < cards.length - 1 ? setStep(step + 1) : onComplete()}
          className="w-full rounded-2xl bg-emerald-500 text-white font-black py-3 active:scale-95"
        >
          {step < cards.length - 1 ? 'Seterusnya →' : '🕌 Mula Bina Musalla'}
        </button>
      </motion.div>
    </motion.div>
  )
}

const BismillahOverlay = ({ templateId, lang, onConfirm, onCancel }) => {
  const t = BUILDING_TEMPLATES[templateId]
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[90] flex items-center justify-center p-6"
      style={{ background: 'rgba(6, 63, 54, 0.85)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl p-6 text-center shadow-2xl"
      >
        <div className="text-6xl mb-2">{t?.icon}</div>
        <div className="text-xs uppercase tracking-widest font-black text-amber-600 mb-1">
          Bermula Bina {t?.name[lang]}
        </div>
        <div className="font-serif text-4xl text-emerald-900 my-4" dir="rtl">
          {ISLAMIC_PHRASES.bismillah.ar}
        </div>
        <div className="text-lg font-bold text-emerald-800 mb-1">
          Bismillah
        </div>
        <div className="text-sm text-emerald-700/70 mb-6">
          {ISLAMIC_PHRASES.bismillah.meaning[lang]}
        </div>
        <button
          onClick={onConfirm}
          className="w-full rounded-2xl bg-emerald-500 text-white font-black py-3 active:scale-95 mb-2"
        >
          🕌 Bismillah — Mula Bina
        </button>
        <button
          onClick={onCancel}
          className="w-full rounded-2xl bg-transparent text-emerald-700 font-bold py-2 text-sm"
        >
          Batal
        </button>
      </motion.div>
    </motion.div>
  )
}

const BuildingProgressOverlay = () => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="absolute inset-0 z-[90] flex items-center justify-center pointer-events-none"
  >
    <div className="bg-white/95 rounded-2xl px-6 py-4 shadow-xl flex items-center gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="text-3xl"
      >🏗️</motion.div>
      <div>
        <div className="font-black text-emerald-900">Sedang bina...</div>
        <div className="text-xs text-emerald-700/70">Bismillah, semoga berkah</div>
      </div>
    </div>
  </motion.div>
)

const AlhamdulillahOverlay = ({ templateId, lang }) => {
  const t = BUILDING_TEMPLATES[templateId]
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[90] flex items-center justify-center p-6 pointer-events-none"
    >
      <div className="max-w-md w-full bg-gradient-to-br from-amber-100 to-emerald-100 border-4 border-amber-400 rounded-3xl p-6 text-center shadow-2xl">
        <div className="text-6xl mb-2">✨</div>
        <div className="text-xs uppercase tracking-widest font-black text-amber-600 mb-1">
          {t?.name[lang]} Siap!
        </div>
        <div className="font-serif text-4xl text-emerald-900 my-4" dir="rtl">
          {ISLAMIC_PHRASES.alhamdulillah.ar}
        </div>
        <div className="text-lg font-bold text-emerald-800 mb-1">Alhamdulillah</div>
        <div className="text-sm text-emerald-700/70">
          {ISLAMIC_PHRASES.alhamdulillah.meaning[lang]}
        </div>
      </div>
    </motion.div>
  )
}
