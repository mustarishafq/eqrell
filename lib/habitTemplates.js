/**
 * EQrel Habit Templates — 30 starter habits (Cohort A)
 * Islamic-first, age-banded, category-tagged. Localised to MS / EN / ID / AR.
 *
 * Categories:
 *   - ibadah:      Solat, doa, hafazan, wudhu
 *   - akhlak:      Adab, sopan, kongsi, minta maaf
 *   - pembelajaran: Baca, muraja'ah, homework
 *   - kesihatan:   Gigi, tangan, tidur, mandi
 *   - keluarga:    Bantu ibubapa, main bersama
 *
 * Mata (points): 5–20 per habit. Higher for effort/discipline.
 *
 * NOTE: `title` and `desc` on each template are the CANONICAL/BM strings kept
 * for backward compatibility with older DB records. UI should always resolve
 * localised text via `getTemplateTitle(tpl, lang)` / `getTemplateDesc(tpl, lang)`.
 */

// Legacy MS labels (kept so old code doesn't break). Prefer getCategoryLabel(catId, t).
export const HABIT_CATEGORIES = {
  ibadah:       { label: 'Ibadah',       icon: '🕌', color: '#00B894' },
  akhlak:       { label: 'Akhlak',       icon: '💛', color: '#FFB703' },
  pembelajaran: { label: 'Pembelajaran', icon: '📚', color: '#2D9CDB' },
  kesihatan:    { label: 'Kesihatan',    icon: '🪥', color: '#FF8A00' },
  keluarga:     { label: 'Keluarga',     icon: '👨‍👩‍👧', color: '#FF5D6E' },
}

/** Locale-aware category label lookup. `t` = strings[lang] from useLang(). */
export function getCategoryLabel(catId, t) {
  const key = 'cat_' + catId
  return (t && t[key]) || HABIT_CATEGORIES[catId]?.label || catId
}

// Legacy MS-only age band labels (kept for backward compat). Prefer strings.band_* via useLang().
export const AGE_BAND_LABEL = {
  '3-4':   'Toddler (3–4)',
  '5-6':   'Prasekolah (5–6)',
  '7-9':   'Awal sekolah (7–9)',
  '10-12': 'Pra-remaja (10–12)',
  all:     'Semua umur',
}

/** Locale-aware age band label lookup. */
export function getAgeBandLabel(band, t) {
  const key = 'band_' + String(band).replace('-', '_')
  return (t && t[key]) || AGE_BAND_LABEL[band] || band
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

/**
 * Locale strings for the 30 templates.
 * Keys: template id → { ms, en, id, ar } each with { title, desc }.
 * ms values duplicated from canonical to make lookups uniform.
 */
export const HABIT_TEMPLATE_I18N = {
  'ib-01': {
    ms: { title: 'Solat Subuh', desc: 'Solat Subuh berjemaah atau sendiri.' },
    en: { title: 'Subuh (Fajr) Prayer', desc: 'Perform Fajr prayer in congregation or on your own.' },
    id: { title: 'Salat Subuh', desc: 'Salat Subuh berjamaah atau sendiri.' },
    ar: { title: 'صلاة الفجر', desc: 'أداء صلاة الفجر جماعةً أو منفرداً.' },
  },
  'ib-02': {
    ms: { title: 'Solat Zohor', desc: 'Solat Zohor tepat waktu.' },
    en: { title: 'Zuhr Prayer', desc: 'Perform Zuhr prayer on time.' },
    id: { title: 'Salat Zuhur', desc: 'Salat Zuhur tepat waktu.' },
    ar: { title: 'صلاة الظهر', desc: 'أداء صلاة الظهر في وقتها.' },
  },
  'ib-03': {
    ms: { title: 'Solat Asar', desc: 'Solat Asar sebelum matahari terbenam.' },
    en: { title: 'Asr Prayer', desc: 'Perform Asr prayer before sunset.' },
    id: { title: 'Salat Asar', desc: 'Salat Asar sebelum matahari terbenam.' },
    ar: { title: 'صلاة العصر', desc: 'أداء صلاة العصر قبل غروب الشمس.' },
  },
  'ib-04': {
    ms: { title: 'Solat Maghrib', desc: 'Solat Maghrib berjemaah dengan keluarga.' },
    en: { title: 'Maghrib Prayer', desc: 'Perform Maghrib in congregation with family.' },
    id: { title: 'Salat Magrib', desc: 'Salat Magrib berjamaah dengan keluarga.' },
    ar: { title: 'صلاة المغرب', desc: 'أداء صلاة المغرب جماعةً مع العائلة.' },
  },
  'ib-05': {
    ms: { title: 'Solat Isyak', desc: 'Solat Isyak sebelum tidur.' },
    en: { title: 'Isha Prayer', desc: 'Perform Isha prayer before sleeping.' },
    id: { title: 'Salat Isya', desc: 'Salat Isya sebelum tidur.' },
    ar: { title: 'صلاة العشاء', desc: 'أداء صلاة العشاء قبل النوم.' },
  },
  'ib-06': {
    ms: { title: 'Doa sebelum makan', desc: 'Baca Bismillah dan doa sebelum menjamah makanan.' },
    en: { title: 'Du’a before eating', desc: 'Say Bismillah and the du’a before eating.' },
    id: { title: 'Doa sebelum makan', desc: 'Baca Bismillah dan doa sebelum makan.' },
    ar: { title: 'دعاء قبل الأكل', desc: 'التسمية والدعاء قبل تناول الطعام.' },
  },
  'ib-07': {
    ms: { title: 'Doa sebelum tidur', desc: 'Baca doa tidur dan 3 Qul.' },
    en: { title: 'Du’a before sleep', desc: 'Recite the bedtime du’a and the 3 Quls.' },
    id: { title: 'Doa sebelum tidur', desc: 'Baca doa sebelum tidur dan 3 Qul.' },
    ar: { title: 'دعاء قبل النوم', desc: 'قراءة دعاء النوم والمعوذات الثلاث.' },
  },
  'ib-08': {
    ms: { title: 'Doa bangun tidur', desc: 'Baca doa bangun tidur.' },
    en: { title: 'Du’a upon waking', desc: 'Recite the du’a for waking up.' },
    id: { title: 'Doa bangun tidur', desc: 'Baca doa bangun tidur.' },
    ar: { title: 'دعاء الاستيقاظ', desc: 'قراءة دعاء الاستيقاظ من النوم.' },
  },
  'ib-09': {
    ms: { title: 'Baca / Muraja’ah Quran', desc: 'Baca atau ulang hafazan 5–15 minit.' },
    en: { title: 'Read / Review Quran', desc: 'Read or revise memorisation for 5–15 minutes.' },
    id: { title: 'Baca / Muraja’ah Al-Qur’an', desc: 'Baca atau ulang hafalan 5–15 menit.' },
    ar: { title: 'قراءة / مراجعة القرآن', desc: 'قراءة أو مراجعة الحفظ لمدة 5–15 دقيقة.' },
  },
  'ib-10': {
    ms: { title: 'Wudhu betul', desc: 'Ambil wudhu dengan langkah yang lengkap.' },
    en: { title: 'Proper Wudu', desc: 'Perform ablution with all the correct steps.' },
    id: { title: 'Wudu benar', desc: 'Berwudu dengan langkah-langkah yang lengkap.' },
    ar: { title: 'الوضوء الصحيح', desc: 'أداء الوضوء بجميع خطواته الصحيحة.' },
  },

  'ak-01': {
    ms: { title: 'Beri salam', desc: 'Ucap "Assalamualaikum" bila jumpa keluarga.' },
    en: { title: 'Give salam', desc: 'Say "Assalamualaikum" when meeting family.' },
    id: { title: 'Memberi salam', desc: 'Ucapkan "Assalamualaikum" saat bertemu keluarga.' },
    ar: { title: 'إلقاء السلام', desc: 'قول "السلام عليكم" عند لقاء العائلة.' },
  },
  'ak-02': {
    ms: { title: 'Cium tangan Ibu/Bapa', desc: 'Cium tangan Ibu & Bapa pagi dan malam.' },
    en: { title: 'Kiss parents’ hands', desc: 'Kiss mother’s and father’s hands morning and night.' },
    id: { title: 'Cium tangan Ibu/Ayah', desc: 'Cium tangan Ibu & Ayah pagi dan malam.' },
    ar: { title: 'تقبيل يد الوالدين', desc: 'تقبيل يد الأم والأب صباحاً ومساءً.' },
  },
  'ak-03': {
    ms: { title: 'Kongsi dengan adik-beradik', desc: 'Kongsi mainan/makanan tanpa diminta.' },
    en: { title: 'Share with siblings', desc: 'Share toys/food without being asked.' },
    id: { title: 'Berbagi dengan saudara', desc: 'Berbagi mainan/makanan tanpa diminta.' },
    ar: { title: 'المشاركة مع الإخوة', desc: 'مشاركة الألعاب/الطعام دون أن يُطلب منك.' },
  },
  'ak-04': {
    ms: { title: 'Terima kasih & Maaf', desc: 'Ucap terima kasih dan minta maaf bila perlu.' },
    en: { title: 'Thanks & Sorry', desc: 'Say thank you and apologise when needed.' },
    id: { title: 'Terima kasih & Maaf', desc: 'Ucapkan terima kasih dan minta maaf bila perlu.' },
    ar: { title: 'الشكر والاعتذار', desc: 'قل شكراً واعتذر عند الحاجة.' },
  },
  'ak-05': {
    ms: { title: 'Bercakap dengan sopan', desc: 'Tidak menjerit atau memarahi orang tua.' },
    en: { title: 'Speak politely', desc: 'No shouting or talking back to elders.' },
    id: { title: 'Bicara sopan', desc: 'Tidak berteriak atau membentak orang tua.' },
    ar: { title: 'التحدث بأدب', desc: 'عدم الصراخ أو مجادلة الكبار.' },
  },
  'ak-06': {
    ms: { title: 'Tolong orang lain', desc: 'Buat 1 perbuatan baik hari ini.' },
    en: { title: 'Help others', desc: 'Do 1 good deed today.' },
    id: { title: 'Bantu orang lain', desc: 'Lakukan 1 perbuatan baik hari ini.' },
    ar: { title: 'مساعدة الآخرين', desc: 'قم بعمل صالح واحد اليوم.' },
  },

  'pb-01': {
    ms: { title: 'Baca buku 15 minit', desc: 'Baca buku cerita atau ilmu 15 minit.' },
    en: { title: 'Read a book 15 min', desc: 'Read a story or knowledge book for 15 minutes.' },
    id: { title: 'Baca buku 15 menit', desc: 'Baca buku cerita atau ilmu selama 15 menit.' },
    ar: { title: 'قراءة كتاب لمدة 15 دقيقة', desc: 'قراءة قصة أو كتاب معرفي لمدة 15 دقيقة.' },
  },
  'pb-02': {
    ms: { title: 'Baca Iqra / Al-Quran', desc: 'Baca 1 muka Iqra atau Quran dengan orang dewasa.' },
    en: { title: 'Read Iqra / Quran', desc: 'Read 1 page of Iqra or Quran with an adult.' },
    id: { title: 'Baca Iqra / Al-Qur’an', desc: 'Baca 1 halaman Iqra atau Al-Qur’an dengan orang dewasa.' },
    ar: { title: 'قراءة إقرأ / القرآن', desc: 'قراءة صفحة واحدة من إقرأ أو القرآن مع شخص بالغ.' },
  },
  'pb-03': {
    ms: { title: 'Siapkan homework', desc: 'Buat & semak kerja rumah sekolah.' },
    en: { title: 'Finish homework', desc: 'Do and review school homework.' },
    id: { title: 'Selesaikan PR', desc: 'Kerjakan dan periksa PR sekolah.' },
    ar: { title: 'إتمام الواجب المنزلي', desc: 'أداء ومراجعة الواجب المدرسي.' },
  },
  'pb-04': {
    ms: { title: 'Cerita hari ini', desc: 'Kongsi 1 perkara baru yang dipelajari.' },
    en: { title: 'Today’s story', desc: 'Share 1 new thing you learned today.' },
    id: { title: 'Cerita hari ini', desc: 'Bagikan 1 hal baru yang dipelajari hari ini.' },
    ar: { title: 'قصة اليوم', desc: 'شاركني شيئاً جديداً تعلّمته اليوم.' },
  },

  'ks-01': {
    ms: { title: 'Berus gigi 2x', desc: 'Berus gigi pagi dan malam sebelum tidur.' },
    en: { title: 'Brush teeth 2x', desc: 'Brush teeth in the morning and before bed.' },
    id: { title: 'Sikat gigi 2x', desc: 'Sikat gigi pagi dan malam sebelum tidur.' },
    ar: { title: 'تنظيف الأسنان مرتين', desc: 'تنظيف الأسنان صباحاً وقبل النوم.' },
  },
  'ks-02': {
    ms: { title: 'Cuci tangan', desc: 'Cuci tangan dengan sabun sebelum makan.' },
    en: { title: 'Wash hands', desc: 'Wash hands with soap before eating.' },
    id: { title: 'Cuci tangan', desc: 'Cuci tangan dengan sabun sebelum makan.' },
    ar: { title: 'غسل اليدين', desc: 'غسل اليدين بالصابون قبل الأكل.' },
  },
  'ks-03': {
    ms: { title: 'Mandi & kemas diri', desc: 'Mandi & kemas rambut/baju.' },
    en: { title: 'Shower & tidy up', desc: 'Shower and tidy hair/clothes.' },
    id: { title: 'Mandi & rapikan diri', desc: 'Mandi dan rapikan rambut/pakaian.' },
    ar: { title: 'الاستحمام والاعتناء بالنفس', desc: 'الاستحمام وترتيب الشعر والملابس.' },
  },
  'ks-04': {
    ms: { title: 'Tidur awal', desc: 'Tidur sebelum 10 malam.' },
    en: { title: 'Sleep early', desc: 'Go to sleep before 10 PM.' },
    id: { title: 'Tidur lebih awal', desc: 'Tidur sebelum jam 10 malam.' },
    ar: { title: 'النوم مبكراً', desc: 'النوم قبل الساعة العاشرة مساءً.' },
  },
  'ks-05': {
    ms: { title: 'Kemas bilik', desc: 'Susun mainan / kemas katil sendiri.' },
    en: { title: 'Tidy the room', desc: 'Put away toys / make the bed by yourself.' },
    id: { title: 'Rapikan kamar', desc: 'Rapikan mainan / merapikan tempat tidur sendiri.' },
    ar: { title: 'ترتيب الغرفة', desc: 'ترتيب الألعاب وترتيب السرير بنفسك.' },
  },

  'kg-01': {
    ms: { title: 'Bantu Ibu/Bapa', desc: 'Bantu 1 tugas rumah (basuh pinggan, kemas, dll).' },
    en: { title: 'Help mum/dad', desc: 'Help with 1 household task (dishes, tidying, etc.).' },
    id: { title: 'Bantu Ibu/Ayah', desc: 'Bantu 1 pekerjaan rumah (cuci piring, rapikan, dll).' },
    ar: { title: 'مساعدة الأم/الأب', desc: 'المساعدة في مهمة منزلية واحدة (غسل الأطباق، الترتيب، إلخ).' },
  },
  'kg-02': {
    ms: { title: 'Main dengan adik-kakak', desc: 'Main bersama tanpa gadget 30 minit.' },
    en: { title: 'Play with siblings', desc: 'Play together without gadgets for 30 minutes.' },
    id: { title: 'Main dengan saudara', desc: 'Bermain bersama tanpa gawai selama 30 menit.' },
    ar: { title: 'اللعب مع الإخوة', desc: 'اللعب معاً بدون أجهزة لمدة 30 دقيقة.' },
  },
  'kg-03': {
    ms: { title: 'Makan bersama keluarga', desc: 'Makan bersama tanpa TV/gadget.' },
    en: { title: 'Eat as a family', desc: 'Share a meal together without TV/gadgets.' },
    id: { title: 'Makan bersama keluarga', desc: 'Makan bersama tanpa TV/gawai.' },
    ar: { title: 'الأكل مع العائلة', desc: 'تناول الطعام معاً بدون تلفاز/أجهزة.' },
  },
  'kg-04': {
    ms: { title: 'Peluk keluarga', desc: 'Peluk Ibu/Bapa/adik-beradik hari ini.' },
    en: { title: 'Hug your family', desc: 'Give mum, dad or siblings a hug today.' },
    id: { title: 'Peluk keluarga', desc: 'Peluk Ibu/Ayah/saudara hari ini.' },
    ar: { title: 'احتضان العائلة', desc: 'احتضن الأم أو الأب أو الإخوة اليوم.' },
  },
  'kg-05': {
    ms: { title: 'Doa untuk keluarga', desc: 'Doa keselamatan untuk ibu, bapa, adik-beradik.' },
    en: { title: 'Du’a for family', desc: 'Make du’a for the safety of mum, dad and siblings.' },
    id: { title: 'Doa untuk keluarga', desc: 'Doa keselamatan untuk ibu, ayah, dan saudara.' },
    ar: { title: 'الدعاء للعائلة', desc: 'الدعاء بالسلامة للأم والأب والإخوة.' },
  },
}

/** Get localised template title. Falls back to canonical, then id. */
export function getTemplateTitle(tpl, lang = 'ms') {
  if (!tpl) return ''
  const entry = HABIT_TEMPLATE_I18N[tpl.id]?.[lang] || HABIT_TEMPLATE_I18N[tpl.id]?.ms
  return entry?.title || tpl.title || tpl.id
}

/** Get localised template description. */
export function getTemplateDesc(tpl, lang = 'ms') {
  if (!tpl) return ''
  const entry = HABIT_TEMPLATE_I18N[tpl.id]?.[lang] || HABIT_TEMPLATE_I18N[tpl.id]?.ms
  return entry?.desc || tpl.desc || ''
}

/** Resolve title/desc for a habit record (may be template-based or custom). */
export function getHabitTitle(habit, lang = 'ms') {
  if (!habit) return ''
  if (habit.templateId && HABIT_TEMPLATE_I18N[habit.templateId]) {
    const entry = HABIT_TEMPLATE_I18N[habit.templateId][lang] || HABIT_TEMPLATE_I18N[habit.templateId].ms
    return entry?.title || habit.title || ''
  }
  return habit.title || ''
}
export function getHabitDesc(habit, lang = 'ms') {
  if (!habit) return ''
  if (habit.templateId && HABIT_TEMPLATE_I18N[habit.templateId]) {
    const entry = HABIT_TEMPLATE_I18N[habit.templateId][lang] || HABIT_TEMPLATE_I18N[habit.templateId].ms
    return entry?.desc || habit.desc || ''
  }
  return habit.desc || ''
}

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
