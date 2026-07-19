/**
 * EQrel Quiz Bank — Islamic knowledge quiz for kids.
 * Question format: { id, ageBand, category, prompt, choices: [], correctIdx, emoji }
 *
 * Age bands: '3-6' (early), '7-9' (mid), '10-12' (elder)
 * Categories: 'rukun' (pillars), 'nabi' (prophet stories),
 *             'doa' (daily du'a), 'akhlak' (manners), 'quran' (Quran facts)
 *
 * IMPORTANT: 4 choices always. correctIdx 0-3. Malay first as source of truth.
 * Multilingual variants keyed by lang code — falls back to ms.
 */

// Helper: choice picker with locale fallback
export const pickText = (dict, lang = 'ms') => dict?.[lang] || dict?.ms || ''

export const QUIZ_QUESTIONS = [
  // ═══ RUKUN ISLAM ═══════════════════════════════════════════════
  {
    id: 'q-rukun-01',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'rukun',
    emoji: '🕌',
    prompt: { ms: 'Berapa rukun Islam?', en: 'How many pillars of Islam are there?', id: 'Berapa rukun Islam?', ar: 'كم عدد أركان الإسلام؟' },
    choices: [
      { ms: '3', en: '3', id: '3', ar: '٣' },
      { ms: '5', en: '5', id: '5', ar: '٥' },
      { ms: '7', en: '7', id: '7', ar: '٧' },
      { ms: '10', en: '10', id: '10', ar: '١٠' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-rukun-02',
    ageBand: ['7-9', '10-12'],
    category: 'rukun',
    emoji: '🤲',
    prompt: { ms: 'Berapa kali kita solat sehari?', en: 'How many prayers a day?', id: 'Berapa kali sholat sehari?', ar: 'كم صلاة في اليوم؟' },
    choices: [
      { ms: '3', en: '3', id: '3', ar: '٣' },
      { ms: '4', en: '4', id: '4', ar: '٤' },
      { ms: '5', en: '5', id: '5', ar: '٥' },
      { ms: '6', en: '6', id: '6', ar: '٦' },
    ],
    correctIdx: 2,
  },
  {
    id: 'q-rukun-03',
    ageBand: ['7-9', '10-12'],
    category: 'rukun',
    emoji: '🌙',
    prompt: { ms: 'Bulan apa umat Islam berpuasa?', en: 'Which month do Muslims fast?', id: 'Bulan apa umat Islam berpuasa?', ar: 'في أي شهر يصوم المسلمون؟' },
    choices: [
      { ms: 'Syaaban', en: 'Sha\u2019ban', id: 'Syaban', ar: 'شعبان' },
      { ms: 'Ramadan', en: 'Ramadan', id: 'Ramadan', ar: 'رمضان' },
      { ms: 'Syawal', en: 'Shawwal', id: 'Syawal', ar: 'شوّال' },
      { ms: 'Rejab', en: 'Rajab', id: 'Rajab', ar: 'رجب' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-rukun-04',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'rukun',
    emoji: '🕋',
    prompt: { ms: 'Bila solat, kita menghadap ke mana?', en: 'When praying, we face which direction?', id: 'Saat sholat, kita menghadap ke mana?', ar: 'إلى أين نتّجه في الصلاة؟' },
    choices: [
      { ms: 'Kiblat / Kaabah', en: 'Qiblah / Kaabah', id: 'Kiblat / Kabah', ar: 'القبلة / الكعبة' },
      { ms: 'Matahari', en: 'The Sun', id: 'Matahari', ar: 'الشمس' },
      { ms: 'Bulan', en: 'The Moon', id: 'Bulan', ar: 'القمر' },
      { ms: 'Utara', en: 'North', id: 'Utara', ar: 'الشمال' },
    ],
    correctIdx: 0,
  },
  // ═══ NABI / PROPHET STORIES ════════════════════════════════════
  {
    id: 'q-nabi-01',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'nabi',
    emoji: '🌟',
    prompt: { ms: 'Siapa nabi terakhir umat Islam?', en: 'Who is the final prophet?', id: 'Siapa nabi terakhir umat Islam?', ar: 'من هو خاتم الأنبياء؟' },
    choices: [
      { ms: 'Nabi Musa عليه السلام', en: 'Prophet Musa (as)', id: 'Nabi Musa AS', ar: 'موسى عليه السلام' },
      { ms: 'Nabi Isa عليه السلام', en: 'Prophet Isa (as)', id: 'Nabi Isa AS', ar: 'عيسى عليه السلام' },
      { ms: 'Nabi Muhammad ﷺ', en: 'Prophet Muhammad ﷺ', id: 'Nabi Muhammad ﷺ', ar: 'محمد ﷺ' },
      { ms: 'Nabi Ibrahim عليه السلام', en: 'Prophet Ibrahim (as)', id: 'Nabi Ibrahim AS', ar: 'إبراهيم عليه السلام' },
    ],
    correctIdx: 2,
  },
  {
    id: 'q-nabi-02',
    ageBand: ['7-9', '10-12'],
    category: 'nabi',
    emoji: '🐋',
    prompt: { ms: 'Nabi manakah yang ditelan ikan besar?', en: 'Which prophet was swallowed by a big fish?', id: 'Nabi mana yang ditelan ikan besar?', ar: 'أي نبي ابتلعه الحوت؟' },
    choices: [
      { ms: 'Nabi Yunus عليه السلام', en: 'Prophet Yunus (as)', id: 'Nabi Yunus AS', ar: 'يونس عليه السلام' },
      { ms: 'Nabi Nuh عليه السلام', en: 'Prophet Nuh (as)', id: 'Nabi Nuh AS', ar: 'نوح عليه السلام' },
      { ms: 'Nabi Yusuf عليه السلام', en: 'Prophet Yusuf (as)', id: 'Nabi Yusuf AS', ar: 'يوسف عليه السلام' },
      { ms: 'Nabi Sulaiman عليه السلام', en: 'Prophet Sulaiman (as)', id: 'Nabi Sulaiman AS', ar: 'سليمان عليه السلام' },
    ],
    correctIdx: 0,
  },
  {
    id: 'q-nabi-03',
    ageBand: ['7-9', '10-12'],
    category: 'nabi',
    emoji: '🐜',
    prompt: { ms: 'Nabi manakah yang boleh bercakap dengan haiwan?', en: 'Which prophet could speak with animals?', id: 'Nabi mana yang bisa bicara dengan hewan?', ar: 'أي نبي كان يتكلم مع الحيوانات؟' },
    choices: [
      { ms: 'Nabi Adam عليه السلام', en: 'Prophet Adam (as)', id: 'Nabi Adam AS', ar: 'آدم عليه السلام' },
      { ms: 'Nabi Sulaiman عليه السلام', en: 'Prophet Sulaiman (as)', id: 'Nabi Sulaiman AS', ar: 'سليمان عليه السلام' },
      { ms: 'Nabi Idris عليه السلام', en: 'Prophet Idris (as)', id: 'Nabi Idris AS', ar: 'إدريس عليه السلام' },
      { ms: 'Nabi Ismail عليه السلام', en: 'Prophet Ismail (as)', id: 'Nabi Ismail AS', ar: 'إسماعيل عليه السلام' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-nabi-04',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'nabi',
    emoji: '👶',
    prompt: { ms: 'Siapa nabi pertama umat manusia?', en: 'Who is the first prophet?', id: 'Siapa nabi pertama umat manusia?', ar: 'من هو أول الأنبياء؟' },
    choices: [
      { ms: 'Nabi Nuh عليه السلام', en: 'Prophet Nuh (as)', id: 'Nabi Nuh AS', ar: 'نوح عليه السلام' },
      { ms: 'Nabi Adam عليه السلام', en: 'Prophet Adam (as)', id: 'Nabi Adam AS', ar: 'آدم عليه السلام' },
      { ms: 'Nabi Ibrahim عليه السلام', en: 'Prophet Ibrahim (as)', id: 'Nabi Ibrahim AS', ar: 'إبراهيم عليه السلام' },
      { ms: 'Nabi Muhammad ﷺ', en: 'Prophet Muhammad ﷺ', id: 'Nabi Muhammad ﷺ', ar: 'محمد ﷺ' },
    ],
    correctIdx: 1,
  },
  // ═══ DOA / DAILY DU'A ══════════════════════════════════════════
  {
    id: 'q-doa-01',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'doa',
    emoji: '🍽️',
    prompt: { ms: 'Kita baca doa sebelum...', en: 'We say du\u2019a before...', id: 'Kita baca doa sebelum...', ar: 'نقرأ الدعاء قبل...' },
    choices: [
      { ms: 'Tidur sahaja', en: 'Only sleep', id: 'Tidur saja', ar: 'النوم فقط' },
      { ms: 'Makan sahaja', en: 'Only eating', id: 'Makan saja', ar: 'الأكل فقط' },
      { ms: 'Setiap perkara baik', en: 'Every good thing', id: 'Setiap hal baik', ar: 'كل شيء طيّب' },
      { ms: 'Mandi sahaja', en: 'Only bathing', id: 'Mandi saja', ar: 'الاستحمام فقط' },
    ],
    correctIdx: 2,
  },
  {
    id: 'q-doa-02',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'doa',
    emoji: '💤',
    prompt: { ms: 'Apa kita ucapkan sebelum tidur?', en: 'What do we say before sleeping?', id: 'Apa yang kita ucapkan sebelum tidur?', ar: 'ماذا نقول قبل النوم؟' },
    choices: [
      { ms: 'Selamat malam', en: 'Good night', id: 'Selamat malam', ar: 'تصبح على خير' },
      { ms: 'Bismika Allahumma...', en: 'Bismika Allahumma...', id: 'Bismika Allahumma...', ar: 'باسمك اللهم أحيا وأموت' },
      { ms: 'Hurrah!', en: 'Hurrah!', id: 'Hurrah!', ar: 'هوره!' },
      { ms: 'Tiada apa-apa', en: 'Nothing', id: 'Tidak ada', ar: 'لا شيء' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-doa-03',
    ageBand: ['7-9', '10-12'],
    category: 'doa',
    emoji: '☔',
    prompt: { ms: 'Apa kita ucap sebelum makan?', en: 'What do we say before eating?', id: 'Apa yang kita ucap sebelum makan?', ar: 'ماذا نقول قبل الأكل؟' },
    choices: [
      { ms: 'Alhamdulillah', en: 'Alhamdulillah', id: 'Alhamdulillah', ar: 'الحمد لله' },
      { ms: 'Bismillah', en: 'Bismillah', id: 'Bismillah', ar: 'بسم الله' },
      { ms: 'Astaghfirullah', en: 'Astaghfirullah', id: 'Astaghfirullah', ar: 'أستغفر الله' },
      { ms: 'Subhanallah', en: 'Subhanallah', id: 'Subhanallah', ar: 'سبحان الله' },
    ],
    correctIdx: 1,
  },
  // ═══ AKHLAK / MANNERS ═══════════════════════════════════════════
  {
    id: 'q-akhlak-01',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'akhlak',
    emoji: '👋',
    prompt: { ms: 'Bila jumpa kawan Muslim, kita ucap apa?', en: 'When we meet a Muslim friend, we say?', id: 'Saat bertemu teman Muslim, kita ucap apa?', ar: 'عند لقاء صديق مسلم، ماذا نقول؟' },
    choices: [
      { ms: 'Hi!', en: 'Hi!', id: 'Hai!', ar: 'مرحبا!' },
      { ms: 'Assalamualaikum', en: 'Assalamualaikum', id: 'Assalamualaikum', ar: 'السلام عليكم' },
      { ms: 'Bye!', en: 'Bye!', id: 'Dadah!', ar: 'إلى اللقاء!' },
      { ms: 'Wow!', en: 'Wow!', id: 'Wow!', ar: 'واو!' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-akhlak-02',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'akhlak',
    emoji: '🙏',
    prompt: { ms: 'Bila kita buat salah, kita perlu?', en: 'When we do wrong, we should?', id: 'Saat kita salah, kita harus?', ar: 'عندما نخطئ، ماذا نفعل؟' },
    choices: [
      { ms: 'Sembunyi', en: 'Hide', id: 'Sembunyi', ar: 'نختبئ' },
      { ms: 'Minta maaf & istighfar', en: 'Say sorry & istighfar', id: 'Minta maaf & istighfar', ar: 'الاعتذار والاستغفار' },
      { ms: 'Marah balik', en: 'Get angry back', id: 'Marah kembali', ar: 'نغضب' },
      { ms: 'Lupakan', en: 'Forget', id: 'Lupakan', ar: 'ننسى' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-akhlak-03',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'akhlak',
    emoji: '👨‍👩‍👧',
    prompt: { ms: 'Kepada ibu bapa, kita harus?', en: 'To our parents, we should?', id: 'Kepada orang tua, kita harus?', ar: 'مع الوالدين، ماذا يجب أن نفعل؟' },
    choices: [
      { ms: 'Membentak', en: 'Yell', id: 'Membentak', ar: 'نصرخ' },
      { ms: 'Taat & sayang', en: 'Obey & love', id: 'Taat & sayang', ar: 'الطاعة والمحبّة' },
      { ms: 'Tidak dengar', en: 'Ignore', id: 'Cuek', ar: 'نتجاهل' },
      { ms: 'Suruh mereka', en: 'Boss them', id: 'Menyuruh mereka', ar: 'نأمرهم' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-akhlak-04',
    ageBand: ['7-9', '10-12'],
    category: 'akhlak',
    emoji: '🤝',
    prompt: { ms: 'Kawan susah — kita?', en: 'A friend is in trouble — we?', id: 'Teman kesulitan — kita?', ar: 'صديق في ضيق — نحن؟' },
    choices: [
      { ms: 'Ketawa', en: 'Laugh', id: 'Menertawakan', ar: 'نضحك' },
      { ms: 'Tinggalkan', en: 'Leave them', id: 'Tinggalkan', ar: 'نتركه' },
      { ms: 'Tolong dan doakan', en: 'Help & pray for them', id: 'Bantu & doakan', ar: 'نساعده وندعو له' },
      { ms: 'Ambil barang mereka', en: 'Take their things', id: 'Ambil barang mereka', ar: 'نأخذ أشياءهم' },
    ],
    correctIdx: 2,
  },
  // ═══ QURAN FACTS ════════════════════════════════════════════════
  {
    id: 'q-quran-01',
    ageBand: ['7-9', '10-12'],
    category: 'quran',
    emoji: '📖',
    prompt: { ms: 'Surah pertama dalam Al-Quran?', en: 'First surah in the Quran?', id: 'Surah pertama dalam Al-Quran?', ar: 'أول سورة في القرآن؟' },
    choices: [
      { ms: 'Al-Baqarah', en: 'Al-Baqarah', id: 'Al-Baqarah', ar: 'البقرة' },
      { ms: 'Al-Fatihah', en: 'Al-Fatihah', id: 'Al-Fatihah', ar: 'الفاتحة' },
      { ms: 'Al-Ikhlas', en: 'Al-Ikhlas', id: 'Al-Ikhlas', ar: 'الإخلاص' },
      { ms: 'Al-Nas', en: 'An-Nas', id: 'An-Nas', ar: 'الناس' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-quran-02',
    ageBand: ['7-9', '10-12'],
    category: 'quran',
    emoji: '📚',
    prompt: { ms: 'Berapa juzuk dalam Al-Quran?', en: 'How many juz in the Quran?', id: 'Berapa juz dalam Al-Quran?', ar: 'كم جزءًا في القرآن؟' },
    choices: [
      { ms: '20', en: '20', id: '20', ar: '٢٠' },
      { ms: '30', en: '30', id: '30', ar: '٣٠' },
      { ms: '40', en: '40', id: '40', ar: '٤٠' },
      { ms: '50', en: '50', id: '50', ar: '٥٠' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-quran-03',
    ageBand: ['10-12'],
    category: 'quran',
    emoji: '🌙',
    prompt: { ms: 'Al-Quran mula turun pada bulan?', en: 'The Quran was first revealed in the month of?', id: 'Al-Quran mulai turun di bulan?', ar: 'بدأ نزول القرآن في شهر؟' },
    choices: [
      { ms: 'Syaaban', en: 'Sha\u2019ban', id: 'Syaban', ar: 'شعبان' },
      { ms: 'Ramadan', en: 'Ramadan', id: 'Ramadan', ar: 'رمضان' },
      { ms: 'Muharram', en: 'Muharram', id: 'Muharram', ar: 'المحرم' },
      { ms: 'Zulhijjah', en: 'Dhul-Hijjah', id: 'Dzulhijah', ar: 'ذو الحجة' },
    ],
    correctIdx: 1,
  },
  {
    id: 'q-quran-04',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'quran',
    emoji: '🎁',
    prompt: { ms: 'Al-Quran datang dari?', en: 'The Quran comes from?', id: 'Al-Quran berasal dari?', ar: 'القرآن جاء من؟' },
    choices: [
      { ms: 'Manusia biasa', en: 'A regular person', id: 'Manusia biasa', ar: 'إنسان عادي' },
      { ms: 'Allah SWT', en: 'Allah (SWT)', id: 'Allah SWT', ar: 'الله سبحانه وتعالى' },
      { ms: 'Buku sejarah', en: 'A history book', id: 'Buku sejarah', ar: 'كتاب تاريخ' },
      { ms: 'Nabi tulis sendiri', en: 'A prophet wrote it', id: 'Nabi menulis sendiri', ar: 'نبي كتبه' },
    ],
    correctIdx: 1,
  },
  // Extra mixed
  {
    id: 'q-mix-01',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'akhlak',
    emoji: '🌸',
    prompt: { ms: 'Bila terima hadiah, kita ucap?', en: 'When receiving a gift, we say?', id: 'Saat menerima hadiah, kita ucap?', ar: 'عند تلقّي هدية، ماذا نقول؟' },
    choices: [
      { ms: 'Alhamdulillah & terima kasih', en: 'Alhamdulillah & thank you', id: 'Alhamdulillah & terima kasih', ar: 'الحمد لله وشكرًا' },
      { ms: 'Kenapa hanya ini?', en: 'Why only this?', id: 'Kenapa cuma ini?', ar: 'لماذا هذا فقط؟' },
      { ms: 'Ambil dan lari', en: 'Take and run', id: 'Ambil dan lari', ar: 'نأخذ ونهرب' },
      { ms: 'Buang', en: 'Throw it away', id: 'Buang', ar: 'نرميها' },
    ],
    correctIdx: 0,
  },
  {
    id: 'q-mix-02',
    ageBand: ['3-6', '7-9', '10-12'],
    category: 'rukun',
    emoji: '💰',
    prompt: { ms: 'Zakat itu bermakna?', en: 'Zakat means?', id: 'Zakat itu bermakna?', ar: 'الزكاة تعني؟' },
    choices: [
      { ms: 'Beli barang', en: 'Buy things', id: 'Membeli barang', ar: 'شراء الأشياء' },
      { ms: 'Bantu orang susah', en: 'Help those in need', id: 'Membantu orang susah', ar: 'مساعدة المحتاجين' },
      { ms: 'Simpan wang', en: 'Save money', id: 'Menabung', ar: 'ادّخار المال' },
      { ms: 'Berkumpul', en: 'Gather', id: 'Berkumpul', ar: 'الاجتماع' },
    ],
    correctIdx: 1,
  },
]

// Filter questions available for a given age band
export function questionsForAge(ageBand) {
  return QUIZ_QUESTIONS.filter(q => q.ageBand.includes(ageBand))
}

// Pick N random unique questions from a pool
export function pickRandomQuestions(pool, n) {
  const arr = [...pool]
  const out = []
  while (out.length < n && arr.length > 0) {
    const idx = Math.floor(Math.random() * arr.length)
    out.push(arr.splice(idx, 1)[0])
  }
  return out
}

export const POINTS_PER_CORRECT = 2   // Mata Bina per correct answer
export const QUESTIONS_PER_SESSION = 5
