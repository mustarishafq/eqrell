/**
 * EQrel Habit Templates — 30 starter habits (Cohort A)
 * Islamic-first, age-banded, category-tagged.
 *
 * Categories:
 *   - ibadah:      Solat, doa, hafazan, wudhu
 *   - akhlak:      Adab, sopan, kongsi, minta maaf
 *   - pembelajaran: Baca, muraja'ah, homework
 *   - kesihatan:   Gigi, tangan, tidur, mandi
 *   - keluarga:    Bantu ibubapa, main bersama
 *
 * Mata (points): 5-20 per habit. Higher for effort/discipline.
 */

export const HABIT_CATEGORIES = {
  ibadah:       { label: 'Ibadah',       icon: '🕌', color: '#00B894' },
  akhlak:       { label: 'Akhlak',       icon: '💛', color: '#FFB703' },
  pembelajaran: { label: 'Pembelajaran', icon: '📚', color: '#2D9CDB' },
  kesihatan:    { label: 'Kesihatan',    icon: '🪥', color: '#FF8A00' },
  keluarga:     { label: 'Keluarga',     icon: '👨‍👩‍👧', color: '#FF5D6E' },
}

export const AGE_BAND_LABEL = {
  '3-4':   'Toddler (3–4)',
  '5-6':   'Prasekolah (5–6)',
  '7-9':   'Awal sekolah (7–9)',
  '10-12': 'Pra-remaja (10–12)',
  all:     'Semua umur',
}

export const HABIT_TEMPLATES = [
  // ═══ IBADAH (10) ═══
  { id: 'ib-01', category: 'ibadah', title: 'Solat Subuh',            desc: 'Solat Subuh berjemaah atau sendiri.',   ageBands: ['5-6', '7-9', '10-12'], points: 20, frequency: 'daily' },
  { id: 'ib-02', category: 'ibadah', title: 'Solat Zohor',            desc: 'Solat Zohor tepat waktu.',              ageBands: ['5-6', '7-9', '10-12'], points: 15, frequency: 'daily' },
  { id: 'ib-03', category: 'ibadah', title: 'Solat Asar',             desc: 'Solat Asar sebelum matahari terbenam.', ageBands: ['5-6', '7-9', '10-12'], points: 15, frequency: 'daily' },
  { id: 'ib-04', category: 'ibadah', title: 'Solat Maghrib',          desc: 'Solat Maghrib berjemaah dengan keluarga.', ageBands: ['5-6', '7-9', '10-12'], points: 15, frequency: 'daily' },
  { id: 'ib-05', category: 'ibadah', title: 'Solat Isyak',            desc: 'Solat Isyak sebelum tidur.',            ageBands: ['5-6', '7-9', '10-12'], points: 15, frequency: 'daily' },
  { id: 'ib-06', category: 'ibadah', title: 'Doa sebelum makan',      desc: 'Baca Bismillah dan doa sebelum menjamah makanan.', ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 5,  frequency: 'daily' },
  { id: 'ib-07', category: 'ibadah', title: 'Doa sebelum tidur',      desc: 'Baca doa tidur dan 3 Qul.',             ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'ib-08', category: 'ibadah', title: 'Doa bangun tidur',       desc: 'Baca doa bangun tidur.',                ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 5,  frequency: 'daily' },
  { id: 'ib-09', category: 'ibadah', title: 'Baca / Muraja’ah Quran', desc: 'Baca atau ulang hafazan 5–15 minit.',   ageBands: ['5-6', '7-9', '10-12'], points: 15, frequency: 'daily' },
  { id: 'ib-10', category: 'ibadah', title: 'Wudhu betul',            desc: 'Ambil wudhu dengan langkah yang lengkap.', ageBands: ['5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },

  // ═══ AKHLAK (6) ═══
  { id: 'ak-01', category: 'akhlak', title: 'Beri salam',             desc: 'Ucap "Assalamualaikum" bila jumpa keluarga.', ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 5, frequency: 'daily' },
  { id: 'ak-02', category: 'akhlak', title: 'Cium tangan Ibu/Bapa',   desc: 'Cium tangan Ibu & Bapa pagi dan malam.',    ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 5, frequency: 'daily' },
  { id: 'ak-03', category: 'akhlak', title: 'Kongsi dengan adik-beradik', desc: 'Kongsi mainan/makanan tanpa diminta.', ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'ak-04', category: 'akhlak', title: 'Terima kasih & Maaf',    desc: 'Ucap terima kasih dan minta maaf bila perlu.', ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 5, frequency: 'daily' },
  { id: 'ak-05', category: 'akhlak', title: 'Bercakap dengan sopan',  desc: 'Tidak menjerit atau memarahi orang tua.',    ageBands: ['5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'ak-06', category: 'akhlak', title: 'Tolong orang lain',      desc: 'Buat 1 perbuatan baik hari ini.',            ageBands: ['5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },

  // ═══ PEMBELAJARAN (4) ═══
  { id: 'pb-01', category: 'pembelajaran', title: 'Baca buku 15 minit', desc: 'Baca buku cerita atau ilmu 15 minit.',     ageBands: ['5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'pb-02', category: 'pembelajaran', title: 'Baca Iqra / Al-Quran', desc: 'Baca 1 muka Iqra atau Quran dengan orang dewasa.', ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 15, frequency: 'daily' },
  { id: 'pb-03', category: 'pembelajaran', title: 'Siapkan homework',    desc: 'Buat & semak kerja rumah sekolah.',        ageBands: ['7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'pb-04', category: 'pembelajaran', title: 'Cerita hari ini',     desc: 'Kongsi 1 perkara baru yang dipelajari.',   ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 5,  frequency: 'daily' },

  // ═══ KESIHATAN (5) ═══
  { id: 'ks-01', category: 'kesihatan', title: 'Berus gigi 2x',        desc: 'Berus gigi pagi dan malam sebelum tidur.', ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'ks-02', category: 'kesihatan', title: 'Cuci tangan',          desc: 'Cuci tangan dengan sabun sebelum makan.',  ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 5,  frequency: 'daily' },
  { id: 'ks-03', category: 'kesihatan', title: 'Mandi & kemas diri',   desc: 'Mandi & kemas rambut/baju.',               ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'ks-04', category: 'kesihatan', title: 'Tidur awal',           desc: 'Tidur sebelum 10 malam.',                  ageBands: ['5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'ks-05', category: 'kesihatan', title: 'Kemas bilik',          desc: 'Susun mainan / kemas katil sendiri.',      ageBands: ['5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },

  // ═══ KELUARGA (5) ═══
  { id: 'kg-01', category: 'keluarga', title: 'Bantu Ibu/Bapa',        desc: 'Bantu 1 tugas rumah (basuh pinggan, kemas, dll).', ageBands: ['5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'kg-02', category: 'keluarga', title: 'Main dengan adik-kakak', desc: 'Main bersama tanpa gadget 30 minit.',      ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'kg-03', category: 'keluarga', title: 'Makan bersama keluarga', desc: 'Makan bersama tanpa TV/gadget.',           ageBands: ['5-6', '7-9', '10-12'], points: 10, frequency: 'daily' },
  { id: 'kg-04', category: 'keluarga', title: 'Peluk keluarga',        desc: 'Peluk Ibu/Bapa/adik-beradik hari ini.',     ageBands: ['3-4', '5-6', '7-9', '10-12'], points: 5,  frequency: 'daily' },
  { id: 'kg-05', category: 'keluarga', title: 'Doa untuk keluarga',    desc: 'Doa keselamatan untuk ibu, bapa, adik-beradik.', ageBands: ['5-6', '7-9', '10-12'], points: 5, frequency: 'daily' },
]

export const TEMPLATES_BY_CATEGORY = HABIT_TEMPLATES.reduce((acc, t) => {
  if (!acc[t.category]) acc[t.category] = []
  acc[t.category].push(t)
  return acc
}, {})

export const TEMPLATE_BY_ID = Object.fromEntries(HABIT_TEMPLATES.map(t => [t.id, t]))

/** Filter templates suitable for a given age band. */
export function templatesForAgeBand(ageBand) {
  if (!ageBand) return HABIT_TEMPLATES
  return HABIT_TEMPLATES.filter(t => t.ageBands.includes(ageBand) || t.ageBands.includes('all'))
}
