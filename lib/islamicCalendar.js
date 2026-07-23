/**
 * Islamic Calendar — key Sirah events & celebrations mapped by Hijri month/day.
 * Used on Family Display to add educational context to the Hijri date shown.
 *
 * Month indices are 0-based (Muharram=0, Safar=1, ..., Dhu al-Hijjah=11).
 * Language keys: ms (Malay), en, id, ar.
 */

export const ISLAMIC_EVENTS = [
  // ─── Muharram (0) ───
  {
    month: 0, day: 1,
    title: {
      ms: 'Awal Muharam — Tahun Baru Hijrah',
      en: 'Islamic New Year',
      id: 'Tahun Baru Hijriyah',
      ar: 'رأس السنة الهجرية',
    },
    desc: {
      ms: 'Peringatan hijrah Nabi ﷺ dari Mekah ke Madinah — permulaan takwim Islam.',
      en: 'Commemorates the Prophet ﷺ\u2019s migration from Mecca to Medina — start of the Islamic calendar.',
      id: 'Peringatan hijrah Nabi ﷺ dari Makkah ke Madinah — awal kalender Islam.',
      ar: 'ذكرى هجرة النبي ﷺ من مكة إلى المدينة — بداية التقويم الهجري.',
    },
  },
  {
    month: 0, day: 10,
    title: {
      ms: 'Hari Asyura',
      en: 'Day of Ashura',
      id: 'Hari Asyura',
      ar: 'يوم عاشوراء',
    },
    desc: {
      ms: 'Hari Musa ﷺ diselamatkan dari Firaun. Sunat puasa 9 & 10 Muharam.',
      en: 'Day Prophet Musa ﷺ was saved from Pharaoh. Sunnah to fast the 9th & 10th.',
      id: 'Hari Nabi Musa ﷺ diselamatkan dari Firaun. Disunnahkan puasa 9 & 10.',
      ar: 'اليوم الذي نجى الله فيه موسى ﷺ من فرعون. يُسنّ صيام التاسع والعاشر.',
    },
  },

  // ─── Rabi al-Awwal (2) ───
  {
    month: 2, day: 12,
    title: {
      ms: 'Maulidur Rasul ﷺ',
      en: 'Mawlid — Prophet\u2019s Birthday ﷺ',
      id: 'Maulid Nabi ﷺ',
      ar: 'المولد النبوي الشريف ﷺ',
    },
    desc: {
      ms: 'Kelahiran Nabi Muhammad ﷺ di Mekah pada Tahun Gajah.',
      en: 'Birth of Prophet Muhammad ﷺ in Mecca in the Year of the Elephant.',
      id: 'Kelahiran Nabi Muhammad ﷺ di Makkah pada Tahun Gajah.',
      ar: 'مولد النبي محمد ﷺ في مكة عام الفيل.',
    },
  },
  {
    month: 2, day: 8,
    title: {
      ms: 'Nabi ﷺ tiba di Madinah',
      en: 'Prophet ﷺ arrives in Medina',
      id: 'Nabi ﷺ tiba di Madinah',
      ar: 'وصول النبي ﷺ إلى المدينة',
    },
    desc: {
      ms: 'Hijrah tamat — Nabi ﷺ tiba di Quba, membina masjid pertama Islam.',
      en: 'End of Hijra — Prophet ﷺ arrives at Quba, building the first mosque of Islam.',
      id: 'Akhir Hijrah — Nabi ﷺ tiba di Quba, mendirikan masjid pertama Islam.',
      ar: 'نهاية الهجرة — وصل النبي ﷺ إلى قباء وبنى أول مسجد في الإسلام.',
    },
  },

  // ─── Rajab (6) — additions ───
  {
    month: 6, day: 1,
    title: {
      ms: 'Awal Rejab',
      en: 'Beginning of Rajab',
      id: 'Awal Rajab',
      ar: 'بداية شهر رجب',
    },
    desc: {
      ms: 'Salah satu bulan haram. Waktu untuk banyakkan doa & bersedia untuk Ramadan.',
      en: 'One of the sacred months. Time to increase du\u2019a & prepare for Ramadan.',
      id: 'Salah satu bulan haram. Waktu memperbanyak doa & bersiap untuk Ramadhan.',
      ar: 'من الأشهر الحرم. وقت الإكثار من الدعاء والاستعداد لرمضان.',
    },
  },

  // ─── Jumada al-Awwal (4) ───
  {
    month: 4, day: 5,
    title: {
      ms: 'Perang Mu\u2019tah',
      en: 'Battle of Mu\u2019tah',
      id: 'Perang Mu\u2019tah',
      ar: 'غزوة مؤتة',
    },
    desc: {
      ms: 'Peperangan pertama Islam menentang Empayar Byzantine (8 H).',
      en: 'First Islamic battle against the Byzantine Empire (8 AH).',
      id: 'Perang pertama Islam melawan Kekaisaran Bizantium (8 H).',
      ar: 'أول معركة إسلامية ضد الإمبراطورية البيزنطية (٨ هـ).',
    },
  },

  // ─── Rajab (6) ───
  {
    month: 6, day: 27,
    title: {
      ms: 'Isra\u2019 & Mi\u2019raj',
      en: 'Isra\u2019 & Mi\u2019raj',
      id: 'Isra\u2019 Mi\u2019raj',
      ar: 'الإسراء والمعراج',
    },
    desc: {
      ms: 'Perjalanan malam Nabi ﷺ dari Masjidil Haram ke Masjidil Aqsa lalu ke langit — kewajiban solat 5 waktu diturunkan.',
      en: 'Prophet\u2019s ﷺ night journey from Al-Haram to Al-Aqsa then to the heavens — the 5 daily prayers were mandated.',
      id: 'Perjalanan malam Nabi ﷺ dari Masjidil Haram ke Masjidil Aqsa lalu ke langit — kewajiban shalat 5 waktu diturunkan.',
      ar: 'رحلة النبي ﷺ الليلية من المسجد الحرام إلى المسجد الأقصى ثم إلى السماء — وفُرضت الصلوات الخمس.',
    },
  },

  // ─── Sha'ban (7) ───
  {
    month: 7, day: 15,
    title: {
      ms: 'Nisfu Sya\u2019ban',
      en: 'Nisfu Sha\u2019ban (Laylat al-Bara\u2019ah)',
      id: 'Nisfu Sya\u2019ban',
      ar: 'ليلة النصف من شعبان',
    },
    desc: {
      ms: 'Malam pertengahan Sya\u2019ban — masa untuk banyak beristighfar dan berdoa.',
      en: 'The Night of Forgiveness — a night for repentance and supplication.',
      id: 'Malam pertengahan Sya\u2019ban — waktu memperbanyak istighfar dan doa.',
      ar: 'ليلة النصف من شعبان — وقت الاستغفار والدعاء.',
    },
  },
  {
    month: 7, day: 1,
    title: {
      ms: 'Awal Sya\u2019ban',
      en: 'Beginning of Sha\u2019ban',
      id: 'Awal Sya\u2019ban',
      ar: 'بداية شعبان',
    },
    desc: {
      ms: 'Bulan Nabi ﷺ paling banyak berpuasa selain Ramadan. Sunat memperbanyak puasa.',
      en: 'Prophet ﷺ fasted most in this month after Ramadan. Recommended to fast often.',
      id: 'Bulan Nabi ﷺ paling banyak berpuasa selain Ramadhan. Disunahkan memperbanyak puasa.',
      ar: 'أكثر شهر كان النبي ﷺ يصوم فيه بعد رمضان. يستحب الإكثار من الصيام.',
    },
  },

  // ─── Ramadan (8) ───
  {
    month: 8, day: 1,
    title: {
      ms: 'Awal Ramadan Mubarak',
      en: 'Ramadan Begins — Mubarak!',
      id: 'Awal Ramadhan Mubarak',
      ar: 'رمضان مبارك',
    },
    desc: {
      ms: 'Bulan puasa, membaca Al-Quran, dan mendekatkan diri kepada Allah.',
      en: 'Month of fasting, reciting the Qur\u2019an, and drawing closer to Allah.',
      id: 'Bulan puasa, membaca Al-Qur\u2019an, dan mendekatkan diri kepada Allah.',
      ar: 'شهر الصيام وتلاوة القرآن والتقرب إلى الله.',
    },
  },
  {
    month: 8, day: 17,
    title: {
      ms: 'Nuzul Al-Quran & Perang Badar',
      en: 'Nuzul al-Qur\u2019an & Battle of Badr',
      id: 'Nuzul Al-Qur\u2019an & Perang Badar',
      ar: 'نزول القرآن وغزوة بدر',
    },
    desc: {
      ms: 'Hari pertama Al-Quran diturunkan kepada Nabi ﷺ di Gua Hira\u2019, dan kemenangan agung di Badar (2 H).',
      en: 'The day the Qur\u2019an was first revealed to the Prophet ﷺ at Cave Hira\u2019, and the great victory at Badr (2 AH).',
      id: 'Hari pertama Al-Qur\u2019an diturunkan kepada Nabi ﷺ di Gua Hira\u2019, dan kemenangan besar di Badar (2 H).',
      ar: 'يوم نزول القرآن على النبي ﷺ في غار حراء، والنصر العظيم في بدر (٢ هـ).',
    },
  },
  {
    month: 8, day: 20,
    title: {
      ms: 'Pembukaan Mekah (Fathu Makkah)',
      en: 'Conquest of Mecca',
      id: 'Fathu Makkah',
      ar: 'فتح مكة',
    },
    desc: {
      ms: 'Nabi ﷺ dan sahabat memasuki Mekah tanpa peperangan (8 H) — Kaabah dibersihkan dari berhala.',
      en: 'Prophet ﷺ and companions entered Mecca peacefully (8 AH) — Ka\u2019bah cleansed of idols.',
      id: 'Nabi ﷺ dan sahabat memasuki Makkah tanpa perang (8 H) — Ka\u2019bah dibersihkan dari berhala.',
      ar: 'دخل النبي ﷺ وأصحابه مكة سلماً (٨ هـ) — وطُهرت الكعبة من الأصنام.',
    },
  },
  {
    month: 8, day: 27,
    title: {
      ms: 'Malam Lailatul Qadar (jangkaan)',
      en: 'Laylat al-Qadr (likely night)',
      id: 'Malam Lailatul Qadar (kemungkinan)',
      ar: 'ليلة القدر (الأرجح)',
    },
    desc: {
      ms: 'Malam kemuliaan — lebih baik dari 1000 bulan. Kejarlah dengan doa & qiyam.',
      en: 'The Night of Power — better than 1000 months. Seek it with prayer & du\u2019a.',
      id: 'Malam kemuliaan — lebih baik dari 1000 bulan. Kejarlah dengan doa & qiyam.',
      ar: 'ليلة خير من ألف شهر — اجتهدوا فيها بالدعاء والقيام.',
    },
  },
  {
    month: 8, day: 21,
    title: {
      ms: 'Mula i\u2019tikaf 10 malam terakhir',
      en: 'Last 10 nights of Ramadan begin',
      id: 'Mulai i\u2019tikaf 10 malam terakhir',
      ar: 'بداية العشر الأواخر',
    },
    desc: {
      ms: 'Sunnah Nabi ﷺ — banyakkan qiyamullail, doa & i\u2019tikaf di masjid.',
      en: 'Sunnah of the Prophet ﷺ — intensify qiyam, du\u2019a & i\u2019tikaf at the mosque.',
      id: 'Sunnah Nabi ﷺ — perbanyak qiyamullail, doa & i\u2019tikaf di masjid.',
      ar: 'من سنة النبي ﷺ — الإكثار من القيام والدعاء والاعتكاف.',
    },
  },
  {
    month: 8, day: 10,
    title: {
      ms: 'Wafat Khadijah RA',
      en: 'Passing of Khadijah RA',
      id: 'Wafatnya Khadijah RA',
      ar: 'وفاة السيدة خديجة رضي الله عنها',
    },
    desc: {
      ms: 'Isteri pertama Nabi ﷺ, ibu kepada umat mukmin. Wafat 3 tahun sebelum Hijrah.',
      en: 'First wife of the Prophet ﷺ, mother of the believers. Died 3 years before Hijra.',
      id: 'Istri pertama Nabi ﷺ, ibu kaum mukminin. Wafat 3 tahun sebelum Hijrah.',
      ar: 'أول زوجات النبي ﷺ، أم المؤمنين. توفيت قبل الهجرة بثلاث سنوات.',
    },
  },

  // ─── Shawwal (9) ───
  {
    month: 9, day: 1,
    title: {
      ms: 'Hari Raya Aidilfitri',
      en: 'Eid al-Fitr',
      id: 'Idul Fitri',
      ar: 'عيد الفطر',
    },
    desc: {
      ms: 'Sambutan kemenangan selepas sebulan berpuasa. Solat sunat Aidilfitri di pagi hari.',
      en: 'Celebration after a month of fasting. Eid prayer in the morning.',
      id: 'Perayaan kemenangan setelah sebulan berpuasa. Shalat Idul Fitri di pagi hari.',
      ar: 'عيد الفطر بعد شهر من الصيام. صلاة العيد في الصباح.',
    },
  },
  {
    month: 9, day: 7,
    title: {
      ms: 'Perang Uhud',
      en: 'Battle of Uhud',
      id: 'Perang Uhud',
      ar: 'غزوة أحد',
    },
    desc: {
      ms: 'Peperangan besar tahun ketiga Hijrah — pengajaran tentang taat kepada arahan Nabi ﷺ.',
      en: 'Major battle in the 3rd year of Hijrah — a lesson in obedience to the Prophet\u2019s ﷺ command.',
      id: 'Perang besar di tahun ke-3 Hijrah — pelajaran tentang taat kepada perintah Nabi ﷺ.',
      ar: 'معركة كبرى في السنة الثالثة للهجرة — درس في طاعة أمر النبي ﷺ.',
    },
  },

  // ─── Dhu al-Hijjah (11) ───
  {
    month: 11, day: 1,
    title: {
      ms: 'Mula 10 Hari Zulhijjah',
      en: 'First 10 days of Dhu al-Hijjah',
      id: '10 Hari Pertama Dzulhijjah',
      ar: 'العشر الأوائل من ذي الحجة',
    },
    desc: {
      ms: 'Hari-hari terbaik sepanjang tahun. Perbanyak tahlil, takbir, tahmid, dan puasa.',
      en: 'The best days of the year. Increase tahlil, takbir, tahmid, and fasting.',
      id: 'Hari-hari terbaik sepanjang tahun. Perbanyak tahlil, takbir, tahmid, dan puasa.',
      ar: 'أفضل أيام السنة. أكثروا من التهليل والتكبير والتحميد والصيام.',
    },
  },
  {
    month: 11, day: 8,
    title: {
      ms: 'Hari Tarwiyah',
      en: 'Day of Tarwiyah',
      id: 'Hari Tarwiyah',
      ar: 'يوم التروية',
    },
    desc: {
      ms: 'Jemaah haji berkumpul di Mina — permulaan rukun haji.',
      en: 'Pilgrims gather at Mina — start of the Hajj rites.',
      id: 'Jemaah haji berkumpul di Mina — awal ritual haji.',
      ar: 'يتجمع الحجاج في منى — بداية مناسك الحج.',
    },
  },
  {
    month: 11, day: 9,
    title: {
      ms: 'Hari Arafah',
      en: 'Day of Arafah',
      id: 'Hari Arafah',
      ar: 'يوم عرفة',
    },
    desc: {
      ms: 'Puncak ibadah haji di padang Arafah. Sunat puasa bagi bukan haji — menghapus dosa 2 tahun.',
      en: 'Peak of Hajj at Arafat. Sunnah to fast for non-pilgrims — expiates 2 years of minor sins.',
      id: 'Puncak ibadah haji di padang Arafah. Sunnah berpuasa bagi non-jamaah — menghapus dosa 2 tahun.',
      ar: 'ذروة الحج في عرفة. صيامه سنة لغير الحاج — يكفر ذنوب سنتين.',
    },
  },
  {
    month: 11, day: 10,
    title: {
      ms: 'Hari Raya Aidiladha',
      en: 'Eid al-Adha',
      id: 'Idul Adha',
      ar: 'عيد الأضحى',
    },
    desc: {
      ms: 'Hari korban — sambutan pengorbanan Nabi Ibrahim ﷺ. Solat sunat Aidiladha di pagi hari.',
      en: 'Feast of Sacrifice — commemorates Prophet Ibrahim\u2019s ﷺ obedience. Eid prayer in the morning.',
      id: 'Hari kurban — peringatan pengorbanan Nabi Ibrahim ﷺ. Shalat Idul Adha di pagi hari.',
      ar: 'عيد الأضحى — ذكرى تضحية النبي إبراهيم ﷺ. صلاة العيد في الصباح.',
    },
  },
]

// Monthly context (shown if no specific-day event exists today)
export const MONTHLY_CONTEXT = {
  0: { // Muharram
    ms: 'Muharam — Bulan haram, bulan hijrah. Perbanyakkan ibadah & muhasabah.',
    en: 'Muharram — Sacred month of the Hijra. Increase worship & self-reflection.',
    id: 'Muharram — Bulan haram, bulan hijrah. Perbanyaklah ibadah & muhasabah.',
    ar: 'محرم — شهر حرام، شهر الهجرة. أكثروا من العبادة والمحاسبة.',
  },
  1: { // Safar
    ms: 'Safar — Bulan bermulanya hijrah Rasulullah ﷺ dari Makkah ke Madinah, perjalanan yang mengubah sejarah umat Islam.',
    en: 'Safar — The month Prophet Muhammad ﷺ set out on his Hijra from Mecca to Madinah, a journey that changed history.',
    id: 'Safar — Bulan dimulainya hijrah Rasulullah ﷺ dari Mekah ke Madinah, sebuah perjalanan yang mengubah sejarah umat.',
    ar: 'صفر — الشهر الذي خرج فيه رسول الله ﷺ مهاجراً من مكة إلى المدينة، رحلة غيّرت مجرى التاريخ.',
  },
  2: { // Rabi al-Awwal
    ms: 'Rabiulawal — Bulan kelahiran Nabi ﷺ. Renungi sirah baginda.',
    en: 'Rabi al-Awwal — Month of the Prophet\u2019s birth ﷺ. Reflect on his life.',
    id: 'Rabiul Awal — Bulan kelahiran Nabi ﷺ. Renungi sirah beliau.',
    ar: 'ربيع الأول — شهر مولد النبي ﷺ. تأمل في سيرته.',
  },
  3: { // Rabi al-Thani
    ms: 'Rabiulakhir — Bulan menyambung amal soleh & mendalami sunnah Nabi ﷺ.',
    en: 'Rabi al-Thani — Continue good deeds & deepen your understanding of the Sunnah.',
    id: 'Rabiul Akhir — Lanjutkan amal saleh & perdalam Sunnah Nabi ﷺ.',
    ar: 'ربيع الآخر — واصلوا الأعمال الصالحة وتعمقوا في السنة النبوية.',
  },
  4: { // Jumada al-Awwal
    ms: 'Jamadilawal — Bulan yang mengandungi kisah Perang Mu\u2019tah dan pengorbanan sahabat.',
    en: 'Jumada al-Awwal — Contains the story of Battle of Mu\u2019tah and companions\u2019 sacrifices.',
    id: 'Jumadil Awal — Mengandung kisah Perang Mu\u2019tah dan pengorbanan para sahabat.',
    ar: 'جمادى الأولى — تحوي قصة غزوة مؤتة وتضحيات الصحابة.',
  },
  5: { // Jumada al-Thani
    ms: 'Jamadilakhir — Bulan renungan tentang kepimpinan Khulafa Rasyidin.',
    en: 'Jumada al-Thani — Month for reflecting on the leadership of the Rightly-Guided Caliphs.',
    id: 'Jumadil Akhir — Bulan renungan kepemimpinan Khulafaur Rasyidin.',
    ar: 'جمادى الآخرة — شهر التأمل في قيادة الخلفاء الراشدين.',
  },
  6: { // Rajab
    ms: 'Rejab — Bulan haram. Persiapkan diri untuk Ramadan.',
    en: 'Rajab — Sacred month. Prepare yourself for Ramadan.',
    id: 'Rajab — Bulan haram. Persiapkan diri untuk Ramadhan.',
    ar: 'رجب — شهر حرام. استعدوا لرمضان.',
  },
  7: { // Sha'ban
    ms: 'Syaaban — Bulan menyucikan hati sebelum Ramadan.',
    en: 'Sha\u2019ban — Purify your heart before Ramadan.',
    id: 'Sya\u2019ban — Bulan menyucikan hati sebelum Ramadhan.',
    ar: 'شعبان — شهر تطهير القلب قبل رمضان.',
  },
  8: { // Ramadan
    ms: 'Ramadan Mubarak — Puasa, tarawih, tadarus Al-Quran.',
    en: 'Ramadan Mubarak — Fasting, tarawih, & Qur\u2019an recitation.',
    id: 'Ramadhan Mubarak — Puasa, tarawih, & tadarus Al-Qur\u2019an.',
    ar: 'رمضان مبارك — صيام وتراويح وتلاوة القرآن.',
  },
  9: { // Shawwal
    ms: 'Syawal — Sunat puasa 6 hari selepas Aidilfitri = pahala setahun.',
    en: 'Shawwal — Fasting 6 days after Eid = reward of a full year.',
    id: 'Syawal — Puasa 6 hari setelah Idul Fitri = pahala setahun.',
    ar: 'شوال — صيام ست من شوال = أجر سنة كاملة.',
  },
  10: { // Dhul-Qi'dah
    ms: 'Zulkaedah — Bulan haram. Bersedia untuk musim haji.',
    en: 'Dhu al-Qi\u2019dah — Sacred month. Prepare for Hajj season.',
    id: 'Dzulqaidah — Bulan haram. Bersiap untuk musim haji.',
    ar: 'ذو القعدة — شهر حرام. الاستعداد لموسم الحج.',
  },
  11: { // Dhul-Hijjah
    ms: 'Zulhijjah — Bulan haji. 10 hari pertama paling utama sepanjang tahun.',
    en: 'Dhu al-Hijjah — Month of Hajj. First 10 days are the best of the year.',
    id: 'Dzulhijjah — Bulan haji. 10 hari pertama adalah yang terbaik sepanjang tahun.',
    ar: 'ذو الحجة — شهر الحج. العشر الأوائل أفضل أيام السنة.',
  },
}

/**
 * Get the Islamic event for a given Hijri date (month 0-based, day 1-based).
 * Returns event object or null.
 */
export const getEventForDate = (month, day) => {
  return ISLAMIC_EVENTS.find(e => e.month === month && e.day === day) || null
}

/**
 * Get monthly context for the current Hijri month (0-based).
 */
export const getMonthlyContext = (month) => {
  return MONTHLY_CONTEXT[month] || null
}
