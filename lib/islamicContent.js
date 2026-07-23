/**
 * Islamic content bank for Family Display Mode.
 * Rotating hadith + doa for ambient reminder.
 * Supports: ms (Malay), en (English), id (Indonesian), ar (Arabic).
 *
 * Hadith format: "Rasulullah SAW bersabda: [text]" (HR = Hadith Riwayat, e.g. Imam Ahmad, Bukhari, Muslim)
 */
export const HADITH_BANK = [
  {
    ms: 'Rasulullah SAW bersabda: "Sebaik-baik manusia adalah yang paling bermanfaat kepada manusia." (HR Ahmad)',
    en: 'The Prophet Muhammad ﷺ said: "The best of people are those most beneficial to people." (Reported by Imam Ahmad)',
    id: 'Rasulullah SAW bersabda: "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia." (HR Imam Ahmad)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ." (رواه أحمد)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Senyummu kepada saudaramu adalah sedekah." (HR Tirmidzi)',
    en: 'The Prophet Muhammad ﷺ said: "Your smile for your brother is charity." (Reported by Imam Tirmidhi)',
    id: 'Rasulullah SAW bersabda: "Senyummu di hadapan saudaramu adalah sedekah." (HR Imam Tirmidzi)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ." (رواه الترمذي)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Barangsiapa yang tidak menyayangi, tidak akan disayangi." (HR Bukhari)',
    en: 'The Prophet Muhammad ﷺ said: "He who does not show mercy will not be shown mercy." (Reported by Imam Bukhari)',
    id: 'Rasulullah SAW bersabda: "Barangsiapa tidak menyayangi, tidak akan disayangi." (HR Imam Bukhari)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "مَنْ لَا يَرْحَمْ لَا يُرْحَمْ." (رواه البخاري)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Allah tidak melihat rupa dan hartamu, tetapi melihat hati dan amalanmu." (HR Muslim)',
    en: 'The Prophet Muhammad ﷺ said: "Allah looks at your hearts and deeds, not your appearance and wealth." (Reported by Imam Muslim)',
    id: 'Rasulullah SAW bersabda: "Allah tidak melihat rupa dan harta kalian, tetapi melihat hati dan amal kalian." (HR Imam Muslim)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "إِنَّ اللَّهَ لَا يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ." (رواه مسلم)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Syurga itu di bawah tapak kaki ibu." (HR Ahmad & An-Nasa\'i)',
    en: 'The Prophet Muhammad ﷺ said: "Paradise lies at the feet of mothers." (Reported by Imam Ahmad & An-Nasa\'i)',
    id: 'Rasulullah SAW bersabda: "Surga itu di bawah telapak kaki ibu." (HR Imam Ahmad & An-Nasa\'i)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "الْجَنَّةُ تَحْتَ أَقْدَامِ الْأُمَّهَاتِ." (رواه أحمد والنسائي)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Setiap perbuatan itu bergantung pada niatnya." (HR Bukhari & Muslim)',
    en: 'The Prophet Muhammad ﷺ said: "Actions are but by intentions." (Reported by Bukhari & Muslim)',
    id: 'Rasulullah SAW bersabda: "Sesungguhnya setiap amal tergantung pada niatnya." (HR Bukhari & Muslim)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ." (رواه البخاري ومسلم)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Sabar itu adalah cahaya." (HR Muslim)',
    en: 'The Prophet Muhammad ﷺ said: "Patience is a light." (Reported by Imam Muslim)',
    id: 'Rasulullah SAW bersabda: "Sabar itu adalah cahaya." (HR Imam Muslim)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "وَالصَّبْرُ ضِيَاءٌ." (رواه مسلم)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Barangsiapa menyambung silaturahim, Allah akan panjangkan usianya." (HR Bukhari)',
    en: 'The Prophet Muhammad ﷺ said: "Whoever maintains family ties, Allah will extend his life." (Reported by Imam Bukhari)',
    id: 'Rasulullah SAW bersabda: "Barangsiapa menyambung silaturahim, Allah akan panjangkan usianya." (HR Imam Bukhari)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "مَنْ سَرَّهُ أَنْ يُبْسَطَ لَهُ فِي رِزْقِهِ وَأَنْ يُنْسَأَ لَهُ فِي أَثَرِهِ فَلْيَصِلْ رَحِمَهُ." (رواه البخاري)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Bersiwak itu membersihkan mulut dan diredhai Allah." (HR Ahmad & An-Nasa\'i)',
    en: 'The Prophet Muhammad ﷺ said: "Siwak cleanses the mouth and pleases the Lord." (Reported by Imam Ahmad & An-Nasa\'i)',
    id: 'Rasulullah SAW bersabda: "Siwak itu membersihkan mulut dan diridhai Allah." (HR Imam Ahmad & An-Nasa\'i)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "السِّوَاكُ مَطْهَرَةٌ لِلْفَمِ مَرْضَاةٌ لِلرَّبِّ." (رواه أحمد والنسائي)',
  },
  {
    ms: 'Saidina Ali RA berkata: "Ilmu itu lebih baik daripada harta. Ilmu menjaga kamu, harta kamu yang menjaga."',
    en: 'Sayyiduna Ali RA said: "Knowledge is better than wealth — knowledge guards you, while you must guard wealth."',
    id: 'Sayyidina Ali RA berkata: "Ilmu itu lebih baik daripada harta. Ilmu menjaga kamu, harta kamu yang menjaganya."',
    ar: 'قَالَ عَلِيٌّ رَضِيَ اللَّهُ عَنْهُ: "الْعِلْمُ خَيْرٌ مِنَ الْمَالِ، الْعِلْمُ يَحْرُسُكَ وَأَنْتَ تَحْرُسُ الْمَالَ."',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Sebaik-baik kamu adalah yang paling baik terhadap keluarganya." (HR Tirmidzi)',
    en: 'The Prophet Muhammad ﷺ said: "The best of you are those who are best to their family." (Reported by Imam Tirmidhi)',
    id: 'Rasulullah SAW bersabda: "Sebaik-baik kalian adalah yang paling baik terhadap keluarganya." (HR Imam Tirmidzi)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "خَيْرُكُمْ خَيْرُكُمْ لِأَهْلِهِ." (رواه الترمذي)',
  },
  {
    ms: 'Rasulullah SAW bersabda: "Kebersihan itu sebahagian daripada iman." (HR Muslim)',
    en: 'The Prophet Muhammad ﷺ said: "Cleanliness is half of faith." (Reported by Imam Muslim)',
    id: 'Rasulullah SAW bersabda: "Kebersihan itu sebagian dari iman." (HR Imam Muslim)',
    ar: 'قَالَ رَسُولُ اللَّهِ ﷺ: "الطُّهُورُ شَطْرُ الْإِيمَانِ." (رواه مسلم)',
  },
]

export const DOA_BANK = [
  {
    ms: 'Rabbana atina fid-dunya hasanah, wa fil akhirati hasanah, wa qina adhaban-nar.',
    en: 'Our Lord, grant us goodness in this life and the next, and save us from the fire.',
    id: 'Ya Tuhan kami, berilah kami kebaikan di dunia dan akhirat, dan lindungi kami dari azab neraka.',
    ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ.',
  },
  {
    ms: 'Allahumma yassir wa la tu\u2019assir. — Ya Allah, permudahkan urusan kami.',
    en: 'O Allah, make it easy and do not make it difficult.',
    id: 'Ya Allah, permudahkanlah dan jangan Engkau persulit.',
    ar: 'اللَّهُمَّ يَسِّرْ وَلَا تُعَسِّرْ.',
  },
  {
    ms: 'Rabbi zidni ilma. — Ya Tuhanku, tambahkan aku ilmu.',
    en: 'My Lord, increase me in knowledge.',
    id: 'Ya Tuhanku, tambahkanlah ilmu kepadaku.',
    ar: 'رَبِّ زِدْنِي عِلْمًا.',
  },
  {
    ms: 'Allahumma inni as\u2019aluka husnal khatimah. — Ya Allah kurniakan aku penutup yang baik.',
    en: 'O Allah, I ask You for a good ending.',
    id: 'Ya Allah, aku memohon kepada-Mu husnul khatimah (akhir yang baik).',
    ar: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ حُسْنَ الْخَاتِمَةِ.',
  },
  {
    ms: 'Rabbanaghfir lana dhunubana. — Ampunilah dosa-dosa kami.',
    en: 'Our Lord, forgive us our sins.',
    id: 'Ya Tuhan kami, ampunilah dosa-dosa kami.',
    ar: 'رَبَّنَا اغْفِرْ لَنَا ذُنُوبَنَا.',
  },
]
