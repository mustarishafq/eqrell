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
  dragHint:     { ms: 'Tekan butang pindah untuk susun', en: 'Tap Move to reorganize', id: 'Tekan Pindah untuk susun', ar: 'اضغط "نقل" للترتيب' },
  moveBtn:      { ms: 'Pindah bangunan ini', en: 'Move this building', id: 'Pindahkan bangunan ini', ar: 'انقل هذا المبنى' },
  moveHint:     { ms: 'Seret ke petak baru...', en: 'Drag to new cell...', id: 'Seret ke petak baru...', ar: 'اسحب إلى موقع جديد...' },
  moveCancel:   { ms: 'Batal', en: 'Cancel', id: 'Batal', ar: 'إلغاء' },
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
  // Tasik intro — EQ mascot dialog shown ONCE per child when they first
  // enter the world after the v3 migration adds the pre-placed lake.
  // Persisted via localStorage key `eqrel_tasik_intro_<childId>`.
  const [tasikIntroOpen, setTasikIntroOpen] = useState(false)
  // Construction sequel — AFTER the AutoUpgrade popup closes, we no longer
  // show a popup. Instead we trigger scene.playAutoUpgrade(...) which plays
  // the full Red-Alert construction ceremony ON the actual Musalla tile in
  // the world (user: "process upgrade bukan pada popup tetapi pada actual
  // worlds macam kita baru bina asset").  Object shape: { buildingId, toLevel, key }.
  const [autoUpgradeAnim, setAutoUpgradeAnim] = useState(null)
  // While an auto-upgrade is pending (popup showing OR world anim playing),
  // we DEFER load() so the Musalla stays at its pre-upgrade level in Phaser.
  // Once the world anim completes we call load() to sync the new level.
  const pendingAutoUpgradeRef = useRef(null)
  // Move confirmation: shown after the child drops a building on a new cell.
  // Prevents accidental relocations from stray drags. Cleared on confirm/cancel.
  // Shape: { buildingId, templateId, x, y, origX, origY, screenX, screenY }
  const [moveConfirmation, setMoveConfirmation] = useState(null)
  // Move-mode HUD state — visible while the user is dragging a "picked-up"
  // building to a new cell (after tapping [Pindah] in BuildingInfoCard).
  const [moveModeActive, setMoveModeActive] = useState(null)
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
  // Archipelago is now the CANONICAL entry gate — every time the child
  // navigates to /world (from the kid dashboard, from a fresh reload, from a
  // deep link), they land on the map first (user: "dari dashboard anak jika
  // tekan ke world harus navigate ke map dulu, bukan masuk world terus").
  // We no longer auto-skip based on a persisted island choice; the
  // localStorage entry is only kept as a "last-picked island" hint for
  // future multi-island themes.
  const [archipelagoOpen, setArchipelagoOpen] = useState(true)
  useEffect(() => {
    // Read persisted island choice for downstream logic, but DO NOT
    // auto-close the archipelago — force the kid to consciously "enter" a
    // island each session so the map always feels like the entry gate.
    try {
      const saved = localStorage.getItem('eqrel-selected-island')
      if (saved) setSelectedIslandId(saved)
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
        // Tasik intro — show EQ mascot dialog once per child, after world
        // state loads (v3 migration guarantees tasik exists in buildings[]).
        // Persisted via localStorage so it doesn't repeat on future visits.
        const hasTasik = (data.world.buildings || []).some(b => b.templateId === 'tasik')
        if (hasTasik && typeof window !== 'undefined') {
          const seen = localStorage.getItem(`eqrel_tasik_intro_${childId}`) === '1'
          if (!seen) setTimeout(() => setTasikIntroOpen(true), 1200)
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
    // Bismillah — the child is DELIBERATELY starting the act of relocating
    // (they tapped [Pindah] → dragged → confirmed). This is the pedagogical
    // moment to associate with dhikr, v5: no longer fires on accidental
    // touches thanks to the SELECT-FIRST-THEN-MOVE flow.
    bismillah()
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
          // If the server AUTO-UPGRADED the Musalla (7 rumah → Masjid, 15
          // rumah → Jami' Masjid), DEFER the load() so Phaser keeps showing
          // the OLD Musalla level until the auto-upgrade celebration popup
          // closes and the world-tile construction animation plays. Otherwise
          // the child would see the Musalla instantly morph before the
          // ceremonial anim runs.
          if (data.autoUpgrade) {
            pendingAutoUpgradeRef.current = data.autoUpgrade
            // Queue the celebration popup — animation on the actual tile
            // fires after the popup closes.
            setTimeout(() => setAutoUpgradeCelebration(data.autoUpgrade), 3000)
          } else {
            await load()
          }
          // If the server auto-placed a milestone landmark (Surau @ 5, Masjid
          // @ 10), queue a celebratory overlay AFTER the alhamdulillah dismiss
          // so the child sees "Kampung anda telah dianugerahkan..." pop up.
          if (Array.isArray(data.newLandmarks) && data.newLandmarks.length > 0) {
            setTimeout(() => setLandmarkCelebration(data.newLandmarks[0]), 2800)
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
    if (type === 'auto-upgrade-anim-done') {
      // World-tile construction ceremony for auto-upgrade finished. Now it's
      // safe to load() the fresh state — Phaser will diff-sync the Musalla
      // to its new level and sweep the temp construction sprite. Also clear
      // the pending flag + refresh anim state.
      alhamdulillah()
      haptic.ihsan()
      pendingAutoUpgradeRef.current = null
      setAutoUpgradeAnim(null)
      ;(async () => { await load() })()
      return
    }
    if (type === 'drag-armed') {
      // v5: This event no longer fires from Phaser drag (drag lifecycle
      // disabled). Kept as a no-op stub for backward compat in case any
      // stale code paths emit it. Bismillah is now triggered only when
      // the child EXPLICITLY confirms a move via confirmMoveRelocate().
      return
    }
    if (type === 'move-mode-entered') {
      setMoveModeActive({ buildingId: payload.buildingId })
      haptic.select()
      return
    }
    if (type === 'move-mode-cancelled') {
      setMoveModeActive(null)
      return
    }
    if (type === 'building-move-requested') {
      // User dropped a building at a valid destination cell. Show the
      // Ya/Tidak confirmation card. Bismillah does NOT fire here — it
      // fires only when the child confirms the move (see confirmMoveRelocate).
      haptic.select()
      setMoveModeActive(null)
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
                      !!moveConfirmation || !!landmarkCelebration || !!autoUpgradeCelebration ||
                      tasikIntroOpen
  // Canvas pointer-events + Phaser interactionLocked. We EXCLUDE
  // ritual.phase === 'building' from the block so children can freely
  // swipe/pan the world while the construction animation plays out
  // (same as during restructure/relocate). The BuildingProgressOverlay is
  // already pointer-events-none so it doesn't consume gestures itself.
  const canvasBlocked = overlayOpen && !(ritual?.phase === 'building')

  return (
    <div className="fixed inset-0 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'} style={{
      background: 'radial-gradient(1200px 800px at 50% 30%, #a8dda8 0%, #6eaa6e 45%, #2d5c3a 100%)',
    }}>
      {/* Phaser canvas — pointer events disabled whenever a React overlay is up
          so button taps on modals never bleed through to isometric tiles below. */}
      <div className={`absolute inset-0 ${canvasBlocked ? 'pointer-events-none' : ''}`}>
        {!loading && worldState && (
          <WorldCanvas
            childId={childId}
            worldState={worldState}
            onEvent={handleCanvasEvent}
            interactionLocked={canvasBlocked}
            construct={construct}
            autoUpgradeAnim={autoUpgradeAnim}
            lang={lang}
            cameraCommand={cameraCommand}
            buildDrag={buildDrag}
          />
        )}
      </div>

      {/*  ═══ WORLD POLISH — CSS VIGNETTE + SUN WARMTH ═══
           A subtle radial mask darkens the edges of the viewport to give the
           world "cinematic depth" (Kingshot/LordRush trick). The vignette is
           `pointer-events: none` so it never blocks taps. Two layers:
             1. dark vignette — corners fade to ~35% black, centre stays clear.
             2. warm sun tint — soft top-right warm glow reinforces the
                consistent 45° top-right lighting our assets are drawn with. */}
      {!loading && worldState && (
        <div
          className="pointer-events-none absolute inset-0 z-[6]"
          aria-hidden="true"
          style={{
            background: [
              // Warm sun highlight — top-right, blended additively
              'radial-gradient(circle at 82% 12%, rgba(255,236,180,0.22) 0%, rgba(255,236,180,0.10) 22%, transparent 45%)',
              // Vignette — dark corners fading toward centre
              'radial-gradient(ellipse at 50% 55%, transparent 42%, rgba(0,0,0,0.18) 78%, rgba(0,0,0,0.36) 100%)',
            ].join(', '),
            mixBlendMode: 'multiply',
          }}
        />
      )}

      {/* Beautiful loading splash — shown ONLY on first mount while world
          data is being fetched AND the archipelago is closed (archipelago
          now doubles as the loading screen when it is open, per user
          feedback: "island map will be the first pages of the world, it
          become loading pages… go straight to the world without loading
          anymore"). */}
      <AnimatePresence>
        {loading && !archipelagoOpen && (
          <WorldLoadingScreen key="world-loading" lang={lang} />
        )}
      </AnimatePresence>

      {/* ═══ ARCHIPELAGO MAP — entry gate ═══
          Shown first-visit and when the child taps 🗺️ in the world view.
          Only "Pulau Impianku" is playable; the other 6 slots are generic
          locked placeholders (nama/tema belum diputuskan). Selection is
          persisted so a page refresh keeps the child on their island.
          Doubles as the loading screen — WorldCanvas renders behind it
          as soon as worldState hydrates, so the transition into the world
          is instantaneous (no second loading splash). */}
      <AnimatePresence>
        {archipelagoOpen && (
          <ArchipelagoMap
            key="archipelago"
            lang={lang}
            worldState={worldState}
            isLoadingWorld={loading}
            onBack={() => router.push('/kid')}
            onSelectIsland={(id) => {
              setSelectedIslandId(id)
              setArchipelagoOpen(false)
              try { localStorage.setItem('eqrel-selected-island', id) } catch { /* noop */ }
              // Fire the Phaser dolly-zoom on the SAME frame the archipelago
              // begins its exit — no timeout gap — so the map's zoom-into-
              // island and the world's zoom-into-Musalla read as one
              // continuous camera flight (user: "action camera must
              // continuety frictionless to enter the world").
              setCameraCommand({ action: 'worldEnter', key: Date.now() })
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
            {buildings.filter(b => !(BUILDING_TEMPLATES[b.templateId]?.locked)).length} {l('buildings', lang)}{' · '}
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
                    {(t.cardAsset || t.spriteAsset) ? (
                      <img
                        src={t.cardAsset || t.spriteAsset}
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
              // Popup dismissed → trigger the CONSTRUCTION CEREMONY on the
              // ACTUAL Musalla tile in the world (not another popup). User
              // said: "process upgrade bukan pada popup tetapi pada actual
              // worlds macam kita baru bina asset."
              setAutoUpgradeAnim({
                buildingId: autoUpgradeCelebration.buildingId,
                toLevel: autoUpgradeCelebration.toLevel,
                key: Date.now(),
              })
              setAutoUpgradeCelebration(null)
            }}
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
            onMove={() => {
              // v5: Explicit Move flow — engage scene's picked-up state and
              // close the info card so the child can drag to the destination.
              const scene = (typeof window !== 'undefined')
                ? window.__eqrelPhaser?.scene?.getScene?.('WorldScene')
                : null
              if (scene?.enterMoveMode?.(upgradeTarget.id)) {
                setUpgradeTarget(null)
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Move-Mode HUD — hint + Batal button visible while a building is
          "picked up" and the child is dragging to a new cell. */}
      <AnimatePresence>
        {moveModeActive && (
          <motion.div
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-[95] pointer-events-auto"
          >
            <div className="flex items-center gap-2 bg-amber-500 text-white rounded-2xl shadow-2xl px-3 py-2 border-2 border-amber-300">
              <span className="text-lg">✋</span>
              <span className="text-sm font-black">{l('moveHint', lang)}</span>
              <button
                onClick={() => {
                  const scene = (typeof window !== 'undefined')
                    ? window.__eqrelPhaser?.scene?.getScene?.('WorldScene')
                    : null
                  scene?.cancelMoveMode?.()
                  setMoveModeActive(null)
                }}
                className="ml-1 rounded-lg bg-white/25 hover:bg-white/40 active:scale-95 px-2 py-0.5 text-[11px] font-black"
              >{l('moveCancel', lang)}</button>
            </div>
          </motion.div>
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

      {/* Tasik intro — EQ mascot greeting when child first sees the
          pre-placed natural lake. Shown once per child, persisted via
          localStorage. Bilingual (follows lang toggle). */}
      <AnimatePresence>
        {tasikIntroOpen && (
          <TasikIntroOverlay
            lang={lang}
            childName={child?.nickname}
            onComplete={() => {
              if (typeof window !== 'undefined')
                localStorage.setItem(`eqrel_tasik_intro_${childId}`, '1')
              setTasikIntroOpen(false)
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

// ─── Tasik Intro Overlay ────────────────────────────────────────────
// Shown ONCE per child, right after the world loads for the first time
// (or after the v3 migration adds the pre-placed lake to an existing
// world). EQ mascot greets the child and explains that the tasik is
// Allah's gift — the reason civilization began here. Then invites them
// to build the Musalla (rumah Allah) next.
const TasikIntroOverlay = ({ lang, childName, onComplete }) => {
  const isRTL = lang === 'ar'
  const nick = childName || (lang === 'ms' ? 'anak soleh' : lang === 'ar' ? 'يا حبيبي' : 'young builder')

  const text = {
    ms: {
      title: 'Assalamualaikum!',
      body: `Lihat, ${nick}! Tasik ini bukan kita bina — Allah kurniakan sebagai nikmat awal. Tamadun bermula di mana ada air.`,
      cta: 'Mari bina rumah Allah dahulu →',
      subline: '"Dan Kami jadikan dari air, tiap-tiap sesuatu yang hidup" — Al-Anbiya: 30',
    },
    en: {
      title: 'Assalamualaikum!',
      body: `Look, ${nick}! This lake wasn't built by us — Allah placed it here as His first gift. Civilization begins where there is water.`,
      cta: "Let's build Allah's house first →",
      subline: '"We made from water every living thing" — Al-Anbiya: 30',
    },
    id: {
      title: 'Assalamualaikum!',
      body: `Lihat, ${nick}! Danau ini bukan kita buat — Allah kurniakan sebagai nikmat awal. Peradaban bermula di mana ada air.`,
      cta: 'Mari bangun rumah Allah dahulu →',
      subline: '"Kami jadikan segala yang hidup dari air" — Al-Anbiya: 30',
    },
    ar: {
      title: 'السلام عليكم!',
      body: `انظر يا ${nick}! هذه البحيرة ليست من صنعنا — الله وضعها هنا نعمةً أولى. تبدأ الحضارة حيث يكون الماء.`,
      cta: '← فلنبنِ بيت الله أولاً',
      subline: '﴿وَجَعَلْنَا مِنَ الْمَاءِ كُلَّ شَيْءٍ حَيٍّ﴾ — الأنبياء ٣٠',
    },
  }[lang] || null
  const T = text || {
    title: 'Assalamualaikum!',
    body: `Look, ${nick}! Allah placed this lake here as His first gift.`,
    cta: "Let's build Allah's house first →",
    subline: '"We made from water every living thing" — Al-Anbiya: 30',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0, 30, 45, 0.72)', backdropFilter: 'blur(6px)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onComplete}
    >
      <motion.div
        initial={{ y: 40, scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 40, scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        className="relative max-w-md w-full bg-gradient-to-br from-sky-50 to-cyan-100 rounded-3xl shadow-2xl border-4 border-sky-300 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* EQ mascot header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="text-5xl leading-none" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,120,180,0.35))' }}>
            🌊
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black text-sky-600 uppercase tracking-widest">EQ</div>
            <div className="text-lg font-black text-sky-900 leading-tight">{T.title}</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 space-y-3">
          <p className="text-sm text-sky-900/90 leading-relaxed font-medium">
            {T.body}
          </p>
          <div className="text-[11px] italic text-sky-700 leading-snug border-l-3 border-cyan-400 pl-2.5 bg-white/50 rounded-r-lg py-1.5">
            {T.subline}
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          <button
            onClick={onComplete}
            className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-black py-3 text-sm active:scale-95 shadow-lg"
          >
            {T.cta}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

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
  const spriteSrc = t?.cardAsset || t?.spriteAsset
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
  const spriteSrc = t?.cardAsset || t?.spriteAsset
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
// ═══════════════════════════════════════════════════════════════════════════
// SmokeMass v2 — layered atmospheric smoke, CSS only, ~10 DOM nodes.
// Each layer uses MULTI-STOP radial-gradients with OFFSET centres so the
// cloud has irregular internal density (not one symmetric oval). Palette
// mostly pure black with subtle navy/purple hints ONLY inside inner dark
// layers (per user spec 2026-08-03). One tiny highlight puff catches
// "moonlight" for a hint of dimensionality. CSS variables drive per-
// instance variation without duplicating declarations.
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// SmokeMass v3 — layered smoke where DARKNESS EMERGES from overlap, not
// from a single black fill. Fixes the "flat uniform black" problem (2026-
// 08-03): parent is transparent, NO parent multiply blend, no full-size
// black gradient. Charcoal-dominant body + navy & violet depth pockets +
// SMALL black density pockets + subtle highlights on top. Composition
// (per spec §"Colour Proportions"):
//   pure black   ~12%  (tiny inner pockets, opacity <0.60)
//   charcoal     ~55%  (main visible body, opacity 0.30-0.52)
//   navy-charcoal ~18%  (cool cavity, opacity 0.18-0.34)
//   violet-charcoal ~10% (warm depth pocket, opacity 0.18-0.30)
//   highlights   ~5%   (rgba white/blue at 0.04-0.10 on upper puffs)
// Z-order (back → front): outer haze → charcoal → navy → violet →
// black pockets → highlights. No mix-blend on parent.
// ═══════════════════════════════════════════════════════════════════════════
const SmokeMass = ({ i, size, yPos, startX, duration, onTap }) => {
  const rand = (n) => {
    const x = Math.sin(i * 137 + n * 31) * 10000
    return x - Math.floor(x)
  }
  const cssVars = {
    '--cloud-scale':      1.0 + (rand(50) - 0.5) * 0.25,
    '--cloud-rotation':   `${(rand(52) - 0.5) * 22}deg`,
  }
  const xStart = startX - 70
  const xEnd   = startX + 170

  // Deterministic offset centres so gradients don't all sit at 50/50.
  const cLeft  = `${28 + rand(60) * 14}%`  // charcoal body offset centre-left
  const cLeftY = `${42 + rand(61) * 16}%`
  const cRight = `${58 + rand(62) * 14}%`  // charcoal body offset centre-right
  const cRightY = `${48 + rand(63) * 14}%`
  const navyX  = `${45 + rand(64) * 20}%`  // navy cavity lower-centre
  const navyY  = `${58 + rand(65) * 16}%`
  const violX  = `${58 + rand(66) * 18}%`  // violet depth upper-right
  const violY  = `${28 + rand(67) * 18}%`
  const hlX    = `${34 + rand(68) * 24}%`  // highlight upper-left/centre
  const hlY    = `${18 + rand(69) * 14}%`
  const blk1X  = `${38 + rand(70) * 12}%`  // black pocket 1
  const blk1Y  = `${48 + rand(71) * 10}%`
  const blk2X  = `${56 + rand(72) * 14}%`  // black pocket 2
  const blk2Y  = `${52 + rand(73) * 14}%`

  return (
    <motion.button
      initial={{ x: `${xStart}vw`, opacity: 0 }}
      animate={{
        x: [`${xStart}vw`, `${xStart + 20}vw`, `${xEnd - 20}vw`, `${xEnd}vw`],
        opacity: [0, 1, 1, 0],
        scale: [1, 1.03, 1.01, 1],
      }}
      transition={{ duration, times: [0, 0.09, 0.91, 1], repeat: Infinity, ease: 'linear' }}
      onClick={onTap}
      aria-label="Astaghfirullah"
      className="absolute pointer-events-auto cursor-pointer active:scale-95"
      style={{
        top: `${yPos}%`,
        width: size,
        height: size * 0.72,
        border: 'none',
        padding: 0,
        // Parent must be transparent — no full-size black fill, no multiply.
        background: 'transparent',
        willChange: 'transform, opacity',
        transform: `rotate(var(--cloud-rotation, 0)) scale(var(--cloud-scale, 1))`,
        ...cssVars,
      }}
    >
      {/* Layer 1 — outer atmospheric haze (broadest, most transparent) */}
      <div style={{
        position: 'absolute', inset: '-8% -8% -8% -8%', borderRadius: '48% 52% 55% 45%',
        background: `
          radial-gradient(ellipse 60% 55% at 35% 55%, #222630 0%, #292D37 45%, transparent 82%),
          radial-gradient(ellipse 50% 45% at 65% 45%, #20283A 0%, transparent 78%)
        `,
        opacity: 0.10 + rand(80) * 0.08,     // 0.10-0.18
        filter: `blur(${34 + rand(81) * 12}px)`,
        pointerEvents: 'none',
      }} />

      {/* Layer 2 — broad charcoal body (main visible mass, offset centre-left) */}
      <div style={{
        position: 'absolute', inset: '2% 6% 4% 0', borderRadius: '55% 45% 58% 42%',
        background: `
          radial-gradient(ellipse 58% 48% at ${cLeft} ${cLeftY}, #15171C 0%, #1B1E25 35%, #222630 60%, transparent 82%),
          radial-gradient(ellipse 42% 36% at ${cRight} ${cRightY}, #1B1E25 0%, #292D37 50%, transparent 78%)
        `,
        opacity: 0.34 + rand(82) * 0.18,     // 0.34-0.52
        filter: `blur(${20 + rand(83) * 10}px)`,
        pointerEvents: 'none',
      }} />

      {/* Layer 3 — cool navy-charcoal cavity (lower centre) */}
      <div style={{
        position: 'absolute', inset: '10% 8% 5% 12%', borderRadius: '52% 48% 45% 55%',
        background: `
          radial-gradient(ellipse 55% 45% at ${navyX} ${navyY}, #111827 0%, #182033 40%, transparent 78%)
        `,
        opacity: 0.20 + rand(84) * 0.14,     // 0.20-0.34
        filter: `blur(${22 + rand(85) * 8}px)`,
        pointerEvents: 'none',
      }} />

      {/* Layer 4 — muted violet depth (upper right pocket) */}
      <div style={{
        position: 'absolute', inset: '5% 5% 15% 20%', borderRadius: '45% 55% 50% 50%',
        background: `
          radial-gradient(ellipse 50% 45% at ${violX} ${violY}, #1D1928 0%, #252033 40%, transparent 76%)
        `,
        opacity: 0.18 + rand(86) * 0.12,     // 0.18-0.30
        filter: `blur(${20 + rand(87) * 10}px)`,
        pointerEvents: 'none',
      }} />

      {/* Layer 5a — deep black pocket #1 (small, dense, inner) */}
      <div style={{
        position: 'absolute', inset: '25% 30% 25% 30%', borderRadius: '50%',
        background: `radial-gradient(ellipse 45% 40% at ${blk1X} ${blk1Y}, #000000 0%, #040506 40%, transparent 75%)`,
        opacity: 0.44 + rand(88) * 0.16,     // 0.44-0.60
        filter: `blur(${12 + rand(89) * 6}px)`,
        pointerEvents: 'none',
      }} />

      {/* Layer 5b — deep black pocket #2 (smaller, offset) */}
      <div style={{
        position: 'absolute', inset: '30% 25% 30% 35%', borderRadius: '50%',
        background: `radial-gradient(ellipse 35% 32% at ${blk2X} ${blk2Y}, #000000 0%, #08090C 45%, transparent 78%)`,
        opacity: 0.38 + rand(90) * 0.18,     // 0.38-0.56
        filter: `blur(${14 + rand(91) * 4}px)`,
        pointerEvents: 'none',
      }} />

      {/* Layer 6 — subtle upper highlights (TOP of z-order) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 28% 20% at ${hlX} ${hlY}, rgba(205,212,224,0.09) 0%, rgba(170,180,195,0.05) 50%, transparent 85%),
          radial-gradient(ellipse 18% 14% at 58% 22%, rgba(255,255,255,0.035) 0%, transparent 80%)
        `,
        opacity: 0.6 + rand(92) * 0.3,
        filter: `blur(${14 + rand(93) * 8}px)`,
        mixBlendMode: 'screen',              // ONLY on this thin highlight layer, per spec
        pointerEvents: 'none',
      }} />

      {/* Small detached charcoal puffs at perimeter — irregular silhouette */}
      {[0, 1, 2, 3].map((k) => {
        const px = 5 + rand(100 + k) * 88
        const py = 5 + rand(105 + k) * 88
        const pw = 15 + rand(110 + k) * 15
        const ph = 11 + rand(115 + k) * 12
        const shape = ['48% 52% 55% 45%', '55% 45% 48% 52%', '50% 50% 42% 58%', '45% 55% 52% 48%'][k]
        return (
          <div key={`puff-${k}`} style={{
            position: 'absolute',
            left: `${px}%`, top: `${py}%`,
            width: `${pw}%`, height: `${ph}%`,
            borderRadius: shape,
            background: `radial-gradient(ellipse at 42% 45%, #1B1E25 0%, #222630 50%, transparent 85%)`,
            opacity: 0.10 + rand(120 + k) * 0.14,
            filter: `blur(${20 + rand(125 + k) * 14}px)`,
            pointerEvents: 'none',
          }} />
        )
      })}
    </motion.button>
  )
}



const CloudOverlay = ({ demeritCount, lang, onOpenIstighfar }) => {
  if (!demeritCount || demeritCount <= 0) return null
  const clouds = Math.min(demeritCount, 10)
  // Overall darkening intensity (0 → 0.45 max) — subtle ambient dim,
  // NOT a solid overlay. Smoke masses layer their own darkness on top.
  const darken = Math.min(0.45, demeritCount * 0.04)
  // i18n for the CTA that appears once smoke accumulates.
  const CTA = {
    ms: '🤲 Ketuk asap untuk beristighfar',
    en: '🤲 Tap the smoke to say Astaghfirullah',
    id: '🤲 Ketuk asap untuk beristighfar',
    ar: '🤲 اضغط على الدخان للاستغفار',
  }
  return (
    // pointer-events-none on the wrapper so the world underneath still receives
    // pans/zooms — only the interactive elements below enable pointer events.
    <div className="absolute inset-0 pointer-events-none z-[20] overflow-hidden">
      {/* Ambient atmospheric darkening — subtle, since smoke masses carry
          the heavy darkness. This layer just tints the whole scene calmer. */}
      <div className="absolute inset-0 transition-opacity duration-1000" style={{
        background: `rgba(15, 15, 15, ${darken})`,
      }} />
      {/* Volumetric smoke masses — each drifts across the sky and can be
          tapped to open the Istighfar cleanse loop. */}
      {[...Array(clouds)].map((_, i) => {
        const size = 200 + (i % 4) * 80         // 200, 280, 360, 440 px
        const yPos = 2 + (i * 11) % 45          // spread top half of screen
        const startX = -(i * 13) % 100
        const duration = 55 + (i % 5) * 12      // 55-103s drift — slow, calm
        return (
          <SmokeMass
            key={i}
            i={i}
            size={size}
            yPos={yPos}
            startX={startX}
            duration={duration}
            onTap={onOpenIstighfar}
          />
        )
      })}
      {/* CTA hint — clickable button that also opens the Istighfar modal. */}
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
const ArchipelagoMap = ({ lang, worldState, onSelectIsland, onBack, isLoadingWorld = false }) => {
  const isRTL = lang === 'ar'
  const buildings = worldState?.buildings || []
  const musalla = buildings.find(b => b.templateId === 'musalla')
  const musallaLevel = musalla?.level || 1
  const rumahCount = buildings.filter(b => BUILDING_TEMPLATES[b.templateId]?.category === 'rumah').length
  // totalBuildings excludes musalla (auto-tracked separately) AND locked landmarks
  // (tasik) — these aren't child-built achievements.
  const totalBuildings = buildings.filter(b => b.templateId !== 'musalla' && !BUILDING_TEMPLATES[b.templateId]?.locked).length
  const musallaProgress = Math.min(1, (musallaLevel - 1) / 2)
  const buildingProgress = Math.min(1, totalBuildings / 30)
  const rumahProgress = Math.min(1, rumahCount / 15)
  const overallPct = Math.round(((musallaProgress + buildingProgress + rumahProgress) / 3) * 100)
  const readyToHijrah = overallPct >= 100
  // Local UI state: which island is being tapped (for zoom-in transition)
  // and which locked island shows the "coming soon" tooltip.
  const [enteringId, setEnteringId] = useState(null)
  const [lockedTooltipId, setLockedTooltipId] = useState(null)
  useEffect(() => {
    if (!lockedTooltipId) return
    const t = setTimeout(() => setLockedTooltipId(null), 2600)
    return () => clearTimeout(t)
  }, [lockedTooltipId])

  // ── Strategy B: background asset warm-up ─────────────────────────────
  // While the child is viewing the archipelago (usually 2-5 seconds), we
  // quietly kick off `new Image()` fetches for the most-critical world
  // assets so they land in the browser's HTTP cache. When the child taps
  // "Enter Island" and Phaser starts preloading, those assets resolve
  // instantly from cache instead of hitting the network again. Combined
  // with Strategy C (conditional preload in WorldScene), the perceived
  // world-load time drops significantly. Runs ONCE per mount, non-blocking.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const buildings = worldState?.buildings || []
    const templateIds = new Set(buildings.map(b => b.templateId))
    const musallaLevel = buildings.find(b => b.templateId === 'musalla')?.level || 1

    // Core assets — always warm (small footprint, always needed)
    const paths = [
      '/assets/world/musalla.webp',
      '/assets/world/rumah/rumah_kayu.webp',
      '/assets/world/rumah/rumah_batu.webp',
      '/assets/world/rumah/banglo.webp',
      '/assets/world/construction/fence.webp',
      '/assets/world/sumber_air/tasik.webp',  // pre-placed landmark, guaranteed in every world
    ]
    // Construction poses (workers + excavator, 4 each — used for build/relocate)
    for (let i = 1; i <= 4; i++) {
      const k = String(i).padStart(2, '0')
      paths.push(`/assets/world/construction/workers/worker_${k}.webp`)
      paths.push(`/assets/world/construction/excavator/excavator_${k}.webp`)
    }
    // Musalla next-level (auto-upgrade preview)
    if (musallaLevel <= 2) paths.push('/assets/world/masjid_l2.webp')
    if (musallaLevel === 2) paths.push('/assets/world/masjid_l3.webp')
    // Livestock — only warm animals whose pen exists
    if (templateIds.has('kandang_kambing')) {
      paths.push('/assets/world/ternakan/kandang_kambing.webp', '/assets/world/ternakan/kambing.webp')
    }
    if (templateIds.has('kandang_lembu')) {
      paths.push('/assets/world/ternakan/kandang_lembu.webp', '/assets/world/ternakan/lembu.webp')
    }
    if (templateIds.has('kandang_unta')) {
      paths.push('/assets/world/ternakan/kandang_unta.webp', '/assets/world/ternakan/unta.webp')
    }
    if (templateIds.has('reban_ayam')) {
      paths.push('/assets/world/ternakan/reban_ayam.webp')
      for (let i = 1; i <= 7; i++) {
        const k = `chicken_${String(i).padStart(2, '0')}`
        paths.push(`/assets/world/ternakan/chickens/${k}.webp`)
      }
    }
    // Kebun trees — only warm if the matching kebun exists
    const KEBUN_TO_TREE = {
      kebun_kurma:  '/assets/world/kebun/palm_tree.webp',
      kebun_tin:    '/assets/world/kebun/fig_tree.webp',
      kebun_delima: '/assets/world/kebun/pomegranate_tree.webp',
      kebun_zaitun: '/assets/world/kebun/olive_tree.webp',
      kebun_anggur: '/assets/world/kebun/grape_row.webp',
    }
    for (const [kebun, tree] of Object.entries(KEBUN_TO_TREE)) {
      if (templateIds.has(kebun)) paths.push(tree)
    }
    // Sumber Air (perigi/kolam) — warm if world already has them
    if (templateIds.has('perigi')) paths.push('/assets/world/sumber_air/perigi.webp')
    if (templateIds.has('kolam'))  paths.push('/assets/world/sumber_air/kolam.webp')
    // Nature core (sample of most-used decoration — full set loaded by Phaser)
    for (let i = 1; i <= 4; i++) {
      const n = String(i).padStart(2, '0')
      paths.push(`/assets/world/grass/grass_${n}.webp`)
      paths.push(`/assets/world/flowers/patches/flower_patch_${n}.webp`)
      paths.push(`/assets/world/saplings/sapling_${n}.webp`)
    }
    // Fire-and-forget prefetch — browser will cache; no error handling needed.
    for (const p of paths) {
      try { const img = new window.Image(); img.src = p } catch { /* ignore */ }
    }
  }, [worldState])
  const L = {
    title:      { ms: 'Peta Kepulauan Iman', en: 'Islands of Iman Map',       id: 'Peta Kepulauan Iman', ar: 'خريطة جزر الإيمان' },
    subtitle:   {
      ms: 'Ikuti laluan. Setiap pulau menanti — buat baik untuk buka pulau seterusnya.',
      en: 'Follow the path. Each island awaits — keep doing good to unlock the next.',
      id: 'Ikuti jalur. Setiap pulau menunggu — teruslah berbuat baik.',
      ar: 'اتبع المسار. كل جزيرة تنتظر — استمر في فعل الخير.',
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
    tapToEnter: {
      ms: 'Tekan untuk masuk',
      en: 'Tap to enter',
      id: 'Ketuk untuk masuk',
      ar: 'اضغط للدخول',
    },
    lockedTooltip: {
      ms: 'Kena lengkapkan Pulau Impianku dulu sebelum buka pulau ini!',
      en: 'Complete My Dream Island first to unlock this one!',
      id: 'Selesaikan Pulau Impianku dulu untuk membuka pulau ini!',
      ar: 'أكمل جزيرة أحلامي أولاً لفتح هذه الجزيرة!',
    },
    back:        { ms: 'Kembali', en: 'Back',       id: 'Kembali',      ar: 'رجوع' },
    preparing:   {
      ms: 'Menyediakan dunia kamu…',
      en: 'Preparing your world…',
      id: 'Menyiapkan duniamu…',
      ar: 'نُهيّئ عالمك…',
    },
    zooming: {
      ms: 'Turun ke pulau…',
      en: 'Descending to island…',
      id: 'Turun ke pulau…',
      ar: 'الهبوط إلى الجزيرة…',
    },
  }
  const tr = (k, ...args) => {
    const v = L[k]?.[lang] || L[k]?.ms
    return typeof v === 'function' ? v(...args) : v
  }
  const WAYPOINTS = [
    // Active island moved UP from y=78 → y=62 so its nameplate no longer
    // overlaps the fixed progress footer at the bottom (user feedback).
    // Other 6 locked islands re-flowed above to keep the S-curve trail.
    { id: 'pulau_impianku', x: 50, y: 66, size: 200, locked: false },
    { id: 'locked_1',       x: 22, y: 52, size: 96,  locked: true },
    { id: 'locked_2',       x: 76, y: 42, size: 96,  locked: true },
    { id: 'locked_3',       x: 26, y: 30, size: 92,  locked: true },
    { id: 'locked_4',       x: 74, y: 20, size: 92,  locked: true },
    { id: 'locked_5',       x: 30, y: 10, size: 88,  locked: true },
    { id: 'locked_6',       x: 72, y: 3,  size: 88,  locked: true },
  ]
  const pathD = WAYPOINTS.map((w, i) => {
    if (i === 0) return `M ${w.x} ${w.y}`
    const prev = WAYPOINTS[i - 1]
    const midX = (prev.x + w.x) / 2
    return `Q ${midX} ${prev.y}, ${w.x} ${w.y}`
  }).join(' ')
  // ISLAND-CENTERED CAMERA ZOOM. On tap, we DO NOT scale the island itself —
  // the island stays anchored in place and the entire archipelago container
  // scales up (transform-origin locked to the island's on-screen position),
  // simulating a camera dolly-zoom INTO the island. Phaser's worldEnter cam
  // tween fires simultaneously so the map exit blends seamlessly into the
  // world camera — one continuous frictionless zoom (user: "camera zoom in
  // ke island bukan island datang close or become bigger, dan action camera
  // must continuety frictionless to enter the world").
  const handleEnterActive = (id) => {
    if (enteringId || isLoadingWorld) return
    setEnteringId(id)
    // Fire the callback immediately — parent closes the archipelago (which
    // triggers our AnimatePresence exit scale-into-island) AND kicks the
    // Phaser worldEnter tween on the same frame. No timeout gap = no
    // visible cut between map camera and world camera.
    onSelectIsland(id)
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale: 1 }}
      // On exit, the ENTIRE map container scales up strongly with a
      // transform-origin locked at the active island's on-screen position
      // (50%, ~60% viewport) — so the island stays visually anchored while
      // everything around it explodes outward. Combined with the Phaser
      // camera's worldEnter tween firing on the same frame, the effect is
      // one continuous camera zoom from the archipelago into the world.
      exit={{ opacity: 0, scale: 6 }}
      transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
      style={{ transformOrigin: '50% 58%' }}
      // FIXED positioning + top z-index — blocks ALL underlying world
      // interactions (user: "pressing anything at this pages still occurs
      // the info of the house build"). Now behaves as a true page.
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden pointer-events-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sea covers the WHOLE viewport (no gaps, no looping/tiling — user
          requested a clean "stretch to fit" background). Uses `cover` so the
          image scales to fill the viewport while preserving aspect ratio. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/assets/archipelago/sea.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,20,45,0.55) 100%)',
      }} />

      {/* Back button — floats at top-left, returns kid to their dashboard.
          Uses safe-area-inset so it clears iPhone notches. */}
      {onBack && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBack() }}
          className="absolute z-30 top-[max(env(safe-area-inset-top),12px)] left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur border-2 border-amber-400/70 rounded-full px-3 py-1.5 text-amber-100 font-black text-xs shadow-xl active:scale-95"
          aria-label={tr('back')}
        >
          <span className="text-base leading-none">{isRTL ? '→' : '←'}</span>
          <span>{tr('back')}</span>
        </button>
      )}

      {/* Header — floats over map, uses safe-area-inset for notched phones */}
      <div className="relative z-20 px-3 pt-[max(env(safe-area-inset-top),12px)] pb-2 text-center flex-shrink-0">
        <motion.div
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', damping: 20 }}
          className="inline-block bg-amber-950/85 backdrop-blur border-2 border-amber-400/70 rounded-full px-4 py-1.5 shadow-lg"
        >
          <div className="text-amber-300 text-[11px] uppercase tracking-widest font-black drop-shadow-md">
            🗺️ {tr('title')}
          </div>
        </motion.div>
        <div className="text-white/95 text-[11px] max-w-md mx-auto leading-tight mt-1.5 drop-shadow-md font-medium px-2">
          {tr('subtitle')}
        </div>
      </div>

      {/* Journey canvas — dashed path + islands */}
      <div className="relative flex-1 min-h-0">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={pathD} stroke="rgba(255, 235, 150, 0.9)" strokeWidth="0.55" strokeDasharray="1.5 1.3"
            fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255,220,120,0.6))' }} />
        </svg>

        {WAYPOINTS.map((wp) => {
          const isActive = !wp.locked
          const isEntering = enteringId === wp.id
          const src = isActive ? '/assets/archipelago/pulau_impian.webp' : '/assets/archipelago/lock_island.webp'
          return (
            <div key={wp.id} className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${wp.x}%`, top: `${wp.y}%` }}>
              {isActive ? (
                <motion.button
                  onClick={() => handleEnterActive(wp.id)}
                  initial={{ scale: 0.6, opacity: 0, y: 30 }}
                  // Island stays STATIC on tap — the container-level scale
                  // (transform-origin locked to this island's position)
                  // provides the "camera zoom INTO the island" effect the
                  // user asked for. The island itself must not grow, else
                  // it looks like it's flying toward the camera instead of
                  // the camera flying toward it.
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 180, damping: 18,
                    delay: 0.15,
                  }}
                  className="relative block group active:scale-95 transition-transform"
                  style={{ width: 'clamp(120px, 34vmin, 200px)' }}
                  aria-label={tr('pulauImpianku')}
                >
                  <motion.div
                    className="absolute inset-x-0 top-1/4 h-3/4 rounded-full bg-amber-300/40 blur-3xl pointer-events-none"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.85, 0.4] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.img
                    src={src} alt={tr('pulauImpianku')}
                    className="relative w-full h-auto object-contain drop-shadow-2xl"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    draggable={false}
                  />
                  {/* Nameplate sits ABOVE the island so it can't collide with
                      the fixed progress footer at the bottom (user feedback:
                      "text pulau aktif kena overlap dengan progress bar").
                      Constrained width (max-w-[220px]) prevents it from
                      spilling sideways into neighbouring locked islands.
                      Positioned close to island crest with a downward arrow. */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-[6%] -translate-y-full w-max max-w-[220px] z-10 pointer-events-none">
                    <div className="bg-black/85 backdrop-blur border-2 border-amber-400/80 rounded-2xl px-3 py-1 shadow-2xl">
                      <div className="text-amber-200 font-black text-sm drop-shadow leading-tight text-center whitespace-nowrap">
                        ⭐ {tr('pulauImpianku')}
                      </div>
                      <div className="text-white/80 text-[10px] text-center whitespace-nowrap">
                        {tr('stats', musallaLevel, rumahCount, totalBuildings)}
                      </div>
                      <div className="text-emerald-300 text-[9px] mt-0.5 font-bold italic animate-pulse text-center">
                        👆 {tr('tapToEnter')}
                      </div>
                    </div>
                    {/* Tiny pointer arrow linking nameplate to island crest */}
                    <div className="w-3 h-3 bg-black/85 border-r-2 border-b-2 border-amber-400/80 rotate-45 mx-auto -mt-1.5" />
                  </div>
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => setLockedTooltipId(wp.id)}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.9 }}
                  transition={{ delay: 0.2 + wp.y * 0.005 }}
                  className="relative block"
                  style={{ width: 'clamp(64px, 18vmin, 120px)' }}
                  aria-label={tr('locked')}
                >
                  <img src={src} alt={tr('locked')}
                    className="w-full h-auto object-contain drop-shadow-xl" draggable={false} />
                  {/* No persistent pill label — asset sudah ada padlock icon
                      visible, dan tap → tooltip. This removes overlap on
                      neighboring islands (user feedback: NANTI DIBUKA pills
                      "sticks out sideways covering neighboring islands"). */}
                  {/* Tap tooltip appears above the island for 2.6s */}
                  <AnimatePresence>
                    {lockedTooltipId === wp.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.9 }}
                        className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full z-20 pointer-events-none"
                      >
                        <div className="bg-amber-950/95 backdrop-blur border-2 border-amber-400/80 rounded-2xl px-3 py-2 shadow-2xl max-w-[60vw] w-max">
                          <div className="text-amber-100 text-[11px] font-bold text-center leading-snug">
                            🔒 {tr('lockedTooltip')}
                          </div>
                        </div>
                        <div className="w-3 h-3 bg-amber-950/95 border-r-2 border-b-2 border-amber-400/80 rotate-45 mx-auto -mt-1.5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress footer with safe-area bottom padding for iPhone home bar */}
      <div className="relative z-20 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 flex-shrink-0">
        <div className="max-w-md mx-auto">
          <div className="bg-black/70 backdrop-blur border-2 border-amber-400/70 rounded-2xl px-4 py-2.5 shadow-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-amber-200 text-[10px] uppercase tracking-wider font-black">
                {tr('pulauImpianku')}
              </div>
              <div className="text-amber-300 text-base font-black">{overallPct}%</div>
            </div>
            <div className="relative w-full h-2.5 bg-slate-900/70 rounded-full overflow-hidden border border-slate-500/40">
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400 rounded-full"
                style={{ width: `${overallPct}%`, transition: 'width 800ms ease' }} />
            </div>
            <div className="text-white/85 text-[10px] mt-1.5 leading-tight text-center">
              {readyToHijrah ? `🎉 ${tr('hijrahReady')}` : tr('progressLabel')}
            </div>
          </div>
          <button
            onClick={() => handleEnterActive('pulau_impianku')}
            disabled={!!enteringId || isLoadingWorld}
            className="mt-2.5 w-full rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-500 text-amber-950 font-black py-3 active:scale-95 shadow-2xl text-base border-2 border-amber-200 disabled:opacity-70"
          >
            {enteringId
              ? `✨ ${tr('zooming')}`
              : isLoadingWorld
                ? `⏳ ${tr('preparing')}`
                : `🏝️ ${tr('enter')}`}
          </button>
        </div>
      </div>
    </motion.div>
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
const BuildingInfoCard = ({ building, lang, onConfirm, onCancel, onMove, anchor, allBuildings = [] }) => {
  const t = BUILDING_TEMPLATES[building.templateId]
  // v5: Default expanded so [Pindah] button is immediately visible without
  // an extra tap. Sacred buildings stay collapsed since they can't be moved.
  const [expanded, setExpanded] = useState(!t?.isSacred)
  if (!t) return null
  // Tasik & other `locked:true` landmarks are treated as sacred/immutable —
  // no Move button, no Upgrade button. Same locked treatment as musalla.
  const isLocked = t.isSacred || t.locked === true
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
    tasik: {
      ms: '"Dan Kami jadikan dari air, tiap-tiap sesuatu yang hidup" — Al-Anbiya 30 💧',
      en: '"We made from water every living thing" — Al-Anbiya 30 💧',
      id: '"Kami jadikan segala sesuatu yang hidup dari air" — Al-Anbiya 30 💧',
      ar: '﴿وَجَعَلْنَا مِنَ الْمَاءِ كُلَّ شَيْءٍ حَيٍّ﴾ — الأنبياء ٣٠ 💧',
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
                  {/* Pindah (Move) button — the ONLY way to relocate a
                      building on the world. User feedback v5: previous
                      Phaser drag-to-move accidentally triggered on natural
                      pan gestures. Now relocation is explicit: tap here →
                      building "picked up" → drag to new cell. */}
                  {!isLocked && onMove && (
                    <button
                      onClick={onMove}
                      className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-black py-2 text-xs active:scale-95 shadow flex items-center justify-center gap-1.5"
                    >
                      ✋ {l('moveBtn', lang)}
                    </button>
                  )}
                  {isLocked && t.locked === true ? (
                    // Tasik / other landmark — read-only tag: "Anugerah Allah"
                    <div className="text-center text-[11px] font-bold text-sky-700 bg-sky-50 rounded-xl py-1.5 border border-sky-200">
                      🌊 {lang === 'ms' ? 'Anugerah Allah — kekal selamanya'
                          : lang === 'en' ? "Allah's gift — everlasting"
                          : lang === 'id' ? 'Anugerah Allah — kekal selamanya'
                          : 'نعمة من الله — دائمة'}
                    </div>
                  ) : isMax ? (
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
