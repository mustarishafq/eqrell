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
export function getCurrentBounds(worldState) {
  const buildings = worldState?.buildings || []
  const musalla = buildings.find(b => b.templateId === 'musalla')
  const musallaPos = musalla ? { x: musalla.x, y: musalla.y } : MUSALLA_ANCHOR
  const size = getWorldSize(buildings.length)
  return { ...getWorldBounds(musallaPos, size), size, musallaPos }
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
    // 4×4. We pre-gazette the full 4×4 zone from day one so the child can
    // upgrade smoothly without other buildings blocking the way.
    reserveSize: { w: 4, h: 4 },
    // Per-level footprint (used at render time as the building grows).
    tileSizeByLevel: {
      1: { w: 2, h: 2 },
      2: { w: 3, h: 3 },
      3: { w: 4, h: 4 },
    },
    color: '#0d5b4e',              // primary building color
    accentColor: '#FFB703',        // dome / accent
    cost: 0,                       // FREE — mandatory first build
    villagerSpawn: 2,              // spawns 2 villagers (imam + muadhin)
    lockedByDefault: false,        // unlocked at start
    isSacred: true,                // triggers Bismillah/Alhamdulillah + can't be moved
    maxLevel: 3,                   // Musalla → Masjid → Jami' Masjid
    // Progressive unlock: musalla can only upgrade when the child has built
    // enough houses (rumah). Teaches that community grows before the mosque
    // expands — jamaah first, structure later.
    upgradeRequires: {
      2: { rumah: 3 },   // to Masjid: need at least 3 houses
      3: { rumah: 8 },   // to Jami' Masjid: need at least 8 houses
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
    maxLevel: 3,
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
    tileSize: { w: 1, h: 1 },
    color: '#4a7c3a',              // rich green
    accentColor: '#8b4513',        // trunk brown
    cost: 30,
    villagerSpawn: 1,              // 1 farmer
    lockedByDefault: false,
    isSacred: false,
    maxLevel: 2,
  },
}

// Convenience: array form for menu iteration
export const BUILDING_LIST = Object.values(BUILDING_TEMPLATES)

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
