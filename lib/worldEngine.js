/**
 * World Engine — Building Templates
 * Central registry of all placeable structures for the EQrel World.
 * Each template drives sprite rendering, costs, unlocks, and villager mechanics.
 */

// Fixed pre-gazetted position for the Musalla — center of the MAX grid.
// The world "opens" progressively: it starts small (18×18) and expands
// outward (24×24 → 30×30 → 36×36) as more buildings are placed, keeping
// the Musalla visually centered at all times.
//
// For fresh worlds seeded by the ritual, MUSALLA_ANCHOR is used as the
// default drop point. Existing worlds keep whatever Musalla position they
// have; getWorldBounds computes bounds around that actual position so old
// data (Musalla at 7,7) still works — bounds simply center on it.
export const MUSALLA_ANCHOR = { x: 17, y: 17 }
export const WORLD_SIZE = 18            // initial visible extent (side length)
export const MAX_WORLD_SIZE = 36        // absolute cap after full progression

// Progressive expansion thresholds — buildings count → world side length.
// User approved: 18×18 initial, then 24 / 30 / 36 as milestones are hit.
export function getWorldSize(buildingCount = 0) {
  if (buildingCount >= 15) return 36
  if (buildingCount >= 10) return 30
  if (buildingCount >= 5)  return 24
  return 18
}

// ═══ CIRCULAR WORLD (2026-07-26) ═══════════════════════════════════════
// User request: "bentuk grid world besar sekarang bentuk square, kalau kita
// boleh jadikan ianya bulat macam red alert atau sebagainya ianya nampak
// lebih tersusun". Instead of a rectangular playfield, tiles form a CIRCLE
// around the Musalla (in grid coords → looks like an ELLIPSE in isometric
// projection, which is what a top-down circle looks like when tilted).
//
// Radius grows with population — more buildings → wider island. The Musalla
// stays dead-center as the "heart" of the village.
export function getWorldRadius(buildingCount = 0) {
  // ═══ LINEAR CONTINUOUS GROWTH (2026-08-08 v3) ═════════════════════
  // Previously TIERED (loncatan besar): 10 → 13 → 16 → 19 at counts 5/10/15.
  // User feedback: between milestones felt static — a child building
  // house #2, #3, #4 saw no change in world size ("tak berkembang").
  //
  // Now LINEAR: every single building visibly expands the world by ~0.55
  // tiles. From starter nucleus of 8 tiles up to endgame 22 tiles.
  //
  //   count=0  → R=8.0  (nucleus of village)
  //   count=3  → R=9.7  (tiny hamlet)
  //   count=5  → R=10.75 (small community)
  //   count=10 → R=13.5 (growing village)
  //   count=15 → R=16.25 (established town)
  //   count=20 → R=19.0 (bandaraya)
  //   count=25+→ R=22.0 (metropolitan endgame, cap)
  //
  // Return integer for stable diamond mask alignment (fractional radii
  // create visible sub-pixel jitter on the mask edge).
  return Math.min(22, Math.round(8 + buildingCount * 0.55))
}

// ─── Wilderness offset — RECEDES as playable grows ─────────────────
// The wilderness ring around playable "shrinks" as more buildings are
// built. This gives the child a sense of "civilizing"/khalifah
// stewardship — human community pushing back the untouched wild.
//
// Total map extent (playable + wilderness) stays roughly constant at
// ~28-31 tiles diameter, so the scene doesn't blow up in size, but the
// balance between village and Allah's untouched creation shifts.
//
//   count=0  → offset=20 (vast unknown surrounds tiny village)
//   count=5  → offset=18
//   count=10 → offset=16 (balanced)
//   count=15 → offset=14
//   count=20 → offset=12 (village dominates, wilderness like garden edge)
//   count=25+→ offset=8  (min — always keep some wilderness)
export function getWildernessOffset(buildingCount = 0) {
  return Math.max(8, Math.round(20 - buildingCount * 0.4))
}

// ─── Circle membership test ────────────────────────────────────
// Returns true if a grid cell (x, y) is INSIDE the circular world.
// Uses Euclidean grid distance from the world center. The center is
// the middle of the Musalla's 8×8 sacred zone (musallaPos + 3.5).
// A tiny 0.5-cell buffer allows cells that are HALF inside to render
// (softer edge, no harsh cut).
export function isCellInWorld(x, y, center, radius) {
  const dx = x - center.x + 0.5   // sample cell center
  const dy = y - center.y + 0.5
  return (dx * dx + dy * dy) <= (radius + 0.5) * (radius + 0.5)
}

// Compute rectangular bounds centered on the Musalla's *actual* position so
// the world grows outward around whichever cell the child originally chose.
// Returns inclusive-exclusive: valid cells x satisfy minX <= x < maxX.
// Bounds may be negative — the renderer handles arbitrary grid coordinates.
export function getWorldBounds(musallaPos = MUSALLA_ANCHOR, size = WORLD_SIZE) {
  const half = Math.floor(size / 2)
  // +1 offset accounts for Musalla being a 2×2 building anchored at its NW cell,
  // so its visual center is at (anchor.x + 0.5, anchor.y + 0.5). Placing half
  // cells on each side keeps the Musalla visually centered.
  return {
    minX: musallaPos.x - half + 1,
    maxX: musallaPos.x + half + 1,
    minY: musallaPos.y - half + 1,
    maxY: musallaPos.y + half + 1,
  }
}

// Convenience: given current worldState (or {buildings}), return bounds.
// Now includes CIRCLE data: `center` (grid coords of world heart, same as
// Musalla-zone center) + `radius` (grid distance from center). The rect
// bounds enclose the circle so renderers/backend iterators still work
// row-by-row, but the CIRCLE fields are the source of truth for whether
// a specific cell is inside the playable world.
export function getCurrentBounds(worldState) {
  const buildings = worldState?.buildings || []
  const musalla = buildings.find(b => b.templateId === 'musalla')
  const musallaPos = musalla ? { x: musalla.x, y: musalla.y } : MUSALLA_ANCHOR
  const radius = getWorldRadius(buildings.length)
  // Circle center = middle of Musalla's 8×8 sacred zone (musallaPos + 3.5)
  // so the mosque sits exactly at the heart of the island regardless of level.
  const center = { x: musallaPos.x + 3.5, y: musallaPos.y + 3.5 }
  // Rect bounds enclosing the circle (with 1-cell padding for safe iteration)
  const minX = Math.floor(center.x - radius - 1)
  const maxX = Math.ceil(center.x + radius + 1)
  const minY = Math.floor(center.y - radius - 1)
  const maxY = Math.ceil(center.y + radius + 1)
  return {
    minX, maxX, minY, maxY,
    center, radius, musallaPos,
    size: radius * 2,   // kept for backward-compat (some UI shows "world size")
  }
}

export const BUILDING_TEMPLATES = {
  musalla: {
    id: 'musalla',
    icon: '🕌',
    name: {
      ms: 'Musalla',
      en: 'Musalla',
      id: 'Musalla',
      ar: 'مصلى',
    },
    desc: {
      ms: 'Rumah Allah — pusat komuniti kamu',
      en: 'House of Allah — heart of your community',
      id: 'Rumah Allah — pusat komunitas kamu',
      ar: 'بيت الله — مركز مجتمعك',
    },
    tileSize: { w: 2, h: 2 },      // occupies 2×2 grid cells at level 1
    // Reserved sacred footprint — never assignable to other buildings.
    // Musalla level 2 (Masjid) expands to 3×3, level 3 (Jami' Masjid) to
    // 4×4. We pre-gazette a LARGE 8×8 zone (buffer padding) so children
    // can't crowd their houses right up against the mosque — with a tall
    // Jami' Masjid (2 minarets + big dome), buildings behind it would be
    // visually obstructed. The 8×8 zone ensures plenty of breathing room
    // AND the mosque is anchored dead-center of the zone so its silhouette
    // is symmetrical (no back-lean blocking rear houses).
    reserveSize: { w: 8, h: 8 },
    // Per-level footprint (used at render time as the building grows).
    tileSizeByLevel: {
      1: { w: 2, h: 2 },
      2: { w: 3, h: 3 },
      3: { w: 4, h: 4 },
    },
    color: '#0d5b4e',              // primary building color
    accentColor: '#FFB703',        // dome / accent
    cost: 0,                       // FREE — mandatory first build
    spriteAsset: '/assets/world/musalla.webp', // shown on sidebar card preview
    villagerSpawn: 2,              // spawns 2 villagers (imam + muadhin)
    lockedByDefault: false,        // unlocked at start
    isSacred: true,                // triggers Bismillah/Alhamdulillah + can't be moved
    maxLevel: 3,                   // Musalla → Masjid → Jami' Masjid
    // Progressive unlock: musalla can only upgrade when the child has built
    // enough houses (rumah). Teaches that community grows before the mosque
    // expands — jamaah first, structure later.
    upgradeRequires: {
      2: { rumah: 7 },    // to Masjid: need at least 7 houses
      3: { rumah: 15 },   // to Jami' Masjid: need at least 15 houses
    },
    levelNames: {
      1: { ms: 'Musalla', en: 'Musalla', id: 'Musalla', ar: 'مصلى' },
      2: { ms: 'Masjid', en: 'Masjid', id: 'Masjid', ar: 'مسجد' },
      3: { ms: 'Jami\u2019 Masjid', en: 'Grand Mosque', id: 'Masjid Jami\u2019', ar: 'جامع' },
    },
  },

  // ─── Tasik — landmark alam pre-placed (2026-07-30) ─────────────
  // Bukan binaan manusia. Anugerah Allah yang wujud sebelum tamadun.
  // • Auto-injected at world seed/migration in top-left corner (13, 13).
  // • Cannot be moved, demolished, or duplicated (locked: true).
  // • Not surfaced in the build sidebar (hidden: true).
  // • Same tile footprint as Jami' Masjid (4×4) — sekali pandang, saiznya
  //   memberitahu anak ini adalah landmark alam yang tersendiri.
  // • Onboarding EQ mascot mengingatkan: "Allah kurniakan air sebagai
  //   nikmat awal. Tamadun bermula di mana ada air — mari bangunkan
  //   rumah Allah dahulu."
  tasik: {
    id: 'tasik',
    icon: '🏞️',
    name: {
      ms: 'Tasik',
      en: 'Lake',
      id: 'Danau',
      ar: 'بحيرة',
    },
    desc: {
      ms: 'Anugerah air semulajadi dari Allah — permulaan tamadun',
      en: 'Natural water gift from Allah — where civilization begins',
      id: 'Anugerah air alami dari Allah — awal peradaban',
      ar: 'نعمة المياه الطبيعية من الله — بداية الحضارة',
    },
    tileSize: { w: 4, h: 4 },
    category: 'sumber_air',
    cost: 0,
    tier: 'landmark',
    color: '#5db6d8',
    accentColor: '#2a5a7a',
    hidden: true,   // not in build sidebar
    locked: true,   // cannot be moved / demolished / duplicated
    spriteAsset: '/assets/world/sumber_air/tasik.webp',
    spriteType: 'water_lake',
  },
  rumah: {
    id: 'rumah',
    icon: '🏠',
    name: {
      ms: 'Rumah Keluarga',
      en: 'Family Home',
      id: 'Rumah Keluarga',
      ar: 'بيت العائلة',
    },
    desc: {
      ms: 'Tempat tinggal keluarga Muslim',
      en: 'Muslim family dwelling',
      id: 'Tempat tinggal keluarga Muslim',
      ar: 'مسكن العائلة المسلمة',
    },
    tileSize: { w: 1, h: 1 },
    color: '#a86a4a',              // warm brown
    accentColor: '#5d3a1f',        // roof
    cost: 50,
    villagerSpawn: 3,              // father, mother, child
    lockedByDefault: false,        // unlocked after musalla built (client-side gate)
    isSacred: false,
    maxLevel: 1,                   // user removed non-musalla upgrades (2026-07-25)
  },
  kebun: {
    id: 'kebun',
    icon: '🌴',
    name: {
      ms: 'Kebun Kurma',
      en: 'Date Orchard',
      id: 'Kebun Kurma',
      ar: 'بستان النخيل',
    },
    desc: {
      ms: 'Kebun kurma seperti sahabat Nabi',
      en: 'Date orchard like the Companions grew',
      id: 'Kebun kurma seperti sahabat Nabi',
      ar: 'بستان نخيل كأصحاب النبي',
    },
    tileSize: { w: 2, h: 2 },      // 2×2 tile footprint (twice old 1×1)
    color: '#4a7c3a',              // rich green
    accentColor: '#8b4513',        // trunk brown
    cost: 25,
    villagerSpawn: 1,              // 1 farmer
    lockedByDefault: false,
    isSacred: false,
    maxLevel: 1,                   // user removed non-musalla upgrades (2026-07-25)
  },

  // ═══ AUTO-PLACED LANDMARKS ═══════════════════════════════════════
  // These are NOT drag-placed by the child. The backend auto-inserts them
  // when the village hits a milestone — a small Surau at 5 buildings, a
  // Masjid at 10 — teaching that a growing ummah earns its landmarks. Both
  // are `isSacred` so they can't be moved, and `isAutoLandmark: true` so
  // the UI never surfaces them in the build tabs and the tier-unlock
  // counter doesn't count them.
  surau: {
    id: 'surau',
    icon: '🕋',
    name: { ms: 'Surau', en: 'Prayer Hall', id: 'Surau', ar: 'مصلى صغير' },
    desc: {
      ms: 'Surau kampung — hadiah kerana kampung membesar',
      en: 'Village prayer hall — a gift for growing ummah',
      id: 'Surau kampung — hadiah karena kampung tumbuh',
      ar: 'مصلى القرية — هدية لنمو الأمة',
    },
    tileSize: { w: 2, h: 2 },
    color: '#0a6b5f',
    accentColor: '#f4c95d',        // small golden dome
    cost: 0,                       // free — auto-placed
    villagerSpawn: 0,
    lockedByDefault: true,         // never in tabs
    isSacred: true,                // can't move / can't stack over
    isAutoLandmark: true,          // flag for backend + UI to skip in counts
    milestoneCount: 5,             // appears when 5 user buildings exist
    maxLevel: 1,
  },
  // (Removed 2026-07-25) — `masjid_landmark` auto-landmark was retired
  // because its "Masjid Kampung" name and mosque appearance clashed with
  // the Musalla upgrade path (Musalla L2 also called "Masjid" and L3
  // "Jami' Masjid"). Children were confused thinking their upgrade had
  // landed at the wrong location when the auto-landmark appeared at 10
  // buildings. Only the Surau (small prayer hall, at 5 buildings) is
  // retained as a milestone landmark — visually distinct + humble.
}

// ═══ BUILDING CATEGORIES ═══════════════════════════════════════════════
// Grouped catalogue of buildings surfaced in the bottom sidebar as TABS.
// Each variant is a full building template — extends the base schema above
// with a `category`, `tier` (economy), and `spriteType` for the placeholder
// renderer. `spriteAsset` reserved for future 3D/PNG override — swap URL
// only, no logic change.
// Order tuned 2026-08-03 v2 (user): Taman letak SELEPAS Rumah (bukan sebelum).
// Awam + Pasar digabungkan menjadi satu tab (kedai/pasar dianggap kemudahan awam).
// Final visible order (selepas Musalla dibina & tab Ibadah difilter):
//   Rumah → Taman → Kebun → Ternakan → Sumber Air → Awam (termasuk pasar)
export const BUILDING_CATEGORIES = [
  { id: 'ibadah',     icon: '🕌', name: { ms: 'Ibadah',     en: 'Worship',    id: 'Ibadah',      ar: 'عبادة' } },
  { id: 'rumah',      icon: '🏠', name: { ms: 'Rumah',      en: 'Homes',      id: 'Rumah',       ar: 'منازل' } },
  { id: 'taman',      icon: '🎠', name: { ms: 'Taman',      en: 'Playground', id: 'Taman',       ar: 'ملعب' } },
  { id: 'kebun',      icon: '🌴', name: { ms: 'Kebun',      en: 'Orchards',   id: 'Kebun',       ar: 'بساتين' } },
  { id: 'ternakan',   icon: '🐄', name: { ms: 'Ternakan',   en: 'Livestock',  id: 'Ternakan',    ar: 'ماشية' } },
  { id: 'sumber_air', icon: '💧', name: { ms: 'Sumber Air', en: 'Water',      id: 'Sumber Air',  ar: 'المياه' } },
  { id: 'awam',       icon: '🏛️', name: { ms: 'Awam',       en: 'Public',     id: 'Umum',        ar: 'عام' } },
]

// Multilingual name/description lookup for every variant.
// Every variant MUST have ms/en/id/ar so the sidebar text switches cleanly
// when the child taps the global language toggle. Keeping the map here (near
// the variant list) makes it easy to keep both in sync.
const VARIANT_LABELS = {
  // 🏠 Rumah — 3 varian sahaja (rumah_kampung DIBUANG per user request 2026-07-25).
  //   Saiz visual mengikut mata: rumah_kayu (30 mata) paling kecil, rumah_batu
  //   (60 mata) sederhana, banglo (100 mata) paling besar.
  rumah_kayu:      { name: { ms: 'Rumah Kayu',     en: 'Wooden House',    id: 'Rumah Kayu',      ar: 'بيت خشبي' },       desc: { ms: 'Rumah kayu tradisional',        en: 'Traditional wooden house',      id: 'Rumah kayu tradisional',       ar: 'بيت خشبي تقليدي' } },
  rumah_batu:      { name: { ms: 'Rumah Batu',     en: 'Stone House',     id: 'Rumah Batu',      ar: 'بيت حجري' },       desc: { ms: 'Rumah batu yang kukuh',         en: 'Sturdy stone dwelling',         id: 'Rumah batu yang kokoh',        ar: 'بيت حجري متين' } },
  banglo:          { name: { ms: 'Banglo',         en: 'Bungalow',        id: 'Banglo',          ar: 'فيلا' },            desc: { ms: 'Rumah keluarga besar',          en: 'Spacious family bungalow',      id: 'Rumah keluarga besar',         ar: 'فيلا واسعة للأسرة' } },

  // 🌴 Kebun
  kebun_kurma:     { name: { ms: 'Kebun Kurma',    en: 'Date Orchard',        id: 'Kebun Kurma',    ar: 'بستان نخيل' },      desc: { ms: 'Pohon kurma seperti sahabat',      en: 'Date palms like the Sahabah',       id: 'Pohon kurma seperti sahabat',       ar: 'نخيل كأصحاب النبي' } },
  kebun_anggur:    { name: { ms: 'Kebun Anggur',   en: 'Grape Vineyard',      id: 'Kebun Anggur',   ar: 'كرم عنب' },         desc: { ms: 'Ladang anggur manis',              en: 'Sweet grape vineyard',              id: 'Kebun anggur manis',                ar: 'كرم عنب حلو' } },
  kebun_zaitun:    { name: { ms: 'Kebun Zaitun',   en: 'Olive Grove',         id: 'Kebun Zaitun',   ar: 'بستان زيتون' },     desc: { ms: 'Pohon zaitun yang diberkati',      en: 'Blessed olive trees',               id: 'Pohon zaitun yang diberkahi',       ar: 'شجر زيتون مبارك' } },
  kebun_delima:    { name: { ms: 'Kebun Delima',   en: 'Pomegranate Orchard', id: 'Kebun Delima',   ar: 'بستان رمّان' },     desc: { ms: 'Buah delima disebut di al-Quran',  en: 'Pomegranates mentioned in the Qur\u2019an', id: 'Buah delima disebut dalam al-Quran', ar: 'الرمّان مذكور في القرآن' } },
  kebun_tin:       { name: { ms: 'Kebun Tin',      en: 'Fig Orchard',         id: 'Kebun Tin',      ar: 'بستان تين' },       desc: { ms: 'Buah tin diberkati Allah',         en: 'Figs, blessed by Allah',            id: 'Buah tin yang diberkahi Allah',     ar: 'التين المبارك' } },

  // 🐄 Ternakan
  reban_ayam:      { name: { ms: 'Reban Ayam',     en: 'Chicken Coop',    id: 'Kandang Ayam',    ar: 'قن دجاج' },         desc: { ms: 'Ayam berkeliaran & bertelur',   en: 'Chickens roaming & laying',     id: 'Ayam berkeliaran & bertelur',  ar: 'دجاج يتجول ويبيض' } },
  kandang_kambing: { name: { ms: 'Kandang Kambing',en: 'Goat Pen',        id: 'Kandang Kambing', ar: 'حظيرة الماعز' },    desc: { ms: 'Kambing untuk susu & korban',   en: 'Goats for milk & qurban',       id: 'Kambing untuk susu & kurban',  ar: 'ماعز للحليب والأضحية' } },
  kandang_lembu:   { name: { ms: 'Kandang Lembu',  en: 'Cattle Ranch',    id: 'Kandang Sapi',    ar: 'مزرعة أبقار' },     desc: { ms: 'Lembu untuk susu & daging',     en: 'Cattle for milk & meat',        id: 'Sapi untuk susu & daging',     ar: 'أبقار للحليب واللحم' } },
  kandang_unta:    { name: { ms: 'Kandang Unta',   en: 'Camel Barn',      id: 'Kandang Unta',    ar: 'إسطبل الإبل' },     desc: { ms: 'Unta gurun yang gagah',         en: 'Majestic desert camel',         id: 'Unta gurun yang gagah',        ar: 'جمل صحراوي مهيب' } },

  // 🎠 Taman (3 aktif 2026-08-03) — user: "kanak2 suka taman, letakan ianya
  // di depan dan ada beberapa taman sahaja". Ganti 8 permainan tunggal dengan
  // 3 taman gabungan: Taman Permainan Awam (2×2), Padang Bola (3×3), Waterpark
  // (4×4 — mata paling tinggi antara semua taman).
  taman_awam:      { name: { ms: 'Taman Permainan Awam', en: 'Public Playground', id: 'Taman Bermain Umum', ar: 'ملعب عام' },   desc: { ms: 'Ayunan, gelongsor & jongkang untuk semua', en: 'Swings, slides & seesaws for all',  id: 'Ayunan, perosotan & jungkat-jungkit', ar: 'أراجيح ومزالق للجميع' } },
  padang_bola:     { name: { ms: 'Padang Bola',          en: 'Football Field',    id: 'Lapangan Bola',      ar: 'ملعب كرة' },   desc: { ms: 'Padang hijau untuk main bola',              en: 'Green pitch for football',          id: 'Lapangan hijau untuk bola',           ar: 'ملعب أخضر لكرة القدم' } },
  waterpark:       { name: { ms: 'Waterpark',            en: 'Waterpark',         id: 'Waterpark',          ar: 'حديقة مائية' }, desc: { ms: 'Kolam gelongsor & air pancut yang seronok', en: 'Water slides & fountains galore',   id: 'Perosotan air & air mancur seru',     ar: 'مزالق مائية ونوافير ممتعة' } },

  // 💧 Sumber Air
  perigi:          { name: { ms: 'Perigi',            en: 'Well',          id: 'Sumur',              ar: 'بئر' },              desc: { ms: 'Sumber air minum kampung',      en: 'Village drinking water source', id: 'Sumber air minum desa',        ar: 'مصدر ماء الشرب' } },
  kolam:           { name: { ms: 'Kolam',             en: 'Pond',          id: 'Kolam',              ar: 'بركة' },             desc: { ms: 'Kolam air segar dengan ikan',   en: 'Freshwater pond with lilies',   id: 'Kolam air segar',              ar: 'بركة ماء عذبة' } },

  // 🏪 Pasar — user 2026-08-03: hanya 2 pasar sahaja
  pasar_payung:    { name: { ms: 'Pasar Payung',       en: 'Umbrella Bazaar', id: 'Pasar Payung',      ar: 'سوق المظلات' },       desc: { ms: 'Gerai payung & khemah warna-warni',  en: 'Colourful umbrella & tent stalls', id: 'Gerai payung & tenda warna', ar: 'أكشاك بمظلات وخيام ملونة' } },
  pasar_bangunan:  { name: { ms: 'Pasar Bangunan',     en: 'Bazaar Hall',   id: 'Pasar Bangunan',     ar: 'قاعة السوق' },        desc: { ms: 'Bangunan pasar batu dengan kubah emas', en: 'Stone market hall with golden domes', id: 'Bangunan pasar batu berkubah', ar: 'قاعة سوق حجرية بقباب ذهبية' } },

  // 📚 Awam
  madrasah:        { name: { ms: 'Sekolah',            en: 'School',        id: 'Sekolah',            ar: 'مدرسة' },             desc: { ms: 'Menuntut ilmu dunia & akhirat',   en: 'Learning for this world & the next', id: 'Menuntut ilmu dunia & akhirat', ar: 'طلب علم الدنيا والآخرة' } },
  hospital:        { name: { ms: 'Hospital',           en: 'Hospital',      id: 'Rumah Sakit',        ar: 'مستشفى' },            desc: { ms: 'Merawat & menyembuhkan orang sakit',en: 'Care and healing for the sick', id: 'Merawat & menyembuhkan yang sakit', ar: 'رعاية وشفاء للمرضى' } },
  perpustakaan:    { name: { ms: 'Perpustakaan',      en: 'Library',       id: 'Perpustakaan',       ar: 'مكتبة' },             desc: { ms: 'Tempat membaca dan belajar',    en: 'Place to read & learn',         id: 'Tempat membaca & belajar',     ar: 'مكان للقراءة والتعلم' } },
  balai_rakyat:    { name: { ms: 'Balai Rakyat',      en: 'Community Hall',id: 'Balai Warga',        ar: 'قاعة المجتمع' },      desc: { ms: 'Berkumpul dengan jiran',        en: 'Gather with neighbours',        id: 'Berkumpul dengan tetangga',    ar: 'الاجتماع مع الجيران' } },
}

// Helper factory to keep variants concise & consistent.
// Names & desc are read from VARIANT_LABELS so every variant is fully i18n-ready.
// Optional `spriteAsset` — WebP path used by BOTH the Phaser world renderer
// AND the sidebar card preview (shows actual isometric art instead of emoji).
// Optional `tileSize` — footprint width/height in grid cells (default 1×1).
// Bigger buildings occupy a larger footprint so drag-placement never allows
// them to overlap adjacent houses (banglo 2×2, rumah_batu 2×2, rumah_kayu 1×1).
// `maxLevel: 1` for all variants — user removed upgrade system for non-musalla
// buildings on 2026-07-25 ("kita sudah introduce binaan ikut bilangan mata,
// jadi tak perlu lagi ada naik taraf binaan"). Only Musalla still upgrades.
const v = (id, category, iconEmoji, spriteType, color, accent, cost, tier = 'starter', extras = {}) => {
  const labels = VARIANT_LABELS[id] || { name: { ms: id, en: id, id, ar: id }, desc: { ms: id, en: id, id, ar: id } }
  return {
    id, category, tier, icon: iconEmoji, spriteType, spriteAsset: extras.spriteAsset || null,
    cardAsset: extras.cardAsset || null,   // 2026-08-03: sidebar preview override (e.g. livestock shows animal, not pen)
    name: labels.name,
    desc: labels.desc,
    tileSize: extras.tileSize || { w: 1, h: 1 }, color, accentColor: accent, cost,
    villagerSpawn: category === 'rumah' ? 2 : 0, lockedByDefault: false, isSacred: false, maxLevel: 1,
  }
}

export const BUILDING_VARIANTS = {
  // 🏠 Rumah (3 aktif) — semua ada aset WebP; saiz visual + FOOTPRINT ikut mata.
  //   rumah_kayu (30 mata, 1×1, baseScale 0.28 → paling kecil)
  //   rumah_batu (60 mata, 2×2, baseScale 0.36 → sederhana)
  //   banglo     (100 mata, 2×2, baseScale 0.48 → paling besar)
  //   rumah_kampung dibuang dari sidebar (hidden:true) — legacy backward-compat.
  rumah_kayu:    v('rumah_kayu',    'rumah', '🏡', 'house_wood',    '#c88a5a', '#5d3a1f',  30, 'starter',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/rumah/rumah_kayu.webp' }),
  rumah_batu:    v('rumah_batu',    'rumah', '🏠', 'house_stone',   '#b0a99f', '#4a463d',  60, 'standard', { spriteAsset: '/assets/world/rumah/rumah_batu.webp', tileSize: { w: 2, h: 2 } }),
  banglo:        v('banglo',        'rumah', '🏘️', 'house_banglo',  '#e8d8b8', '#8b6f47', 100, 'premium',  { spriteAsset: '/assets/world/rumah/banglo.webp',     tileSize: { w: 2, h: 2 } }),
  rumah_kampung: { ...v('rumah_kampung','rumah', '🛖', 'house_kampung', '#a86a4a', '#7a4a2a',  80, 'standard'), hidden: true }, // legacy backward-compat only

  // 🌴 Kebun (4)
  // 🌴 Kebun (4 aktif) — semua 2×2 tile footprint (twice previous size)
  // supaya drag placement reserve enough grid cells & tidak overlap
  // adjacent buildings. Mata dibezakan sedikit (25-70) supaya kanak-kanak
  // ada rasa progression tapi tidak terlalu jauh.
  //   kebun_kurma  (35 mata) — pohon kurma seperti sahabat — PREMIUM (paling tinggi)
  //   kebun_zaitun (32 mata) — pohon zaitun yang diberkati
  //   kebun_anggur (30 mata) — anggur manis
  //   kebun_delima (28 mata) — buah delima, disebut al-Quran
  //   kebun_tin    (25 mata) — buah tin (tin), diberkati Allah — starter
  //   Julat harmoni 25-35 (user 2026-07-30): "kebun point between 25 to 35
  //   point sahaja dan kebun kurma lebih premium berbanding kebun lain".
  //   kebun_sayur DIBUANG dari sidebar (hidden:true) — legacy backward-compat only.
  kebun_kurma:   v('kebun_kurma',   'kebun', '🌴', 'orchard_date',        '#4a7c3a', '#8b4513', 35, 'premium',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/palm_tree.webp' }),
  kebun_tin:     v('kebun_tin',     'kebun', '🍈', 'orchard_fig',         '#7a8f4a', '#4a5824', 25, 'starter',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/fig_tree.webp' }),
  kebun_delima:  v('kebun_delima',  'kebun', '🍎', 'orchard_pomegranate', '#a03040', '#5a1a24', 28, 'standard', { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/pomegranate_tree.webp' }),
  kebun_anggur:  v('kebun_anggur',  'kebun', '🍇', 'orchard_grape',       '#6b4a8b', '#3d2a4d', 30, 'standard', { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/grape_row.webp' }),
  kebun_zaitun:  v('kebun_zaitun',  'kebun', '🫒', 'orchard_olive',       '#6a7f3a', '#454f24', 32, 'standard', { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/olive_tree.webp' }),
  kebun_sayur:   { ...v('kebun_sayur', 'kebun', '🥬', 'orchard_veg',      '#5da84a', '#3a6a2a', 25, 'starter',  { tileSize: { w: 2, h: 2 } }), hidden: true }, // legacy backward-compat only

  // 🐄 Ternakan (4)
  // ── Ternakan — ordered from cheapest starter to most premium (user
  // request: "swap kedudukan dalam kad ternakan ayam, kambing, lembu dan
  // unta"). Also swapped point cost between lembu and unta so the camel
  // (unta) is now more premium than the cattle ranch (user: "buat unta
  // lebih premium dari lembu").
  //   • reban_ayam       — 25 pts (starter, 2×2)
  //   • kandang_kambing  — 40 pts (starter, 2×2)
  //   • kandang_lembu    — 90 pts (standard, 3×3)  ← was 100
  //   • kandang_unta     — 100 pts (standard, 4×4) ← was 90 (most premium)
  reban_ayam:      v('reban_ayam',      'ternakan', '🐔', 'pen_chicken', '#e8b878', '#a86a3a',  25, 'starter',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/ternakan/reban_ayam.webp',    cardAsset: '/assets/world/ternakan/chickens/chicken_01.webp' }),
  kandang_kambing: v('kandang_kambing', 'ternakan', '🐐', 'pen_goat',    '#d4c39a', '#8b7355',  40, 'starter',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/ternakan/kandang_kambing.webp', cardAsset: '/assets/world/ternakan/kambing.webp' }),
  kandang_lembu:   v('kandang_lembu',   'ternakan', '🐄', 'pen_cattle',  '#a88968', '#5d3a2a',  90, 'standard', { tileSize: { w: 3, h: 3 }, spriteAsset: '/assets/world/ternakan/kandang_lembu.webp',   cardAsset: '/assets/world/ternakan/lembu.webp' }),
  kandang_unta:    v('kandang_unta',    'ternakan', '🐫', 'pen_camel',   '#c9a26e', '#7a5a3a', 100, 'standard', { tileSize: { w: 4, h: 4 }, spriteAsset: '/assets/world/ternakan/kandang_unta.webp',    cardAsset: '/assets/world/ternakan/unta.webp' }),

  // 🎠 Taman (3 aktif) — user 2026-08-03: "kanak2 suka taman, letakan ianya
  // di depan dan ada beberapa taman sahaja". 8 permainan tunggal lama dibuang
  // dan diganti dengan 3 taman gabungan:
  //   • taman_awam   (30 mata, 2×2, starter)  — playground awam ada semua
  //     kemudahan (ayunan, gelongsor, jongkang, dsb)
  //   • padang_bola  (70 mata, 3×3, standard) — padang bola hijau
  //   • waterpark    (200 mata, 4×4, PREMIUM) — mata paling tinggi antara taman
  // Legacy 8 variants disembunyikan (hidden:true) untuk backward-compat world.
  taman_awam:      v('taman_awam',      'taman', '🎠', 'play_public',     '#ff6b9d', '#c73866',  30, 'starter',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/taman/taman_awam.webp' }),
  padang_bola:     v('padang_bola',     'taman', '⚽', 'play_soccer',     '#38b000', '#245e00',  70, 'standard', { tileSize: { w: 4, h: 5 }, spriteAsset: '/assets/world/taman/padang_bola.webp' }),
  waterpark:       v('waterpark',       'taman', '🏊', 'play_waterpark',  '#00bbf9', '#0089cc', 200, 'premium',  { tileSize: { w: 4, h: 4 }, spriteAsset: '/assets/world/taman/waterpark.webp' }),

  // Legacy taman variants (hidden 2026-08-03) — backward-compat only for old worlds
  taman_ayunan:    { ...v('taman_ayunan',    'taman', '🎠', 'play_swing',      '#ff6b9d', '#c73866',  20, 'starter'),  hidden: true },
  taman_gelongsor: { ...v('taman_gelongsor', 'taman', '🛝', 'play_slide',      '#f4a261', '#c76d1f',  25, 'starter'),  hidden: true },
  taman_panjat:    { ...v('taman_panjat',    'taman', '🧗', 'play_climb',      '#9b5de5', '#6d3fb0',  60, 'standard'), hidden: true },
  taman_trampolin: { ...v('taman_trampolin', 'taman', '🎪', 'play_trampoline', '#00bbf9', '#0089cc',  55, 'standard'), hidden: true },
  taman_jongkang:  { ...v('taman_jongkang',  'taman', '⚖️', 'play_seesaw',     '#ffbe0b', '#c48c00',  20, 'starter'),  hidden: true },
  taman_bola:      { ...v('taman_bola',      'taman', '⚽', 'play_soccer',     '#38b000', '#245e00',  65, 'standard'), hidden: true },
  taman_pokok:     { ...v('taman_pokok',     'taman', '🏰', 'play_treehouse',  '#8b5a2b', '#4a2e13', 140, 'premium'),  hidden: true },
  taman_bunga:     { ...v('taman_bunga',     'taman', '🌸', 'play_flowers',    '#ff85a1', '#c94d6f',  15, 'starter'),  hidden: true },

  // 💧 Sumber Air (2) — user 2026-07-30: "kita ada perigi dan kolam sahaja,
  // buang kolam ikan". Perigi 1×1 (10 mata), Kolam 2×2 (25 mata).
  // Legacy kolam_wudhu / kolam_ikan kept as `hidden:true` for backward-compat
  // (any existing world state referencing them still renders via _drawWaterProc).
  perigi:          v('perigi',          'sumber_air', '⛲', 'water_well',     '#8ec5fc', '#4a6b8a',  10, 'starter',  { tileSize: { w: 1, h: 1 }, spriteAsset: '/assets/world/sumber_air/perigi.webp' }),
  kolam:           v('kolam',           'sumber_air', '💧', 'water_pond',     '#7ec8e3', '#3a7a95',  25, 'standard', { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/sumber_air/kolam.webp' }),
  kolam_wudhu:     { ...v('kolam_wudhu', 'sumber_air', '💧', 'water_wudhu',   '#7ec8e3', '#3a7a95',  25, 'standard'), hidden: true }, // legacy backward-compat
  kolam_ikan:      { ...v('kolam_ikan',  'sumber_air', '🐟', 'water_fish',    '#6bb6d6', '#2a5a7a',  25, 'standard'), hidden: true }, // legacy backward-compat

  // 🏪 Pasar (2) — user 2026-08-03 v2: gabung ke dalam tab Awam.
  // Category ditukar dari 'pasar' → 'awam' supaya kad papar dalam tab Awam
  // yang sama sebagai kemudahan komuniti. templateId tak berubah supaya
  // dunia sedia ada terus render tanpa migration.
  pasar_payung:    v('pasar_payung',    'awam',      '☂️', 'market_umbrella', '#e8734a', '#a84a1f',  50, 'starter',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/pasar/pasar_payung.webp' }),
  pasar_bangunan:  v('pasar_bangunan',  'awam',      '🏛️', 'market_hall',    '#d4a373', '#7a5a3a', 120, 'premium',  { tileSize: { w: 3, h: 3 }, spriteAsset: '/assets/world/pasar/pasar_bangunan.webp' }),
  souk:            { ...v('souk',         'awam',    '🎪', 'market_souk',    '#e8734a', '#a84a1f',  60, 'starter'),  hidden: true },
  kedai_runcit:    { ...v('kedai_runcit', 'awam',    '🏪', 'market_grocery', '#f4c95d', '#a8842a',  80, 'standard'), hidden: true },
  kedai_roti:      { ...v('kedai_roti',   'awam',    '🥖', 'market_bakery',  '#d4a373', '#7a5a3a',  70, 'standard'), hidden: true },

  // 📚 Awam (2 aktif — 2026-08-07)
  // User: replace madrasah with `school` asset, add `hospital`, remove
  // `perpustakaan` & `balai_rakyat`. Kekalkan templateId madrasah dengan
  // sprite baharu supaya dunia sedia ada tak perlu migration; asset baharu
  // sudah `smart-trimmed` untuk anchor tepat pada pad isometrik.
  madrasah:        v('madrasah',        'awam',      '🏫', 'public_school',  '#e8b04a', '#a67a2a', 120, 'standard', { tileSize: { w: 3, h: 3 }, spriteAsset: '/assets/world/awam/school.webp' }),
  hospital:        v('hospital',        'awam',      '🏥', 'public_hospital','#e6544a', '#9c2f24', 200, 'premium',  { tileSize: { w: 3, h: 3 }, spriteAsset: '/assets/world/awam/hospital.webp' }),
  // Legacy — hidden untuk backward-compat dunia sedia ada
  perpustakaan:    { ...v('perpustakaan',    'awam',      '📚', 'public_library', '#a89078', '#5d4433', 130, 'standard'), hidden: true },
  balai_rakyat:    { ...v('balai_rakyat',    'awam',      '🏛️', 'public_hall',    '#b8a890', '#6a5a48', 150, 'premium'),  hidden: true },
}

// Merge base templates with variants — the WorldScene renders anything in
// BUILDING_TEMPLATES; both are looked up by templateId. Existing worlds with
// 'rumah'/'kebun' still work (base templates unchanged), and new sidebar
// picks any variant which gets stored as its own templateId.
Object.assign(BUILDING_TEMPLATES, BUILDING_VARIANTS)

// Convenience: array form for menu iteration (all templates INCLUDING variants)
export const BUILDING_LIST = Object.values(BUILDING_TEMPLATES)

// Variants grouped by category — used by the sidebar tabs UI.
// Filter out `hidden: true` variants (e.g. legacy rumah_kampung kept for
// backward-compat but not surfaced to new placements).  Results are
// sorted by point cost (lowest → highest) so children see the cheapest
// starter options first and premium picks at the bottom of the sidebar.
// User request (2026-07-30): "arrange dalam card kebun ikut point paling
// rendah ke paling tinggi" — applied to all categories for consistency.
export const getVariantsForCategory = (categoryId) => {
  if (categoryId === 'ibadah') return [BUILDING_TEMPLATES.musalla]
  return Object.values(BUILDING_VARIANTS)
    .filter(v => v.category === categoryId && !v.hidden)
    .sort((a, b) => (a.cost || 0) - (b.cost || 0))
}

// Get building's display name for its current level
export const getBuildingName = (templateId, level, lang = 'ms') => {
  const t = BUILDING_TEMPLATES[templateId]
  if (!t) return templateId
  if (t.levelNames?.[level]) return t.levelNames[level][lang] || t.levelNames[level].ms
  return t.name[lang] || t.name.ms
}

// Islamic phrases for build ritual — used by both onboarding and every build.
export const ISLAMIC_PHRASES = {
  bismillah: {
    ar: 'بِسْمِ اللَّهِ',
    translit: 'Bismillah',
    meaning: {
      ms: 'Dengan nama Allah',
      en: 'In the name of Allah',
      id: 'Dengan nama Allah',
      ar: 'باسم الله',
    },
  },
  alhamdulillah: {
    ar: 'اَلْحَمْدُ لِلَّهِ',
    translit: 'Alhamdulillah',
    meaning: {
      ms: 'Segala puji bagi Allah',
      en: 'All praise be to Allah',
      id: 'Segala puji bagi Allah',
      ar: 'الحمد لله',
    },
  },
  mashallah: {
    ar: 'مَا شَاءَ اللَّهُ',
    translit: 'Masha\u2019Allah',
    meaning: {
      ms: 'Sesuatu yang Allah kehendaki',
      en: 'What Allah has willed',
      id: 'Apa yang dikehendaki Allah',
      ar: 'ما شاء الله',
    },
  },
}
