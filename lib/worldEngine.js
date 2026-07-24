/**
 * World Engine — Building Templates
 * Central registry of all placeable structures for the EQrel World.
 * Each template drives sprite rendering, costs, unlocks, and villager mechanics.
 */

// Fixed pre-gazetted position for the Musalla — center of a 16×16 grid.
export const MUSALLA_ANCHOR = { x: 7, y: 7 }
export const WORLD_SIZE = 16  // 16×16 isometric grid — room for a small village

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
    tileSize: { w: 2, h: 2 },      // occupies 2×2 grid cells
    color: '#0d5b4e',              // primary building color
    accentColor: '#FFB703',        // dome / accent
    cost: 0,                       // FREE — mandatory first build
    villagerSpawn: 2,              // spawns 2 villagers (imam + muadhin)
    lockedByDefault: false,        // unlocked at start
    isSacred: true,                // triggers Bismillah/Alhamdulillah + can't be moved
    maxLevel: 3,                   // Musalla → Masjid → Jami' Masjid
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
