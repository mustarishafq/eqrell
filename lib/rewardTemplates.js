/**
 * EQrel Reward Templates — 15 starter rewards (Cohort A)
 * Muslim-family focused mix of worldly + spiritual rewards.
 * Cost measured in Mata Reward (earned via Ihsan grants — flat +5 per Ihsan verification).
 *
 * Pricing philosophy (kids earn ~10-15 Mata Reward/day when averaging 2-3 Ihsan grants):
 *   • Small  (25–50)  = ~3–7 days of consistent excellence  → weekly treats
 *   • Medium (80–150) = ~2–3 weeks of consistent excellence → monthly outings
 *   • Large  (200–500)= ~1–2 months of consistent excellence → special events
 * The gap between tiers means kids must sustain Ihsan effort — not just claim
 * habits — to unlock the larger rewards. Spiritual reward (rw-12) intentionally
 * priced slightly below its worldly peers to encourage Islamic learning.
 */

export const REWARD_CATEGORIES = {
  screen:    { id: 'screen',    icon: '📺', color: '#7C3AED' },
  food:      { id: 'food',      icon: '🍜', color: '#F97316' },
  learning:  { id: 'learning',  icon: '📚', color: '#2D9CDB' },
  outing:    { id: 'outing',    icon: '🌳', color: '#10B981' },
  activity:  { id: 'activity',  icon: '🎨', color: '#EC4899' },
  spiritual: { id: 'spiritual', icon: '🕌', color: '#059669' },
}

/** Locale-aware category label. */
export function getRewardCategoryLabel(catId, t) {
  const key = 'rw_cat_' + catId
  return (t && t[key]) || catId
}

export const REWARD_TEMPLATES = [
  // ── Small (25–50) — weekly treats, ~3–7 days of Ihsan ──
  { id: 'rw-01', category: 'screen',    icon: '📺', cost: 25 },   // Screen time 15min
  { id: 'rw-02', category: 'food',      icon: '🍪', cost: 30 },   // Favourite snack
  { id: 'rw-03', category: 'food',      icon: '🍦', cost: 40 },   // Special ice cream
  { id: 'rw-04', category: 'learning',  icon: '📖', cost: 35 },   // Extra bedtime story
  { id: 'rw-05', category: 'food',      icon: '🍜', cost: 50 },   // Choose family dinner

  // ── Medium (80–150) — monthly outings, ~2–3 weeks of Ihsan ──
  { id: 'rw-06', category: 'outing',    icon: '🌳', cost: 80 },   // Park trip
  { id: 'rw-07', category: 'learning',  icon: '📚', cost: 100 },  // New storybook
  { id: 'rw-08', category: 'outing',    icon: '👥', cost: 120 },  // Playdate
  { id: 'rw-09', category: 'activity',  icon: '🧸', cost: 150 },  // Small toy
  { id: 'rw-10', category: 'activity',  icon: '🎬', cost: 150 },  // Movie night pick

  // ── Large (200–500) — special events, 1–2 months of Ihsan ──
  { id: 'rw-11', category: 'outing',    icon: '📕', cost: 250 },  // Bookstore trip
  { id: 'rw-12', category: 'spiritual', icon: '🕌', cost: 200 },  // Islamic bookstore (encourage!)
  { id: 'rw-13', category: 'activity',  icon: '🎨', cost: 300 },  // Craft / Lego set
  { id: 'rw-14', category: 'food',      icon: '🍽️', cost: 400 }, // Restaurant of your pick
  { id: 'rw-15', category: 'outing',    icon: '🛏️', cost: 500 }, // Sleepover with cousins
]

// Localised title + desc per template
export const REWARD_TEMPLATE_I18N = {
  'rw-01': {
    ms: { title: 'Skrin masa 15 minit',      desc: 'YouTube Kids, cartoon, atau game — 15 minit ekstra.' },
    en: { title: 'Screen time 15 min',       desc: 'YouTube Kids, cartoons, or games — 15 extra minutes.' },
    id: { title: 'Waktu layar 15 menit',     desc: 'YouTube Kids, kartun, atau game — 15 menit ekstra.' },
    ar: { title: 'وقت شاشة 15 دقيقة',        desc: 'يوتيوب كيدز، كرتون، أو لعبة — 15 دقيقة إضافية.' },
  },
  'rw-02': {
    ms: { title: 'Snek pilihan',             desc: 'Pilih snek kegemaran dari rumah atau kedai.' },
    en: { title: 'Favourite snack',          desc: 'Pick your favourite snack from home or the shop.' },
    id: { title: 'Cemilan favorit',          desc: 'Pilih cemilan favorit dari rumah atau toko.' },
    ar: { title: 'وجبة خفيفة مفضّلة',        desc: 'اختر وجبتك الخفيفة المفضّلة من البيت أو المتجر.' },
  },
  'rw-03': {
    ms: { title: 'Ais krim istimewa',        desc: 'Satu skop / cone ais krim pilihan.' },
    en: { title: 'Special ice cream',        desc: 'One scoop or cone of your choice.' },
    id: { title: 'Es krim istimewa',         desc: 'Satu skop atau cone es krim pilihan.' },
    ar: { title: 'آيس كريم مميّز',           desc: 'ملعقة أو كوز آيس كريم من اختيارك.' },
  },
  'rw-04': {
    ms: { title: 'Cerita tidur ekstra',      desc: 'Bacaan cerita tambahan 10 minit sebelum tidur.' },
    en: { title: 'Extra bedtime story',      desc: '10 extra minutes of a bedtime story.' },
    id: { title: 'Cerita tidur ekstra',      desc: '10 menit tambahan cerita sebelum tidur.' },
    ar: { title: 'قصة نوم إضافية',           desc: '10 دقائق إضافية من قصة قبل النوم.' },
  },
  'rw-05': {
    ms: { title: 'Pilih menu makan malam',   desc: 'Pilih menu untuk seisi keluarga malam ini.' },
    en: { title: 'Choose family dinner',     desc: 'Pick tonight’s dinner menu for the whole family.' },
    id: { title: 'Pilih menu makan malam',   desc: 'Pilih menu makan malam untuk seluruh keluarga.' },
    ar: { title: 'اختر عشاء العائلة',        desc: 'اختر قائمة العشاء لجميع أفراد الأسرة الليلة.' },
  },
  'rw-06': {
    ms: { title: 'Jalan-jalan taman',        desc: 'Trip ke taman permainan atau taman rekreasi.' },
    en: { title: 'Trip to the park',         desc: 'Visit to the playground or recreational park.' },
    id: { title: 'Jalan ke taman',           desc: 'Kunjungan ke taman bermain atau taman rekreasi.' },
    ar: { title: 'نزهة إلى الحديقة',         desc: 'زيارة إلى ملعب أو حديقة ترفيهية.' },
  },
  'rw-07': {
    ms: { title: 'Buku cerita baharu',       desc: 'Sebuah buku cerita/aktiviti pilihan anak.' },
    en: { title: 'A new storybook',          desc: 'A new story or activity book of your choice.' },
    id: { title: 'Buku cerita baru',         desc: 'Sebuah buku cerita atau aktivitas pilihanmu.' },
    ar: { title: 'كتاب قصصي جديد',           desc: 'كتاب قصص أو نشاط من اختيارك.' },
  },
  'rw-08': {
    ms: { title: 'Playdate dengan kawan',    desc: 'Jemput kawan datang main / pergi main bersama.' },
    en: { title: 'Playdate with friend',     desc: 'Invite a friend over or go visit them.' },
    id: { title: 'Main dengan teman',        desc: 'Undang teman ke rumah atau kunjungi mereka.' },
    ar: { title: 'موعد لعب مع صديق',         desc: 'ادعُ صديقاً إلى البيت أو زُر صديقك.' },
  },
  'rw-09': {
    ms: { title: 'Mainan kecil',             desc: 'Sebuah mainan bawah bajet parent.' },
    en: { title: 'A small toy',              desc: 'A small toy within parent’s budget.' },
    id: { title: 'Mainan kecil',             desc: 'Mainan kecil dalam anggaran orang tua.' },
    ar: { title: 'لعبة صغيرة',               desc: 'لعبة صغيرة ضمن ميزانية الوالدين.' },
  },
  'rw-10': {
    ms: { title: 'Movie night pilihan',      desc: 'Pilih filem untuk ditonton seisi keluarga.' },
    en: { title: 'Movie night pick',         desc: 'Choose a family movie for tonight.' },
    id: { title: 'Movie night pilihan',      desc: 'Pilih film untuk ditonton bersama keluarga.' },
    ar: { title: 'اختيار فيلم العائلة',      desc: 'اختر فيلم العائلة لهذه الليلة.' },
  },
  'rw-11': {
    ms: { title: 'Trip ke kedai buku',       desc: 'Pergi ke kedai buku, pilih 1 buku.' },
    en: { title: 'Bookstore trip',           desc: 'Visit a bookstore and pick one book.' },
    id: { title: 'Ke toko buku',             desc: 'Kunjungi toko buku dan pilih satu buku.' },
    ar: { title: 'زيارة مكتبة',              desc: 'زيارة مكتبة واختيار كتاب واحد.' },
  },
  'rw-12': {
    ms: { title: 'Kedai buku Islamik',       desc: 'Trip khas ke kedai buku Islamik, pilih 1 item.' },
    en: { title: 'Islamic bookstore',        desc: 'Visit an Islamic bookstore, pick one item.' },
    id: { title: 'Toko buku Islami',         desc: 'Kunjungi toko buku Islami, pilih satu barang.' },
    ar: { title: 'مكتبة إسلامية',            desc: 'زيارة مكتبة إسلامية واختيار عنصر واحد.' },
  },
  'rw-13': {
    ms: { title: 'Set craft / Lego kecil',   desc: 'Set craft, colouring atau Lego kecil.' },
    en: { title: 'Craft or small Lego set',  desc: 'A craft, colouring, or small Lego set.' },
    id: { title: 'Kerajinan / Lego kecil',   desc: 'Set kerajinan, mewarnai, atau Lego kecil.' },
    ar: { title: 'مجموعة حرف/ليجو صغيرة',    desc: 'مجموعة حرف يدوية أو تلوين أو ليجو صغيرة.' },
  },
  'rw-14': {
    ms: { title: 'Restoran pilihan',         desc: 'Makan di restoran pilihan bersama keluarga.' },
    en: { title: 'Restaurant of your pick',  desc: 'Family meal at a restaurant of your choice.' },
    id: { title: 'Restoran pilihan',         desc: 'Makan di restoran pilihanmu bersama keluarga.' },
    ar: { title: 'مطعم من اختيارك',          desc: 'وجبة عائلية في مطعم من اختيارك.' },
  },
  'rw-15': {
    ms: { title: 'Sleepover dengan sepupu',  desc: 'Bermalam di rumah sepupu / datuk nenek.' },
    en: { title: 'Sleepover with cousins',   desc: 'Sleep over at cousins’ or grandparents’ place.' },
    id: { title: 'Menginap dengan sepupu',   desc: 'Menginap di rumah sepupu atau kakek/nenek.' },
    ar: { title: 'مبيت مع الأقارب',          desc: 'مبيت في بيت الأقارب أو الأجداد.' },
  },
}

export function getRewardTitle(reward, lang = 'ms') {
  if (!reward) return ''
  const entry = REWARD_TEMPLATE_I18N[reward.id]?.[lang] || REWARD_TEMPLATE_I18N[reward.id]?.ms
  return entry?.title || reward.title || reward.id
}

export function getRewardDesc(reward, lang = 'ms') {
  if (!reward) return ''
  const entry = REWARD_TEMPLATE_I18N[reward.id]?.[lang] || REWARD_TEMPLATE_I18N[reward.id]?.ms
  return entry?.desc || reward.desc || ''
}

export const REWARD_BY_ID = Object.fromEntries(REWARD_TEMPLATES.map(r => [r.id, r]))
