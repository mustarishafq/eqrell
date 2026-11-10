'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Sparkles, RotateCcw, Info, HelpCircle } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { HABIT_CATEGORIES, getCategoryLabel, getHabitTitle, getHabitDesc } from '@/lib/habitTemplates'
import { Tutorial, useTutorial } from '@/components/eqrel/Tutorial'
import { getTutorial } from '@/lib/tutorials'
import { haptic } from '@/lib/feedback'

/**
 * VerifySheet — Parent Verify Queue with 3-level rubric.
 *
 * Rubric:
 *   - Ihsan (⭐⭐⭐) : Excellence, +50% points, `excellence` flag
 *   - Sah   (✅)   : Accepted, full points
 *   - Belum (↩️)   : Not yet, 0 points, claim removed (child can retry today)
 */
export function VerifySheet({ open, onClose, onCountChange }) {
  const { t, lang } = useLang()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success' | 'reset' | 'error', text }

  // Tutorial: Ihsan meaning — auto on first open + manual "?" trigger
  const tutIhsan = useTutorial('ihsan_meaning', { autoOpenFirstTime: false })
  useEffect(() => {
    if (open && items.length > 0) {
      try {
        if (!localStorage.getItem('eqrel-tut-v1-ihsan_meaning')) {
          const timer = setTimeout(() => tutIhsan.forceOpen(), 700)
          return () => clearTimeout(timer)
        }
      } catch (e) { /* ignore */ }
    }
  }, [open, items.length, tutIhsan])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/verify-queue/items', { credentials: 'include' })
      const data = await res.json()
      const list = data.items || []
      setItems(list)
      setActiveIdx(0)
      if (onCountChange) onCountChange(list.length)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('verify-queue fetch error', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    if (open) {
      setNote('')
      setToast(null)
      fetchItems()
    }
  }, [open, fetchItems])

  const active = items[activeIdx]

  const timeAgo = (d) => {
    if (!d) return ''
    const diff = Math.max(0, Date.now() - new Date(d).getTime())
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t.verify_claim_time_now
    if (mins < 60) return t.verify_claim_time_min(mins)
    return t.verify_claim_time_hour(Math.floor(mins / 60))
  }

  const applyRubric = async (rubric) => {
    if (!active || busy) return
    // Immediate tap acknowledgement
    haptic.tap()
    setBusy(true)
    setToast(null)
    try {
      const res = await fetch(`/api/verify-queue/items/${active.claimId}/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubric, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'verify failed')

      // toast + tactile confirmation per rubric outcome
      if (rubric === 'belum') {
        haptic.undo()
        setToast({ type: 'reset', text: t.verify_reset })
      } else if (rubric === 'ihsan') {
        haptic.ihsan()
        setToast({ type: 'success', text: t.verify_awarded(data.points) })
      } else {
        haptic.success()
        setToast({ type: 'success', text: t.verify_awarded(data.points) })
      }

      // remove processed item from local list, advance
      setItems(prev => {
        const next = prev.filter((_, i) => i !== activeIdx)
        if (onCountChange) onCountChange(next.length)
        return next
      })
      setActiveIdx((i) => Math.max(0, Math.min(i, items.length - 2)))
      setNote('')

      // clear toast after 2s
      setTimeout(() => setToast(null), 2200)
    } catch (e) {
      haptic.locked()
      setToast({ type: 'error', text: t.verify_error })
      setTimeout(() => setToast(null), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
            style={{ zIndex: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden pointer-events-auto"
            style={{ zIndex: 10 }}
          >
            {/* Drag handle */}
            <div className="pt-2 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-eq-ink/15 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl">🧾</span>
                  <h2 className="text-lg font-extrabold text-emerald-900 truncate">{t.verify_title}</h2>
                </div>
                <p className="text-xs text-emerald-800/60 mt-0.5">{t.verify_subtitle(items.length)}</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-eq-cream/60 hover:bg-eq-cream flex items-center justify-center flex-shrink-0"
                aria-label={t.cancel}
              >
                <X className="w-5 h-5 text-eq-ink/60" />
              </button>
            </div>

            {/* Toast */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`mx-5 mb-2 rounded-xl px-3 py-2 text-sm font-bold border-2 flex items-center gap-2 ${
                    toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    toast.type === 'reset'   ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                               'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {toast.type === 'success' && <Sparkles className="w-4 h-4 shrink-0" fill="currentColor" />}
                  {toast.type === 'reset'   && <RotateCcw className="w-4 h-4 shrink-0" />}
                  {toast.type === 'error'   && <Info className="w-4 h-4 shrink-0" />}
                  <span>{toast.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {loading ? (
                <div className="py-16 text-center text-eq-ink/60">{t.loading}</div>
              ) : items.length === 0 ? (
                // Empty state
                <div className="py-10 text-center">
                  <div className="text-6xl mb-3">🌿</div>
                  <div className="text-emerald-900 font-extrabold text-base">{t.verify_empty_title}</div>
                  <p className="text-emerald-800/60 text-sm mt-2 max-w-[280px] mx-auto leading-relaxed">
                    {t.verify_empty_body}
                  </p>
                </div>
              ) : active ? (
                <>
                  {/* Intro */}
                  {activeIdx === 0 && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-3 py-2 mb-3 text-[11px] text-emerald-800 leading-snug">
                      {t.verify_intro}
                    </div>
                  )}

                  {/* Progress dots */}
                  {items.length > 1 && (
                    <div className="flex justify-center gap-1 mb-3">
                      {items.map((_, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${
                          i === activeIdx ? 'bg-emerald-500 w-4' :
                          i < activeIdx   ? 'bg-emerald-300' : 'bg-eq-ink/15'
                        }`} />
                      ))}
                    </div>
                  )}

                  <ClaimCard item={active} timeAgo={timeAgo} t={t} lang={lang} />

                  {/* Note field */}
                  <div className="mt-3">
                    <label className="text-[11px] font-bold uppercase tracking-wide text-eq-ink/70 block mb-1">
                      {t.verify_note_optional}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t.verify_note_placeholder}
                      rows={2}
                      maxLength={200}
                      className="w-full bg-eq-cream/40 border-2 border-transparent focus:border-eq-green focus:bg-white outline-none rounded-xl px-3 py-2 text-eq-ink text-sm resize-none"
                    />
                  </div>
                </>
              ) : null}
            </div>

            {/* Sticky rubric action bar */}
            {!loading && items.length > 0 && active && (
              <div className="border-t border-eq-cream/60 bg-white/95 backdrop-blur px-3 py-3">
                <div className="grid grid-cols-3 gap-2">
                  <RubricButton
                    kind="belum"
                    label={t.rubric_belum_label}
                    hint={t.rubric_belum_hint}
                    icon="↩️"
                    onClick={() => applyRubric('belum')}
                    disabled={busy}
                  />
                  <RubricButton
                    kind="sah"
                    label={t.rubric_sah_label}
                    hint={t.rubric_sah_hint}
                    icon="✅"
                    onClick={() => applyRubric('sah')}
                    disabled={busy}
                  />
                  <div className="relative">
                    <button
                      onClick={tutIhsan.forceOpen}
                      className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-white shadow-md border-2 border-amber-300 text-amber-700 flex items-center justify-center active:scale-95"
                      aria-label="What is Ihsan?"
                      title="What is Ihsan?"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    <RubricButton
                      kind="ihsan"
                      label={t.rubric_ihsan_label}
                      hint={t.rubric_ihsan_hint}
                      icon="🌟"
                      onClick={() => applyRubric('ihsan')}
                      disabled={busy}
                    />
                  </div>
                </div>
                {busy && (
                  <div className="text-center text-[11px] text-eq-ink/50 mt-2">
                    {t.verify_processing}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      {/* Tutorial: Ihsan meaning */}
      <Tutorial open={tutIhsan.open} onClose={tutIhsan.close} config={getTutorial('ihsan_meaning', lang)} />
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

const ClaimCard = ({ item, timeAgo, t, lang }) => {
  const child = item.child
  const habit = item.habit
  const cat = HABIT_CATEGORIES[habit?.category] || HABIT_CATEGORIES.ibadah
  const catLabel = getCategoryLabel(habit?.category, t)
  const title = getHabitTitle(habit, lang)
  const desc  = getHabitDesc(habit, lang)
  const avatarSrc = child?.avatarId ? AVATAR_BY_ID[child.avatarId]?.src : null
  const favColor = child?.favColor || '#00B894'

  return (
    <div className="bg-white border-2 border-emerald-100 rounded-2xl p-3 shadow-sm">
      {item.daysAgo > 0 && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5" data-testid="verify-late-chip">
          🌙 {item.daysAgo === 1 ? (lang === 'ms' ? 'Untuk semalam' : lang === 'id' ? 'Untuk kemarin' : lang === 'ar' ? 'عن الأمس' : 'For yesterday') : (lang === 'ms' ? `Untuk ${item.daysAgo} hari lalu` : lang === 'ar' ? `قبل ${item.daysAgo} أيام` : `For ${item.daysAgo} days ago`)} · {item.dateStr}
        </div>
      )}
      {/* Child + time */}
      <div className="flex items-center gap-3 mb-2.5">
        <div
          className="w-11 h-11 rounded-full ring-2 overflow-hidden flex-shrink-0 bg-eq-cream"
          style={{ borderColor: favColor, boxShadow: `0 0 0 3px ${favColor}22` }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">🧒</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-eq-ink text-sm leading-tight truncate">
            {t.verify_claim_by(child?.nickname || '—')}
          </div>
          <div className="text-[11px] text-eq-ink/50 mt-0.5">{timeAgo(item.claimedAt)}</div>
        </div>
      </div>

      {/* Habit info */}
      <div className="bg-eq-cream/40 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className="text-base">{cat.icon}</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: cat.color }}
          >
            {catLabel}
          </span>
          <span className="text-[10px] text-eq-ink/40">·</span>
          <span className="text-[10px] text-amber-600 font-extrabold">
            +{habit?.points || 0} {t.habits_points_word}
          </span>
          {!habit?.templateId && (
            <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">
              {t.habits_custom_badge}
            </span>
          )}
        </div>
        <div className="font-bold text-eq-ink text-[15px] leading-tight">{title}</div>
        {desc && (
          <div className="text-[12px] text-eq-ink/60 mt-0.5 leading-snug">{desc}</div>
        )}
      </div>
    </div>
  )
}

const RubricButton = ({ kind, label, hint, icon, onClick, disabled }) => {
  const styles = {
    ihsan: 'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-400 text-amber-900 hover:from-amber-200 hover:to-amber-300',
    sah:   'bg-gradient-to-br from-emerald-100 to-emerald-200 border-emerald-400 text-emerald-900 hover:from-emerald-200 hover:to-emerald-300',
    belum: 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300 text-slate-700 hover:from-slate-200 hover:to-slate-300',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border-2 py-3 px-2 text-center transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${styles[kind]}`}
    >
      <div className="text-xl leading-none mb-1">{icon}</div>
      <div className="text-[13px] font-extrabold leading-none">{label}</div>
      <div className="text-[9px] font-semibold mt-1 leading-tight opacity-80">{hint}</div>
    </button>
  )
}

export default VerifySheet
