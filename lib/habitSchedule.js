// Habit day-scheduling (client + server safe — no imports).
// habit.schedule: 'daily' (default) | 'school' | 'weekend' | 'custom'
// habit.days:     [0..6] weekdays (0 = Sunday) — only used for 'custom'
// family.schoolDays: [0..6] — parent picks in settings; default Monday–Friday.
// Solat Teras (core) is always daily.

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
export const DEFAULT_SCHOOL_DAYS = [1, 2, 3, 4, 5]
export const SCHEDULES = ['daily', 'school', 'weekend', 'custom']

export const sanitizeDays = (arr) => [...new Set((Array.isArray(arr) ? arr : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
export const schoolDaysOf = (family) => {
  const d = sanitizeDays(family?.schoolDays)
  return d.length ? d : DEFAULT_SCHOOL_DAYS
}

export function activeDaysOf(habit, schoolDays = DEFAULT_SCHOOL_DAYS) {
  if (!habit || habit.core) return ALL_DAYS
  const s = habit.schedule || 'daily'
  if (s === 'school') return schoolDays
  if (s === 'weekend') return ALL_DAYS.filter(d => !schoolDays.includes(d))
  if (s === 'custom') { const d = sanitizeDays(habit.days); return d.length ? d : ALL_DAYS }
  return ALL_DAYS
}
/** holiday=true (school holiday) → "School days" habits rest, "Weekends" habits run, others unchanged. */
export const isHabitOnDay = (habit, weekday, schoolDays, holiday = false) => {
  if (holiday && !habit?.core) {
    if (habit?.schedule === 'school') return false
    if (habit?.schedule === 'weekend') return true
  }
  return activeDaysOf(habit, schoolDays).includes(weekday)
}

// ─── School holidays: family.schoolHolidays = [{ id, from:'YYYY-MM-DD', to:'YYYY-MM-DD', label }] ───
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const holidaysOf = (family) => (Array.isArray(family?.schoolHolidays) ? family.schoolHolidays : []).filter(h => DATE_RE.test(h?.from) && DATE_RE.test(h?.to))
export const isHolidayDate = (dateStr, holidays = []) => holidays.some(h => dateStr >= h.from && dateStr <= h.to)
export const holidayOn = (dateStr, holidays = []) => holidays.find(h => dateStr >= h.from && dateStr <= h.to) || null
export const weekdayOfDateStr = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay()

/** Normalise a { schedule, days } payload from the client. Returns null fields when invalid. */
export function sanitizeSchedule(body = {}) {
  const schedule = SCHEDULES.includes(body.schedule) ? body.schedule : 'daily'
  const days = schedule === 'custom' ? sanitizeDays(body.days) : []
  if (schedule === 'custom' && (days.length === 0 || days.length === 7)) return { schedule: 'daily', days: [] }
  return { schedule, days }
}

const DAY_SHORT = {
  ms: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  ar: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
}
export const dayShort = (d, lang = 'en') => (DAY_SHORT[lang] || DAY_SHORT.en)[d]
// Display order Monday → Sunday
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const LBL = {
  daily: { ms: 'Setiap hari', en: 'Every day', id: 'Setiap hari', ar: 'كل يوم' },
  school: { ms: 'Hari sekolah', en: 'School days', id: 'Hari sekolah', ar: 'أيام المدرسة' },
  weekend: { ms: 'Hujung minggu', en: 'Weekends', id: 'Akhir pekan', ar: 'نهاية الأسبوع' },
  custom: { ms: 'Hari pilihan', en: 'Chosen days', id: 'Hari pilihan', ar: 'أيام مختارة' },
}
export const scheduleName = (s, lang = 'en') => (LBL[s] || LBL.daily)[lang] || (LBL[s] || LBL.daily).en

/** Short chip label, e.g. "School days" / "Mon · Wed · Fri". null for every-day habits. */
export function scheduleLabel(habit, lang = 'en', schoolDays = DEFAULT_SCHOOL_DAYS) {
  const s = habit?.schedule || 'daily'
  if (habit?.core || s === 'daily') return null
  if (s === 'custom') return WEEK_ORDER.filter(d => activeDaysOf(habit, schoolDays).includes(d)).map(d => dayShort(d, lang)).join(' · ')
  return scheduleName(s, lang)
}
