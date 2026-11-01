/**
 * Hijri date helper using native Intl.DateTimeFormat with Islamic calendar.
 * Uses 'islamic-umalqura' (Umm al-Qura, Saudi Arabia standard).
 * Falls back gracefully if browser doesn't support it.
 */

const HIJRI_MONTH_NAMES = {
  ms: ['Muharram', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jamadilawal', 'Jamadilakhir',
       'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah'],
  en: ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani',
       'Rajab', 'Sha\u2019ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi\u2019dah', 'Dhu al-Hijjah'],
  id: ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir',
       'Rajab', 'Sya\u2019ban', 'Ramadhan', 'Syawal', 'Dzulqaidah', 'Dzulhijjah'],
  ar: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
       'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
}

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const toArabicDigits = (n) => String(n).replace(/[0-9]/g, d => AR_DIGITS[+d])

/**
 * Get Hijri date parts from a JS Date.
 * @returns { day: number, month: number(0-based), year: number } or null on failure.
 */
export const getHijri = (date = new Date()) => {
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric',
    })
    const parts = fmt.formatToParts(date)
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10)
    const monthNum = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10)
    const yearStr = parts.find(p => p.type === 'year')?.value || '0'
    // Year value may include "AH" or era suffix — strip non-digits
    const year = parseInt(yearStr.replace(/[^0-9]/g, ''), 10)
    if (!day || !monthNum || !year) return null
    return { day, month: monthNum - 1, year }
  } catch (e) {
    return null
  }
}

/**
 * Format Hijri date as a display string in the requested language.
 * Example: "12 Ramadan 1447 AH"
 */
export const formatHijri = (date = new Date(), lang = 'en') => {
  const h = getHijri(date)
  if (!h) return ''
  const monthName = (HIJRI_MONTH_NAMES[lang] || HIJRI_MONTH_NAMES.ms)[h.month] || ''
  const suffix = lang === 'ms' ? 'H' : lang === 'ar' ? 'هـ' : lang === 'id' ? 'H' : 'AH'
  if (lang === 'ar') {
    return `${toArabicDigits(h.day)} ${monthName} ${toArabicDigits(h.year)} ${suffix}`
  }
  return `${h.day} ${monthName} ${h.year} ${suffix}`
}
