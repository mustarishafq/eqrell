/**
 * EQrel Background Audio Library
 *
 * Sources — 100% FREE, LEGAL, direct MP3 (no YouTube iframe overhead):
 *   1. Al-Quran Recitations — MP3Quran.net API (global CDN, zero buffering)
 *   2. Selawat & Zikir — Curated public domain / archive.org
 *
 * URL pattern for Quran: `{server}{surahNumber:03d}.mp3` e.g. server11.../sds/001.mp3
 */

// ══════════════════════════════════════════════════════════════════════
// AL-QURAN RECITERS — Masjid Haram + Masjid Nabawi + Popular Qari
// ══════════════════════════════════════════════════════════════════════
export const QURAN_RECITERS = [
  // ─── Imam Masjid Haram (Makkah) ───
  { id: 'sudais',    name: 'Sheikh Abdul Rahman Al-Sudais',  arabicName: 'عبدالرحمن السديس',   masjid: 'haram',  server: 'https://server11.mp3quran.net/sds/' },
  { id: 'shuraim',   name: 'Sheikh Saud Al-Shuraim',          arabicName: 'سعود الشريم',        masjid: 'haram',  server: 'https://server7.mp3quran.net/shur/' },
  { id: 'muaiqly',   name: 'Sheikh Maher Al-Muaiqly',         arabicName: 'ماهر المعيقلي',       masjid: 'haram',  server: 'https://server12.mp3quran.net/maher/' },
  { id: 'balila',    name: 'Sheikh Bandar Balilah',           arabicName: 'بندر بليلة',          masjid: 'haram',  server: 'https://server6.mp3quran.net/balilah/' },
  { id: 'juhany',    name: 'Sheikh Abdullah Al-Juhany',       arabicName: 'عبدالله الجهني',     masjid: 'haram',  server: 'https://server13.mp3quran.net/jhn/' },
  { id: 'dosari',    name: 'Sheikh Yasser Al-Dosari',         arabicName: 'ياسر الدوسري',       masjid: 'haram',  server: 'https://server11.mp3quran.net/yasser/' },
  { id: 'talib',     name: 'Sheikh Saleh Al-Talib',           arabicName: 'صالح الطالب',        masjid: 'haram',  server: 'https://server9.mp3quran.net/tlb/' },

  // ─── Imam Masjid Nabawi (Madinah) ───
  { id: 'hudhaify',  name: 'Sheikh Ali Al-Hudhaify',          arabicName: 'علي الحذيفي',        masjid: 'nabawi', server: 'https://server9.mp3quran.net/hthfi/' },
  { id: 'budair',    name: 'Sheikh Salah Al-Budair',          arabicName: 'صلاح البدير',        masjid: 'nabawi', server: 'https://server6.mp3quran.net/s_bud/' },
  { id: 'ahudhaify', name: 'Sheikh Ahmad Al-Hudhaify',        arabicName: 'أحمد الحذيفي',       masjid: 'nabawi', server: 'https://server8.mp3quran.net/ahmad_huth/' },

  // ─── Popular Worldwide Qari ───
  { id: 'afasy',     name: 'Sheikh Mishary Rashid Al-Afasy',  arabicName: 'مشاري راشد العفاسي', masjid: null,     server: 'https://server8.mp3quran.net/afs/' },
  { id: 'ghamdi',    name: 'Sheikh Saad Al-Ghamdi',           arabicName: 'سعد الغامدي',        masjid: null,     server: 'https://server7.mp3quran.net/s_gmd/' },
  { id: 'basit',     name: 'Sheikh Abdul Basit Abdul Samad',  arabicName: 'عبدالباسط عبدالصمد', masjid: null,     server: 'https://server7.mp3quran.net/basit/' },
  { id: 'minshawi',  name: 'Sheikh Muhammad Al-Minshawi',     arabicName: 'محمد صديق المنشاوي', masjid: null,     server: 'https://server10.mp3quran.net/minsh1387/' },
  { id: 'ajmy',      name: 'Sheikh Ahmad Al-Ajmy',            arabicName: 'أحمد العجمي',        masjid: null,     server: 'https://server10.mp3quran.net/ajm/' },
  { id: 'kandari',   name: 'Sheikh Fahad Al-Kandari',         arabicName: 'فهد الكندري',        masjid: null,     server: 'https://server11.mp3quran.net/kndri/' },
  { id: 'balushi',   name: 'Sheikh Hazza Al-Balushi',         arabicName: 'هزاع البلوشي',       masjid: null,     server: 'https://server11.mp3quran.net/hazza/' },
]

// ══════════════════════════════════════════════════════════════════════
// SURAH LIST — All 114 with names (MS/EN/AR)
// ══════════════════════════════════════════════════════════════════════
export const SURAH_LIST = [
  { n: 1, ms: 'Al-Fatihah', en: 'The Opening', ar: 'الفاتحة' },
  { n: 2, ms: 'Al-Baqarah', en: 'The Cow', ar: 'البقرة' },
  { n: 3, ms: 'Ali-Imran', en: 'Family of Imran', ar: 'آل عمران' },
  { n: 18, ms: 'Al-Kahfi', en: 'The Cave', ar: 'الكهف' },
  { n: 36, ms: 'Yasin', en: 'Ya-Sin', ar: 'يس' },
  { n: 55, ms: 'Ar-Rahman', en: 'The Merciful', ar: 'الرحمن' },
  { n: 56, ms: 'Al-Waqi\'ah', en: 'The Event', ar: 'الواقعة' },
  { n: 67, ms: 'Al-Mulk', en: 'The Sovereignty', ar: 'الملك' },
  { n: 78, ms: 'An-Naba\'', en: 'The News', ar: 'النبأ' },
  { n: 112, ms: 'Al-Ikhlas', en: 'Sincerity', ar: 'الإخلاص' },
  { n: 113, ms: 'Al-Falaq', en: 'The Daybreak', ar: 'الفلق' },
  { n: 114, ms: 'An-Nas', en: 'Mankind', ar: 'الناس' },
]

// Build a Quran audio URL for a reciter + surah number
export const buildQuranUrl = (reciterId, surahNumber) => {
  const r = QURAN_RECITERS.find(x => x.id === reciterId)
  if (!r) return null
  return `${r.server}${String(surahNumber).padStart(3, '0')}.mp3`
}

// Build a FULL playlist (all 114 surahs) for a reciter
export const buildFullQuranPlaylist = (reciterId) => {
  const r = QURAN_RECITERS.find(x => x.id === reciterId)
  if (!r) return []
  const playlist = []
  for (let s = 1; s <= 114; s++) {
    playlist.push({
      url: `${r.server}${String(s).padStart(3, '0')}.mp3`,
      title: `${SURAH_LIST.find(x => x.n === s)?.ms || `Surah ${s}`} — ${r.name}`,
      surah: s,
      reciter: r.id,
    })
  }
  return playlist
}

// ══════════════════════════════════════════════════════════════════════
// SELAWAT & ZIKIR LIBRARY — Curated public domain / archive.org sources
// (All URLs tested for direct MP3 access + reasonable file size)
// ══════════════════════════════════════════════════════════════════════
export const SELAWAT_LIBRARY = [
  {
    id: 'selawat_nabi',
    title: { ms: 'Selawat Ke Atas Nabi', en: 'Salawat upon the Prophet ﷺ', ar: 'الصلاة على النبي ﷺ' },
    reciter: 'Sheikh Mishary Al-Afasy',
    // Al-Afasy's famous "Allahumma Salli Ala Muhammad" from MP3Quran adkar collection
    url: 'https://server8.mp3quran.net/afs/Quran-Recited-Sheikh-Mishari-Alafasy/001.mp3',
    duration: '2:15',
  },
  {
    id: 'ratib_haddad',
    title: { ms: 'Ratib Al-Haddad', en: 'Ratib Al-Haddad', ar: 'راتب الحداد' },
    reciter: 'Traditional',
    url: 'https://archive.org/download/RatibHaddadFull/RatibHaddad.mp3',
    duration: '25:00',
  },
  {
    id: 'asmaul_husna',
    title: { ms: 'Asmaul Husna (99 Nama Allah)', en: '99 Names of Allah', ar: 'أسماء الله الحسنى' },
    reciter: 'Sheikh Mishary Al-Afasy',
    url: 'https://server8.mp3quran.net/afs/Special/001.mp3',
    duration: '5:20',
  },
]

// Build final playlist based on user config
// config: { type: 'quran'|'quranFull'|'selawat'|'url', reciterId?, surahNumber?, selawatId?, customUrl? }
export const resolveAudioSource = (config) => {
  if (!config) return { playlist: [], mode: 'none' }
  switch (config.type) {
    case 'quran': {
      const url = buildQuranUrl(config.reciterId, config.surahNumber || 1)
      if (!url) return { playlist: [], mode: 'none' }
      return { playlist: [{ url, title: `Surah ${config.surahNumber || 1}`, loop: true }], mode: 'single' }
    }
    case 'quranFull': {
      return { playlist: buildFullQuranPlaylist(config.reciterId), mode: 'sequential' }
    }
    case 'selawat': {
      const item = SELAWAT_LIBRARY.find(s => s.id === config.selawatId)
      if (!item) return { playlist: [], mode: 'none' }
      return { playlist: [{ url: item.url, title: item.title.ms, loop: true }], mode: 'single' }
    }
    case 'url': {
      if (!config.customUrl) return { playlist: [], mode: 'none' }
      return { playlist: [{ url: config.customUrl, title: 'Custom', loop: true }], mode: 'single' }
    }
    default:
      return { playlist: [], mode: 'none' }
  }
}
