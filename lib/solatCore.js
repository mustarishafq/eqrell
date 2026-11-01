/**
 * Solat Teras — EQrel's non-negotiable core ("Build Habits, Grow Iman").
 * Follows the hadith "Command your children to pray at seven…":
 *  - age < 7  → Latihan Solat: Maghrib + Isyak with the family
 *  - age >= 7 → all 5 daily prayers
 * Core prayer habits cannot be removed — only paused (Cuti Solat for girls 9+, or serious illness).
 */
export const SOLAT_IDS = ['ib-01', 'ib-02', 'ib-03', 'ib-04', 'ib-05']
export const SOLAT_PRACTICE_IDS = ['ib-04', 'ib-05']
export const SOLAT_WAJIB_AGE = 7

export const childAgeYears = (c) => {
  if (Number.isFinite(c?.age)) return c.age
  const n = parseInt(String(c?.ageBand || '').split('-')[0], 10)
  return Number.isFinite(n) ? n : SOLAT_WAJIB_AGE
}
export const solatCoreFor = (age) => (Number(age) < SOLAT_WAJIB_AGE ? SOLAT_PRACTICE_IDS : SOLAT_IDS)
export const isSolatTpl = (id) => SOLAT_IDS.includes(id)
export const canCutiSolat = (c) => c?.gender === 'female' && childAgeYears(c) >= 9
export const PAUSE_REASONS = ['haid', 'sakit']
