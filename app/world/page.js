'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Package, Volume2, VolumeX } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { haptic } from '@/lib/feedback'
import { useLang } from '@/lib/i18n/LangProvider'
import audio, { installAutoPrime, isMuted, toggleMuted, bismillah, alhamdulillah, astaghfirullah } from '@/lib/audio'
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
  needForUpgrade:{ ms: 'Untuk naik taraf ke', en: 'To upgrade to', id: 'Untuk naik ke', ar: 'للترقية إلى' },
  autoUpgradeInfo:{
    ms: 'Naik taraf automatik apabila cukup rumah — tak perlu tekan apa-apa!',
    en: 'Auto-upgrades when enough houses are built — no button needed!',
    id: 'Naik otomatis saat cukup rumah — tidak perlu tekan tombol!',
    ar: 'ترقية تلقائية عند اكتمال البيوت — بدون ضغط أي زر!',
  },
  reqRumah:     { ms: '🏠 Rumah', en: '🏠 Houses', id: '🏠 Rumah', ar: '🏠 منازل' },
  reqKebun:     { ms: '🌴 Kebun', en: '🌴 Orchards', id: '🌴 Kebun', ar: '🌴 بساتين' },
  reqTernakan:  { ms: '🐄 Ternakan', en: '🐄 Livestock', id: '🐄 Ternak', ar: '🐄 ماشية' },
  reqPasar:     { ms: '🛒 Pasar', en: '🛒 Market', id: '🛒 Pasar', ar: '🛒 سوق' },
  reqAir:       { ms: '💧 Air', en: '💧 Water', id: '💧 Air', ar: '💧 ماء' },
  reqAwam:      { ms: '🏛️ Awam', en: '🏛️ Public', id: '🏛️ Umum', ar: '🏛️ عام' },
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
  // Ref that mirrors worldState — used to detect "first load" inside load()
  // without adding worldState as a dependency of the useCallback (which would
  // trigger a re-fetch on every state change and cause infinite loops).
  const worldStateRef = useRef(null)
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
  // Landmark celebration: shown when the server auto-places a Surau (@5)
  // or Masjid (@10) after a build. Object shape: { templateId, x, y, id }.
  const [landmarkCelebration, setLandmarkCelebration] = useState(null)
  const [autoUpgradeCelebration, setAutoUpgradeCelebration] = useState(null)
  // Construction sequel — after the AutoUpgrade popup closes, show a 10s
  // scaffolding + progress ceremony so kids see the "wow" moment of the
  // Musalla physically becoming a bigger Masjid.
  const [upgradeConstruction, setUpgradeConstruction] = useState(null)
  // Move confirmation: shown after the child drops a building on a new cell.
  // Prevents accidental relocations from stray drags. Cleared on confirm/cancel.
  // Shape: { buildingId, templateId, x, y, origX, origY, screenX, screenY }
  const [moveConfirmation, setMoveConfirmation] = useState(null)
  // Istighfar overlay — opens when child taps a black cloud. Requires
  // 10 completions of Astaghfirullah (with 3s cooldown between each tap)
  // to clear one demerit → one cloud fades from the sky.
  const [istighfarOpen, setIstighfarOpen] = useState(false)
  // Archipelago Map — entry gate to the world scene. On every visit, kids
  // land on the archipelago first, pick their island, then descend into
  // that island's world. Currently only "Pulau Impianku" is playable; the
  // other 6 slots are locked/generic ("Coming Soon"). Selection lives in
  // localStorage so a mid-session refresh keeps them on the picked island.
  const [selectedIslandId, setSelectedIslandId] = useState(null)
  const [archipelagoOpen, setArchipelagoOpen] = useState(true)
  useEffect(() => {
    // Hydrate persisted island choice (SSR-safe)
    try {
      const saved = localStorage.getItem('eqrel-selected-island')
      if (saved) {
        setSelectedIslandId(saved)
        setArchipelagoOpen(false)
      }
    } catch { /* noop */ }
  }, [])
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
    // Only flip `loading` to true on the FIRST fetch (when we have no world
    // state yet). Subsequent refreshes (after build/move/upgrade) MUST NOT
    // unmount the WorldCanvas — that would destroy the Phaser game and reset
    // camera scroll to the default Musalla-centered view. Instead we quietly
    // refetch and setWorldState which nudges Phaser via registry sync.
    // (User: "camera masih jump selepas popup alhamdulillah siap binaan
    //  baru" — this was the root cause.)
    const isFirstLoad = !worldStateRef.current
    if (isFirstLoad) setLoading(true)
    try {
      const r = await fetch(`/api/world/${childId}`, { credentials: 'include' })
      if (r.ok) {
        const data = await r.json()
        setWorldState(data.world)
        worldStateRef.current = data.world
        setChild(data.child)
        const hasMusalla = (data.world.buildings || []).some(b => b.templateId === 'musalla')
        if (!hasMusalla) {
          const seen = typeof window !== 'undefined' &&
                       localStorage.getItem(`eqrel-world-onboarding-${childId}`) === '1'
          if (!seen) setShowOnboarding(true)
        }
      }
    } finally { if (isFirstLoad) setLoading(false) }
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

  // ─── Move confirmation handlers ─────────────────────────────
  // When the child drops a dragged building onto a new cell, Phaser snaps
  // it back to origin and emits 'building-move-requested'. We show a small
  // card; only if the child confirms do we (a) tell Phaser to play the
  // 10s restructure animation at destination, and (b) POST to /move. If
  // the child cancels or taps outside, nothing is committed (safe from
  // accidental drags).
  const confirmMoveRelocate = async () => {
    if (!moveConfirmation) return
    const { buildingId, x, y } = moveConfirmation
    setMoveConfirmation(null)
    haptic.ihsan()
    // Kick off the restructure animation in Phaser via the scene method
    const scene = (typeof window !== 'undefined')
      ? window.__eqrelPhaser?.scene?.getScene?.('WorldScene')
      : null
    scene?.confirmPendingMove?.(buildingId, x, y)
    // Persist to server in parallel — the restructure animation runs for
    // ~10s so we have plenty of time; on failure we revert via load().
    try {
      const r = await fetch(`/api/world/${childId}/move`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, x, y }),
      })
      if (!r.ok) {
        haptic.locked()
        await load()
      }
    } catch {
      await load()
    }
  }
  const cancelMoveRelocate = () => {
    if (!moveConfirmation) return
    const scene = (typeof window !== 'undefined')
      ? window.__eqrelPhaser?.scene?.getScene?.('WorldScene')
      : null
    scene?.cancelPendingMove?.(moveConfirmation.buildingId)
    setMoveConfirmation(null)
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
          const data = await r.json().catch(() => ({}))
          haptic.ihsan()
          setRitual({ phase: 'alhamdulillah', templateId: payload.templateId })
          await load()
          // If the server auto-placed a milestone landmark (Surau @ 5, Masjid
          // @ 10), queue a celebratory overlay AFTER the alhamdulillah dismiss
          // so the child sees "Kampung anda telah dianugerahkan..." pop up.
          if (Array.isArray(data.newLandmarks) && data.newLandmarks.length > 0) {
            setTimeout(() => setLandmarkCelebration(data.newLandmarks[0]), 2800)
          }
          // If the server AUTO-UPGRADED the Musalla (7 rumah → Masjid, 15
          // rumah → Jami' Masjid), queue a pedagogical celebration popup
          // so the child understands their houses/jemaah made the mosque grow.
          if (data.autoUpgrade) {
            setTimeout(() => setAutoUpgradeCelebration(data.autoUpgrade), 3000)
          }
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
    if (type === 'building-move-requested') {
      // User dragged a building onto a new valid cell. Instead of committing
      // the move (which caused accidental relocations from stray drags), we
      // pop a small confirmation card near the destination. The building has
      // already snapped back to its origin in Phaser — nothing is committed
      // until the child taps "Ya, alih". On cancel we just dismiss the card.
      haptic.select()
      setMoveConfirmation(payload)
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

  // Lock Phaser cell taps + sidebar clicks whenever any React overlay is
  // visible, so that clicks on modal buttons don't simultaneously trigger a
  // tile hit-zone or a sidebar variant tile underneath them. Includes ALL
  // types of overlays that block gameplay.
  const overlayOpen = !!ritual || !!upgradeTarget || showOnboarding ||
                      !!moveConfirmation || !!landmarkCelebration || !!autoUpgradeCelebration || !!upgradeConstruction

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

      {/* Beautiful loading splash — shown ONLY on first mount while world
          data is being fetched. Cycles through motivational Islamic sayings
          so kids feel invited into the world instead of staring at a blank
          screen. */}
      <AnimatePresence>
        {loading && (
          <WorldLoadingScreen key="world-loading" lang={lang} />
        )}
      </AnimatePresence>

      {/* ═══ ARCHIPELAGO MAP — entry gate ═══
          Shown first-visit and when the child taps 🗺️ in the world view.
          Only "Pulau Impianku" is playable; the other 6 slots are generic
          locked placeholders (nama/tema belum diputuskan). Selection is
          persisted so a page refresh keeps the child on their island. */}
      <AnimatePresence>
        {archipelagoOpen && (
          <ArchipelagoMap
            key="archipelago"
            lang={lang}
            worldState={worldState}
            onSelectIsland={(id) => {
              setSelectedIslandId(id)
              setArchipelagoOpen(false)
              try { localStorage.setItem('eqrel-selected-island', id) } catch { /* noop */ }
            }}
          />
        )}
      </AnimatePresence>

      {/* Move confirmation card — floats near destination cell when child
          drops a dragged building. Prevents accidental relocations. */}
      {moveConfirmation && (
        <MoveConfirmCard
          confirmation={moveConfirmation}
          lang={lang}
          onConfirm={confirmMoveRelocate}
          onCancel={cancelMoveRelocate}
        />
      )}

      {/* Floating zoom + center controls — right side above sidebar */}
      {!overlayOpen && hasMusalla && (
        <div className="absolute right-3 bottom-40 z-30 flex flex-col gap-2 pointer-events-auto">
          <button
            onClick={() => setArchipelagoOpen(true)}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur border-2 border-amber-400 shadow-lg text-amber-600 text-lg active:scale-90"
            aria-label="Archipelago Map"
            title="Peta Kepulauan"
          >🗺️</button>
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
          Tapping ANY cloud opens IstighfarModal — 10× Astaghfirullah clears
          one cloud (backend decrements demeritCount by 1 via /demerit endpoint). */}
      <CloudOverlay
        demeritCount={worldState?.demeritCount || 0}
        lang={lang}
        onOpenIstighfar={() => setIstighfarOpen(true)}
      />
      {/* ═══ ISTIGHFAR MODAL — child's path to remove a black cloud ═══ */}
      <AnimatePresence>
        {istighfarOpen && (worldState?.demeritCount || 0) > 0 && (
          <IstighfarModal
            lang={lang}
            onClose={() => setIstighfarOpen(false)}
            onComplete={async () => {
              // Decrement demeritCount by 1 on server, then refetch.
              try {
                await fetch(`/api/world/${childId}/demerit`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ delta: -1 }),
                })
                await load()
              } catch (e) { /* swallow */ }
              setIstighfarOpen(false)
            }}
          />
        )}
      </AnimatePresence>

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

      {/* Sidebar — Build menu. When any modal overlay is open, we lower the
          sidebar into pointer-events-none so tapping popup buttons above it
          never leaks into a sidebar variant tile / category tab below. */}
      <div className={`absolute bottom-0 left-0 right-0 p-3 z-30 ${overlayOpen ? 'pointer-events-none' : ''}`}>
        <div className={`bg-white/90 backdrop-blur rounded-2xl border-2 border-white/60 shadow-xl p-3 ${overlayOpen ? 'pointer-events-none opacity-70' : 'pointer-events-auto'}`}>
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
                    {t.spriteAsset ? (
                      <img
                        src={t.spriteAsset}
                        alt={t.name[lang] || t.name.ms}
                        draggable={false}
                        className="h-9 w-9 object-contain drop-shadow-sm pointer-events-none"
                        style={{ imageRendering: 'auto' }}
                      />
                    ) : (
                      <span>{t.icon}</span>
                    )}
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
        {landmarkCelebration && (
          <LandmarkCelebrationOverlay
            key={landmarkCelebration.id}
            landmark={landmarkCelebration}
            lang={lang}
            onClose={() => setLandmarkCelebration(null)}
          />
        )}
        {autoUpgradeCelebration && (
          <AutoUpgradeCelebrationOverlay
            key={`upg-${autoUpgradeCelebration.buildingId}-${autoUpgradeCelebration.toLevel}`}
            upgrade={autoUpgradeCelebration}
            lang={lang}
            onClose={() => {
              // Chain into 10-second construction ceremony so the child sees
              // the Masjid physically "being built" — creates the wow moment
              // the user asked for (upgrade dari L1→L2 tak feel enough).
              setUpgradeConstruction({
                fromLevel: (autoUpgradeCelebration.toLevel || 2) - 1,
                toLevel: autoUpgradeCelebration.toLevel,
              })
              setAutoUpgradeCelebration(null)
            }}
          />
        )}
        {upgradeConstruction && (
          <UpgradeConstructionOverlay
            key={`constr-${upgradeConstruction.toLevel}`}
            upgrade={upgradeConstruction}
            lang={lang}
            onClose={() => setUpgradeConstruction(null)}
          />
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
  // Prefer the actual illustrated PNG over the fallback emoji so the child
  // sees the exact building/orchard art they're about to construct — a
  // stronger "Bismillah" moment than a generic 🏠 or 🌴 icon.
  const spriteSrc = t?.spriteAsset
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
        {spriteSrc ? (
          <div className="mx-auto mb-3 h-24 w-24 flex items-end justify-center">
            <img
              src={spriteSrc}
              alt={t?.name?.[lang] || t?.name?.ms || templateId}
              className="max-h-24 max-w-24 object-contain drop-shadow-md"
              draggable={false}
            />
          </div>
        ) : (
          <div className="text-6xl mb-2">{t?.icon}</div>
        )}
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
  const spriteSrc = t?.spriteAsset
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[90] flex items-center justify-center p-6 pointer-events-none"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-md w-full bg-gradient-to-br from-amber-100 to-emerald-100 border-4 border-amber-400 rounded-3xl p-6 text-center shadow-2xl">
        {spriteSrc ? (
          // Real asset surrounded by celebratory sparkles — child sees exactly
          // what they've just built rather than a generic ✨ emoji.
          <div className="relative mx-auto mb-2 h-28 w-28 flex items-end justify-center">
            <motion.span
              className="absolute top-0 left-0 text-2xl"
              animate={{ scale: [0.8, 1.2, 0.8], rotate: [0, 15, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >✨</motion.span>
            <motion.span
              className="absolute top-2 right-0 text-xl"
              animate={{ scale: [1.2, 0.8, 1.2], rotate: [0, -20, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            >✨</motion.span>
            <motion.span
              className="absolute bottom-0 right-2 text-lg"
              animate={{ scale: [0.9, 1.3, 0.9] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            >✨</motion.span>
            <img
              src={spriteSrc}
              alt={t?.name?.[lang] || t?.name?.ms || templateId}
              className="max-h-28 max-w-28 object-contain drop-shadow-lg"
              draggable={false}
            />
          </div>
        ) : (
          <div className="text-6xl mb-2">✨</div>
        )}
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
// LandmarkCelebrationOverlay — full-screen "🕌 Alhamdulillah!" moment that
// fires when the ummah earns its milestone landmark (Surau @ 5 buildings,
// Masjid @ 10). Auto-dismisses after 4s. Tappable to dismiss earlier.
// ═══════════════════════════════════════════════════════════════════════════
const LandmarkCelebrationOverlay = ({ landmark, lang, onClose }) => {
  const t = BUILDING_TEMPLATES[landmark.templateId] || {}
  const isRTL = lang === 'ar'
  useEffect(() => {
    const timer = setTimeout(onClose, 4500)
    return () => clearTimeout(timer)
  }, [onClose])
  // Special headline copy in each language — celebratory not ritualistic.
  const HEADLINES = {
    surau: {
      ms: 'Alhamdulillah! Kampung anda telah dianugerahkan sebuah Surau!',
      en: 'Alhamdulillah! Your village has earned a Surau!',
      id: 'Alhamdulillah! Kampung kamu telah dianugerahkan Surau!',
      ar: 'الحمد لله! لقد نالت قريتكم مصلى!',
    },
    masjid_landmark: {
      ms: 'MasyaAllah! Kampung anda sudah cukup besar untuk sebuah Masjid!',
      en: 'MashaAllah! Your village is big enough for a Mosque!',
      id: 'MasyaAllah! Kampung kamu sudah cukup besar untuk Masjid!',
      ar: 'ما شاء الله! قريتكم كبيرة كفايةً لمسجد!',
    },
  }
  const SUBS = {
    surau: {
      ms: 'Setiap kali kamu tunaikan solat & habit, kampung ini akan terus membesar. Teruskan!',
      en: 'Every prayer & habit you complete grows your village. Keep going!',
      id: 'Setiap salat & habit yang kamu selesaikan menumbuhkan kampung ini. Terus semangat!',
      ar: 'كل صلاة وعادة تكملها تنمّي قريتكم. استمرّ!',
    },
    masjid_landmark: {
      ms: 'Sekarang azan boleh berkumandang di kampung kamu. Ajaklah lebih ramai jamaah!',
      en: 'The adhan can now echo through your village. Invite more jamaah!',
      id: 'Azan kini berkumandang di kampung kamu. Ajak lebih banyak jamaah!',
      ar: 'صار الأذان يُرفع في قريتكم. ادعُ المزيد من الجماعة!',
    },
  }
  const headline = HEADLINES[landmark.templateId]?.[lang] || HEADLINES[landmark.templateId]?.ms
  const sub = SUBS[landmark.templateId]?.[lang] || SUBS[landmark.templateId]?.ms
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-[95] flex items-center justify-center p-6 cursor-pointer"
      style={{ background: 'radial-gradient(ellipse at center, rgba(13,91,78,0.55) 0%, rgba(0,0,0,0.75) 100%)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ scale: 0.5, y: 40, rotate: -6 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="max-w-md w-full bg-gradient-to-br from-amber-50 via-emerald-50 to-teal-50 border-4 border-amber-400 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden"
      >
        {/* Sunburst backdrop */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
          backgroundImage: 'repeating-conic-gradient(from 0deg, transparent 0deg 10deg, rgba(255,183,3,0.3) 10deg 20deg)',
        }} />
        <div className="relative">
          <motion.div
            className="text-7xl mb-2"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            {t.icon || '🕌'}
          </motion.div>
          <div className="text-xs uppercase tracking-widest font-black text-amber-700 mb-2">
            {landmark.templateId === 'surau' ? 'MILESTONE · 5' : 'MILESTONE · 10'}
          </div>
          <div className="font-black text-emerald-900 text-lg mb-3 leading-snug">
            {headline}
          </div>
          <div className="text-sm text-emerald-800/80 leading-relaxed">
            {sub}
          </div>
          <div className="text-[10px] text-emerald-700/60 mt-4 uppercase tracking-wider">
            {lang === 'ar' ? 'انقر للمتابعة' : lang === 'en' ? 'Tap to continue' : lang === 'id' ? 'Ketuk untuk lanjut' : 'Tekan untuk teruskan'}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// WorldLoadingScreen — full-viewport splash shown while the world state is
// being fetched. Displays a rotating library of short Islamic-themed
// motivational phrases in the child's language so they feel invited into
// the world (rather than seeing a blank/broken screen). Uses a soft
// gradient background matching the world's palette + animated mosque icon.
// (User: "buat satu loading animation pages dengan kata2 motivasi untuk
//  anak masuk ke world sementara world tengah loading, ini untuk avoid
//  kids berasa world tak function".)
// ═══════════════════════════════════════════════════════════════════════════
const WorldLoadingScreen = ({ lang = 'ms' }) => {
  // 6 kid-friendly Islamic motivational phrases per language, rotated every
  // ~2.4s so the screen feels alive during a slow fetch.
  const MSG_BANK = {
    ms: [
      'Bismillahirrahmanirrahim…',
      'Kampung kamu sedang menanti…',
      'Setiap amal kecil dinilai Allah 🌱',
      'Menyediakan dunia kamu…',
      'Rumah bertambah, jemaah gembira!',
      'Setiap zikir menyinari kampungmu ✨',
    ],
    en: [
      'Bismillahirrahmanirrahim…',
      'Your village awaits you…',
      'Every small deed counts with Allah 🌱',
      'Preparing your world…',
      'More houses, joyful jamaah!',
      'Every dhikr lights up your village ✨',
    ],
    id: [
      'Bismillahirrahmanirrahim…',
      'Kampungmu sedang menantimu…',
      'Setiap amal kecil bernilai di sisi Allah 🌱',
      'Menyiapkan duniamu…',
      'Rumah bertambah, jemaah bahagia!',
      'Setiap zikir menyinari kampungmu ✨',
    ],
    ar: [
      'بسم الله الرحمن الرحيم…',
      'قريتك تنتظرك…',
      'كل عمل صغير له قيمة عند الله 🌱',
      'نُهيّئ عالمك…',
      'المزيد من البيوت، جماعة سعيدة!',
      'كل ذكر يُنير قريتك ✨',
    ],
  }
  const HEADING = {
    ms: 'Selamat datang ke Kampung EQ',
    en: 'Welcome to Your EQ Village',
    id: 'Selamat datang di Kampung EQ',
    ar: 'أهلاً بك في قرية EQ',
  }
  const HINT = {
    ms: 'Sabar sedikit ya, jangan pergi jauh…',
    en: 'Hold on for a moment, don\u2019t go far…',
    id: 'Sabar sebentar ya, jangan pergi jauh…',
    ar: 'اصبر قليلاً، لا تذهب بعيدًا…',
  }
  const msgs = MSG_BANK[lang] || MSG_BANK.ms
  const [msgIdx, setMsgIdx] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 2400)
    return () => clearInterval(timer)
  }, [msgs.length])
  const isRTL = lang === 'ar'
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[95] flex flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(ellipse at center, #0e6f5f 0%, #0d5b4e 55%, #063a30 100%)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Animated star field for texture */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        {[...Array(28)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-amber-200"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: 2 + (i % 3),
              height: 2 + (i % 3),
            }}
            animate={{ opacity: [0.2, 0.9, 0.2] }}
            transition={{ duration: 2 + (i % 5) * 0.3, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      {/* Central mosque icon — gentle float */}
      <motion.div
        className="text-8xl mb-4 relative z-10"
        animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        🕌
      </motion.div>
      {/* Ring of orbiting dots (spinner) */}
      <motion.div
        className="relative z-10 w-16 h-16 mb-6"
        animate={{ rotate: 360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
      >
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="absolute w-2.5 h-2.5 rounded-full bg-amber-300"
            style={{
              top: '50%', left: '50%',
              transform: `rotate(${i * 60}deg) translateY(-28px) translateX(-5px)`,
              opacity: 1 - i * 0.13,
            }}
          />
        ))}
      </motion.div>
      {/* Heading */}
      <div className="text-white font-black text-xl mb-2 relative z-10 text-center">
        {HEADING[lang] || HEADING.ms}
      </div>
      {/* Rotating motivational message */}
      <div className="min-h-[3.5rem] flex items-center justify-center max-w-sm relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={msgIdx}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="text-amber-100 text-center text-sm leading-relaxed font-medium"
          >
            {msgs[msgIdx]}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Small hint at bottom */}
      <div className="absolute bottom-8 left-0 right-0 text-center text-emerald-200/70 text-xs italic px-8 z-10">
        {HINT[lang] || HINT.ms}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AutoUpgradeCelebrationOverlay — pedagogical popup that fires when the
// server auto-upgrades the Musalla (L1→L2 at 7 rumah, L2→L3 at 15 rumah).
// The message frames the growth as a DIRECT consequence of the child's
// habit-building: "your rumah grew, your jemaah grew, so the mosque grew".
// This teaches contribution to religion development (deen) — a core pedagogy
// goal of EQrel. Auto-dismiss after 6s. Tap to dismiss earlier.
// ═══════════════════════════════════════════════════════════════════════════
const AutoUpgradeCelebrationOverlay = ({ upgrade, lang, onClose }) => {
  const isRTL = lang === 'ar'
  useEffect(() => {
    // Extended to 5.5s so kids have time to read; construction overlay
    // handles the follow-up 10-second wow moment when this closes.
    const timer = setTimeout(onClose, 5500)
    return () => clearTimeout(timer)
  }, [onClose])
  const HEADLINES = {
    2: {
      ms: 'MasyaAllah! Musalla dinaik taraf menjadi Masjid!',
      en: 'MashaAllah! Your Musalla has grown into a Masjid!',
      id: 'MasyaAllah! Musalla naik menjadi Masjid!',
      ar: 'ما شاء الله! تطوّر المصلى إلى مسجد!',
    },
    3: {
      ms: 'Alhamdulillah! Masjid dinaik taraf menjadi Jami\u2019 Masjid!',
      en: 'Alhamdulillah! Your Masjid has grown into a Grand Mosque!',
      id: 'Alhamdulillah! Masjid naik menjadi Masjid Jami\u2019!',
      ar: 'الحمد لله! تطوّر مسجدكم إلى جامع!',
    },
  }
  const REASONS = {
    2: {
      ms: (n) => `Kamu sudah bina ${n} buah rumah. Jemaah semakin ramai — kampung kamu semakin diberkati dengan pembangunan agama!`,
      en: (n) => `You've built ${n} homes. The jamaah grows — your community is filled with the blessings of a growing deen!`,
      id: (n) => `Kamu sudah membangun ${n} rumah. Jemaah makin banyak — kampung kamu semakin diberkati oleh perkembangan agama!`,
      ar: (n) => `لقد بنيتَ ${n} بيوت. الجماعة تنمو — قريتكم مباركة بنموّ الدين!`,
    },
    3: {
      ms: (n) => `Kamu sudah bina ${n} buah rumah — kampung ini kini komuniti besar. Jami\u2019 Masjid dibina untuk menyatukan semua ahli jemaah!`,
      en: (n) => `You've built ${n} homes — a full community now. A Grand Mosque unites all your jamaah!`,
      id: (n) => `Kamu sudah membangun ${n} rumah — komunitas besar sekarang. Masjid Jami\u2019 menyatukan semua jemaah!`,
      ar: (n) => `لقد بنيتَ ${n} بيتًا — مجتمع كامل الآن. الجامع يجمع كلّ الجماعة!`,
    },
  }
  const CONTRIB = {
    ms: 'Kamu menyumbang kepada pembangunan agama! 🌱',
    en: 'You are contributing to building the deen! 🌱',
    id: 'Kamu berkontribusi pada pembangunan agama! 🌱',
    ar: 'أنت تسهم في بناء الدين! 🌱',
  }
  const level = upgrade.toLevel
  const rumahCount = upgrade.rumahCount || 0
  const headline = HEADLINES[level]?.[lang] || HEADLINES[level]?.ms
  const reason = (REASONS[level]?.[lang] || REASONS[level]?.ms)?.(rumahCount)
  const contrib = CONTRIB[lang] || CONTRIB.ms
  // Show the ACTUAL upgraded building — Masjid L2 or Jami' Masjid L3 PNG,
  // not the generic Kaabah emoji. Gives child a concrete "before/after"
  // feel of what their Musalla just became.
  const upgradedSprite = level === 3
    ? '/assets/world/masjid_l3.webp'
    : '/assets/world/masjid_l2.webp'
  const tierLabel = level === 3
    ? ({ ms: 'JAMI\u2019 MASJID · L3', en: 'GRAND MOSQUE · L3', id: 'MASJID JAMI\u2019 · L3', ar: 'جامع · L3' }[lang] || 'JAMI\u2019 MASJID · L3')
    : ({ ms: 'MASJID · L2', en: 'MASJID · L2', id: 'MASJID · L2', ar: 'مسجد · L2' }[lang] || 'MASJID · L2')
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-[96] flex items-center justify-center p-6 cursor-pointer"
      style={{ background: 'radial-gradient(ellipse at center, rgba(13,91,78,0.65) 0%, rgba(0,0,0,0.8) 100%)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ scale: 0.5, y: 40, rotate: -6 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="max-w-md w-full bg-gradient-to-br from-amber-50 via-emerald-50 to-teal-50 border-4 border-amber-400 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
          backgroundImage: 'repeating-conic-gradient(from 0deg, transparent 0deg 10deg, rgba(255,183,3,0.35) 10deg 20deg)',
        }} />
        <div className="relative">
          {/* Actual upgraded masjid PNG — replaces the old 🕋 emoji so the
              child sees precisely which building tier just came online. */}
          <motion.div
            className="mx-auto mb-3 h-32 w-32 flex items-end justify-center"
            animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src={upgradedSprite}
              alt={tierLabel}
              className="max-h-32 max-w-32 object-contain drop-shadow-2xl"
              draggable={false}
            />
          </motion.div>
          <div className="text-xs uppercase tracking-widest font-black text-amber-700 mb-2">
            ⭐ AUTO UPGRADE · {tierLabel}
          </div>
          <div className="font-black text-emerald-900 text-lg mb-3 leading-snug">
            {headline}
          </div>
          <div className="text-sm text-emerald-800/90 leading-relaxed mb-3">
            {reason}
          </div>
          <div className="text-sm font-bold text-emerald-700 leading-relaxed">
            {contrib}
          </div>
          <div className="text-[10px] text-emerald-700/60 mt-4 uppercase tracking-wider">
            {lang === 'ar' ? 'انقر للمتابعة' : lang === 'en' ? 'Tap to continue' : lang === 'id' ? 'Ketuk untuk lanjut' : 'Tekan untuk teruskan'}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// UpgradeConstructionOverlay — 10-second construction ceremony that runs
// AFTER the AutoUpgradeCelebration popup closes. Child sees a scaffolding
// scene + progress bar counting up to 100% while the "old" Musalla morphs
// into the "new" Masjid.
// Timeline (10s total):
//   0-2.5s : scaffolding zooms in, old asset shown, "Menaik taraf..." text
//   2.5-8s : progress bar fills, sparks fly, "🔨🪚⚒️" bounce
//   8-10s  : reveal — old fades, new upgraded PNG scales in with glow
// ═══════════════════════════════════════════════════════════════════════════
const UpgradeConstructionOverlay = ({ upgrade, lang, onClose }) => {
  const isRTL = lang === 'ar'
  const TOTAL_MS = 10000
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / TOTAL_MS) * 100)
      setProgress(pct)
      if (elapsed >= TOTAL_MS) {
        clearInterval(id)
        setTimeout(onClose, 800)
      }
    }, 60)
    return () => clearInterval(id)
  }, [onClose])
  const revealed = progress >= 80
  const fromLevel = upgrade.fromLevel || 1
  const toLevel = upgrade.toLevel || 2
  const beforeSrc = fromLevel === 2 ? '/assets/world/masjid_l2.webp' : '/assets/world/musalla.webp'
  const afterSrc  = toLevel === 3 ? '/assets/world/masjid_l3.webp'  : '/assets/world/masjid_l2.webp'
  const L = {
    building: { ms: 'Menaik taraf Musalla...', en: 'Upgrading the Musalla...', id: 'Meningkatkan Musalla...', ar: 'يجري ترقية المصلى...' },
    almost:   { ms: 'Hampir siap!', en: 'Almost done!', id: 'Hampir selesai!', ar: 'كاد ينتهي!' },
    done:     { ms: 'Alhamdulillah, siap!', en: 'Alhamdulillah, complete!', id: 'Alhamdulillah, selesai!', ar: 'الحمد لله، اكتمل!' },
    subtitle: { ms: `Level ${fromLevel} → Level ${toLevel}`, en: `Level ${fromLevel} → Level ${toLevel}`, id: `Level ${fromLevel} → Level ${toLevel}`, ar: `المستوى ${fromLevel} ← المستوى ${toLevel}` },
  }
  const tr = (k) => L[k][lang] || L[k].ms
  const label = progress >= 100 ? tr('done') : progress >= 80 ? tr('almost') : tr('building')
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[97] flex items-center justify-center p-6 pointer-events-none"
      style={{ background: 'radial-gradient(ellipse at center, rgba(6,63,54,0.75) 0%, rgba(0,0,0,0.85) 100%)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="max-w-md w-full bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-50 border-4 border-amber-500 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #f59e0b 0px, #f59e0b 10px, transparent 10px, transparent 20px)',
          }}
        />
        <div className="relative">
          <div className="flex justify-center gap-3 mb-3 text-3xl">
            <motion.span animate={{ y: [0, -6, 0], rotate: [0, -8, 0] }} transition={{ duration: 0.7, repeat: Infinity }}>🔨</motion.span>
            <motion.span animate={{ y: [0, -6, 0], rotate: [0, 8, 0]  }} transition={{ duration: 0.7, repeat: Infinity, delay: 0.15 }}>🪚</motion.span>
            <motion.span animate={{ y: [0, -6, 0], rotate: [0, -8, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: 0.3 }}>⚒️</motion.span>
          </div>
          <div className="relative mx-auto h-40 w-40 mb-4 flex items-end justify-center">
            <motion.div
              className="absolute inset-0 rounded-full bg-amber-200/50 blur-2xl"
              animate={{ scale: [0.8, 1.15, 0.8], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <motion.img
              src={beforeSrc}
              alt="before"
              className="absolute max-h-40 max-w-40 object-contain"
              animate={{ opacity: revealed ? 0 : 0.55, scale: revealed ? 0.9 : 1 }}
              transition={{ duration: 0.6 }}
              draggable={false}
            />
            <motion.img
              src={afterSrc}
              alt="after"
              className="absolute max-h-40 max-w-40 object-contain drop-shadow-2xl"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: revealed ? 1 : 0,
                scale: revealed ? 1 : 0.6,
                y: revealed ? [0, -4, 0] : 0,
              }}
              transition={{ duration: 0.8, y: { duration: 1.6, repeat: Infinity } }}
              draggable={false}
            />
          </div>
          <div className="relative w-full h-4 bg-emerald-100 rounded-full overflow-hidden border border-emerald-300 mb-2">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-600"
              style={{ width: `${progress}%`, transition: 'width 60ms linear' }}
            />
            <motion.div
              className="absolute inset-y-0 w-8 bg-white/30 blur-md"
              animate={{ left: ['-10%', '110%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <div className="text-xs font-bold text-emerald-800 mb-3">
            {Math.round(progress)}%
          </div>
          <div className="text-xs uppercase tracking-widest font-black text-amber-700 mb-1">
            🚧 {tr('subtitle')}
          </div>
          <div className="text-base font-black text-emerald-900">
            {label}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CloudOverlay — dark clouds appear as demeritCount grows.
// Uses layered blurred CSS shapes for depth (no Phaser overhead).
// 0 demerit = clear sky, 10+ = heavy storm.
// ═══════════════════════════════════════════════════════════════════════════
const CloudOverlay = ({ demeritCount, lang, onOpenIstighfar }) => {
  if (!demeritCount || demeritCount <= 0) return null
  const clouds = Math.min(demeritCount, 10)
  // Overall darkening intensity (0 → 0.5 max)
  const darken = Math.min(0.5, demeritCount * 0.05)
  // i18n for the CTA that appears once clouds accumulate. All text piped
  // through this map so the toggle bahasa switches copy live.
  const CTA = {
    ms: '🤲 Ketuk awan untuk beristighfar',
    en: '🤲 Tap a cloud to say Astaghfirullah',
    id: '🤲 Ketuk awan untuk beristighfar',
    ar: '🤲 اضغط على السحاب للاستغفار',
  }
  return (
    // pointer-events-none on the wrapper so the world underneath still receives
    // pans/zooms — only the interactive elements below enable pointer events.
    <div className="absolute inset-0 pointer-events-none z-[20] overflow-hidden">
      {/* Sky darkening layer */}
      <div className="absolute inset-0 transition-opacity duration-1000" style={{
        background: `rgba(20, 20, 30, ${darken})`,
      }} />
      {/* Individual cloud puffs — slow drift, tappable to open Istighfar */}
      {[...Array(clouds)].map((_, i) => {
        const size = 120 + (i % 4) * 40
        const yPos = 5 + (i * 7) % 40   // spread top portion of screen
        const startX = -(i * 15) % 100
        const duration = 40 + (i % 5) * 8  // 40-72s drift
        return (
          <motion.button
            key={i}
            initial={{ x: `${startX - 20}vw` }}
            animate={{ x: `${startX + 120}vw` }}
            transition={{ duration, repeat: Infinity, ease: 'linear' }}
            onClick={onOpenIstighfar}
            aria-label="Astaghfirullah"
            className="absolute rounded-full pointer-events-auto cursor-pointer active:scale-95 transition-transform"
            style={{
              top: `${yPos}%`,
              width: size,
              height: size * 0.55,
              background: 'radial-gradient(ellipse, rgba(45,50,65,0.85) 0%, rgba(45,50,65,0.35) 60%, transparent 100%)',
              filter: 'blur(12px)',
              border: 'none',
              padding: 0,
            }}
          />
        )
      })}
      {/* CTA hint — clickable button that also opens the Istighfar modal.
          Shows as soon as ANY cloud is present so kids know the way out. */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto">
        <button
          onClick={onOpenIstighfar}
          className="bg-black/60 backdrop-blur text-white/95 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 active:scale-95 hover:bg-black/70 transition"
        >
          {CTA[lang] || CTA.ms}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// IstighfarModal — pedagogical cleanse loop.
// Mekanik: anak buat istighfar 10 kali untuk hilangkan 1 awan hitam. Setiap
// tap ada cooldown 3 saat (elak spam), audio Astaghfirullah dimainkan, dan
// counter progres nampak jelas. Selepas 10, backend dipanggil untuk kurangkan
// demeritCount by 1, popup pedagogi ("MashaAllah") ditunjuk, kemudian tutup.
// Pahala di sisi Allah — tiada reward material (per user spec).
// ═══════════════════════════════════════════════════════════════════════════
const IstighfarModal = ({ lang, onClose, onComplete }) => {
  const [count, setCount] = useState(0)
  const [cooldownEnd, setCooldownEnd] = useState(0)   // Date.now() when cooldown ends
  const [now, setNow] = useState(Date.now())
  const [showDone, setShowDone] = useState(false)
  const TOTAL = 10
  const COOLDOWN_MS = 2000
  // Tick 60fps for smooth cooldown ring
  useEffect(() => {
    if (showDone) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [showDone])
  const isRTL = lang === 'ar'
  const remaining = Math.max(0, cooldownEnd - now)
  const inCooldown = remaining > 0
  const cooldownPct = inCooldown ? 1 - remaining / COOLDOWN_MS : 1
  // i18n copy
  const L = {
    title: {
      ms: 'Mohon Ampun kepada Allah',
      en: 'Seek Forgiveness from Allah',
      id: 'Memohon Ampun kepada Allah',
      ar: 'الاستغفار من الله',
    },
    sub: {
      ms: 'Baca Astaghfirullah 10 kali untuk hilangkan 1 awan hitam',
      en: 'Recite Astaghfirullah 10 times to clear 1 dark cloud',
      id: 'Baca Astaghfirullah 10 kali untuk menghilangkan 1 awan hitam',
      ar: 'قل أستغفر الله ١٠ مرات لإزالة سحابة سوداء',
    },
    meaning: {
      ms: 'Aku memohon ampun kepada Allah',
      en: 'I seek forgiveness from Allah',
      id: 'Aku memohon ampun kepada Allah',
      ar: 'أستغفر الله',
    },
    button: { ms: 'Astaghfirullah', en: 'Astaghfirullah', id: 'Astaghfirullah', ar: 'أستغفر الله' },
    wait: {
      ms: 'Sabar sekejap ya...',
      en: 'Wait a moment...',
      id: 'Sabar sebentar ya...',
      ar: 'انتظر لحظة...',
    },
    doneTitle: {
      ms: 'MashaAllah! Allah Maha Pengampun',
      en: 'MashaAllah! Allah is Most Forgiving',
      id: 'MashaAllah! Allah Maha Pengampun',
      ar: 'ما شاء الله! الله غفور',
    },
    doneSub: {
      ms: 'Bila kita minta ampun dengan ikhlas, Allah akan ampunkan',
      en: 'When we sincerely seek forgiveness, Allah forgives us',
      id: 'Ketika kita meminta ampun dengan ikhlas, Allah mengampuni',
      ar: 'حين نستغفر بإخلاص، يغفر الله لنا',
    },
    close: { ms: 'Tutup', en: 'Close', id: 'Tutup', ar: 'إغلاق' },
    progress: { ms: 'Jumlah', en: 'Count', id: 'Jumlah', ar: 'العدد' },
  }
  const tr = (k) => L[k][lang] || L[k].ms
  const onTap = () => {
    if (inCooldown || showDone) return
    astaghfirullah()
    const next = count + 1
    setCount(next)
    if (next >= TOTAL) {
      setShowDone(true)
      setTimeout(() => { onComplete() }, 2600)
    } else {
      setCooldownEnd(Date.now() + COOLDOWN_MS)
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex items-center justify-center p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ background: 'rgba(6, 30, 40, 0.88)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl p-6 text-center shadow-2xl"
      >
        {!showDone ? (
          <>
            <div className="text-xs uppercase tracking-widest font-black text-emerald-600 mb-1">
              {tr('title')}
            </div>
            <div className="font-serif text-3xl text-emerald-900 my-3" dir="rtl">
              أَسْتَغْفِرُ اللَّه
            </div>
            <div className="text-sm text-emerald-700/80 mb-1">Astaghfirullah</div>
            <div className="text-xs text-emerald-800/60 mb-4">{tr('meaning')}</div>

            {/* Progress ring — visual + text */}
            <div className="relative mx-auto w-32 h-32 mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="45" fill="none" stroke="#10b981" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 45}
                  strokeDashoffset={2 * Math.PI * 45 * (1 - count / TOTAL)}
                  style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-black text-emerald-800">{count}</div>
                <div className="text-xs text-emerald-700/70">/ {TOTAL}</div>
              </div>
            </div>

            {/* Big Astaghfirullah button with cooldown ring */}
            <button
              onClick={onTap}
              disabled={inCooldown}
              className={`relative w-full rounded-2xl font-black py-4 text-lg overflow-hidden transition ${
                inCooldown
                  ? 'bg-emerald-200 text-emerald-500 cursor-not-allowed'
                  : 'bg-emerald-500 text-white active:scale-95 hover:bg-emerald-600'
              }`}
            >
              {/* Cooldown progress fill (green wipe) */}
              {inCooldown && (
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-400/70 pointer-events-none"
                  style={{ width: `${cooldownPct * 100}%`, transition: 'width 100ms linear' }}
                />
              )}
              <span className="relative z-10">
                {inCooldown ? (
                  <span className="flex items-center justify-center gap-2">
                    ⏳ {tr('wait')}
                  </span>
                ) : (
                  <>🤲 {tr('button')}</>
                )}
              </span>
            </button>
            {tr('sub') && (
              <div className="text-[11px] text-emerald-800/60 mt-3">{tr('sub')}</div>
            )}
            <button
              onClick={onClose}
              className="mt-3 text-xs text-emerald-700/70 hover:text-emerald-900 font-bold"
            >
              {tr('close')}
            </button>
          </>
        ) : (
          // ─── Completion pedagogy ─────────────────────────────
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 250, damping: 20 }}
          >
            <div className="relative mx-auto mb-3 h-24 w-24 flex items-center justify-center">
              <motion.span
                className="absolute top-0 left-0 text-2xl"
                animate={{ scale: [0.8, 1.3, 0.8], rotate: [0, 20, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >✨</motion.span>
              <motion.span
                className="absolute top-2 right-0 text-xl"
                animate={{ scale: [1.2, 0.8, 1.2], rotate: [0, -25, 0] }}
                transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              >✨</motion.span>
              <motion.span
                className="absolute bottom-0 right-2 text-lg"
                animate={{ scale: [0.9, 1.4, 0.9] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              >✨</motion.span>
              <div className="text-5xl">🤲</div>
            </div>
            <div className="text-lg font-black text-emerald-900 mb-2">
              {tr('doneTitle')}
            </div>
            <div className="text-sm text-emerald-800/80 leading-relaxed">
              {tr('doneSub')}
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ArchipelagoMap — the entry gate. Kids see 7 island slots arranged in
// a rough hexagonal ring, with "Pulau Impianku" glowing at the center as
// the active/only playable island. The other 6 are locked placeholders
// (nama/tema belum diputuskan). Progress toward "hijrah" is displayed as
// a bar under Pulau Impianku so kids can gauge how close they are to
// unlocking the next island (criteria: Musalla L3 + 30 buildings + 15
// rumah minimum). Fully i18n across ms/en/id/ar including RTL Arabic.
// ═══════════════════════════════════════════════════════════════════════════
const ArchipelagoMap = ({ lang, worldState, onSelectIsland }) => {
  const isRTL = lang === 'ar'
  const buildings = worldState?.buildings || []
  const musalla = buildings.find(b => b.templateId === 'musalla')
  const musallaLevel = musalla?.level || 1
  const rumahCount = buildings.filter(b => BUILDING_TEMPLATES[b.templateId]?.category === 'rumah').length
  const totalBuildings = buildings.filter(b => b.templateId !== 'musalla').length
  const musallaProgress = Math.min(1, (musallaLevel - 1) / 2)
  const buildingProgress = Math.min(1, totalBuildings / 30)
  const rumahProgress = Math.min(1, rumahCount / 15)
  const overallPct = Math.round(((musallaProgress + buildingProgress + rumahProgress) / 3) * 100)
  const readyToHijrah = overallPct >= 100
  const L = {
    title:      { ms: 'Peta Kepulauan Iman', en: 'Islands of Iman Map',       id: 'Peta Kepulauan Iman', ar: 'خريطة جزر الإيمان' },
    subtitle:   {
      ms: 'Ikuti laluan. Setiap pulau menanti kamu — buat baik untuk buka pulau seterusnya.',
      en: 'Follow the path. Each island awaits — keep doing good to unlock the next.',
      id: 'Ikuti jalur. Setiap pulau menunggu — terus berbuat baik untuk membuka pulau berikut.',
      ar: 'اتبع المسار. كل جزيرة تنتظر — استمر في فعل الخير لفتح التالية.',
    },
    active:     { ms: 'AKTIF', en: 'ACTIVE', id: 'AKTIF', ar: 'نشط' },
    locked:     { ms: 'Terkunci', en: 'Locked', id: 'Terkunci', ar: 'مغلق' },
    comingSoon: { ms: 'Nanti Dibuka', en: 'Coming Soon', id: 'Segera Hadir', ar: 'قريبًا' },
    enter:      { ms: 'Masuk Pulau', en: 'Enter Island', id: 'Masuk Pulau', ar: 'ادخل الجزيرة' },
    pulauImpianku: { ms: 'Pulau Impianku', en: 'My Dream Island', id: 'Pulau Impianku', ar: 'جزيرة أحلامي' },
    progressLabel: {
      ms: 'lengkap untuk hijrah ke pulau seterusnya',
      en: 'complete to migrate to the next island',
      id: 'lengkap untuk hijrah ke pulau berikutnya',
      ar: 'مكتمل للهجرة إلى الجزيرة التالية',
    },
    hijrahReady: {
      ms: 'MashaAllah! Pulau kamu sudah lengkap. Nantikan pulau baharu!',
      en: 'MashaAllah! Your island is complete. New islands coming!',
      id: 'MashaAllah! Pulaumu sudah lengkap. Nantikan pulau baru!',
      ar: 'ما شاء الله! جزيرتك مكتملة!',
    },
    stats: {
      ms: (m, r, b) => `Musalla L${m} · ${r} rumah · ${b} binaan`,
      en: (m, r, b) => `Musalla L${m} · ${r} homes · ${b} buildings`,
      id: (m, r, b) => `Musalla L${m} · ${r} rumah · ${b} bangunan`,
      ar: (m, r, b) => `مصلى ل${m} · ${r} بيوت · ${b} مباني`,
    },
  }
  const tr = (k, ...args) => {
    const v = L[k]?.[lang] || L[k]?.ms
    return typeof v === 'function' ? v(...args) : v
  }
  // ─── 7 waypoints along a winding S-curve treasure-map journey ─────
  // Coordinates normalized [0,100] % for both x and y so responsiveness
  // is automatic. First waypoint (Pulau Impianku) is at the bottom-front
  // (start of journey), 6 locked islands snake upward through the ocean.
  // Coordinates authored to feel like a hand-drawn adventure map.
  const WAYPOINTS = [
    { id: 'pulau_impianku', x: 50, y: 82, size: 26, locked: false },
    { id: 'locked_1',       x: 22, y: 68, size: 16, locked: true },
    { id: 'locked_2',       x: 72, y: 56, size: 16, locked: true },
    { id: 'locked_3',       x: 28, y: 44, size: 15, locked: true },
    { id: 'locked_4',       x: 78, y: 32, size: 15, locked: true },
    { id: 'locked_5',       x: 34, y: 22, size: 15, locked: true },
    { id: 'locked_6',       x: 72, y: 12, size: 15, locked: true },
  ]
  // Cubic path between waypoints — treasure map dotted line.
  const pathD = WAYPOINTS.map((w, i) => {
    if (i === 0) return `M ${w.x} ${w.y}`
    const prev = WAYPOINTS[i - 1]
    const midX = (prev.x + w.x) / 2
    return `Q ${midX} ${prev.y}, ${w.x} ${w.y}`
  }).join(' ')
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[85] flex flex-col overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        // Warm parchment-inspired tropical ocean — treasure map feel.
        background: 'radial-gradient(ellipse at 50% 30%, #4a92c9 0%, #2a6da8 40%, #1a4c7f 100%)',
      }}
    >
      {/* Parchment-style vignette + subtle noise for treasure-map aesthetic */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
      }} />
      {/* Wave ripples (SVG defs) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <defs>
          <pattern id="waves" x="0" y="0" width="120" height="24" patternUnits="userSpaceOnUse">
            <path d="M0 12 Q 30 4 60 12 T 120 12" stroke="rgba(255,255,255,0.09)" strokeWidth="1.4" fill="none"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#waves)" />
      </svg>

      {/* Header — compact, floats over map */}
      <div className="relative z-20 px-4 pt-3 pb-2 text-center flex-shrink-0">
        <div className="text-amber-300 text-[10px] uppercase tracking-widest font-black mb-0.5 drop-shadow-md">
          🗺️ {tr('title')}
        </div>
        <div className="text-white/85 text-[11px] max-w-md mx-auto leading-tight drop-shadow">
          {tr('subtitle')}
        </div>
      </div>

      {/* Journey canvas — flex-1 fills between header + footer, responsive.
          Portrait vs landscape both work because we use % positioning. */}
      <div className="relative flex-1 min-h-0">
        {/* Treasure-map dashed path connecting all 7 waypoints */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d={pathD}
            stroke="rgba(255, 220, 130, 0.85)"
            strokeWidth="0.6"
            strokeDasharray="1.8 1.4"
            fill="none"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,220,130,0.4))' }}
          />
        </svg>

        {/* Waypoint islands. Positioned in % so they scale for any orientation. */}
        {WAYPOINTS.map((wp, i) => {
          const isActive = !wp.locked
          const isFirst = i === 0
          return (
            <div
              key={wp.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${wp.x}%`, top: `${wp.y}%` }}
            >
              {isActive ? (
                <motion.button
                  onClick={() => onSelectIsland(wp.id)}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="relative block group active:scale-95 transition-transform"
                  style={{ width: `${wp.size * 3}vmin`, maxWidth: 220, minWidth: 140 }}
                >
                  {/* Pulsing water halo */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-amber-400/30 blur-2xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <IslandShape size="lg" active />
                  <div className="mt-1 text-center relative z-10">
                    <div className="inline-block bg-amber-300 text-amber-900 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-md">
                      ⭐ {tr('active')}
                    </div>
                    <div className="text-white font-black text-base mt-1 drop-shadow-lg">
                      {tr('pulauImpianku')}
                    </div>
                    <div className="text-amber-100/90 text-[10px] mt-0.5 drop-shadow">
                      {tr('stats', musallaLevel, rumahCount, totalBuildings)}
                    </div>
                  </div>
                </motion.button>
              ) : (
                <div
                  className="relative block opacity-70"
                  style={{ width: `${wp.size * 2.4}vmin`, maxWidth: 140, minWidth: 84 }}
                >
                  <IslandShape size="sm" active={false} />
                  <div className="mt-1 text-center">
                    <div className="text-white/80 text-[9px] font-black uppercase tracking-wider drop-shadow">
                      🔒 {tr('locked')}
                    </div>
                    <div className="text-white/60 text-[9px] mt-0.5">
                      {tr('comingSoon')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress footer — sticky bottom, compact on mobile */}
      <div className="relative z-20 px-4 pb-4 pt-2 flex-shrink-0">
        <div className="max-w-md mx-auto">
          <div className="bg-black/40 backdrop-blur border border-amber-400/50 rounded-2xl px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-white/85 text-[10px] uppercase tracking-wider font-bold">
                {tr('pulauImpianku')}
              </div>
              <div className="text-amber-300 text-sm font-black">{overallPct}%</div>
            </div>
            <div className="relative w-full h-2.5 bg-slate-900/60 rounded-full overflow-hidden border border-slate-500/40">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400 rounded-full"
                style={{ width: `${overallPct}%`, transition: 'width 800ms ease' }}
              />
            </div>
            <div className="text-white/70 text-[10px] mt-1.5 leading-tight text-center">
              {readyToHijrah ? `🎉 ${tr('hijrahReady')}` : tr('progressLabel')}
            </div>
          </div>
          <button
            onClick={() => onSelectIsland('pulau_impianku')}
            className="mt-2.5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-emerald-500 text-white font-black py-3 active:scale-95 shadow-xl text-base"
          >
            🏝️ {tr('enter')}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── IslandShape — hand-drawn tropical island rendered as inline SVG ─────
// Organic sandy beach base + green top + palm trees. Two variants:
//   • active — vibrant colors, 3 palm trees, tiny mosque dome
//   • locked — desaturated + fog overlay, no landmarks
const IslandShape = ({ size = 'lg', active = false }) => {
  return (
    <svg
      viewBox="0 0 120 90"
      className="w-full h-auto"
      style={{ filter: active ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))' : 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))' }}
    >
      <defs>
        <radialGradient id={`grd-sand-${active}`} cx="50%" cy="60%" r="70%">
          <stop offset="0%" stopColor={active ? '#fde68a' : '#94a3b8'} />
          <stop offset="60%" stopColor={active ? '#f59e0b' : '#64748b'} />
          <stop offset="100%" stopColor={active ? '#b45309' : '#334155'} />
        </radialGradient>
        <radialGradient id={`grd-grass-${active}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={active ? '#86efac' : '#6b7d92'} />
          <stop offset="70%" stopColor={active ? '#22c55e' : '#4b5c72'} />
          <stop offset="100%" stopColor={active ? '#166534' : '#334155'} />
        </radialGradient>
      </defs>
      {/* Sandy beach base (irregular blob) */}
      <path
        d="M 12 68 Q 6 60 18 54 Q 10 44 26 42 Q 30 30 48 34 Q 52 24 68 30 Q 88 26 96 40 Q 112 44 108 58 Q 118 66 106 74 Q 100 84 82 82 Q 68 88 54 82 Q 36 88 22 80 Q 8 78 12 68 Z"
        fill={`url(#grd-sand-${active})`}
      />
      {/* Green grass patch on top */}
      <path
        d="M 22 60 Q 20 46 34 44 Q 40 34 54 38 Q 62 32 74 40 Q 88 40 90 52 Q 96 60 86 66 Q 74 72 60 68 Q 44 74 32 68 Q 20 68 22 60 Z"
        fill={`url(#grd-grass-${active})`}
      />
      {active && (
        <>
          {/* Central mosque dome */}
          <ellipse cx="60" cy="52" rx="5" ry="4" fill="#fef3c7" />
          <rect x="57" y="52" width="6" height="6" fill="#fef3c7" />
          <circle cx="60" cy="48" r="3.5" fill="#fbbf24" />
          <line x1="60" y1="45" x2="60" y2="41" stroke="#fbbf24" strokeWidth="0.6"/>
          {/* Palm trees (3, scattered) */}
          {[
            { cx: 38, cy: 56 },
            { cx: 82, cy: 54 },
            { cx: 48, cy: 46 },
          ].map((p, i) => (
            <g key={i}>
              <rect x={p.cx - 0.6} y={p.cy - 1} width="1.2" height="6" fill="#78350f" />
              <ellipse cx={p.cx - 2.5} cy={p.cy - 2} rx="3" ry="1.4" fill="#16a34a" />
              <ellipse cx={p.cx + 2.5} cy={p.cy - 2} rx="3" ry="1.4" fill="#16a34a" />
              <ellipse cx={p.cx} cy={p.cy - 3.6} rx="1.6" ry="3" fill="#22c55e" />
            </g>
          ))}
        </>
      )}
      {!active && (
        <>
          {/* Fog overlay for locked islands */}
          <path
            d="M 12 68 Q 6 60 18 54 Q 10 44 26 42 Q 30 30 48 34 Q 52 24 68 30 Q 88 26 96 40 Q 112 44 108 58 Q 118 66 106 74 Q 100 84 82 82 Q 68 88 54 82 Q 36 88 22 80 Q 8 78 12 68 Z"
            fill="rgba(180,190,210,0.55)"
          />
          {/* Padlock icon in center */}
          <text x="60" y="60" fontSize="12" textAnchor="middle" opacity="0.85">🔒</text>
        </>
      )}
      {/* Wave ring around beach (subtle) */}
      <ellipse cx="60" cy="76" rx="52" ry="6" fill="rgba(255,255,255,0.18)" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CloudOverlay — dark clouds appear as demeritCount grows.
// (Active implementation is defined above with cloud-tap → Istighfar wiring.)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// MoveConfirmCard — LIGHTWEIGHT floating popover that appears next to the
// destination cell right after a child drops a dragged building. Two clear
// buttons: "Ya, alih ke sini" (green) & "Batal" (grey). Prevents accidental
// relocations from stray drag gestures. Position derived from screen coords
// pushed by Phaser via the 'building-move-requested' event.
// ═══════════════════════════════════════════════════════════════════════════
const MoveConfirmCard = ({ confirmation, lang, onConfirm, onCancel }) => {
  const t = BUILDING_TEMPLATES[confirmation.templateId] || {}
  const isRTL = lang === 'ar'
  const name = t.name?.[lang] || t.name?.ms || confirmation.templateId
  // Auto-cancel after 8s of no interaction — safety net so an abandoned
  // card doesn't lock further drags.
  useEffect(() => {
    const timer = setTimeout(onCancel, 8000)
    return () => clearTimeout(timer)
  }, [onCancel])
  // Clamp screen position so the card never renders outside the visible
  // canvas (top-right cutoff, bottom-left cutoff on small screens).
  const width = 260, height = 130
  const pad = 12
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800
  // Card default anchor: 20px above the destination cell, horizontally centred.
  let cx = (confirmation.screenX ?? winW / 2) - width / 2
  let cy = (confirmation.screenY ?? winH / 2) - height - 40
  cx = Math.max(pad, Math.min(cx, winW - width - pad))
  cy = Math.max(pad + 60, Math.min(cy, winH - height - 160)) // avoid sidebar
  const CONFIRM = {
    ms: 'Alih ke sini?', en: 'Move here?', id: 'Pindah ke sini?', ar: 'انقل إلى هنا؟',
  }
  const YES = {
    ms: 'Ya, alih', en: 'Yes, move', id: 'Ya, pindahkan', ar: 'نعم، انقل',
  }
  const NO = {
    ms: 'Batal', en: 'Cancel', id: 'Batal', ar: 'إلغاء',
  }
  return (
    <>
      {/* Backdrop — tap anywhere to cancel */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 z-[85] bg-transparent"
        style={{ touchAction: 'manipulation' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        className="absolute z-[86] pointer-events-auto"
        style={{ left: cx, top: cy, width }}
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-emerald-300 overflow-hidden">
          {/* Little "pointer" triangle under the card, pointing at the cell */}
          <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 rotate-45 bg-white border-r-2 border-b-2 border-emerald-300" />
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-2xl">{t.icon || '📦'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">
                  {CONFIRM[lang] || CONFIRM.ms}
                </div>
                <div className="font-black text-emerald-900 text-sm leading-tight truncate">
                  {name}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs active:scale-95 transition"
              >
                {NO[lang] || NO.ms}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs active:scale-95 transition shadow-md"
              >
                ✓ {YES[lang] || YES.ms}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
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

  // Check progressive-unlock requirements for upgrade.
  // Requirement key 'rumah' means ANY house variant in the 'rumah' category —
  // rumah_kayu, rumah_batu, rumah_kampung, banglo. Falling back to exact
  // templateId match was a bug: children build variants (rumah_kayu etc),
  // never the abstract 'rumah', so requirements never met visually.
  // Server-side logic uses the same category-based counting.
  const reqs = t.upgradeRequires?.[nextLevel] || null
  let reqMet = true
  const reqStatus = []
  if (reqs) {
    for (const [catOrId, need] of Object.entries(reqs)) {
      const have = allBuildings.filter(b => {
        const tpl = BUILDING_TEMPLATES[b.templateId]
        const cat = tpl?.category || b.templateId
        return cat === catOrId || b.templateId === catOrId
      }).length
      reqStatus.push({ tid: catOrId, have, need, met: have >= need })
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
                      <div className="text-[10px] text-amber-900/80 leading-snug">
                        {l('needForUpgrade', lang)} <span className="font-bold">{nextName}</span>:
                      </div>
                      {reqStatus.map(r => {
                        const catKey = 'req' + r.tid.charAt(0).toUpperCase() + r.tid.slice(1)
                        const catLabel = L[catKey]?.[lang] || L[catKey]?.ms || r.tid
                        return (
                          <div key={r.tid} className={`text-[10px] flex justify-between ${r.met ? 'text-emerald-700' : 'text-amber-800'}`}>
                            <span>{catLabel}</span>
                            <span className="font-bold">{r.have} / {r.need}</span>
                          </div>
                        )
                      })}
                      {/* Musalla is auto-upgraded on the server the moment the
                          rumah threshold is crossed — kids never press an
                          upgrade button. This banner tells them so they don't
                          hunt for one. */}
                      {t.id === 'musalla' && (
                        <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 mt-1 border border-emerald-200 leading-snug">
                          ⭐ {l('autoUpgradeInfo', lang)}
                        </div>
                      )}
                    </div>
                  ) : t.id === 'musalla' ? (
                    // Requirements met but not yet auto-upgraded (edge case):
                    // show a friendly waiting message instead of a manual button.
                    <div className="text-center text-xs font-bold text-emerald-600 py-1">
                      ⭐ {l('autoUpgradeInfo', lang)}
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
