/**
 * EQrel tutorial content — 4 languages inline (ms, en, id, ar).
 * Consumed by <Tutorial /> component via useTutorial() hook.
 *
 * getTutorial(id, lang) → returns full config object ready to pass to <Tutorial />
 */

// Helper: pick language-specific value with graceful fallback to Malay
const T = (lang, dict) => dict?.[lang] || dict?.ms || ''

// Shared UI strings
const UI = {
  ctaNext:  { ms: 'Seterusnya', en: 'Next',    id: 'Berikutnya', ar: 'التالي' },
  ctaBack:  { ms: 'Kembali',    en: 'Back',    id: 'Kembali',    ar: 'رجوع' },
  ctaFinal: { ms: 'Faham! ✨',  en: 'Got it! ✨', id: 'Paham! ✨', ar: 'فهمت! ✨' },
  ctaSkip:  { ms: 'Langkau',    en: 'Skip',    id: 'Lewati',     ar: 'تخطّي' },
}

// ─────────────────────────────────────────────────────────────────
// Tutorial definitions

const TUTORIALS = {

  // ═══ KID ═══════════════════════════════════════════════════════
  kid_welcome: {
    mascot: '🌱',
    color: '#00B894',
    title: {
      ms: 'Selamat datang!',
      en: 'Welcome!',
      id: 'Selamat datang!',
      ar: 'أهلاً وسهلاً!',
    },
    subtitle: {
      ms: 'Cara guna EQrel',
      en: 'How EQrel works',
      id: 'Cara pakai EQrel',
      ar: 'كيف يعمل EQrel',
    },
    steps: {
      ms: [
        { icon: '🕌', title: 'Buat habits hari ini',   body: 'Habits macam solat, doa, atau tolong keluarga akan muncul di senarai kamu.' },
        { icon: '👆', title: 'Tap bulatan bila siap',   body: 'Bila kamu dah buat sesuatu, tap bulatan di sebelah kanan. Ibu/bapa akan check.',   hint: 'Ada 5 kategori — Ibadah, Akhlak, Pembelajaran, Kesihatan, Keluarga.' },
        { icon: '✨', title: 'Dapat Mata!',            body: 'Bila ibu/bapa sahkan, kamu dapat Mata Bina & Mata Reward. Gunakan Mata Reward untuk beli barang di Kedai!' },
      ],
      en: [
        { icon: '🕌', title: 'Do today\u2019s habits',   body: 'Habits like prayers, du\u2019a, or helping family show up in your list.' },
        { icon: '👆', title: 'Tap the circle when done', body: 'When you\u2019ve done something, tap the circle on the right. Mum/dad will verify.', hint: 'There are 5 categories — Ibadah, Akhlak, Learning, Health, Family.' },
        { icon: '✨', title: 'Earn Points!',           body: 'When your parent confirms, you earn Build & Reward Points. Spend Reward Points at the Shop!' },
      ],
      id: [
        { icon: '🕌', title: 'Lakukan kebiasaan hari ini', body: 'Kebiasaan seperti sholat, doa, atau bantu keluarga muncul di daftar kamu.' },
        { icon: '👆', title: 'Tap lingkaran saat selesai', body: 'Setelah kamu melakukan sesuatu, tap lingkaran di kanan. Orang tua akan mengecek.', hint: 'Ada 5 kategori — Ibadah, Akhlak, Belajar, Kesehatan, Keluarga.' },
        { icon: '✨', title: 'Dapatkan Poin!',          body: 'Saat orang tua konfirmasi, kamu dapat Poin Bina & Poin Reward. Gunakan Poin Reward di Toko!' },
      ],
      ar: [
        { icon: '🕌', title: 'أنجز عادات اليوم',       body: 'العادات مثل الصلاة، الدعاء، أو مساعدة الأسرة ستظهر في قائمتك.' },
        { icon: '👆', title: 'اضغط الدائرة عند الإنجاز', body: 'بعد أن تفعل شيئًا، اضغط الدائرة على اليمين. الأم/الأب سيتحقّق.', hint: 'هناك 5 فئات — العبادة، الأخلاق، التعلّم، الصحّة، الأسرة.' },
        { icon: '✨', title: 'اكسب النقاط!',           body: 'عندما يؤكّد والدك، تكسب نقاط البناء ونقاط المكافآت. استخدم نقاط المكافآت في المتجر!' },
      ],
    },
  },

  kid_categories: {
    mascot: '🎯',
    color: '#2D9CDB',
    title: {
      ms: 'Chip Kategori',
      en: 'Category Chips',
      id: 'Chip Kategori',
      ar: 'رقاقات الفئات',
    },
    subtitle: {
      ms: 'Tahu mana perlu fokus',
      en: 'Know what to focus on',
      id: 'Tahu mana harus fokus',
      ar: 'اعرف ما يجب التركيز عليه',
    },
    steps: {
      ms: [
        { icon: '📊', title: '6 chip di atas',          body: 'Setiap chip menunjukkan satu kategori. Ada nombor "3/5" — bermaksud 3 siap daripada 5.' },
        { icon: '🎨', title: 'Warna beritahu status',   body: 'Kuning = belum mula, hijau + ✅ = semua siap!',                                       hint: 'Warna kuning = kamu kena fokus dulu di situ.' },
        { icon: '👆', title: 'Tap untuk fokus',         body: 'Tap chip untuk tapis dan lihat satu kategori sahaja. Tap "Semua" untuk kembali.' },
      ],
      en: [
        { icon: '📊', title: '6 chips at the top',      body: 'Each chip is one category. The "3/5" number means 3 done out of 5.' },
        { icon: '🎨', title: 'Colors show status',       body: 'Amber = not started, green + ✅ = all done!',                                       hint: 'Amber means you should focus there first.' },
        { icon: '👆', title: 'Tap to focus',            body: 'Tap a chip to filter and see only that category. Tap "All" to reset.' },
      ],
      id: [
        { icon: '📊', title: '6 chip di atas',           body: 'Setiap chip adalah satu kategori. "3/5" berarti 3 selesai dari 5.' },
        { icon: '🎨', title: 'Warna menunjukkan status', body: 'Kuning = belum mulai, hijau + ✅ = semua selesai!',                                 hint: 'Kuning berarti kamu perlu fokus di sana dulu.' },
        { icon: '👆', title: 'Tap untuk fokus',         body: 'Tap chip untuk saring satu kategori saja. Tap "Semua" untuk kembali.' },
      ],
      ar: [
        { icon: '📊', title: '6 رقاقات في الأعلى',       body: 'كل رقاقة تمثل فئة واحدة. الرقم "3/5" يعني 3 من 5 مكتملة.' },
        { icon: '🎨', title: 'الألوان تظهر الحالة',       body: 'كهرماني = لم يبدأ، أخضر + ✅ = مكتمل!',                                             hint: 'الكهرماني يعني أن عليك التركيز هناك أوّلاً.' },
        { icon: '👆', title: 'اضغط للتركيز',            body: 'اضغط رقاقة لتصفية فئة واحدة فقط. اضغط "الكل" للرجوع.' },
      ],
    },
  },

  kid_rewards: {
    mascot: '🎁',
    color: '#9333EA',
    title: {
      ms: 'Kedai Reward',
      en: 'Reward Shop',
      id: 'Toko Reward',
      ar: 'متجر المكافآت',
    },
    subtitle: {
      ms: 'Guna Mata Reward untuk beli barang',
      en: 'Spend Reward Points on treats',
      id: 'Pakai Poin Reward untuk membeli',
      ar: 'استخدم نقاط المكافآت للشراء',
    },
    steps: {
      ms: [
        { icon: '🛒', title: 'Pilih reward',            body: 'Lihat semua reward. Yang cerah bermakna kamu mampu beli. Yang samar — belum cukup Mata.' },
        { icon: '📩', title: 'Hantar permintaan',       body: 'Tap reward → permintaan dihantar. Tunggu ibu/bapa luluskan.' },
        { icon: '💡', title: 'Cadang reward baru',      body: 'Tak jumpa apa yang kamu nak? Tekan "+ Cadang reward baru" untuk hantar idea kamu sendiri!', hint: 'Ibu/bapa boleh ubah harga sebelum lulus.' },
      ],
      en: [
        { icon: '🛒', title: 'Pick a reward',           body: 'Browse all rewards. Bright ones you can afford. Faded ones cost more than you have.' },
        { icon: '📩', title: 'Send a request',          body: 'Tap a reward → the request is sent. Wait for parent to approve.' },
        { icon: '💡', title: 'Propose a new reward',    body: 'Don\u2019t see what you want? Tap "+ Propose new reward" to send your own idea!',       hint: 'Parents can adjust the price before approving.' },
      ],
      id: [
        { icon: '🛒', title: 'Pilih reward',            body: 'Lihat semua reward. Yang cerah bisa kamu beli, yang samar butuh lebih banyak poin.' },
        { icon: '📩', title: 'Kirim permintaan',        body: 'Tap reward → permintaan terkirim. Tunggu orang tua menyetujui.' },
        { icon: '💡', title: 'Usulkan reward baru',     body: 'Tidak ada yang kamu mau? Tap "+ Usulkan reward baru" untuk kirim idemu!',              hint: 'Orang tua bisa mengubah harga sebelum menyetujui.' },
      ],
      ar: [
        { icon: '🛒', title: 'اختر مكافأة',              body: 'تصفّح كل المكافآت. الساطعة تقدر عليها، والباهتة تحتاج نقاطاً أكثر.' },
        { icon: '📩', title: 'أرسل طلبًا',              body: 'اضغط المكافأة → يُرسل الطلب. انتظر موافقة الوالد.' },
        { icon: '💡', title: 'اقترح مكافأة جديدة',       body: 'لم تجد ما تريده؟ اضغط "+ اقترح مكافأة جديدة" لإرسال فكرتك!',                        hint: 'يمكن للوالدين تعديل السعر قبل الموافقة.' },
      ],
    },
  },

  // ═══ PARENT ════════════════════════════════════════════════════
  parent_reward_shop: {
    mascot: '🎁',
    color: '#FFB703',
    title: {
      ms: 'Kedai Reward — Panduan Ibu/Bapa',
      en: 'Reward Shop — Parent Guide',
      id: 'Toko Reward — Panduan Orang Tua',
      ar: 'متجر المكافآت — دليل الوالدين',
    },
    subtitle: {
      ms: 'Cara guna 3 tab',
      en: 'Using the 3 tabs',
      id: 'Cara pakai 3 tab',
      ar: 'استخدام التبويبات الثلاثة',
    },
    steps: {
      ms: [
        { icon: '📥', title: 'Tab Permintaan',   body: 'Anak minta beli reward → luluskan atau tolak. Bila anak dah dapat reward, tekan "Serah".' },
        { icon: '💡', title: 'Tab Cadangan',     body: 'Anak boleh cadang reward baru sendiri. Awak boleh ubah harga sebelum luluskan.',           hint: 'Cadangan diluluskan → automatik jadi custom reward keluarga.' },
        { icon: '📚', title: 'Tab Katalog',      body: 'Ada 15 template siap + reward custom awak sendiri. Tekan "+ Tambah" untuk cipta baru.' },
        { icon: '✨', title: 'Ihsan = Mata Reward', body: 'Anak dapat Mata Reward hanya bila awak tanda "Ihsan" di Verify Queue. Belanja mata di sini!' },
      ],
      en: [
        { icon: '📥', title: 'Requests tab',     body: 'Kid asks to buy a reward → approve or reject. Once delivered, tap "Fulfill".' },
        { icon: '💡', title: 'Proposals tab',    body: 'Kids can propose new rewards. You can edit the price before approving.',                   hint: 'Approved proposals become family custom rewards automatically.' },
        { icon: '📚', title: 'Catalog tab',      body: '15 built-in templates + your own custom rewards. Tap "+ Add" to create new ones.' },
        { icon: '✨', title: 'Ihsan = Reward Points', body: 'Kids only earn Reward Points when you mark "Ihsan" in the Verify Queue. Spend them here!' },
      ],
      id: [
        { icon: '📥', title: 'Tab Permintaan',   body: 'Anak minta beli reward → setujui atau tolak. Setelah diterima, tap "Serahkan".' },
        { icon: '💡', title: 'Tab Usulan',       body: 'Anak bisa mengusulkan reward baru. Kamu dapat ubah harga sebelum menyetujui.',              hint: 'Usulan disetujui → jadi reward kustom keluarga otomatis.' },
        { icon: '📚', title: 'Tab Katalog',      body: '15 template + reward kustom kamu. Tap "+ Tambah" untuk membuat baru.' },
        { icon: '✨', title: 'Ihsan = Poin Reward', body: 'Anak dapat Poin Reward hanya saat kamu menandai "Ihsan" di Verify Queue. Belanjakan di sini!' },
      ],
      ar: [
        { icon: '📥', title: 'تبويب الطلبات',     body: 'يطلب الطفل شراء مكافأة → وافق أو ارفض. عند التسليم اضغط "تسليم".' },
        { icon: '💡', title: 'تبويب الاقتراحات',   body: 'الأطفال يمكنهم اقتراح مكافآت جديدة. يمكنك تعديل السعر قبل الموافقة.',                    hint: 'الاقتراحات المقبولة تصبح مكافآت مخصّصة تلقائيًا.' },
        { icon: '📚', title: 'تبويب الكتالوج',    body: '15 قالبًا جاهزًا + مكافآتك المخصّصة. اضغط "+ إضافة" لإنشاء واحدة جديدة.' },
        { icon: '✨', title: 'الإحسان = نقاط المكافآت', body: 'يكسب الطفل نقاط المكافآت فقط عند اختيارك "إحسان" في قائمة التحقّق. أنفقها هنا!' },
      ],
    },
  },

  parent_habit_categories: {
    mascot: '📊',
    color: '#00B894',
    title: {
      ms: 'Kategori & Chip Fokus',
      en: 'Categories & Focus Chips',
      id: 'Kategori & Chip Fokus',
      ar: 'الفئات ورقاقات التركيز',
    },
    subtitle: {
      ms: 'Fokus jelas untuk setiap anak',
      en: 'Clear focus for each child',
      id: 'Fokus jelas untuk tiap anak',
      ar: 'تركيز واضح لكلّ طفل',
    },
    steps: {
      ms: [
        { icon: '🎯', title: '5 kategori',        body: 'Ibadah 🕌, Akhlak 💛, Pembelajaran 📚, Kesihatan 🪥, Keluarga 👨‍👩‍👧 — susun habits ikut kategori.' },
        { icon: '📊', title: 'Chip menunjukkan progress', body: 'Setiap chip ada nombor (contoh 2/5) + ring warna kategori. Kuning = kena fokus, hijau = semua siap.' },
        { icon: '👆', title: 'Tap untuk tapis',   body: 'Tap chip untuk lihat satu kategori sahaja. Cepat plan hari kamu!',                    hint: 'Long-press butang habit untuk pilih Ihsan/Sah semasa log.' },
      ],
      en: [
        { icon: '🎯', title: '5 categories',      body: 'Ibadah 🕌, Akhlak 💛, Learning 📚, Health 🪥, Family 👨‍👩‍👧 — organize habits by category.' },
        { icon: '📊', title: 'Chips show progress', body: 'Each chip has a number (e.g. 2/5) + a colored ring. Amber = focus here, green = all done.' },
        { icon: '👆', title: 'Tap to filter',      body: 'Tap a chip to see just that category. Plan your day faster!',                          hint: 'Long-press a habit\u2019s check button to pick Ihsan/Sah while logging.' },
      ],
      id: [
        { icon: '🎯', title: '5 kategori',        body: 'Ibadah 🕌, Akhlak 💛, Belajar 📚, Kesehatan 🪥, Keluarga 👨‍👩‍👧 — atur kebiasaan per kategori.' },
        { icon: '📊', title: 'Chip menunjukkan progres', body: 'Setiap chip punya angka (mis. 2/5) + cincin warna. Kuning = fokus, hijau = selesai.' },
        { icon: '👆', title: 'Tap untuk saring',  body: 'Tap chip untuk lihat satu kategori saja. Rencana hari lebih cepat!',                    hint: 'Tekan lama tombol habit untuk pilih Ihsan/Sah saat mencatat.' },
      ],
      ar: [
        { icon: '🎯', title: '5 فئات',            body: 'العبادة 🕌، الأخلاق 💛، التعلّم 📚، الصحة 🪥، الأسرة 👨‍👩‍👧 — نظّم العادات حسب الفئة.' },
        { icon: '📊', title: 'الرقاقات تُظهر التقدّم', body: 'كل رقاقة بها رقم (مثل 2/5) وحلقة ملوّنة. كهرماني = ركّز، أخضر = مكتمل.' },
        { icon: '👆', title: 'اضغط للتصفية',       body: 'اضغط رقاقة لعرض فئة واحدة فقط. خطّط ليومك أسرع!',                                   hint: 'اضغط مطوّلاً على زر العادة لاختيار إحسان/صحّ أثناء التسجيل.' },
      ],
    },
  },
}

// ─────────────────────────────────────────────────────────────────
// Public API

export function getTutorial(id, lang = 'ms') {
  const tut = TUTORIALS[id]
  if (!tut) return null
  return {
    mascot: tut.mascot,
    color: tut.color,
    title:    T(lang, tut.title),
    subtitle: T(lang, tut.subtitle),
    steps: (tut.steps?.[lang] || tut.steps?.ms || []),
    ctaNext:  T(lang, UI.ctaNext),
    ctaBack:  T(lang, UI.ctaBack),
    ctaFinal: T(lang, UI.ctaFinal),
    ctaSkip:  T(lang, UI.ctaSkip),
  }
}

export const TUTORIAL_IDS = Object.keys(TUTORIALS)
