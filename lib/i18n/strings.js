// EQrel i18n — Locked terms from PRD
// Structure ready for AR (Cohort B activation)

export const strings = {
  ms: {
    // Greetings
    salam: 'Assalamualaikum',
    alhamdulillah: 'Alhamdulillah',
    mashaAllah: 'MashaAllah',
    inshaAllah: 'InshaAllah',
    bismillah: 'Bismillah',
    astaghfirullah: 'Astaghfirullahal \u2018Azim',

    // Nav
    nav_home: 'Utama',
    nav_tasks: 'Tugas',
    nav_reports: 'Laporan',
    nav_profile: 'Profil',

    // Dashboard
    momentum_week: 'MOMENTUM BAIK MINGGU INI',
    dashboard_headline: (names) => `Alhamdulillah, perjalanan ${names} semakin bercahaya`,
    dashboard_sub: 'Setiap langkah kecil hari ini membina kebiasaan yang kekal.',
    family_streak: (days) => `${days} hari sepanjang perjalanan keluarga`,
    verify_pending: (n) => `${n} tugasan sedia disemak`,
    family_quest_title: 'Family Quest',
    family_quest_sub: 'Akan tiba tidak lama lagi \u2728 \u2014 perjalanan keluarga bersama',
    family_quest_cta: 'Terokai Bersama',

    // Common
    loading: 'Memuatkan...',
  },
  en: {
    salam: 'Assalamualaikum',
    alhamdulillah: 'Alhamdulillah',
    mashaAllah: 'MashaAllah',
    inshaAllah: 'InshaAllah',
    bismillah: 'Bismillah',
    astaghfirullah: 'Astaghfirullahal \u2018Azim',

    nav_home: 'Home',
    nav_tasks: 'Tasks',
    nav_reports: 'Reports',
    nav_profile: 'Profile',

    momentum_week: 'GOOD MOMENTUM THIS WEEK',
    dashboard_headline: (names) => `Alhamdulillah, ${names}'s journey is glowing`,
    dashboard_sub: 'Every small step today builds lasting habits.',
    family_streak: (days) => `${days} days on the family journey`,
    verify_pending: (n) => `${n} tasks ready to review`,
    family_quest_title: 'Family Quest',
    family_quest_sub: 'Coming soon \u2728 \u2014 a shared family journey',
    family_quest_cta: 'Explore Together',

    loading: 'Loading...',
  },
  // AR structure ready — activate Cohort B
  ar: {},
}

export const t = (locale = 'ms') => strings[locale] || strings.ms
