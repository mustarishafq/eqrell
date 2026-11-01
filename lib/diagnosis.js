/**
 * EQrel "Diagnosis Iman & Habit" — onboarding quiz engine.
 * Pure functions, shared by the /diagnosis page (live preview) and the API
 * (server re-computes scores + validates the habit plan).
 *
 * Levels per practice question: 0 = Belum mula, 1 = Kadang-kadang, 2 = Dah konsisten
 */
import { TEMPLATE_BY_ID } from '@/lib/habitTemplates'

export const DIMENSIONS = {
  ibadah:    { icon: '🕌', color: '#00B894', ms: 'Ibadah',            en: 'Worship', ind: 'Ibadah', ar: 'العبادة' },
  quran:     { icon: '📖', color: '#2D9CDB', ms: 'Al-Quran',          en: 'Quran', ind: 'Al-Quran', ar: 'القرآن' },
  akhlak:    { icon: '💛', color: '#FFB703', ms: 'Akhlak',            en: 'Character', ind: 'Akhlak', ar: 'الأخلاق' },
  kesihatan: { icon: '🪥', color: '#FF8A00', ms: 'Kebersihan & Diri', en: 'Self-care', ind: 'Kebersihan & Diri', ar: 'النظافة والعناية' },
  keluarga:  { icon: '🏡', color: '#FF5D6E', ms: 'Disiplin & Keluarga', en: 'Discipline & Family', ind: 'Disiplin & Keluarga', ar: 'الانضباط والأسرة' },
}

// ── Family-level questions ───────────────────────────────────────────────
export const GOALS = [
  { id: 'solat',    icon: '🕌', dims: ['ibadah'],               ms: 'Solat lebih konsisten',      en: 'More consistent solat', ind: 'Sholat lebih konsisten', ar: 'المواظبة على الصلاة' },
  { id: 'quran',    icon: '📖', dims: ['quran'],                ms: 'Rapat dengan Al-Quran',      en: 'Closer to the Quran', ind: 'Dekat dengan Al-Quran', ar: 'القرب من القرآن' },
  { id: 'adab',     icon: '💛', dims: ['akhlak'],               ms: 'Adab & akhlak mulia',        en: 'Good manners & character', ind: 'Adab & akhlak mulia', ar: 'الآداب والأخلاق الحسنة' },
  { id: 'disiplin', icon: '⏰', dims: ['kesihatan', 'keluarga'], ms: 'Disiplin & berdikari',       en: 'Discipline & independence', ind: 'Disiplin & mandiri', ar: 'الانضباط والاستقلالية' },
  { id: 'skrin',    icon: '📵', dims: ['keluarga'], q: 'q_skrin', ms: 'Kurangkan gajet / skrin',  en: 'Less screen time', ind: 'Kurangi gawai / layar', ar: 'تقليل الشاشات' },
  { id: 'bersih',   icon: '🧼', dims: ['kesihatan'],            ms: 'Kebersihan & kesihatan',     en: 'Hygiene & health', ind: 'Kebersihan & kesehatan', ar: 'النظافة والصحة' },
  { id: 'keluarga', icon: '👨‍👩‍👧', dims: ['keluarga'],         ms: 'Lebih rapat sekeluarga',     en: 'Closer as a family', ind: 'Lebih dekat sekeluarga', ar: 'أسرة أكثر ترابطاً' },
]

export const ROUTINE_QUESTIONS = [
  { id: 'bedtime', ms: 'Pukul berapa anak-anak biasanya tidur?', en: 'When do the children usually sleep?', ind: 'Jam berapa anak-anak biasanya tidur?', ar: 'متى ينام الأطفال عادةً؟',
    options: [
      { id: 'early', icon: '🌙', ms: 'Sebelum 9 malam', en: 'Before 9 pm', ind: 'Sebelum jam 9 malam', ar: 'قبل ٩ مساءً' },
      { id: 'mid',   icon: '🕙', ms: '9 – 10 malam',    en: '9 – 10 pm', ind: 'Jam 9 – 10 malam', ar: '٩ – ١٠ مساءً' },
      { id: 'late',  icon: '🦉', ms: 'Selepas 10 malam', en: 'After 10 pm', ind: 'Setelah jam 10 malam', ar: 'بعد ١٠ مساءً' },
    ] },
  { id: 'jemaah', ms: 'Berapa kerap keluarga solat berjemaah di rumah?', en: 'How often does the family pray together at home?', ind: 'Seberapa sering keluarga sholat berjamaah di rumah?', ar: 'كم مرة تصلي الأسرة جماعةً في البيت؟',
    options: [
      { id: 'often',     icon: '🤲', ms: 'Hampir setiap hari', en: 'Almost daily', ind: 'Hampir setiap hari', ar: 'يومياً تقريباً' },
      { id: 'sometimes', icon: '🙂', ms: 'Kadang-kadang',      en: 'Sometimes', ind: 'Kadang-kadang', ar: 'أحياناً' },
      { id: 'rarely',    icon: '🌱', ms: 'Jarang',             en: 'Rarely', ind: 'Jarang', ar: 'نادراً' },
    ] },
  { id: 'meals', ms: 'Adakah keluarga makan bersama?', en: 'Does the family eat together?', ind: 'Apakah keluarga makan bersama?', ar: 'هل تأكل الأسرة معاً؟',
    options: [
      { id: 'daily',     icon: '🍽️', ms: 'Setiap hari',   en: 'Every day', ind: 'Setiap hari', ar: 'كل يوم' },
      { id: 'sometimes', icon: '🙂', ms: 'Kadang-kadang', en: 'Sometimes', ind: 'Kadang-kadang', ar: 'أحياناً' },
      { id: 'rarely',    icon: '📱', ms: 'Jarang',        en: 'Rarely', ind: 'Jarang', ar: 'نادراً' },
    ] },
]

// ── Per-child practice questions ─────────────────────────────────────────
// `tpl` = candidate templates (ordered) per age band group
export const PRACTICE_QUESTIONS = [
  { id: 'q_solat', dim: 'ibadah', icon: '🕌',
    ms: (n, a) => a <= 4 ? `Adakah ${n} ikut ibu bapa bila solat?` : `Bagaimana solat 5 waktu ${n} sekarang?`,
    en: (n, a) => a <= 4 ? `Does ${n} join you when you pray?` : `How is ${n}'s 5 daily prayers right now?`,
    ind: (n, a) => a <= 4 ? `Apakah ${n} ikut orang tua saat sholat?` : `Bagaimana sholat 5 waktu ${n} sekarang?`,
    ar: (n, a) => a <= 4 ? `هل يشارك ${n} والديه في الصلاة؟` : `كيف حال صلوات ${n} الخمس الآن؟`,
    tpl: { young: ['ib-06', 'ak-01'], mid: ['ib-04', 'ib-01', 'ib-10'], old: ['ib-01', 'ib-05', 'ib-10', 'ib-03'] } },
  { id: 'q_doa', dim: 'ibadah', icon: '🤲',
    ms: (n) => `Adakah ${n} membaca doa harian (makan, tidur, bangun)?`,
    en: (n) => `Does ${n} recite daily du'a (eating, sleeping, waking)?`,
    ind: (n) => `Apakah ${n} membaca doa harian (makan, tidur, bangun)?`,
    ar: (n) => `هل يقرأ ${n} الأدعية اليومية (الطعام، النوم، الاستيقاظ)؟`,
    tpl: { young: ['ib-06', 'ib-07'], mid: ['ib-07', 'ib-06', 'ib-08'], old: ['ib-08', 'ib-07', 'kg-05'] } },
  { id: 'q_quran', dim: 'quran', icon: '📖',
    ms: (n) => `Bagaimana bacaan Iqra / Al-Quran ${n}?`,
    en: (n) => `How is ${n}'s Iqra / Quran reading?`,
    ind: (n) => `Bagaimana bacaan Iqra / Al-Quran ${n}?`,
    ar: (n) => `كيف قراءة ${n} للقاعدة / القرآن؟`,
    tpl: { young: ['pb-02'], mid: ['pb-02', 'ib-09'], old: ['ib-09', 'pb-02'] } },
  { id: 'q_adab', dim: 'akhlak', icon: '🙋',
    ms: (n) => `Adakah ${n} memberi salam & bercakap sopan dengan orang tua?`,
    en: (n) => `Does ${n} give salam & speak politely to elders?`,
    ind: (n) => `Apakah ${n} memberi salam & berbicara sopan kepada orang tua?`,
    ar: (n) => `هل يُلقي ${n} السلام ويتحدث بأدب مع الكبار؟`,
    tpl: { young: ['ak-01', 'ak-02'], mid: ['ak-01', 'ak-05', 'ak-02'], old: ['ak-05', 'ak-02', 'ak-01'] } },
  { id: 'q_kongsi', dim: 'akhlak', icon: '🤝',
    ms: (n) => `Adakah ${n} suka berkongsi & minta maaf bila salah?`,
    en: (n) => `Does ${n} share & say sorry when wrong?`,
    ind: (n) => `Apakah ${n} suka berbagi & minta maaf saat salah?`,
    ar: (n) => `هل يحب ${n} المشاركة ويعتذر عند الخطأ؟`,
    tpl: { young: ['ak-03', 'ak-04'], mid: ['ak-04', 'ak-03', 'ak-06'], old: ['ak-06', 'ak-04', 'ak-03'] } },
  { id: 'q_bersih', dim: 'kesihatan', icon: '🪥',
    ms: (n) => `Adakah ${n} gosok gigi & jaga kebersihan diri sendiri?`,
    en: (n) => `Does ${n} brush teeth & keep clean independently?`,
    ind: (n) => `Apakah ${n} sikat gigi & menjaga kebersihan diri sendiri?`,
    ar: (n) => `هل يفرّش ${n} أسنانه ويهتم بنظافته بنفسه؟`,
    tpl: { young: ['ks-01', 'ks-02'], mid: ['ks-01', 'ks-03', 'ks-02'], old: ['ks-03', 'ks-01'] } },
  { id: 'q_tidur', dim: 'kesihatan', icon: '😴',
    ms: (n) => `Adakah ${n} tidur awal tanpa banyak pujukan?`,
    en: (n) => `Does ${n} go to bed early without much fuss?`,
    ind: (n) => `Apakah ${n} tidur awal tanpa banyak dibujuk?`,
    ar: (n) => `هل ينام ${n} مبكراً دون إلحاح كثير؟`,
    tpl: { young: ['ib-07', 'kg-04'], mid: ['ks-04', 'ib-07'], old: ['ks-04', 'ib-07'] } },
  { id: 'q_bantu', dim: 'keluarga', icon: '🧹',
    ms: (n) => `Adakah ${n} membantu kerja rumah & kemas barang sendiri?`,
    en: (n) => `Does ${n} help with chores & tidy up?`,
    ind: (n) => `Apakah ${n} membantu pekerjaan rumah & merapikan barangnya?`,
    ar: (n) => `هل يساعد ${n} في أعمال البيت ويرتّب أغراضه؟`,
    tpl: { young: ['kg-04', 'kg-02'], mid: ['ks-05', 'kg-01'], old: ['kg-01', 'ks-05'] } },
  { id: 'q_skrin', dim: 'keluarga', icon: '📱',
    ms: (n) => `Adakah masa skrin / gajet ${n} terkawal?`,
    en: (n) => `Is ${n}'s screen / gadget time under control?`,
    ind: (n) => `Apakah waktu layar / gawai ${n} terkendali?`,
    ar: (n) => `هل وقت الشاشة / الأجهزة لدى ${n} منضبط؟`,
    tpl: { young: ['kg-02', 'pb-04'], mid: ['kg-02', 'pb-01', 'kg-03'], old: ['pb-01', 'kg-03', 'kg-02'] } },
]

export const LEVELS = [
  { v: 0, icon: '🌱', ms: 'Belum mula',     en: 'Not yet', ind: 'Belum mulai', ar: 'لم يبدأ بعد' },
  { v: 1, icon: '🌿', ms: 'Kadang-kadang',  en: 'Sometimes', ind: 'Kadang-kadang', ar: 'أحياناً' },
  { v: 2, icon: '🌳', ms: 'Dah konsisten',  en: 'Consistent', ind: 'Sudah konsisten', ar: 'مواظب' },
]

export const SCHOOL_OPTIONS = [
  { id: 'none',      icon: '🧸', ms: 'Belum bersekolah',  en: 'Not in school yet', ind: 'Belum sekolah', ar: 'لم يلتحق بالمدرسة' },
  { id: 'morning',   icon: '🌤️', ms: 'Sekolah pagi',      en: 'Morning school', ind: 'Sekolah pagi', ar: 'مدرسة صباحية' },
  { id: 'afternoon', icon: '🌇', ms: 'Sekolah petang',    en: 'Afternoon school', ind: 'Sekolah siang', ar: 'مدرسة مسائية' },
]

export const STAGES = [
  { id: 'benih', min: 0,  icon: '🌱', ms: 'Fasa Benih', en: 'Seed Stage', ind: 'Fase Benih', ar: 'مرحلة البذرة',
    descMs: 'Permulaan yang indah. Setiap habit kecil hari ini ialah benih iman yang akan tumbuh.',
    descEn: 'A beautiful beginning. Every small habit today is a seed of iman that will grow.',
    descId: 'Awal yang indah. Setiap kebiasaan kecil hari ini adalah benih iman yang akan tumbuh.',
    descAr: 'بداية جميلة. كل عادة صغيرة اليوم بذرةُ إيمان ستنمو.' },
  { id: 'tunas', min: 35, icon: '🌿', ms: 'Fasa Tunas', en: 'Sprout Stage', ind: 'Fase Tunas', ar: 'مرحلة البرعم',
    descMs: 'Asas sudah ada! Kini masa untuk menjadikan amalan baik lebih konsisten.',
    descEn: 'The foundation is there! Now it is time to make good deeds consistent.',
    descId: 'Dasarnya sudah ada! Sekarang saatnya membuat amalan baik lebih konsisten.',
    descAr: 'الأساس موجود! حان وقت المواظبة على الأعمال الصالحة.' },
  { id: 'pohon', min: 70, icon: '🌳', ms: 'Fasa Pohon', en: 'Tree Stage', ind: 'Fase Pohon', ar: 'مرحلة الشجرة',
    descMs: 'MasyaAllah! Amalan sudah kukuh. Pelan ini akan mengekalkan dan mencabar lagi.',
    descEn: 'MashaAllah! Strong habits already. This plan keeps them strong and stretches further.',
    descId: 'MasyaAllah! Amalan sudah kokoh. Rencana ini menjaga dan menantang lebih jauh.',
    descAr: 'ما شاء الله! عادات راسخة. هذه الخطة تحافظ عليها وتطوّرها.' },
]

export const PLAN_SIZE = { '3-4': 4, '5-6': 5, '7-9': 6, '10-12': 7 }

export const ageGroup = (age) => (age == null ? 'mid' : age <= 4 ? 'young' : age <= 8 ? 'mid' : 'old')
export const bandFromAge = (age) => (age == null || age < 0 ? '5-6' : age <= 4 ? '3-4' : age <= 6 ? '5-6' : age <= 9 ? '7-9' : '10-12')

const LK = (lang) => (lang === 'id' ? 'ind' : lang)   // 'id' is reserved for object ids
export const tx = (obj, lang) => (obj ? (obj[LK(lang)] ?? (lang === 'id' ? obj.ms : obj.en) ?? obj.en) : '')
export const qText = (q, lang, n, a) => (q[LK(lang)] || (lang === 'id' ? q.ms : q.en) || q.ms)(n, a)
export const stageDesc = (st, lang) => (lang === 'en' ? st.descEn : lang === 'id' ? st.descId : lang === 'ar' ? st.descAr : st.descMs)

/** Compute dimension scores (0-100), overall, stage, strengths & focus areas. */
export function scoreDiagnosis(practice = {}) {
  const dims = {}
  for (const d of Object.keys(DIMENSIONS)) {
    const qs = PRACTICE_QUESTIONS.filter(q => q.dim === d)
    const vals = qs.map(q => Number.isFinite(practice[q.id]) ? Math.max(0, Math.min(2, practice[q.id])) : 1)
    dims[d] = Math.round((vals.reduce((s, v) => s + v, 0) / (vals.length * 2)) * 100)
  }
  const overall = Math.round(Object.values(dims).reduce((s, v) => s + v, 0) / Object.keys(dims).length)
  const stage = [...STAGES].reverse().find(s => overall >= s.min) || STAGES[0]
  const sorted = Object.entries(dims).sort((a, b) => b[1] - a[1])
  const strengths = sorted.filter(([, v]) => v >= 50).slice(0, 2).map(([k]) => k)
  const focus = [...sorted].reverse().filter(([, v]) => v < 100).slice(0, 2).map(([k]) => k)
  return { dims, overall, stage: stage.id, strengths, focus }
}

/**
 * Build a personalised habit plan.
 * Returns [{ templateId, reason: { ms, en }, kind: 'focus'|'goal'|'routine'|'maintain' }]
 */
export function buildPlan({ age, practice = {}, goals = [], routine = {}, school = 'none', exclude = [] }) {
  const group = ageGroup(age)
  const band = bandFromAge(age)
  const size = PLAN_SIZE[band] || 5
  const skip = new Set(exclude)
  const eligible = (id) => TEMPLATE_BY_ID[id] && TEMPLATE_BY_ID[id].ageBands.includes(band) && !skip.has(id)

  const goalDims = new Set(goals.flatMap(g => GOALS.find(x => x.id === g)?.dims || []))
  const goalQs = new Set(goals.map(g => GOALS.find(x => x.id === g)?.q).filter(Boolean))

  const ranked = PRACTICE_QUESTIONS.map(q => {
    const lvl = Number.isFinite(practice[q.id]) ? practice[q.id] : 1
    let pr = (2 - lvl) * 3
    if (goalDims.has(q.dim)) pr += 2
    if (goalQs.has(q.id)) pr += 2
    if (q.id === 'q_tidur' && routine.bedtime === 'late') pr += 2
    if (q.id === 'q_solat' && routine.jemaah === 'rarely') pr += 1
    if (q.id === 'q_skrin' && routine.meals === 'rarely') pr += 1
    return { q, lvl, pr }
  }).sort((a, b) => b.pr - a.pr)

  const chosen = []
  const has = (id) => chosen.some(c => c.templateId === id)
  const add = (id, reason, kind) => { if (chosen.length < size && eligible(id) && !has(id)) { chosen.push({ templateId: id, reason, kind }); return true } return false }

  const dimName = (d) => DIMENSIONS[d]
  // Routine-driven essentials
  if (school !== 'none' && (age ?? 0) >= 7) {
    add('pb-03', { ms: 'Anak bersekolah — tabiat siapkan kerja rumah membina disiplin belajar.', en: 'School-going — a homework habit builds study discipline.', ind: 'Anak bersekolah — kebiasaan menyelesaikan PR membangun disiplin belajar.', ar: 'طفل في المدرسة — عادة إنجاز الواجبات تبني انضباط الدراسة.' }, 'routine')
  }
  // Pass 1 — one habit per area, highest priority first
  for (const { q, lvl } of ranked) {
    const list = q.tpl[group] || []
    const goalHit = goalDims.has(q.dim) || goalQs.has(q.id)
    const reason = lvl === 0
      ? { ms: `Fokus utama: ${dimName(q.dim).ms} masih di peringkat awal — mula dengan langkah kecil.`, en: `Main focus: ${dimName(q.dim).en} is just starting — begin with a small step.`, ind: `Fokus utama: ${dimName(q.dim).ind} masih di tahap awal — mulai dengan langkah kecil.`, ar: `التركيز الأساسي: ${dimName(q.dim).ar} في بدايته — ابدأ بخطوة صغيرة.` }
      : goalHit
        ? { ms: `Selari dengan matlamat anda untuk ${dimName(q.dim).ms.toLowerCase()}.`, en: `Matches your goal for ${dimName(q.dim).en.toLowerCase()}.`, ind: `Sesuai dengan tujuan Anda untuk ${dimName(q.dim).ind.toLowerCase()}.`, ar: `يتوافق مع هدفك في ${dimName(q.dim).ar}.` }
        : lvl === 1
          ? { ms: `Sudah kadang-kadang — habit harian akan jadikannya konsisten.`, en: `Already sometimes — a daily habit makes it consistent.`, ind: `Sudah kadang-kadang — kebiasaan harian akan membuatnya konsisten.`, ar: `يحدث أحياناً — العادة اليومية تجعله مواظباً.` }
          : { ms: `Kekuatan ${dimName(q.dim).ms} — kekalkan supaya terus subur.`, en: `A ${dimName(q.dim).en} strength — keep it growing.`, ind: `Kekuatan ${dimName(q.dim).ind} — pertahankan agar terus tumbuh.`, ar: `نقطة قوة في ${dimName(q.dim).ar} — حافظ عليها لتنمو.` }
    const kind = lvl === 0 ? 'focus' : goalHit ? 'goal' : lvl === 1 ? 'focus' : 'maintain'
    for (const id of list) { if (add(id, reason, kind)) break }
    if (chosen.length >= size) break
  }
  // Pass 2 — deepen the top-priority areas
  for (const { q, lvl } of ranked) {
    if (lvl === 2) continue
    for (const id of (q.tpl[group] || [])) {
      add(id, { ms: `Langkah kedua untuk mengukuhkan ${dimName(q.dim).ms.toLowerCase()}.`, en: `A second step to strengthen ${dimName(q.dim).en.toLowerCase()}.`, ind: `Langkah kedua untuk memperkuat ${dimName(q.dim).ind.toLowerCase()}.`, ar: `خطوة ثانية لتقوية ${dimName(q.dim).ar}.` }, 'focus')
    }
    if (chosen.length >= size) break
  }
  return chosen
}
