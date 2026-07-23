/**
 * EQrel Background Audio Library — extended with more surahs and curated playlists
 *
 * Sources — 100% FREE, LEGAL, direct MP3:
 *   1. Al-Quran Recitations — MP3Quran.net API (global CDN, zero buffering)
 *   2. Curated Islamic Playlists — bundle of surahs for specific occasions
 *
 * URL pattern: `{server}{surahNumber:03d}.mp3`
 */

// ══════════════════════════════════════════════════════════════════════
// AL-QURAN RECITERS — Masjid Haram + Nabawi + Popular
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
  { id: 'ahudhaify', name: 'Sheikh Ahmad Al-Hudhaifi',        arabicName: 'أحمد الحذيفي',       masjid: 'nabawi', server: 'https://server8.mp3quran.net/ahmad_huth/' },

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
// SURAH LIST — Extended with more popular surahs (30+ commonly recited)
// ══════════════════════════════════════════════════════════════════════
export const SURAH_LIST = [
  { n: 1,   ms: 'Al-Fatihah',         en: 'The Opening',           ar: 'الفاتحة' },
  { n: 2,   ms: 'Al-Baqarah',         en: 'The Cow',               ar: 'البقرة' },
  { n: 3,   ms: 'Ali-Imran',          en: 'Family of Imran',       ar: 'آل عمران' },
  { n: 4,   ms: 'An-Nisa',            en: 'The Women',             ar: 'النساء' },
  { n: 5,   ms: 'Al-Ma\'idah',        en: 'The Table Spread',      ar: 'المائدة' },
  { n: 6,   ms: 'Al-An\'am',          en: 'The Cattle',            ar: 'الأنعام' },
  { n: 7,   ms: 'Al-A\'raf',          en: 'The Heights',           ar: 'الأعراف' },
  { n: 12,  ms: 'Yusuf',              en: 'Joseph',                ar: 'يوسف' },
  { n: 13,  ms: 'Ar-Ra\'d',           en: 'The Thunder',           ar: 'الرعد' },
  { n: 14,  ms: 'Ibrahim',            en: 'Abraham',               ar: 'إبراهيم' },
  { n: 18,  ms: 'Al-Kahfi',           en: 'The Cave',              ar: 'الكهف' },
  { n: 19,  ms: 'Maryam',             en: 'Mary',                  ar: 'مريم' },
  { n: 20,  ms: 'Ta-Ha',              en: 'Ta-Ha',                 ar: 'طه' },
  { n: 24,  ms: 'An-Nur',             en: 'The Light',             ar: 'النور' },
  { n: 25,  ms: 'Al-Furqan',          en: 'The Criterion',         ar: 'الفرقان' },
  { n: 32,  ms: 'As-Sajdah',          en: 'The Prostration',       ar: 'السجدة' },
  { n: 36,  ms: 'Yasin',              en: 'Ya-Sin',                ar: 'يس' },
  { n: 40,  ms: 'Ghafir',             en: 'The Forgiver',          ar: 'غافر' },
  { n: 41,  ms: 'Fussilat',           en: 'Explained in Detail',   ar: 'فصلت' },
  { n: 44,  ms: 'Ad-Dukhan',          en: 'The Smoke',             ar: 'الدخان' },
  { n: 48,  ms: 'Al-Fath',            en: 'The Victory',           ar: 'الفتح' },
  { n: 55,  ms: 'Ar-Rahman',          en: 'The Merciful',          ar: 'الرحمن' },
  { n: 56,  ms: 'Al-Waqi\'ah',        en: 'The Event',             ar: 'الواقعة' },
  { n: 62,  ms: 'Al-Jumu\'ah',        en: 'The Congregation',      ar: 'الجمعة' },
  { n: 67,  ms: 'Al-Mulk',            en: 'The Sovereignty',       ar: 'الملك' },
  { n: 71,  ms: 'Nuh',                en: 'Noah',                  ar: 'نوح' },
  { n: 72,  ms: 'Al-Jinn',            en: 'The Jinn',              ar: 'الجن' },
  { n: 73,  ms: 'Al-Muzzammil',       en: 'The Enshrouded',        ar: 'المزمل' },
  { n: 74,  ms: 'Al-Muddathir',       en: 'The Cloaked',           ar: 'المدثر' },
  { n: 76,  ms: 'Al-Insan',           en: 'Man',                   ar: 'الإنسان' },
  { n: 78,  ms: 'An-Naba\'',          en: 'The News',              ar: 'النبأ' },
  { n: 79,  ms: 'An-Nazi\'at',        en: 'Those Who Pull Out',    ar: 'النازعات' },
  { n: 80,  ms: 'Abasa',              en: 'He Frowned',            ar: 'عبس' },
  { n: 87,  ms: 'Al-A\'la',           en: 'The Most High',         ar: 'الأعلى' },
  { n: 90,  ms: 'Al-Balad',           en: 'The City',              ar: 'البلد' },
  { n: 91,  ms: 'Ash-Shams',          en: 'The Sun',               ar: 'الشمس' },
  { n: 93,  ms: 'Ad-Duha',            en: 'The Morning Light',     ar: 'الضحى' },
  { n: 94,  ms: 'Al-Insyirah',        en: 'The Relief',            ar: 'الشرح' },
  { n: 97,  ms: 'Al-Qadr',            en: 'The Night of Decree',   ar: 'القدر' },
  { n: 99,  ms: 'Az-Zalzalah',        en: 'The Earthquake',        ar: 'الزلزلة' },
  { n: 105, ms: 'Al-Fil',             en: 'The Elephant',          ar: 'الفيل' },
  { n: 106, ms: 'Quraisy',            en: 'Quraysh',               ar: 'قريش' },
  { n: 107, ms: 'Al-Ma\'un',          en: 'Small Kindnesses',      ar: 'الماعون' },
  { n: 108, ms: 'Al-Kauthar',         en: 'Abundance',             ar: 'الكوثر' },
  { n: 109, ms: 'Al-Kafirun',         en: 'The Disbelievers',      ar: 'الكافرون' },
  { n: 110, ms: 'An-Nasr',            en: 'The Divine Support',    ar: 'النصر' },
  { n: 112, ms: 'Al-Ikhlas',          en: 'Sincerity',             ar: 'الإخلاص' },
  { n: 113, ms: 'Al-Falaq',           en: 'The Daybreak',          ar: 'الفلق' },
  { n: 114, ms: 'An-Nas',             en: 'Mankind',               ar: 'الناس' },
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
      title: `${SURAH_LIST.find(x => x.n === s)?.ms || `Surah ${s}`}`,
      surah: s,
      reciter: r.id,
    })
  }
  return playlist
}

// ══════════════════════════════════════════════════════════════════════
// CURATED ISLAMIC PLAYLISTS — Bundle of surahs for specific occasions
// Legal, all-Quran content sourced from MP3Quran CDN
// ══════════════════════════════════════════════════════════════════════
export const ISLAMIC_PLAYLISTS = [
  {
    id: 'jumaat',
    icon: '🕌',
    title: { ms: 'Jumaat — Al-Kahfi', en: 'Friday — Al-Kahf', ar: 'الجمعة — الكهف' },
    desc: {
      ms: 'Sunnah baca Al-Kahfi setiap hari Jumaat (Al-Hakim)',
      en: 'Sunnah to recite Al-Kahf every Friday (Al-Hakim)',
      ar: 'سنة قراءة الكهف كل يوم جمعة',
    },
    recommendedReciter: 'sudais',
    surahs: [18],
  },
  {
    id: 'sebelum_tidur',
    icon: '🌙',
    title: { ms: 'Sebelum Tidur', en: 'Before Sleep', ar: 'قبل النوم' },
    desc: {
      ms: 'Al-Mulk + 3 Qul (Al-Ikhlas, Al-Falaq, An-Nas)',
      en: 'Al-Mulk + 3 Quls (Al-Ikhlas, Al-Falaq, An-Nas)',
      ar: 'الملك + المعوذات',
    },
    recommendedReciter: 'afasy',
    surahs: [67, 112, 113, 114],
  },
  {
    id: 'subuh',
    icon: '🌅',
    title: { ms: 'Subuh — Bacaan Pagi', en: 'Morning Recitation', ar: 'أذكار الصباح' },
    desc: {
      ms: 'As-Sajdah + Al-Insan (bacaan Rasulullah SAW pada Subuh Jumaat)',
      en: 'As-Sajdah + Al-Insan (Prophet\'s Friday morning recitation)',
      ar: 'السجدة + الإنسان',
    },
    recommendedReciter: 'muaiqly',
    surahs: [32, 76],
  },
  {
    id: 'rezeki',
    icon: '💰',
    title: { ms: 'Al-Waqi\'ah — Rezeki', en: 'Al-Waqi\'ah — Sustenance', ar: 'الواقعة — الرزق' },
    desc: {
      ms: 'Sunnah baca Al-Waqi\'ah untuk keberkatan rezeki',
      en: 'Recited for barakah and sustenance',
      ar: 'الواقعة للبركة والرزق',
    },
    recommendedReciter: 'ghamdi',
    surahs: [56],
  },
  {
    id: 'tenteram',
    icon: '💚',
    title: { ms: 'Ar-Rahman — Tenteram', en: 'Ar-Rahman — Serenity', ar: 'الرحمن — السكينة' },
    desc: {
      ms: 'Merdu, menenangkan hati',
      en: 'Melodious, calms the heart',
      ar: 'مهدئة للقلب',
    },
    recommendedReciter: 'balila',
    surahs: [55],
  },
  {
    id: 'yasin',
    icon: '❤️',
    title: { ms: 'Yasin — Hati Al-Quran', en: 'Ya-Sin — Heart of Quran', ar: 'يس — قلب القرآن' },
    desc: {
      ms: 'Surah Yasin, dibaca untuk hajat & keberkatan',
      en: 'Recited for blessings and needs',
      ar: 'يس للحاجات والبركة',
    },
    recommendedReciter: 'sudais',
    surahs: [36],
  },
  {
    id: 'muawwidhat',
    icon: '🛡️',
    title: { ms: 'Muawwidhat — Perlindungan', en: 'Muawwidhat — Protection', ar: 'المعوذات — الحماية' },
    desc: {
      ms: 'Al-Ikhlas + Al-Falaq + An-Nas (3 Qul)',
      en: 'The 3 protective surahs (Al-Ikhlas, Al-Falaq, An-Nas)',
      ar: 'الإخلاص + الفلق + الناس',
    },
    recommendedReciter: 'hudhaify',
    surahs: [112, 113, 114],
  },
  {
    id: 'juz_amma',
    icon: '📖',
    title: { ms: 'Juz Amma (Hafazan Kanak-kanak)', en: 'Juz Amma (Kids Memorization)', ar: 'جزء عم' },
    desc: {
      ms: 'Surah pendek untuk hafazan — 78 hingga 114',
      en: 'Short surahs for memorization — 78 to 114',
      ar: 'من النبأ إلى الناس',
    },
    recommendedReciter: 'afasy',
    surahs: [78, 79, 80, 87, 90, 91, 93, 94, 97, 99, 105, 106, 107, 108, 109, 110, 112, 113, 114],
  },
  {
    id: 'ramadan',
    icon: '🌙',
    title: { ms: 'Malam Ramadan', en: 'Ramadan Nights', ar: 'ليالي رمضان' },
    desc: {
      ms: 'Surah popular untuk qiyam & tadarus',
      en: 'Popular surahs for tarawih & recitation',
      ar: 'سور رمضانية',
    },
    recommendedReciter: 'muaiqly',
    surahs: [36, 55, 56, 67, 78, 97],
  },
]

// Build a playlist from an Islamic Playlist preset
export const buildIslamicPlaylist = (playlistId, reciterOverride = null) => {
  const p = ISLAMIC_PLAYLISTS.find(x => x.id === playlistId)
  if (!p) return []
  const reciterId = reciterOverride || p.recommendedReciter
  const r = QURAN_RECITERS.find(x => x.id === reciterId)
  if (!r) return []
  return p.surahs.map(s => ({
    url: `${r.server}${String(s).padStart(3, '0')}.mp3`,
    title: SURAH_LIST.find(x => x.n === s)?.ms || `Surah ${s}`,
    surah: s,
    reciter: r.id,
  }))
}

// ══════════════════════════════════════════════════════════════════════
// CUSTOM PLAYLIST — user builds from Quran + Islamic playlists
// Playlist item schema: { type: 'surah', reciterId, surahNumber, title } | { type: 'preset', playlistId }
// ══════════════════════════════════════════════════════════════════════
export const resolveCustomPlaylist = (items) => {
  if (!Array.isArray(items)) return []
  const resolved = []
  items.forEach(item => {
    if (item.type === 'surah' && item.reciterId && item.surahNumber) {
      resolved.push({
        url: buildQuranUrl(item.reciterId, item.surahNumber),
        title: item.title || SURAH_LIST.find(x => x.n === item.surahNumber)?.ms || `Surah ${item.surahNumber}`,
        surah: item.surahNumber,
        reciter: item.reciterId,
      })
    } else if (item.type === 'preset' && item.playlistId) {
      resolved.push(...buildIslamicPlaylist(item.playlistId, item.reciterId))
    }
  })
  return resolved.filter(x => x.url)
}
