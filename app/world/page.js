'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Package, Volume2, VolumeX } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { haptic } from '@/lib/feedback'
import { useLang } from '@/lib/i18n/LangProvider'
import audio, { installAutoPrime, isMuted, toggleMuted, bismillah, alhamdulillah } from '@/lib/audio'
import {
  BUILDING_TEMPLATES, BUILDING_LIST, BUILDING_CATEGORIES, getVariantsForCategory, MUSALLA_ANCHOR,
  ISLAMIC_PHRASES, getBuildingName, WORLD_SIZE, getCurrentBounds,
} from '@/lib/worldEngine'

// Phaser must be client-only — dynamic import prevents SSR crash
const WorldCanvas = dynamic(() => import('@/components/eqrel/WorldCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-white">
      <div className="text-center">
        <div className="text-4xl mb-2">🕌</div>
        <div className="text-sm opacity-70">…</div>
      </div>
    </div>
  ),
})

// ═══════════════════════════════════════════════════════════════════════════
// Multilingual labels for the World page
// ═══════════════════════════════════════════════════════════════════════════
const L = {
  loading:      { ms: 'Memuatkan dunia…', en: 'Loading world…', id: 'Memuat dunia…', ar: 'جاري تحميل العالم…' },
  pickChild:    { ms: 'Sila pilih anak dari Kid Mode.', en: 'Please choose a child from Kid Mode.', id: 'Silakan pilih anak dari Kid Mode.', ar: 'يرجى اختيار الطفل من وضع الطفل.' },
  back:         { ms: 'Balik', en: 'Back', id: 'Kembali', ar: 'رجوع' },
  yourWorld:    { ms: 'Dunia', en: 'World of', id: 'Dunia', ar: 'عالم' },
  you:          { ms: 'Kamu', en: 'You', id: 'Kamu', ar: 'أنت' },
  buildings:    { ms: 'binaan', en: 'buildings', id: 'bangunan', ar: 'مبان' },
  buildMusalla: { ms: 'Bina Musalla dulu', en: 'Build the Musalla first', id: 'Bangun Musalla dulu', ar: 'ابنِ المصلى أولاً' },
  buildLevel:   { ms: 'level', en: 'level', id: 'level', ar: 'مستوى' },
  buildBuilding:{ ms: 'Bina Binaan', en: 'Build Buildings', id: 'Bangun Bangunan', ar: 'ابنِ المباني' },
  dragHint:     { ms: 'Tekan lama untuk pindah', en: 'Long-press to move', id: 'Tekan lama untuk pindah', ar: 'اضغط مطولاً للتحريك' },
  buildingInfo: { ms: 'Info Binaan', en: 'Building Info', id: 'Info Bangunan', ar: 'معلومات المبنى' },
  progress:     { ms: 'Kemajuan', en: 'Progress', id: 'Kemajuan', ar: 'التقدم' },
  builtOn:      { ms: 'Dibina pada', en: 'Built on', id: 'Dibangun pada', ar: 'بُني في' },
  close:        { ms: 'Tutup', en: 'Close', id: 'Tutup', ar: 'إغلاق' },
  more:         { ms: 'Lebih', en: 'More', id: 'Selengkapnya', ar: 'المزيد' },
  needsMore:    { ms: 'Perlukan lagi bangunan', en: 'Needs more buildings', id: 'Perlu bangunan lagi', ar: 'يحتاج مبانٍ إضافية' },
  free:         { ms: 'PERCUMA', en: 'FREE', id: 'GRATIS', ar: 'مجاناً' },
  points:       { ms: 'mata', en: 'points', id: 'poin', ar: 'نقطة' },
  start:        { ms: 'MULA', en: 'START', id: 'MULAI', ar: 'ابدأ' },
  noSpace:      { ms: 'Tiada ruang lagi. Upgrade binaan sedia ada dulu!', en: 'No more space. Upgrade an existing building first!', id: 'Tidak ada ruang lagi. Naikkan level bangunan yang ada dulu!', ar: 'لا يوجد مساحة. طوّر مبنى موجود أولاً!' },
  next:         { ms: 'Seterusnya →', en: 'Next →', id: 'Selanjutnya →', ar: 'التالي ←' },
  startBuilding:{ ms: '🕌 Mula Bina Musalla', en: '🕌 Start Building Musalla', id: '🕌 Mulai Bangun Musalla', ar: '🕌 ابدأ بناء المصلى' },
  onboardTitle1:{ ms: 'Kisah Hijrah', en: 'The Story of Hijrah', id: 'Kisah Hijrah', ar: 'قصة الهجرة' },
  onboardText1: { ms: 'Rasulullah ﷺ hijrah dari Makkah ke Madinah kerana Allah.', en: 'The Prophet ﷺ migrated from Makkah to Madinah for the sake of Allah.', id: 'Rasulullah ﷺ hijrah dari Makkah ke Madinah karena Allah.', ar: 'هاجر النبي ﷺ من مكة إلى المدينة في سبيل الله.' },
  onboardTitle2:{ ms: 'Bina Masjid Dulu', en: 'Build the Mosque First', id: 'Bangun Masjid Dulu', ar: 'ابنِ المسجد أولاً' },
  onboardText2: { ms: 'Perkara PERTAMA yang Baginda ﷺ buat: bina Masjid Quba — masjid pertama dalam Islam.', en: 'The FIRST thing the Prophet ﷺ did: build Masjid Quba — the first mosque in Islam.', id: 'Hal PERTAMA yang Baginda ﷺ lakukan: membangun Masjid Quba — masjid pertama dalam Islam.', ar: 'أول ما فعل النبي ﷺ: بناء مسجد قباء — أول مسجد في الإسلام.' },
  onboardTitle3:{ ms: 'Sekarang Giliran', en: 'Now It\u2019s Your Turn', id: 'Sekarang Giliran', ar: 'الآن دورك' },
  onboardText3: { ms: 'Bina Musalla di dunia kamu. Ini akan jadi pusat keluarga & komuniti.', en: 'Build a Musalla in your world. It will become the heart of your family & community.', id: 'Bangun Musalla di duniamu. Ini akan menjadi pusat keluarga & komunitas.', ar: 'ابنِ مصلى في عالمك. سيصبح مركز عائلتك ومجتمعك.' },
  bermulaBina:  { ms: 'Bermula Bina', en: 'Beginning to Build', id: 'Mulai Membangun', ar: 'بدء بناء' },
  bismillahBtn: { ms: '🤲 Bismillah — Mula Bina', en: '🤲 Bismillah — Start Building', id: '🤲 Bismillah — Mulai Bangun', ar: '🤲 بسم الله — ابدأ البناء' },
  cancel:       { ms: 'Batal', en: 'Cancel', id: 'Batal', ar: 'إلغاء' },
  building:     { ms: 'Sedang bina…', en: 'Building…', id: 'Sedang membangun…', ar: 'جاري البناء…' },
  buildingSub:  { ms: 'Bismillah, semoga berkah', en: 'Bismillah, may it be blessed', id: 'Bismillah, semoga berkah', ar: 'بسم الله، بارك الله فيه' },
  siap:         { ms: 'Siap!', en: 'Ready!', id: 'Selesai!', ar: 'جاهز!' },
  upgradeTitle: { ms: 'Naik Taraf', en: 'Upgrade', id: 'Naikkan Level', ar: 'ترقية' },
  upgradeTo:    { ms: 'Naik taraf kepada', en: 'Upgrade to', id: 'Naikkan ke', ar: 'ترقية إلى' },
  upgradeCost:  { ms: 'Kos', en: 'Cost', id: 'Biaya', ar: 'التكلفة' },
  upgradeBtn:   { ms: '⬆️ Bismillah — Naik Taraf', en: '⬆️ Bismillah — Upgrade', id: '⬆️ Bismillah — Naikkan', ar: '⬆️ بسم الله — ترقية' },
  maxLevel:     { ms: 'Sudah tahap tertinggi', en: 'Already at max level', id: 'Sudah level tertinggi', ar: 'وصل الحد الأقصى' },
  cloudsMsg:    { ms: 'Baca istighfar untuk tenangkan langit', en: 'Recite Istighfar to calm the sky', id: 'Baca istighfar untuk menenangkan langit', ar: 'اقرأ الاستغفار ليصفو السماء' },
  worldGrew:    { ms: 'Dunia kamu berkembang! 🌱', en: 'Your world grew! 🌱', id: 'Duniamu berkembang! 🌱', ar: 'اتسع عالمك! 🌱' },
  worldGrewSub: { ms: 'Alhamdulillah — lebih banyak ruang untuk bina', en: 'Alhamdulillah — more room to build', id: 'Alhamdulillah — lebih banyak ruang untuk membangun', ar: 'الحمد لله — مساحة أكبر للبناء' },
}
const l = (key, lang) => (L[key]?.[lang] || L[key]?.ms || key)

// ═══════════════════════════════════════════════════════════════════════════
// WorldPage — /world?childId=xxx
// Hosts the Phaser canvas + React overlays (build menu, rituals, onboarding).
// ═══════════════════════════════════════════════════════════════════════════
function WorldPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const childId = searchParams.get('childId')
  const { lang } = useLang()  // Follow user's global language toggle
  const [child, setChild] = useState(null)
  const [worldState, setWorldState] = useState(null)
  const [loading, setLoading] = useState(true)

  // Onboarding shown ONLY once per child, persisted to localStorage
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)

  // Ritual state — bismillah/alhamdulillah overlays
  const [ritual, setRitual] = useState(null)
  // Upgrade dialog — shows when user taps an existing building
  const [upgradeTarget, setUpgradeTarget] = useState(null) // building object
  // Construction animation trigger — passed to WorldCanvas; scene plays Red-Alert-style build anim
  const [construct, setConstruct] = useState(null) // { x, y, templateId, level, key, isUpgrade? }
  // Camera command (zoom in/out/center) sent to Phaser via WorldCanvas prop
  const [cameraCommand, setCameraCommand] = useState(null)
  // Drag-from-sidebar state — { templateId, pointerX, pointerY } while dragging
  // Currently active category tab in the bottom sidebar (default: rumah for
  // fastest access to the most-built type). "ibadah" only shows the Musalla
  // upgrade path (via the info card, not the sidebar).
  const [activeCategory, setActiveCategory] = useState('rumah')
  const [buildDrag, setBuildDrag] = useState(null)
  // Celebratory toast shown when the world progressively expands (5/10/15 buildings)
  const [expandToast, setExpandToast] = useState(null)
  // Audio mute preference (persisted in localStorage). We mirror to React state
  // so the header toggle re-renders on change. Initialised via effect (SSR-safe).
  const [audioMuted, setAudioMutedState] = useState(false)

  // Install auto-prime on first user interaction so build/completion sounds can
  // play from inside timed callbacks later (browsers block audio otherwise).
  useEffect(() => {
    installAutoPrime()
    setAudioMutedState(isMuted())
    // Sync mute state across tabs / other components
    const onChange = (e) => setAudioMutedState(!!e.detail?.muted)
    window.addEventListener('eqrel-audio-muted-changed', onChange)
    return () => window.removeEventListener('eqrel-audio-muted-changed', onChange)
  }, [])

  // Document-level pointer listeners while dragging a template from the sidebar.
  // Sends live pointer coords to Phaser (via WorldCanvas prop) so it can draw
  // a ghost outline at the target cell. On pointerup, reads Phaser's dropTarget
  // from game registry and triggers executeBuild at the chosen cell.
  //
  // If the pointer never moved > 10px (i.e. user just tapped without dragging),
  // we fall back to the old auto-place behaviour so quick taps still work.
  useEffect(() => {
    if (!buildDrag) return
    const startX = buildDrag.pointerX
    const startY = buildDrag.pointerY
    let maxMoved = 0
    const onMove = (e) => {
      const p = e.touches?.[0] || e
      const dist = Math.hypot(p.clientX - startX, p.clientY - startY)
      if (dist > maxMoved) maxMoved = dist
      setBuildDrag(prev => prev ? { ...prev, pointerX: p.clientX, pointerY: p.clientY } : null)
    }
    const onUp = () => {
      const templateId = buildDrag.templateId
      // Pure tap (no significant drag) → fall back to auto-place
      if (maxMoved < 10) {
        haptic.select()
        executeBuild(templateId)
        setBuildDrag(null)
        return
      }
      // Drag → read Phaser's chosen drop target
      const game = typeof window !== 'undefined' ? window.__eqrelPhaser : null
      const target = game?.registry?.get('buildDropTarget')
      if (target?.valid && templateId === target.templateId) {
        haptic.select()
        executeBuild(templateId, target.col, target.row)
      } else {
        haptic.locked()
      }
      setBuildDrag(null)
      if (game) { try { game.registry.set('buildDropTarget', null) } catch { /* noop */ } }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildDrag?.templateId])

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
    // Ritual: bismillah → animation → alhamdulillah → save.
    // gridX/gridY optional — when provided (from drag-to-place), the build
    // happens at that specific cell instead of auto-placing.
    setRitual({ phase: 'bismillah', templateId, x: gridX, y: gridY })
    haptic.select()
  }

  const confirmBismillah = async () => {
    if (!ritual) return
    haptic.tap()
    // Upgrade flow branches to different handler
    if (ritual.isUpgrade) {
      await confirmUpgrade()
      return
    }
    const templateId = ritual.templateId
    let gridX, gridY
    if (templateId === 'musalla') {
      gridX = MUSALLA_ANCHOR.x
      gridY = MUSALLA_ANCHOR.y
    } else if (ritual.x != null && ritual.y != null) {
      // User dragged the template to this cell — respect that choice
      gridX = ritual.x; gridY = ritual.y
    } else {
      // Fallback to auto-place algorithm (button-only tap)
      const cell = autoPlace(templateId, worldState.buildings)
      if (!cell) {
        setRitual(null)
        alert(l('noSpace', lang))
        return
      }
      gridX = cell.x; gridY = cell.y
    }
    // Move ritual to 'building' phase (small bottom toast now — animation
    // plays on the canvas itself, Red-Alert-style scaffolding + rising sprite).
    setRitual({ phase: 'building', templateId, x: gridX, y: gridY })
    // Bismillah — the child is starting a new build; every action begins with
    // the name of Allah. Also serves as an audible acknowledgement that the
    // tap/drop registered so the child knows something is happening while the
    // 6-second construction animation plays.
    bismillah()
    // Trigger the Phaser construction animation via prop
    setConstruct({ x: gridX, y: gridY, templateId, level: 1, key: Date.now() })
  }

  // Called by WorldCanvas when the Red-Alert construction anim finishes.
  // Persists to DB and shows Alhamdulillah.
  const finishConstruction = useCallback(async (payload) => {
    // Detect if this was an upgrade or fresh build
    const isUpgrade = !!payload?.isUpgrade
    try {
      if (isUpgrade) {
        const target = (worldState?.buildings || []).find(b => b.templateId === payload.templateId)
        if (!target) { setRitual(null); setConstruct(null); return }
        const r = await fetch(`/api/world/${childId}/upgrade`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buildingId: target.id }),
        })
        if (r.ok) {
          haptic.ihsan()
          setRitual({ phase: 'alhamdulillah', templateId: payload.templateId })
          await load()
        } else { setRitual(null) }
      } else {
        const r = await fetch(`/api/world/${childId}/build`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: payload.templateId, x: payload.x, y: payload.y }),
        })
        if (r.ok) {
          haptic.ihsan()
          setRitual({ phase: 'alhamdulillah', templateId: payload.templateId })
          await load()
        } else {
          haptic.locked()
          setRitual(null)
        }
      }
    } catch { setRitual(null) }
    setConstruct(null)
    setTimeout(() => {
      setRitual(null)
    }, 2500)
  }, [childId, worldState, load])

  const dismissRitual = () => setRitual(null)

  // ─── Auto-place algorithm ─────────────────────────────────
  // Find nearest empty cell in a spiral radiating out from musalla anchor.
  const autoPlace = (templateId, existingBuildings) => {
    const occupied = new Set(existingBuildings.map(b => `${b.x},${b.y}`))
    const musalla = existingBuildings.find(b => b.templateId === 'musalla')
    const anchor = musalla ? { x: musalla.x, y: musalla.y } : MUSALLA_ANCHOR
    // Musalla RESERVED footprint is 4×4 (for future Masjid/Jami' upgrade)
    // — mark all 16 cells as occupied so autoplace never puts a house
    // inside the sacred growth zone.
    if (musalla) {
      for (let dx = 0; dx < 4; dx++)
        for (let dy = 0; dy < 4; dy++)
          occupied.add(`${musalla.x + dx},${musalla.y + dy}`)
    }
    // Dynamic world bounds (18×18 initially, expands to 24/30/36)
    const bounds = getCurrentBounds({ buildings: existingBuildings })
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
          if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) continue
          if (!occupied.has(`${x},${y}`)) candidates.push({ x, y })
        }
      }
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)]
      }
    }
    // Fallback: any empty cell within bounds
    for (let y = bounds.minY; y < bounds.maxY; y++) {
      for (let x = bounds.minX; x < bounds.maxX; x++) {
        if (!occupied.has(`${x},${y}`)) return { x, y }
      }
    }
    return null
  }

  // ─── Upgrade handler ──────────────────────────────────────
  const executeUpgrade = async () => {
    if (!upgradeTarget) return
    const t = BUILDING_TEMPLATES[upgradeTarget.templateId]
    if (!t || (upgradeTarget.level || 1) >= (t.maxLevel || 1)) {
      setUpgradeTarget(null)
      return
    }
    haptic.tap()
    setRitual({ phase: 'bismillah', templateId: upgradeTarget.templateId, isUpgrade: true })
    setUpgradeTarget(null)
  }

  const confirmUpgrade = async () => {
    if (!ritual) return
    const targetBuilding = (worldState?.buildings || []).find(b => b.templateId === ritual.templateId)
    if (!targetBuilding) { setRitual(null); return }
    setRitual({ ...ritual, phase: 'building' })
    // Trigger construction anim on the target building (with next level for visual pop)
    setConstruct({
      x: targetBuilding.x, y: targetBuilding.y,
      templateId: ritual.templateId,
      level: (targetBuilding.level || 1) + 1,
      key: Date.now(),
      isUpgrade: true,
    })
  }

  // ─── World canvas event handler (cell taps + construction completion) ────
  const handleCanvasEvent = useCallback((type, payload) => {
    if (type === 'construction-done') {
      // Alhamdulillah — the building is complete. This is the natural moment
      // for gratitude to Allah for what has been given. Feels celebratory
      // pairs beautifully with the sparkle burst Phaser plays at completion.
      alhamdulillah()
      finishConstruction(payload)
      return
    }
    if (type === 'drag-armed') {
      // Long-press engaged drag mode — give a tactile buzz so the child knows
      // the building is now "picked up" and can be repositioned safely.
      // Also Bismillah: the child is starting the act of moving/restructuring
      // — every deliberate action starts with the name of Allah.
      haptic.select()
      bismillah()
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(30) } catch { /* noop */ }
      }
      return
    }
    if (type === 'building-moved') {
      // User drag-dropped a building; persist to server immediately, but DO NOT
      // update local worldState yet — Phaser plays a 10s restructure animation
      // to teach patience & effort. State patch happens on 'restructure-done'.
      ;(async () => {
        try {
          const r = await fetch(`/api/world/${childId}/move`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buildingId: payload.buildingId,
              x: payload.x, y: payload.y,
            }),
          })
          if (!r.ok) {
            haptic.locked()
            await load()  // server rejected → revert
          }
          // Success: server DB now shows new position; Phaser animation runs
          // in parallel. No state update here — that comes on restructure-done.
        } catch {
          await load()
        }
      })()
      return
    }
    if (type === 'restructure-done') {
      // Phaser finished the 10s restructure — sync local state to match.
      // Alhamdulillah: the rebuilding is complete, the child sees their new
      // arrangement — natural moment for gratitude & completion satisfaction.
      haptic.select()
      alhamdulillah()
      setWorldState(prev => prev ? ({
        ...prev,
        buildings: (prev.buildings || []).map(b =>
          b.id === payload.buildingId ? { ...b, x: payload.x, y: payload.y } : b
        ),
      }) : prev)
      return
    }
    if (type === 'world-expanded') {
      // Phaser detected buildings count crossed a threshold and the world
      // grew to a bigger extent. Show a celebratory toast so the child feels
      // rewarded for their progress ("Wow, my world grew!"), and play
      // Alhamdulillah to root the excitement in gratitude to Allah for the
      // barakah — this is the pedagogical moment we want to associate the
      // dopamine hit with dhikr, not with pure "achievement" euphoria.
      haptic.success?.()
      alhamdulillah()
      setExpandToast({ size: payload.size, key: Date.now() })
      return
    }
    if (type === 'cell-tap') {
      const b = (worldState?.buildings || []).find(building => {
        const t = BUILDING_TEMPLATES[building.templateId]
        const size = t?.tileSize || { w: 1, h: 1 }
        return payload.col >= building.x && payload.col < building.x + size.w &&
               payload.row >= building.y && payload.row < building.y + size.h
      })
      if (b) {
        haptic.select()
        // Attach anchor coords so InfoCard positions itself near the building
        setUpgradeTarget({
          ...b,
          anchor: { screenX: payload.screenX, screenY: payload.screenY },
        })
      }
    }
  }, [worldState, childId, finishConstruction, load])
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
          <p className="text-emerald-800 mb-4">{l('pickChild', lang)}</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold">{l('back', lang)}</button>
        </div>
      </div>
    )
  }

  const buildings = worldState?.buildings || []
  const hasMusalla = buildings.some(b => b.templateId === 'musalla')
  const musalla = buildings.find(b => b.templateId === 'musalla')
  const isRTL = lang === 'ar'

  // Lock Phaser cell taps whenever any React overlay is visible, so that clicks
  // on modal buttons (Bismillah confirm, Upgrade dialog, Onboarding, etc.) don't
  // simultaneously trigger a tile hit-zone underneath them.
  const overlayOpen = !!ritual || !!upgradeTarget || showOnboarding

  return (
    <div className="fixed inset-0 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'} style={{
      background: 'radial-gradient(1200px 800px at 50% 30%, #a8dda8 0%, #6eaa6e 45%, #2d5c3a 100%)',
    }}>
      {/* Phaser canvas — pointer events disabled whenever a React overlay is up
          so button taps on modals never bleed through to isometric tiles below. */}
      <div className={`absolute inset-0 ${overlayOpen ? 'pointer-events-none' : ''}`}>
        {!loading && worldState && (
          <WorldCanvas
            childId={childId}
            worldState={worldState}
            onEvent={handleCanvasEvent}
            interactionLocked={overlayOpen}
            construct={construct}
            lang={lang}
            cameraCommand={cameraCommand}
            buildDrag={buildDrag}
          />
        )}
      </div>

      {/* Floating zoom + center controls — right side above sidebar */}
      {!overlayOpen && hasMusalla && (
        <div className="absolute right-3 bottom-40 z-30 flex flex-col gap-2 pointer-events-auto">
          <button
            onClick={() => setCameraCommand({ action: 'zoomIn', key: Date.now() })}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur border-2 border-emerald-300 shadow-lg text-emerald-700 font-black text-xl active:scale-90"
            aria-label="Zoom in"
          >+</button>
          <button
            onClick={() => setCameraCommand({ action: 'zoomOut', key: Date.now() })}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur border-2 border-emerald-300 shadow-lg text-emerald-700 font-black text-xl active:scale-90"
            aria-label="Zoom out"
          >−</button>
          <button
            onClick={() => setCameraCommand({ action: 'center', key: Date.now() })}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur border-2 border-amber-300 shadow-lg text-amber-700 active:scale-90 flex items-center justify-center"
            aria-label="Center on Musalla"
          >🕌</button>
          {/* Audio mute toggle — parents (or older kids) can silence Bismillah
              /Alhamdulillah cues during quiet hours (naps, live prayer, etc.).
              Preference persists via localStorage. */}
          <button
            onClick={() => { toggleMuted(); haptic.tap() }}
            className={`w-10 h-10 rounded-full backdrop-blur border-2 shadow-lg active:scale-90 flex items-center justify-center transition-colors ${
              audioMuted
                ? 'bg-white/90 border-slate-300 text-slate-500'
                : 'bg-white/90 border-emerald-300 text-emerald-700'
            }`}
            aria-label={audioMuted ? 'Unmute audio' : 'Mute audio'}
            title={audioMuted ? (lang === 'ms' ? 'Bunyikan audio' : 'Unmute') : (lang === 'ms' ? 'Senyapkan audio' : 'Mute')}
          >
            {audioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      )}

      {/* ═══ CLOUD OVERLAY — visualizes demeritCount by darkening the sky ═══
          Each demerit adds a semi-opaque grey layer + drift animation.
          Istighfar reduces demeritCount via /demerit endpoint, sky clears. */}
      <CloudOverlay demeritCount={worldState?.demeritCount || 0} lang={lang} />

      {/* ═══ WORLD EXPANSION TOAST — celebrates progressive growth ═══
          When the buildings count crosses 5/10/15, the world enlarges and a
          pill toast greets the child so they notice their progress. */}
      <AnimatePresence>
        {expandToast && (
          <motion.div
            key={expandToast.key}
            initial={{ opacity: 0, y: -30, scale: 0.85 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            onAnimationComplete={() => {
              // Auto-dismiss after ~3.6s
              setTimeout(() => setExpandToast(t => (t?.key === expandToast.key ? null : t)), 3600)
            }}
            className="fixed left-1/2 -translate-x-1/2 top-16 z-40 pointer-events-none"
          >
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl px-5 py-3 shadow-2xl border-2 border-white/40 flex items-center gap-3">
              <span className="text-2xl">🌍</span>
              <div className="text-left">
                <div className="font-black text-sm leading-tight">{l('worldGrew', lang)}</div>
                <div className="text-xs opacity-90 leading-tight">{l('worldGrewSub', lang)}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header — back button + title */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between pointer-events-none">
        <button
          onClick={() => router.push('/kid?childId=' + childId)}
          className="pointer-events-auto flex items-center gap-1 rounded-xl bg-white/85 backdrop-blur px-3 py-2 text-emerald-900 font-black text-sm shadow active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> {l('back', lang)}
        </button>
        <div className="pointer-events-none text-center">
          <div className="text-white font-black text-lg drop-shadow-lg">
            🌍 {l('yourWorld', lang)} {child?.nickname || l('you', lang)}
          </div>
          <div className="text-white/80 text-xs">
            {buildings.length} {l('buildings', lang)}{' · '}
            {musalla
              ? `${getBuildingName('musalla', musalla.level, lang)} ${l('buildLevel', lang)} ${musalla.level}`
              : l('buildMusalla', lang)}
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
              {l('buildBuilding', lang)}
            </div>
            {hasMusalla && (
              <div className="ml-auto text-[10px] font-bold text-emerald-800/60 flex items-center gap-1">
                <span>✋</span> {l('dragHint', lang)}
              </div>
            )}
          </div>

          {/* Category tabs — visible only after Musalla is built (before that
              the sidebar shows only the Musalla ritual entry).  */}
          {hasMusalla && (
            <div className="flex gap-1 mb-2 overflow-x-auto pb-1 -mx-1 px-1">
              {BUILDING_CATEGORIES.filter(c => c.id !== 'ibadah').map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-black transition-all active:scale-95
                    ${activeCategory === cat.id
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-md'
                      : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'}`}
                >
                  <span className="text-base leading-none">{cat.icon}</span>
                  <span>{cat.name[lang] || cat.name.ms}</span>
                </button>
              ))}
            </div>
          )}

          {/* Variant grid — either the Musalla entry (pre-mosque) OR the active category's variants */}
          <div
            className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto"
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          >
            {(!hasMusalla
              ? [BUILDING_TEMPLATES.musalla]
              : getVariantsForCategory(activeCategory)
            ).map(t => {
              const isBuilt = buildings.some(b => b.templateId === t.id)
              const isLocked = t.id !== 'musalla' && !hasMusalla
              const isMusallaFirst = t.id === 'musalla' && !isBuilt
              const isDisabled = isLocked || (t.id === 'musalla' && isBuilt)
              // Age-appropriate unlock (K2 gated): standard variants unlock
              // after 2 built in the category, premium after 5. For now we
              // default to K2 progression — future work: read the actual
              // child's ageBand from profile and disable gating for K1 (3-6).
              const isK2 = true
              const catCount = buildings.filter(b => BUILDING_TEMPLATES[b.templateId]?.category === t.category).length
              const tierLocked = isK2 && (
                (t.tier === 'standard' && catCount < 2) ||
                (t.tier === 'premium'  && catCount < 5)
              )
              const finalLocked = isDisabled || tierLocked
              const startDrag = (e) => {
                if (finalLocked) return
                e.preventDefault()
                const p = e.touches?.[0] || e
                setBuildDrag({ templateId: t.id, pointerX: p.clientX, pointerY: p.clientY })
                haptic.select()
              }
              const tierBadge = t.tier === 'premium' ? '💎' : t.tier === 'standard' ? '⭐' : ''
              return (
                <button
                  key={t.id}
                  onPointerDown={startDrag}
                  onTouchStart={startDrag}
                  disabled={finalLocked}
                  style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                  className={`relative rounded-xl border-2 p-2 text-left transition-all active:scale-95
                    ${finalLocked ? 'opacity-40 border-gray-200 bg-gray-50' :
                      isMusallaFirst ? 'border-amber-400 bg-amber-50 animate-pulse' :
                      buildDrag?.templateId === t.id ? 'border-emerald-500 bg-emerald-100 scale-105' :
                      'border-emerald-300 bg-white hover:bg-emerald-50/60'}`}
                >
                  <div className="text-2xl leading-none mb-1 flex items-center justify-between">
                    <span>{t.icon}</span>
                    {tierBadge && <span className="text-[10px]">{tierBadge}</span>}
                  </div>
                  <div className="text-[10px] font-black text-emerald-900 leading-tight">
                    {t.name[lang] || t.name.ms}
                  </div>
                  <div className="text-[9px] text-emerald-700/70">
                    {t.cost === 0 ? l('free', lang) : `${t.cost} ${l('points', lang)}`}
                  </div>
                  {isMusallaFirst && (
                    <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">
                      {l('start', lang)}
                    </div>
                  )}
                  {tierLocked && !isDisabled && (
                    <div className="absolute inset-0 flex items-center justify-center text-lg bg-white/40 rounded-xl">🔒</div>
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
            isUpgrade={ritual.isUpgrade}
            lang={lang}
            onConfirm={confirmBismillah}
            onCancel={dismissRitual}
          />
        )}
        {ritual?.phase === 'building' && <BuildingProgressOverlay lang={lang} />}
        {ritual?.phase === 'alhamdulillah' && (
          <AlhamdulillahOverlay templateId={ritual.templateId} lang={lang} />
        )}
      </AnimatePresence>

      {/* Upgrade dialog */}
      <AnimatePresence>
        {upgradeTarget && (
          <BuildingInfoCard
            building={upgradeTarget}
            anchor={upgradeTarget?.anchor}
            allBuildings={buildings}
            lang={lang}
            onConfirm={executeUpgrade}
            onCancel={() => setUpgradeTarget(null)}
          />
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
    <Suspense fallback={<div className="h-screen w-full bg-emerald-900 flex items-center justify-center text-white">…</div>}>
      <WorldPageInner />
    </Suspense>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

const OnboardingOverlay = ({ step, setStep, childName, lang, onComplete }) => {
  const cards = [
    { icon: '🕋', title: l('onboardTitle1', lang), text: l('onboardText1', lang) },
    { icon: '🏗️', title: l('onboardTitle2', lang), text: l('onboardText2', lang) },
    { icon: '💚', title: `${l('onboardTitle3', lang)} ${childName || l('you', lang)}`, text: l('onboardText3', lang) },
  ]
  const c = cards[step] || cards[0]
  const isRTL = lang === 'ar'
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex items-center justify-center p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
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
          {step < cards.length - 1 ? l('next', lang) : l('startBuilding', lang)}
        </button>
      </motion.div>
    </motion.div>
  )
}

const BismillahOverlay = ({ templateId, isUpgrade, lang, onConfirm, onCancel }) => {
  const t = BUILDING_TEMPLATES[templateId]
  const isRTL = lang === 'ar'
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[90] flex items-center justify-center p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ background: 'rgba(6, 63, 54, 0.85)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl p-6 text-center shadow-2xl"
      >
        <div className="text-6xl mb-2">{t?.icon}</div>
        <div className="text-xs uppercase tracking-widest font-black text-amber-600 mb-1">
          {isUpgrade ? l('upgradeTitle', lang) : l('bermulaBina', lang)} {t?.name[lang] || t?.name.ms}
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
          {isUpgrade ? l('upgradeBtn', lang) : l('bismillahBtn', lang)}
        </button>
        <button
          onClick={onCancel}
          className="w-full rounded-2xl bg-transparent text-emerald-700 font-bold py-2 text-sm"
        >
          {l('cancel', lang)}
        </button>
      </motion.div>
    </motion.div>
  )
}

const BuildingProgressOverlay = ({ lang = 'ms' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
    className="absolute left-1/2 -translate-x-1/2 top-16 z-[85] pointer-events-none"
  >
    <div className="bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow-lg flex items-center gap-2 border border-emerald-200">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="text-lg"
      >🏗️</motion.div>
      <div>
        <div className="font-black text-emerald-900 text-xs">{l('building', lang)}</div>
        <div className="text-[10px] text-emerald-700/70">{l('buildingSub', lang)}</div>
      </div>
    </div>
  </motion.div>
)

const AlhamdulillahOverlay = ({ templateId, lang }) => {
  const t = BUILDING_TEMPLATES[templateId]
  const isRTL = lang === 'ar'
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[90] flex items-center justify-center p-6 pointer-events-none"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-md w-full bg-gradient-to-br from-amber-100 to-emerald-100 border-4 border-amber-400 rounded-3xl p-6 text-center shadow-2xl">
        <div className="text-6xl mb-2">✨</div>
        <div className="text-xs uppercase tracking-widest font-black text-amber-600 mb-1">
          {t?.name[lang] || t?.name.ms} {l('siap', lang)}
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

// ═══════════════════════════════════════════════════════════════════════════
// CloudOverlay — dark clouds appear as demeritCount grows.
// Uses layered blurred CSS shapes for depth (no Phaser overhead).
// 0 demerit = clear sky, 10+ = heavy storm.
// ═══════════════════════════════════════════════════════════════════════════
const CloudOverlay = ({ demeritCount, lang }) => {
  if (!demeritCount || demeritCount <= 0) return null
  const clouds = Math.min(demeritCount, 10)
  // Overall darkening intensity (0 → 0.5 max)
  const darken = Math.min(0.5, demeritCount * 0.05)
  return (
    <div className="absolute inset-0 pointer-events-none z-[20] overflow-hidden">
      {/* Sky darkening layer */}
      <div className="absolute inset-0 transition-opacity duration-1000" style={{
        background: `rgba(20, 20, 30, ${darken})`,
      }} />
      {/* Individual cloud puffs — slow drift */}
      {[...Array(clouds)].map((_, i) => {
        const size = 120 + (i % 4) * 40
        const yPos = 5 + (i * 7) % 40   // spread top portion of screen
        const startX = -(i * 15) % 100
        const duration = 40 + (i % 5) * 8  // 40-72s drift
        return (
          <motion.div
            key={i}
            initial={{ x: `${startX - 20}vw` }}
            animate={{ x: `${startX + 120}vw` }}
            transition={{ duration, repeat: Infinity, ease: 'linear' }}
            className="absolute rounded-full"
            style={{
              top: `${yPos}%`,
              width: size,
              height: size * 0.55,
              background: 'radial-gradient(ellipse, rgba(45,50,65,0.85) 0%, rgba(45,50,65,0.35) 60%, transparent 100%)',
              filter: 'blur(12px)',
            }}
          />
        )
      })}
      {/* Hint text — shows only when clouds start appearing */}
      {clouds >= 3 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-black/50 backdrop-blur text-white/90 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5">
            🤲 {l('cloudsMsg', lang)}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BuildingInfoCard — LIGHTWEIGHT floating popover shown when child taps a
// building. Small, non-modal, dismisses on tap-outside. Shows compact info
// (icon + name + level + villagers + date). "Selanjutnya" button expands to
// show reflection + upgrade CTA in a compact side-drawer style.
// ═══════════════════════════════════════════════════════════════════════════
const BuildingInfoCard = ({ building, lang, onConfirm, onCancel, anchor, allBuildings = [] }) => {
  const t = BUILDING_TEMPLATES[building.templateId]
  const [expanded, setExpanded] = useState(false)
  if (!t) return null
  const currentLevel = building.level || 1
  const nextLevel = currentLevel + 1
  const isMax = nextLevel > (t.maxLevel || 1)
  const currentName = getBuildingName(building.templateId, currentLevel, lang)
  const nextName = getBuildingName(building.templateId, nextLevel, lang)
  const isRTL = lang === 'ar'

  // Check progressive-unlock requirements for upgrade
  const reqs = t.upgradeRequires?.[nextLevel] || null
  let reqMet = true
  const reqStatus = []
  if (reqs) {
    for (const [tid, need] of Object.entries(reqs)) {
      const have = allBuildings.filter(b => b.templateId === tid).length
      reqStatus.push({ tid, have, need, met: have >= need })
      if (have < need) reqMet = false
    }
  }

  // Compute anchor position — near building, above if enough space, otherwise below
  const anchorX = anchor?.screenX ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 200)
  const anchorY = anchor?.screenY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 300)
  const cardW = expanded ? 300 : 220
  const cardH = expanded ? 240 : 100
  // Position card above the building by default
  let cx = anchorX - cardW / 2
  let cy = anchorY - cardH - 40  // building height offset
  // Clamp to viewport
  if (typeof window !== 'undefined') {
    const pad = 12
    cx = Math.max(pad, Math.min(window.innerWidth - cardW - pad, cx))
    if (cy < pad) cy = anchorY + 40  // flip below if no room above
    cy = Math.min(window.innerHeight - cardH - pad, cy)
  }

  const placedDate = building.placedAt ? new Date(building.placedAt) : null
  const dateStr = placedDate
    ? placedDate.toLocaleDateString(lang === 'ar' ? 'ar' : (lang === 'ms' ? 'ms-MY' : (lang === 'id' ? 'id-ID' : 'en-GB')), {
        day: 'numeric', month: 'short',
      })
    : ''

  const reflection = {
    musalla: {
      ms: '"Masjid rumah setiap orang bertaqwa" — Tabrani',
      en: '"The mosque is the home of every pious" — Tabarani',
      id: '"Masjid rumah setiap orang bertakwa" — HR Tabrani',
      ar: '«المسجد بيت كل تقي» — رواه الطبراني',
    },
    rumah: {
      ms: 'Baiti Jannati — rumahku syurgaku 🏡',
      en: 'Baiti Jannati — my home, my paradise 🏡',
      id: 'Baiti Jannati — rumahku surgaku 🏡',
      ar: 'بيتي جنتي 🏡',
    },
    kebun: {
      ms: 'Menanam adalah sedekah 🌱',
      en: 'Planting is charity 🌱',
      id: 'Menanam adalah sedekah 🌱',
      ar: 'الغرس صدقة 🌱',
    },
  }[building.templateId] || {}
  const reflectionText = reflection[lang] || reflection.ms || ''

  return (
    <>
      {/* Invisible click-catcher: dismisses on tap-outside (no dark backdrop
          so world stays visible & non-intrusive). */}
      <div
        className="absolute inset-0 z-[92]"
        onClick={onCancel}
        style={{ background: 'transparent', pointerEvents: 'auto' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="absolute z-[95] pointer-events-auto"
        style={{ left: cx, top: cy, width: cardW }}
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-emerald-200 overflow-hidden">
          {/* Compact header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="text-3xl leading-none flex-shrink-0" style={{
              filter: t.isSacred ? 'drop-shadow(0 0 8px rgba(255,183,3,0.6))' : 'none',
            }}>{t.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-emerald-900 text-sm leading-tight truncate">
                {currentName}
              </div>
              <div className="text-[10px] text-emerald-700/70 font-semibold flex items-center gap-1.5 mt-0.5">
                <span className="bg-emerald-100 text-emerald-800 rounded-full px-1.5 py-0.5 font-black">L{currentLevel}</span>
                <span>🧕{t.villagerSpawn}</span>
                {dateStr && <span>📅{dateStr}</span>}
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-6 h-6 rounded-full text-emerald-700 hover:bg-emerald-50 text-lg leading-none flex-shrink-0 active:scale-90"
              aria-label="Close"
            >×</button>
          </div>

          {/* Expanded panel — refleksi + upgrade CTA */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-emerald-100"
              >
                <div className="px-3 py-2.5 space-y-2">
                  {reflectionText && (
                    <div className="text-[11px] italic text-emerald-800/85 leading-snug border-l-2 border-amber-300 pl-2">
                      {reflectionText}
                    </div>
                  )}
                  {!t.isSacred && (
                    <div className="text-[10px] text-emerald-700/60 flex items-center gap-1">
                      ✋ <span>{l('dragHint', lang)}</span>
                    </div>
                  )}
                  {isMax ? (
                    <div className="text-center text-xs font-black text-amber-600 py-1">
                      ✨ {l('maxLevel', lang)}
                    </div>
                  ) : reqs && !reqMet ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-2 space-y-1">
                      <div className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                        🔒 {l('needsMore', lang)}
                      </div>
                      {reqStatus.map(r => (
                        <div key={r.tid} className={`text-[10px] flex justify-between ${r.met ? 'text-emerald-700' : 'text-amber-800'}`}>
                          <span>{r.tid === 'rumah' ? '🏠 Rumah' : r.tid}</span>
                          <span className="font-bold">{r.have} / {r.need}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={onConfirm}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black py-2 text-xs active:scale-95 shadow"
                    >
                      ⬆️ {l('upgradeTo', lang)} {nextName}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle expand button */}
          {(reflectionText || !isMax) && (
            <button
              onClick={() => setExpanded(x => !x)}
              className="w-full text-[10px] font-bold text-emerald-600 py-1.5 border-t border-emerald-50 active:bg-emerald-50"
            >
              {expanded ? '▲' : '▼'} {expanded ? l('close', lang) : l('more', lang)}
            </button>
          )}
        </div>
      </motion.div>
    </>
  )
}
