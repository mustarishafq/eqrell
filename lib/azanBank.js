/**
 * Azan MP3 bank for Family Display Mode.
 * Free public CDN sources (islamcan.com — widely used in Islamic apps).
 * Note: Fajr azan includes the extra phrase "As-salatu khayrun min an-nawm".
 */
export const AZAN_BANK = [
  {
    id: 'makkah',
    url: 'https://www.islamcan.com/audio/adhan/azan2.mp3',
    label: { ms: 'Makkah (Sheikh Ali Ahmad Mulla)', en: 'Makkah (Sheikh Ali Ahmad Mulla)', id: 'Makkah (Syaikh Ali Ahmad Mulla)', ar: 'مكة المكرمة (الشيخ علي أحمد ملا)' },
    duration: 178,
  },
  {
    id: 'madinah',
    url: 'https://www.islamcan.com/audio/adhan/azan1.mp3',
    label: { ms: 'Madinah (Sheikh Abdul Majeed)', en: 'Madinah (Sheikh Abdul Majeed)', id: 'Madinah (Syaikh Abdul Majeed)', ar: 'المدينة المنورة (الشيخ عبد المجيد)' },
    duration: 210,
  },
  {
    id: 'mishary',
    url: 'https://www.islamcan.com/audio/adhan/azan5.mp3',
    label: { ms: 'Mishary Rashid Alafasy', en: 'Mishary Rashid Alafasy', id: 'Mishary Rashid Alafasy', ar: 'مشاري بن راشد العفاسي' },
    duration: 165,
  },
  {
    id: 'egypt',
    url: 'https://www.islamcan.com/audio/adhan/azan4.mp3',
    label: { ms: 'Mesir (Al-Azhar)', en: 'Egypt (Al-Azhar)', id: 'Mesir (Al-Azhar)', ar: 'مصر (الأزهر)' },
    duration: 155,
  },
]

// Special Fajr azan — includes "As-salatu khayrun min an-nawm" (Prayer is better than sleep)
export const AZAN_FAJR_BANK = [
  {
    id: 'fajr-makkah',
    url: 'https://www.islamcan.com/audio/adhan/azan3.mp3',
    label: { ms: 'Subuh — Makkah', en: 'Fajr — Makkah', id: 'Subuh — Makkah', ar: 'الفجر — مكة المكرمة' },
    duration: 205,
  },
  {
    id: 'fajr-madinah',
    url: 'https://www.islamcan.com/audio/adhan/azan6.mp3',
    label: { ms: 'Subuh — Madinah', en: 'Fajr — Madinah', id: 'Subuh — Madinah', ar: 'الفجر — المدينة المنورة' },
    duration: 220,
  },
]

// Pre-azan reminder (soft bell / short zikir cue)
export const PRE_AZAN_CHIME_URL = 'https://actions.google.com/sounds/v1/alarms/gentle_alarm.ogg'

export const getAzan = (id, isFajr = false) => {
  if (isFajr) {
    const fajr = AZAN_FAJR_BANK.find(a => a.id === id)
    if (fajr) return fajr
  }
  return AZAN_BANK.find(a => a.id === id) || AZAN_BANK[0]
}
