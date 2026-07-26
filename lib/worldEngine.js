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
  if (buildingCount >= 15) return 19   // grand island — 4th tier
  if (buildingCount >= 10) return 16   // 3rd tier
  if (buildingCount >= 5)  return 13   // 2nd tier
  return 10                             // starter island
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
export const BUILDING_CATEGORIES = [
  { id: 'ibadah',     icon: '🕌', name: { ms: 'Ibadah',     en: 'Worship',    id: 'Ibadah',      ar: 'عبادة' } },
  { id: 'rumah',      icon: '🏠', name: { ms: 'Rumah',      en: 'Homes',      id: 'Rumah',       ar: 'منازل' } },
  { id: 'kebun',      icon: '🌴', name: { ms: 'Kebun',      en: 'Orchards',   id: 'Kebun',       ar: 'بساتين' } },
  { id: 'ternakan',   icon: '🐄', name: { ms: 'Ternakan',   en: 'Livestock',  id: 'Ternakan',    ar: 'ماشية' } },
  { id: 'sumber_air', icon: '💧', name: { ms: 'Sumber Air', en: 'Water',      id: 'Sumber Air',  ar: 'المياه' } },
  { id: 'pasar',      icon: '🏪', name: { ms: 'Pasar',      en: 'Market',     id: 'Pasar',       ar: 'السوق' } },
  { id: 'awam',       icon: '📚', name: { ms: 'Awam',       en: 'Public',     id: 'Umum',        ar: 'عام' } },
  { id: 'taman',      icon: '🎠', name: { ms: 'Taman',      en: 'Playground', id: 'Taman',       ar: 'ملعب' } },
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

  // 🎠 Taman
  taman_ayunan:    { name: { ms: 'Ayunan',            en: 'Swing Set',    id: 'Ayunan',            ar: 'أرجوحة' },         desc: { ms: 'Ayun tinggi ke langit',         en: 'Swing high to the sky',         id: 'Ayunan tinggi ke langit',      ar: 'تأرجح عالياً في السماء' } },
  taman_gelongsor: { name: { ms: 'Gelongsor',         en: 'Slide',        id: 'Perosotan',         ar: 'زحليقة' },         desc: { ms: 'Meluncur dengan seronok',       en: 'Whooshing fun slide',           id: 'Perosotan yang seru',          ar: 'زحليقة ممتعة' } },
  taman_panjat:    { name: { ms: 'Dinding Panjat',    en: 'Climbing Wall',id: 'Dinding Panjat',    ar: 'جدار التسلق' },    desc: { ms: 'Panjat & jadi kuat',            en: 'Climb up & grow strong',        id: 'Panjat & jadi kuat',           ar: 'تسلق وقوّي جسمك' } },
  taman_trampolin: { name: { ms: 'Trampolin',         en: 'Trampoline',   id: 'Trampolin',         ar: 'ترامبولين' },      desc: { ms: 'Lompat-lompat tinggi',          en: 'Bounce high & higher',          id: 'Lompat-lompat tinggi',         ar: 'قفز عالٍ ومرح' } },
  taman_jongkang:  { name: { ms: 'Jongkang-jongket',  en: 'See-saw',      id: 'Jungkat-jungkit',   ar: 'أرجوحة التوازن' }, desc: { ms: 'Main dengan kawan',             en: 'Play with a friend',            id: 'Main dengan teman',            ar: 'العب مع صديق' } },
  taman_bola:      { name: { ms: 'Padang Bola',       en: 'Soccer Field', id: 'Lapangan Bola',     ar: 'ملعب كرة' },       desc: { ms: 'Padang bola untuk berlari',     en: 'Football pitch to run',         id: 'Lapangan bola untuk lari',     ar: 'ملعب للركض' } },
  taman_pokok:     { name: { ms: 'Rumah Pokok',       en: 'Tree House',   id: 'Rumah Pohon',       ar: 'بيت شجرة' },       desc: { ms: 'Menara khayalan di atas pokok', en: 'Fantasy tower on a tree',       id: 'Menara khayal di atas pohon',  ar: 'برج خيالي فوق الشجرة' } },
  taman_bunga:     { name: { ms: 'Kebun Bunga',       en: 'Flower Garden',id: 'Kebun Bunga',       ar: 'حديقة الزهور' },    desc: { ms: 'Taman bunga warna-warni',       en: 'Colourful flower patch',        id: 'Kebun bunga warna-warni',      ar: 'حديقة زهور ملونة' } },

  // 💧 Sumber Air
  perigi:          { name: { ms: 'Perigi',            en: 'Well',          id: 'Sumur',              ar: 'بئر' },              desc: { ms: 'Sumber air minum kampung',      en: 'Village drinking water source', id: 'Sumber air minum desa',        ar: 'مصدر ماء الشرب' } },
  kolam_wudhu:     { name: { ms: 'Kolam Wudhu',       en: 'Wudu Fountain', id: 'Kolam Wudhu',        ar: 'نافورة الوضوء' },     desc: { ms: 'Tempat bersuci sebelum solat', en: 'Purify before salat',           id: 'Tempat bersuci sebelum salat', ar: 'موضع الطهارة قبل الصلاة' } },
  kolam_ikan:      { name: { ms: 'Kolam Ikan',        en: 'Fish Pond',     id: 'Kolam Ikan',         ar: 'بركة أسماك' },        desc: { ms: 'Kolam ikan yang tenang',        en: 'Serene stocked fish pond',      id: 'Kolam ikan yang tenang',       ar: 'بركة أسماك هادئة' } },

  // 🏪 Pasar
  souk:            { name: { ms: 'Souk',              en: 'Souk',          id: 'Souk',               ar: 'سوق' },               desc: { ms: 'Gerai pasar tradisional',       en: 'Traditional market stall',      id: 'Kios pasar tradisional',       ar: 'سوق تقليدي' } },
  kedai_runcit:    { name: { ms: 'Kedai Runcit',      en: 'Grocery',       id: 'Toko Kelontong',     ar: 'بقالة' },             desc: { ms: 'Beli barangan harian di sini',  en: 'Daily essentials shop',         id: 'Toko kebutuhan harian',        ar: 'محل حاجيات يومية' } },
  kedai_roti:      { name: { ms: 'Kedai Roti',        en: 'Bakery',        id: 'Toko Roti',          ar: 'مخبز' },              desc: { ms: 'Roti hangat setiap pagi',       en: 'Warm bread every morning',      id: 'Roti hangat tiap pagi',        ar: 'خبز طازج كل صباح' } },

  // 📚 Awam
  madrasah:        { name: { ms: 'Madrasah',          en: 'Madrasah',      id: 'Madrasah',           ar: 'مدرسة' },             desc: { ms: 'Sekolah untuk pelajari Al-Quran',en: 'School to learn the Quran',   id: 'Sekolah belajar Al-Quran',     ar: 'مدرسة لتعلم القرآن' } },
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
  rumah_kayu:    v('rumah_kayu',    'rumah', '🏡', 'house_wood',    '#c88a5a', '#5d3a1f',  30, 'starter',  { spriteAsset: '/assets/world/rumah/rumah_kayu.webp' }),
  rumah_batu:    v('rumah_batu',    'rumah', '🏠', 'house_stone',   '#b0a99f', '#4a463d',  60, 'standard', { spriteAsset: '/assets/world/rumah/rumah_batu.webp', tileSize: { w: 2, h: 2 } }),
  banglo:        v('banglo',        'rumah', '🏘️', 'house_banglo',  '#e8d8b8', '#8b6f47', 100, 'premium',  { spriteAsset: '/assets/world/rumah/banglo.webp',     tileSize: { w: 2, h: 2 } }),
  rumah_kampung: { ...v('rumah_kampung','rumah', '🛖', 'house_kampung', '#a86a4a', '#7a4a2a',  80, 'standard'), hidden: true }, // legacy backward-compat only

  // 🌴 Kebun (4)
  // 🌴 Kebun (4 aktif) — semua 2×2 tile footprint (twice previous size)
  // supaya drag placement reserve enough grid cells & tidak overlap
  // adjacent buildings. Mata dibezakan sedikit (25-70) supaya kanak-kanak
  // ada rasa progression tapi tidak terlalu jauh.
  //   kebun_kurma  (25 mata) — pohon kurma seperti sahabat
  //   kebun_tin    (35 mata) — buah tin (tin), diberkati Allah
  //   kebun_delima (45 mata) — buah delima, disebut al-Quran (menggantikan kebun_sayur)
  //   kebun_anggur (55 mata) — anggur manis
  //   kebun_zaitun (70 mata) — pohon zaitun yang diberkati
  //   kebun_sayur DIBUANG dari sidebar (hidden:true) — legacy backward-compat only.
  kebun_kurma:   v('kebun_kurma',   'kebun', '🌴', 'orchard_date',        '#4a7c3a', '#8b4513', 25, 'starter',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/palm_tree.webp' }),
  kebun_tin:     v('kebun_tin',     'kebun', '🍈', 'orchard_fig',         '#7a8f4a', '#4a5824', 35, 'starter',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/fig_tree.webp' }),
  kebun_delima:  v('kebun_delima',  'kebun', '🍎', 'orchard_pomegranate', '#a03040', '#5a1a24', 45, 'standard', { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/pomegranate_tree.webp' }),
  kebun_anggur:  v('kebun_anggur',  'kebun', '🍇', 'orchard_grape',       '#6b4a8b', '#3d2a4d', 55, 'standard', { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/grape_row.webp' }),
  kebun_zaitun:  v('kebun_zaitun',  'kebun', '🫒', 'orchard_olive',       '#6a7f3a', '#454f24', 70, 'premium',  { tileSize: { w: 2, h: 2 }, spriteAsset: '/assets/world/kebun/olive_tree.webp' }),
  kebun_sayur:   { ...v('kebun_sayur', 'kebun', '🥬', 'orchard_veg',      '#5da84a', '#3a6a2a', 25, 'starter',  { tileSize: { w: 2, h: 2 } }), hidden: true }, // legacy backward-compat only

  // 🐄 Ternakan (4)
  kandang_kambing: v('kandang_kambing', 'ternakan', '🐐', 'pen_goat',    '#d4c39a', '#8b7355',  40, 'starter'),
  reban_ayam:      v('reban_ayam',      'ternakan', '🐔', 'pen_chicken', '#e8b878', '#a86a3a',  25, 'starter'),
  kandang_unta:    v('kandang_unta',    'ternakan', '🐫', 'pen_camel',   '#c9a26e', '#7a5a3a',  90, 'standard'),
  kandang_lembu:   v('kandang_lembu',   'ternakan', '🐄', 'pen_cattle',  '#a88968', '#5d3a2a', 100, 'standard'),

  // 🎠 Taman (8)
  taman_ayunan:    v('taman_ayunan',    'taman', '🎠', 'play_swing',      '#ff6b9d', '#c73866',  20, 'starter'),
  taman_gelongsor: v('taman_gelongsor', 'taman', '🛝', 'play_slide',      '#f4a261', '#c76d1f',  25, 'starter'),
  taman_panjat:    v('taman_panjat',    'taman', '🧗', 'play_climb',      '#9b5de5', '#6d3fb0',  60, 'standard'),
  taman_trampolin: v('taman_trampolin', 'taman', '🎪', 'play_trampoline', '#00bbf9', '#0089cc',  55, 'standard'),
  taman_jongkang:  v('taman_jongkang',  'taman', '⚖️', 'play_seesaw',     '#ffbe0b', '#c48c00',  20, 'starter'),
  taman_bola:      v('taman_bola',      'taman', '⚽', 'play_soccer',     '#38b000', '#245e00',  65, 'standard'),
  taman_pokok:     v('taman_pokok',     'taman', '🏰', 'play_treehouse',  '#8b5a2b', '#4a2e13', 140, 'premium'),
  taman_bunga:     v('taman_bunga',     'taman', '🌸', 'play_flowers',    '#ff85a1', '#c94d6f',  15, 'starter'),

  // 💧 Sumber Air (3)
  perigi:          v('perigi',          'sumber_air', '⛲', 'water_well',     '#8ec5fc', '#4a6b8a',  30, 'starter'),
  kolam_wudhu:     v('kolam_wudhu',     'sumber_air', '💧', 'water_wudhu',    '#7ec8e3', '#3a7a95',  50, 'standard'),
  kolam_ikan:      v('kolam_ikan',      'sumber_air', '🐟', 'water_fish',     '#6bb6d6', '#2a5a7a',  70, 'standard'),

  // 🏪 Pasar (3)
  souk:            v('souk',            'pasar',     '🎪', 'market_souk',    '#e8734a', '#a84a1f',  60, 'starter'),
  kedai_runcit:    v('kedai_runcit',    'pasar',     '🏪', 'market_grocery', '#f4c95d', '#a8842a',  80, 'standard'),
  kedai_roti:      v('kedai_roti',      'pasar',     '🥖', 'market_bakery',  '#d4a373', '#7a5a3a',  70, 'standard'),

  // 📚 Awam (3)
  madrasah:        v('madrasah',        'awam',      '📖', 'public_madrasah','#c9a26e', '#7a5a3a', 120, 'standard'),
  perpustakaan:    v('perpustakaan',    'awam',      '📚', 'public_library', '#a89078', '#5d4433', 130, 'standard'),
  balai_rakyat:    v('balai_rakyat',    'awam',      '🏛️', 'public_hall',    '#b8a890', '#6a5a48', 150, 'premium'),
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
// backward-compat but not surfaced to new placements).
export const getVariantsForCategory = (categoryId) => {
  if (categoryId === 'ibadah') return [BUILDING_TEMPLATES.musalla]
  return Object.values(BUILDING_VARIANTS).filter(v => v.category === categoryId && !v.hidden)
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
