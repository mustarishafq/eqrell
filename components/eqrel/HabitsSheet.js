'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Check, Sparkles, ChevronRight, Info, Pencil, HelpCircle, Edit3 } from 'lucide-react'
import { HABIT_CATEGORIES, TEMPLATES_BY_CATEGORY, templatesForAgeBand, getCategoryLabel, getTemplateTitle, getTemplateDesc, getHabitTitle, getHabitDesc } from '@/lib/habitTemplates'
import { TEMPLATE_DEFAULT_SESSION, TEMPLATE_DEFAULT_RECURRING, SESSIONS, getSessionLabel, currentSessionFromClock } from '@/lib/prayerSession'
import { AVATAR_BY_ID, DEFAULT_BOY_ID, DEFAULT_GIRL_ID } from '@/lib/avatars'
import { useLang } from '@/lib/i18n/LangProvider'
import { Tutorial, useTutorial } from '@/components/eqrel/Tutorial'
import { getTutorial } from '@/lib/tutorials'
import { haptic, showBurst } from '@/lib/feedback'
import { DEFAULT_SCHOOL_DAYS, WEEK_ORDER, dayShort, scheduleLabel, scheduleName } from '@/lib/habitSchedule'

const BRIEF_STORAGE_KEY = 'eqrel-habits-brief-seen-v1'

/**
 * HabitsSheet — bottom sheet for viewing/adding habits for a child.
 * Props: { open, onClose, child, onCountChange?(count) }
 *
 * Views: 'brief' (first-time popup) → 'list' (assigned habits) → 'add' (template picker) → 'custom' (custom habit form)
 */
export function HabitsSheet({ open, onClose, child, onCountChange }) {
  const { t, lang } = useLang()
  const [view, setView] = useState('list')
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(null)
  const [busyTemplateId, setBusyTemplateId] = useState(null)
  const [catFilter, setCatFilter] = useState('all')  // filter for grouped list: 'all' | category id

  // Tutorial: category chips + focus (auto-opens on first LIST view)
  const tutCats = useTutorial('parent_habit_categories', { autoOpenFirstTime: false })
  // Tutorial: Ihsan meaning (auto-opens on first rubric picker open + manual "?" trigger)
  const tutIhsan = useTutorial('ihsan_meaning', { autoOpenFirstTime: false })
  useEffect(() => {
    if (open && view === 'list' && habits.length > 0) {
      try {
        if (!localStorage.getItem('eqrel-tut-v1-parent_habit_categories')) {
          const timer = setTimeout(() => tutCats.forceOpen(), 600)
          return () => clearTimeout(timer)
        }
      } catch (e) { /* ignore */ }
    }
  }, [open, view, habits.length, tutCats])

  // Custom habit form
  const [customTitle, setCustomTitle] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customCategory, setCustomCategory] = useState('ibadah')
  const [customPoints, setCustomPoints] = useState(10)
  const [customSession, setCustomSession] = useState('anytime')
  const [customRecurring, setCustomRecurring] = useState('daily')  // 'daily' | 'perPrayer'
  const [editingHabit, setEditingHabit] = useState(null)           // null = create mode, else habit being edited
  const [customSchedule, setCustomSchedule] = useState('daily')    // 'daily' | 'school' | 'weekend' | 'custom'
  const [customDays, setCustomDays] = useState([])
  const [schoolDays, setSchoolDays] = useState(DEFAULT_SCHOOL_DAYS)
  const [allKids, setAllKids] = useState([])                       // for "give to these children"
  const [targetKids, setTargetKids] = useState([])
  const [famTemplates, setFamTemplates] = useState([])             // family-made templates (create once, add to any child)
  const [famBusy, setFamBusy] = useState(null)
  const [saving, setSaving] = useState(false)

  const avatarSrc = child ? (AVATAR_BY_ID[child.avatarId]?.src ||
    (child.gender === 'female' ? AVATAR_BY_ID[DEFAULT_GIRL_ID].src : AVATAR_BY_ID[DEFAULT_BOY_ID].src)) : null

  // Load habits when child changes. Use child.id (stable primitive) instead of child object.
  const childId = child?.id
  useEffect(() => {
    if (!open || !childId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/children/${childId}/habits?all=1`, { credentials: 'include' })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setHabits(data.habits || [])
          if (Array.isArray(data.schoolDays)) setSchoolDays(data.schoolDays)
          onCountChange?.(data.habits?.length || 0)
        }
        const [rk, rt] = await Promise.all([
          fetch('/api/children', { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/habit-templates', { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
        ])
        if (cancelled) return
        setAllKids(rk?.children || [])
        setFamTemplates(rt?.templates || [])
      } catch (e) { console.error(e) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, childId])

  // First-time brief popup: check localStorage once when sheet opens
  useEffect(() => {
    if (!open) return
    try {
      if (!localStorage.getItem(BRIEF_STORAGE_KEY)) {
        setView('brief')
      } else {
        setView('list')
      }
    } catch (e) { setView('list') }
  }, [open])

  const dismissBrief = () => {
    try { localStorage.setItem(BRIEF_STORAGE_KEY, '1') } catch { /* ignore */ }
    setView('list')
  }

  const templates = useMemo(() => templatesForAgeBand(child?.ageBand), [child?.ageBand])

  const templateIdToHabit = useMemo(() => {
    const map = {}
    for (const h of habits) if (h.templateId) map[h.templateId] = h
    return map
  }, [habits])
  const famTplToHabit = useMemo(() => {
    const map = {}
    for (const h of habits) if (h.familyTemplateId) map[h.familyTemplateId] = h
    return map
  }, [habits])

  // Family template: add to / remove from THIS child
  const toggleFamTemplate = async (tpl) => {
    if (!childId || famBusy) return
    setFamBusy(tpl.id)
    try {
      const existing = famTplToHabit[tpl.id]
      if (existing) {
        const r = await fetch(`/api/habits/${existing.id}`, { method: 'DELETE', credentials: 'include' })
        if (r.ok) setHabits(prev => { const next = prev.filter(h => h.id !== existing.id); onCountChange?.(next.length); return next })
      } else {
        const r = await fetch(`/api/children/${childId}/habits`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ familyTemplateId: tpl.id }),
        })
        if (r.ok) {
          const d = await r.json()
          if (!d.duplicate) setHabits(prev => { const next = [...prev, { ...d.habit, todayStatus: 'pending' }]; onCountChange?.(next.length); return next })
        }
      }
    } catch (e) { console.error(e) }
    finally { setFamBusy(null) }
  }
  const deleteFamTemplate = async (tpl) => {
    const msg = lang === 'ms' ? `Padam template "${tpl.title}"? Habit yang sudah diberi kepada anak kekal.` : lang === 'id' ? `Hapus template "${tpl.title}"? Kebiasaan yang sudah diberikan tetap ada.` : lang === 'ar' ? `حذف القالب «${tpl.title}»؟ تبقى العادات المضافة للأطفال.` : `Delete template "${tpl.title}"? Habits already given to children stay.`
    if (!window.confirm(msg)) return
    const r = await fetch(`/api/habit-templates/${tpl.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    if (r?.ok) setFamTemplates(prev => prev.filter(x => x.id !== tpl.id))
  }
  const saveSchoolDays = async (days) => {
    const prev = schoolDays
    setSchoolDays(days)
    const r = await fetch('/api/family/school-days', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) }).catch(() => null)
    if (!r?.ok) setSchoolDays(prev)
  }

  const assignFromTemplate = useCallback(async (tpl) => {
    if (!childId || busyTemplateId) return
    setBusyTemplateId(tpl.id)
    try {
      const res = await fetch(`/api/children/${childId}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          templateId: tpl.id,
          category: tpl.category,
          session: TEMPLATE_DEFAULT_SESSION[tpl.id] || 'anytime',
          recurring: TEMPLATE_DEFAULT_RECURRING[tpl.id] || 'daily',
          title: tpl.title,
          desc: tpl.desc,
          points: tpl.points,
          frequency: tpl.frequency,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setHabits(prev => {
          const next = [...prev, { ...data.habit, todayStatus: 'pending' }]
          onCountChange?.(next.length)
          return next
        })
      }
    } catch (e) { console.error(e) }
    finally { setBusyTemplateId(null) }
  }, [childId, busyTemplateId, onCountChange])

  const unassignHabit = useCallback(async (habitId) => {
    if (busyTemplateId) return
    setBusyTemplateId('__unassign__' + habitId)
    try {
      const res = await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setHabits(prev => {
          const next = prev.filter(h => h.id !== habitId)
          onCountChange?.(next.length)
          return next
        })
      }
    } catch (e) { console.error(e) }
    finally { setBusyTemplateId(null) }
  }, [busyTemplateId, onCountChange])

  const toggleTemplate = (tpl) => {
    const existing = templateIdToHabit[tpl.id]
    if (existing) {
      unassignHabit(existing.id)
    } else {
      assignFromTemplate(tpl)
    }
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)  // habitId pending delete confirmation

  const removeHabit = (habitId) => {
    setConfirmDeleteId(habitId)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    await unassignHabit(confirmDeleteId)
    setConfirmDeleteId(null)
  }

  const isParentLogMode = child?.claimMode === 'parent' || !child?.claimMode
  const [rubricPickerHabit, setRubricPickerHabit] = useState(null)

  // Auto-open Ihsan tutorial the first time the rubric picker appears
  useEffect(() => {
    if (rubricPickerHabit) {
      try {
        if (!localStorage.getItem('eqrel-tut-v1-ihsan_meaning')) {
          const timer = setTimeout(() => tutIhsan.forceOpen(), 300)
          return () => clearTimeout(timer)
        }
      } catch (e) { /* ignore */ }
    }
  }, [rubricPickerHabit, tutIhsan])

  // Quick tap in parent-log mode = auto-Sah (or undo if already done)
  // Quick tap in self mode = classic toggle (claimed/pending)
  const toggleClaim = async (habit) => {
    // Per-prayer habits (e.g. Wudhu) require a session — derive from current clock
    // if the caller didn't provide one (aggregate row in the Parent list view).
    const isPerPrayer = habit._isPerPrayer || habit.recurring === 'perPrayer'
    const sessionForClaim = isPerPrayer
      ? (habit._sessionInstance || currentSessionFromClock())
      : null

    // For per-prayer, "done" is per-session (based on sessionsClaimed[])
    const sessionsClaimed = Array.isArray(habit.sessionsClaimed) ? habit.sessionsClaimed : []
    const isDone = isPerPrayer
      ? sessionsClaimed.includes(sessionForClaim)
      : (habit.todayStatus === 'claimed' || habit.todayStatus === 'verified')

    // Immediate tactile ack — parents feel their tap register instantly
    haptic.tap()
    try {
      if (isDone) {
        // Undo — allow removing today's claim regardless of mode
        const url = sessionForClaim
          ? `/api/habits/${habit.id}/claim?session=${encodeURIComponent(sessionForClaim)}`
          : `/api/habits/${habit.id}/claim`
        await fetch(url, {
          method: 'DELETE', credentials: 'include',
        })
        haptic.undo()
        // For per-prayer, remove ONLY this session from sessionsClaimed; else reset row
        setHabits(prev => prev.map(h => {
          if (h.id !== habit.id) return h
          if (isPerPrayer) {
            const nextSessions = sessionsClaimed.filter(s => s !== sessionForClaim)
            return {
              ...h,
              sessionsClaimed: nextSessions,
              todayStatus: nextSessions.length > 0 ? 'claimed' : 'pending',
            }
          }
          return { ...h, todayStatus: 'pending', rubric: null, pointsAwarded: null }
        }))
        return
      }
      if (isParentLogMode) {
        // Quick Sah
        const body = { rubric: 'sah' }
        if (sessionForClaim) body.session = sessionForClaim
        const res = await fetch(`/api/habits/${habit.id}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          haptic.locked()
          return
        }
        const data = await res.json().catch(() => ({}))
        haptic.success()
        // Floating "+points" burst on the tapped row
        const rowEl = typeof document !== 'undefined'
          ? document.querySelector(`[data-habitrow-id="${habit.id}"]`)
          : null
        if (rowEl) {
          showBurst(rowEl, { text: `+${data.points ?? habit.points}`, variant: 'success' })
        }
        setHabits(prev => prev.map(h => {
          if (h.id !== habit.id) return h
          if (isPerPrayer) {
            const nextSessions = Array.from(new Set([...sessionsClaimed, sessionForClaim]))
            return {
              ...h,
              sessionsClaimed: nextSessions,
              todayStatus: 'claimed', // aggregate: at least one session done
            }
          }
          return { ...h, todayStatus: 'verified', rubric: 'sah', pointsAwarded: data.points ?? h.points }
        }))
      } else {
        // Self mode — legacy behavior: mark as pending claim
        const body = { status: 'claimed' }
        if (sessionForClaim) body.session = sessionForClaim
        const res = await fetch(`/api/habits/${habit.id}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          haptic.locked()
          return
        }
        haptic.success()
        setHabits(prev => prev.map(h => {
          if (h.id !== habit.id) return h
          if (isPerPrayer) {
            const nextSessions = Array.from(new Set([...sessionsClaimed, sessionForClaim]))
            return { ...h, sessionsClaimed: nextSessions, todayStatus: 'claimed' }
          }
          return { ...h, todayStatus: 'claimed' }
        }))
      }
    } catch (e) { console.error(e) }
  }

  // Long-press in parent-log mode → open rubric picker
  const openRubricPicker = (habit) => {
    if (!isParentLogMode) return
    haptic.select()
    setRubricPickerHabit(habit)
  }

  const applyRubricPick = async (rubric) => {
    if (!rubricPickerHabit) return
    const habit = rubricPickerHabit
    setRubricPickerHabit(null)
    haptic.tap()

    // Per-prayer session derivation
    const isPerPrayer = habit._isPerPrayer || habit.recurring === 'perPrayer'
    const sessionForClaim = isPerPrayer
      ? (habit._sessionInstance || currentSessionFromClock())
      : null
    const sessionsClaimed = Array.isArray(habit.sessionsClaimed) ? habit.sessionsClaimed : []

    try {
      const body = { rubric }
      if (sessionForClaim) body.session = sessionForClaim
      const res = await fetch(`/api/habits/${habit.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        haptic.locked()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (rubric === 'belum') {
        haptic.undo()
        setHabits(prev => prev.map(h => {
          if (h.id !== habit.id) return h
          if (isPerPrayer) {
            const nextSessions = sessionsClaimed.filter(s => s !== sessionForClaim)
            return {
              ...h,
              sessionsClaimed: nextSessions,
              todayStatus: nextSessions.length > 0 ? 'claimed' : 'pending',
            }
          }
          return { ...h, todayStatus: 'pending', rubric: null, pointsAwarded: null }
        }))
      } else {
        if (rubric === 'ihsan') haptic.ihsan()
        else haptic.success()
        // Floating burst
        const rowEl = typeof document !== 'undefined'
          ? document.querySelector(`[data-habitrow-id="${habit.id}"]`)
          : null
        if (rowEl) {
          showBurst(rowEl, {
            text: `+${data.points ?? habit.points}`,
            variant: rubric === 'ihsan' ? 'ihsan' : 'success',
          })
        }
        setHabits(prev => prev.map(h => {
          if (h.id !== habit.id) return h
          if (isPerPrayer) {
            const nextSessions = Array.from(new Set([...sessionsClaimed, sessionForClaim]))
            return { ...h, sessionsClaimed: nextSessions, todayStatus: 'claimed' }
          }
          return { ...h, todayStatus: 'verified', rubric, pointsAwarded: data.points ?? h.points }
        }))
      }
    } catch (e) { console.error(e) }
  }

  const openEditHabit = (habit) => {
    setEditingHabit(habit)
    setCustomTitle(habit.title || '')
    setCustomDesc(habit.desc || '')
    setCustomCategory(habit.category || 'ibadah')
    setCustomPoints(habit.points ?? 10)
    setCustomSession(habit.session || 'anytime')
    setCustomRecurring(habit.recurring === 'perPrayer' ? 'perPrayer' : 'daily')
    setCustomSchedule(habit.schedule || 'daily')
    setCustomDays(Array.isArray(habit.days) ? habit.days : [])
    setView('custom')
  }
  const openCreateCustom = () => {
    resetCustomForm()
    setTargetKids(childId ? [childId] : [])
    setView('custom')
  }

  const resetCustomForm = () => {
    setEditingHabit(null)
    setCustomTitle(''); setCustomDesc(''); setCustomCategory('ibadah'); setCustomPoints(10)
    setCustomSession('anytime'); setCustomRecurring('daily')
    setCustomSchedule('daily'); setCustomDays([])
  }

  const submitCustom = async () => {
    if (!childId || !customTitle.trim()) return
    try {
      // EDIT mode → PATCH existing habit
      if (editingHabit) {
        const res = await fetch(`/api/habits/${editingHabit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            category: customCategory,
            session: customSession,
            recurring: customRecurring,
            title: customTitle.trim(),
            desc: customDesc.trim(),
            points: Math.max(1, Math.min(50, parseInt(customPoints) || 10)),
            schedule: customSchedule,
            days: customDays,
          }),
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setHabits(prev => prev.map(h => h.id === editingHabit.id
            ? { ...h, ...(data.habit || {}),
                category: customCategory, session: customSession,
                recurring: customRecurring, title: customTitle.trim(),
                desc: customDesc.trim(),
                points: Math.max(1, Math.min(50, parseInt(customPoints) || 10)) }
            : h))
          resetCustomForm()
          setView('list')
        }
        return
      }
      // CREATE mode → save as a family template + give it to every ticked child in one go
      if (saving) return
      setSaving(true)
      const res = await fetch('/api/habit-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category: customCategory,
          session: customSession,
          recurring: customRecurring,
          title: customTitle.trim(),
          desc: customDesc.trim(),
          points: Math.max(1, Math.min(50, parseInt(customPoints) || 10)),
          frequency: 'daily',
          schedule: customSchedule,
          days: customDays,
          childIds: targetKids.length ? targetKids : [childId],
        }),
      })
      setSaving(false)
      if (res.ok) {
        const data = await res.json()
        if (data.template) setFamTemplates(prev => [...prev, data.template])
        const mine = (data.habits || []).find(h => h.childId === childId)
        if (mine) {
          setHabits(prev => {
            const next = [...prev, { ...mine, todayStatus: 'pending' }]
            onCountChange?.(next.length)
            return next
          })
        }
        resetCustomForm()
        setView('list')
      }
    } catch (e) { console.error(e) }
  }

  const todayHabits = habits.filter(h => !h.offToday)
  const totalPoints = todayHabits.reduce((sum, h) =>
    sum + ((h.todayStatus === 'claimed' || h.todayStatus === 'verified') ? h.points : 0), 0)
  const completedCount = todayHabits.filter(h => h.todayStatus === 'claimed' || h.todayStatus === 'verified').length

  return (
    <AnimatePresence>
      {open && child && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center pointer-events-none"
        >
          {/* Backdrop behind sheet — click to close (explicit z-0 to sit behind sheet) */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
            style={{ zIndex: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative bg-white w-full max-w-md rounded-t-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col pointer-events-auto"
            style={{ zIndex: 10 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-eq-ink/15 rounded-full" />
            </div>

            {/* Header with child avatar */}
            <div className="flex items-center gap-3 px-5 py-2 flex-shrink-0 border-b border-eq-cream/50">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-amber-50 to-white flex-shrink-0 ring-2 ring-emerald-100">
                {avatarSrc && <img src={avatarSrc} alt={child.nickname} className="w-full h-full object-contain object-top" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-eq-ink/60">{t.habits_for}</div>
                <div className="font-extrabold text-eq-ink text-lg leading-tight truncate">{child.nickname}</div>
              </div>
              {view === 'list' && (
                <>
                  <button
                    onClick={tutCats.forceOpen}
                    className="w-9 h-9 rounded-full hover:bg-eq-cream flex items-center justify-center flex-shrink-0"
                    title="Help"
                    aria-label="Help"
                  >
                    <HelpCircle className="w-5 h-5 text-eq-ink/60" />
                  </button>
                  <button
                    onClick={() => { setView('brief') }}
                    className="w-9 h-9 rounded-full hover:bg-eq-cream flex items-center justify-center flex-shrink-0"
                    title={t.habits_help_aria}
                  >
                    <Info className="w-5 h-5 text-eq-ink/60" />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full hover:bg-eq-cream flex items-center justify-center flex-shrink-0"
                aria-label={lang === 'ar' ? 'إغلاق' : lang === 'en' ? 'Close' : 'Tutup'}
              >
                <X className="w-5 h-5 text-eq-ink/60" />
              </button>
            </div>

            {/* ═══ BRIEF POPUP ═══ */}
            {view === 'brief' && (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="text-center">
                  <div className="text-4xl mb-1">🌱</div>
                  <h3 className="text-lg font-extrabold text-emerald-900">{t.habits_brief_title}</h3>
                  <p className="text-emerald-800/60 text-xs mt-0.5">{t.habits_brief_for(child.nickname)}</p>
                </div>

                {[
                  { icon: '📚', title: t.habits_brief_step1_title, body: t.habits_brief_step1_body(child.ageBand) },
                  { icon: '✏️', title: t.habits_brief_step2_title, body: t.habits_brief_step2_body },
                  { icon: '✨', title: t.habits_brief_step3_title, body: t.habits_brief_step3_body },
                  { icon: '💛', title: t.habits_brief_step4_title, body: t.habits_brief_step4_body },
                ].map((item, i) => (
                  <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-start gap-3">
                    <div className="text-2xl">{item.icon}</div>
                    <div>
                      <div className="font-bold text-emerald-900 text-sm">{item.title}</div>
                      <div className="text-emerald-800/70 text-xs mt-0.5 leading-snug">{item.body}</div>
                    </div>
                  </div>
                ))}

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mt-2">
                  <p className="text-amber-900 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: t.habits_brief_tip }} />
                </div>

                <button
                  onClick={dismissBrief}
                  className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-extrabold py-3.5 rounded-2xl shadow-lg active:scale-[0.99]"
                >
                  {t.habits_brief_start}
                </button>
              </div>
            )}

            {/* ═══ LIST VIEW ═══ */}
            {view === 'list' && (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {habits.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200">
                      <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">{t.habits_done_today}</div>
                      <div className="text-2xl font-extrabold text-emerald-800 mt-0.5">
                        {completedCount}<span className="text-sm opacity-60">/{todayHabits.length}</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200">
                      <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">{t.habits_mata}</div>
                      <div className="text-2xl font-extrabold text-amber-800 mt-0.5 flex items-baseline gap-1">
                        +{totalPoints}<Sparkles className="w-4 h-4 text-amber-500" fill="#FFB703" />
                      </div>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 rounded-full border-3 border-emerald-200 border-t-emerald-500 animate-spin" />
                  </div>
                )}

                {!loading && habits.length === 0 && (
                  <div className="text-center py-6">
                    <div className="text-5xl mb-2">🌱</div>
                    <p className="text-eq-ink font-bold">{t.habits_no_habit}</p>
                    <p className="text-eq-ink/60 text-sm mt-1 mb-3">{t.habits_empty_hint}</p>
                  </div>
                )}

                {!loading && habits.length > 0 && isParentLogMode && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-[11px] text-amber-900 leading-snug">
                    {t.parent_log_tap_hint}
                  </div>
                )}

                {!loading && habits.length > 0 && (() => {
                  // Group habits by category
                  const groups = {}
                  habits.forEach(h => {
                    const c = h.category || 'ibadah'
                    if (!groups[c]) groups[c] = []
                    groups[c].push(h)
                  })
                  // Sort within each group: incomplete first
                  Object.values(groups).forEach(list => list.sort((a, b) => {
                    if (!!a.offToday !== !!b.offToday) return a.offToday ? 1 : -1
                    const aDone = a.todayStatus === 'claimed' || a.todayStatus === 'verified'
                    const bDone = b.todayStatus === 'claimed' || b.todayStatus === 'verified'
                    return aDone === bDone ? 0 : (aDone ? 1 : -1)
                  }))
                  // Order groups by HABIT_CATEGORIES declaration; complete-all groups fall to bottom
                  const groupList = Object.keys(HABIT_CATEGORIES)
                    .filter(id => groups[id])
                    .map(id => {
                      const list = groups[id]
                      const due = list.filter(h => !h.offToday)
                      const done = due.filter(h => h.todayStatus === 'claimed' || h.todayStatus === 'verified').length
                      return { id, list, done, total: due.length, allDone: due.length > 0 && done === due.length }
                    })
                  groupList.sort((a, b) => (a.allDone === b.allDone ? 0 : a.allDone ? 1 : -1))

                  // Apply category filter
                  const filteredGroups = catFilter === 'all' ? groupList : groupList.filter(g => g.id === catFilter)
                  const overallDone = completedCount

                  const renderHabit = (habit) => {
                    const cat = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.ibadah
                    const isDone = habit.todayStatus === 'claimed' || habit.todayStatus === 'verified'
                    const isIhsan = habit.rubric === 'ihsan'
                    const displayTitle = getHabitTitle(habit, lang)
                    const displayDesc  = getHabitDesc(habit, lang)
                    const shownPts = habit.pointsAwarded ?? habit.points
                    const isOff = !!habit.offToday
                    const schedTxt = scheduleLabel(habit, lang, schoolDays)

                    let pressTimer = null
                    const startPress = () => {
                      if (!isParentLogMode || isDone) return
                      pressTimer = setTimeout(() => { openRubricPicker(habit); pressTimer = null }, 550)
                    }
                    const endPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null } }

                    return (
                      <div key={habit.id} data-habitrow-id={habit.id} className={`relative rounded-2xl p-3 border-2 transition-all ${
                        isOff ? 'bg-slate-50 border-dashed border-slate-200 opacity-75' :
                        isIhsan ? 'bg-amber-50 border-amber-300' :
                        isDone ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-eq-cream'
                      }`}>
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => { if (!isOff) toggleClaim(habit) }}
                            disabled={isOff}
                            onPointerDown={startPress}
                            onPointerUp={endPress}
                            onPointerLeave={endPress}
                            onContextMenu={(e) => { e.preventDefault(); openRubricPicker(habit) }}
                            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all touch-none select-none ${
                              isIhsan ? 'bg-amber-500 border-amber-500 scale-105' :
                              isDone ? 'bg-emerald-500 border-emerald-500 scale-105' :
                                       'bg-white border-eq-ink/20 hover:border-emerald-400'
                            }`}
                            aria-label={isDone ? t.habits_undo : t.habits_mark_done}
                          >
                            {isIhsan ? <Sparkles className="w-5 h-5 text-white" fill="white" /> :
                             isDone ? <Check className="w-5 h-5 text-white" strokeWidth={3} /> : null}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className={`text-[10px] font-bold ${isIhsan ? 'text-amber-700' : 'text-amber-600'}`}>+{shownPts} {t.habits_points_word}{isIhsan ? ' 🌟' : ''}</span>
                              {!habit.templateId && (
                                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">{t.habits_custom_badge}</span>
                              )}
                              {schedTxt && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isOff ? 'bg-slate-200 text-slate-600' : 'bg-indigo-50 text-indigo-700'}`} data-testid={`habit-schedule-${habit.id}`}>
                                  {isOff ? '🌙 ' : '📅 '}{schedTxt}{isOff ? ` · ${lang === 'ms' ? 'rehat hari ini' : lang === 'id' ? 'libur hari ini' : lang === 'ar' ? 'ليست اليوم' : 'not today'}` : ''}
                                </span>
                              )}
                            </div>
                            <div className={`font-bold text-sm leading-tight ${isDone ? 'text-emerald-900 line-through opacity-70' : 'text-eq-ink'}`}>
                              {displayTitle}
                            </div>
                            {displayDesc && (
                              <div className="text-[11px] text-eq-ink/60 mt-0.5 leading-snug">{displayDesc}</div>
                            )}
                          </div>
                          <button
                            onClick={() => openEditHabit(habit)}
                            className="w-8 h-8 rounded-full hover:bg-blue-50 flex items-center justify-center flex-shrink-0"
                            aria-label={lang === 'ar' ? 'تعديل' : lang === 'en' ? 'Edit' : lang === 'id' ? 'Edit' : 'Edit'}
                          >
                            <Edit3 className="w-4 h-4 text-blue-500/80" />
                          </button>
                          {habit.core ? (
                            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex-shrink-0" data-testid={`habit-core-${habit.id}`}
                              title={lang === 'ms' ? 'Solat Teras — tidak boleh dibuang, boleh dijeda di tab Tasks' : 'Core prayer — cannot be removed, can be paused in the Tasks tab'}>
                              🕌 {lang === 'ms' ? 'Teras' : lang === 'id' ? 'Inti' : lang === 'ar' ? 'أساسي' : 'Core'}
                            </span>
                          ) : (
                          <button
                            onClick={() => removeHabit(habit.id)}
                            className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center flex-shrink-0"
                            aria-label={t.habits_delete_aria}
                          >
                            <Trash2 className="w-4 h-4 text-red-500/70" />
                          </button>
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-3">
                      {/* Category shortcut chips — 3×2 grid, always visible */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <HabitCategoryChip
                          active={catFilter === 'all'}
                          label={t.kid_cat_all}
                          icon="✨"
                          color="#00B894"
                          done={overallDone}
                          total={todayHabits.length}
                          onClick={() => setCatFilter('all')}
                        />
                        {Object.keys(HABIT_CATEGORIES).map(id => {
                          const cat = HABIT_CATEGORIES[id]
                          const g = groupList.find(x => x.id === id)
                          if (!g) {
                            return (
                              <HabitCategoryChip
                                key={id}
                                disabled
                                label={getCategoryLabel(id, t)}
                                icon={cat.icon}
                                color={cat.color}
                                done={0}
                                total={0}
                                onClick={() => {}}
                              />
                            )
                          }
                          return (
                            <HabitCategoryChip
                              key={id}
                              active={catFilter === id}
                              label={getCategoryLabel(id, t)}
                              icon={g.allDone ? '✅' : cat.icon}
                              color={cat.color}
                              done={g.done}
                              total={g.total}
                              allDone={g.allDone}
                              onClick={() => setCatFilter(id)}
                            />
                          )
                        })}
                      </div>

                      {filteredGroups.map(g => {
                        const cat = HABIT_CATEGORIES[g.id]
                        const catLabel = getCategoryLabel(g.id, t)
                        const pct = g.total > 0 ? Math.round((g.done / g.total) * 100) : 0
                        return (
                          <div key={g.id}
                            className={`rounded-3xl border-2 p-2.5 ${
                              g.allDone ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-300' : 'bg-eq-cream/30 border-eq-cream'
                            }`}
                            style={!g.allDone ? { boxShadow: `0 0 0 1px ${cat.color}22` } : undefined}
                          >
                            <div className="flex items-center gap-2.5 px-1 pb-2">
                              <div
                                className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                                style={{ background: g.allDone ? `${cat.color}33` : `${cat.color}22` }}
                              >
                                {g.allDone ? '✅' : cat.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div className="text-sm font-extrabold uppercase tracking-wide" style={{ color: cat.color }}>
                                    {catLabel}
                                  </div>
                                  <div className="text-xs font-bold text-eq-ink/60">
                                    {g.done}/{g.total}
                                  </div>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-white overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${pct}%`,
                                      background: `linear-gradient(90deg, ${cat.color}, ${cat.color}dd)`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2 pt-1">
                              {g.list.map(renderHabit)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Add habit buttons — always visible */}
                {!loading && (
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => { setActiveCategory(null); setView('add') }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-extrabold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-[0.99]"
                    >
                      <Plus className="w-5 h-5" strokeWidth={3} /> {t.habits_add_template}
                    </button>
                    <button
                      onClick={openCreateCustom}
                      data-testid="habits-add-custom"
                      className="w-full bg-white border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-extrabold py-2.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                      <Pencil className="w-4 h-4" strokeWidth={2.5} /> {t.habits_add_custom}
                    </button>
                  </div>
                )}

                <div className="h-2" />
              </div>
            )}

            {/* ═══ ADD (TEMPLATE PICKER) ═══ */}
            {view === 'add' && (
              <div className="flex-1 overflow-y-auto">
                <div className="sticky top-0 bg-white z-10 px-5 pt-3 pb-2 border-b border-eq-cream/50">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setView('list')} className="text-emerald-700 font-bold text-sm flex items-center gap-1">
                      {t.setup_back}
                    </button>
                    <div className="text-xs text-eq-ink/60">
                      {t.habits_add_header_age} <span className="font-bold text-emerald-700">{child.ageBand}</span> · {t.habits_add_header_count(habits.length)}
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5 mb-2 text-[11px] text-emerald-800">
                    {t.habits_template_hint}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-1 no-scrollbar">
                    <button
                      onClick={() => setActiveCategory(null)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        activeCategory === null ? 'bg-emerald-500 text-white' : 'bg-eq-cream/50 text-eq-ink'
                      }`}
                    >
                      {t.habits_all_category}
                    </button>
                    {Object.entries(HABIT_CATEGORIES).map(([id, cat]) => (
                      <button key={id}
                        onClick={() => setActiveCategory(id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                          activeCategory === id ? 'text-white' : 'bg-eq-cream/50 text-eq-ink'
                        }`}
                        style={activeCategory === id ? { background: cat.color } : {}}
                      >
                        <span>{cat.icon}</span> {getCategoryLabel(id, t)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-3 space-y-2">
                  {famTemplates.filter(tpl => activeCategory === null || tpl.category === activeCategory).length > 0 && (
                    <div className="rounded-2xl bg-purple-50/60 border border-purple-100 p-2.5 space-y-2" data-testid="habits-family-templates">
                      <div className="text-[10px] font-black uppercase tracking-wider text-purple-700 px-1">
                        👨‍👩‍👧 {lang === 'ms' ? 'Template keluarga anda' : lang === 'id' ? 'Template keluarga Anda' : lang === 'ar' ? 'قوالب عائلتك' : 'Your family templates'}
                      </div>
                      {famTemplates.filter(tpl => activeCategory === null || tpl.category === activeCategory).map(tpl => {
                        const cat = HABIT_CATEGORIES[tpl.category] || HABIT_CATEGORIES.ibadah
                        const assigned = !!famTplToHabit[tpl.id]
                        const sched = scheduleLabel(tpl, lang, schoolDays)
                        const others = (tpl.childIds || []).filter(id => id !== childId).map(id => allKids.find(k => k.id === id)?.nickname).filter(Boolean)
                        return (
                          <div key={tpl.id} className={`rounded-2xl p-3 border-2 flex items-start gap-2 ${assigned ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-eq-cream'}`} data-testid={`famtpl-${tpl.id}`}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${cat.color}22` }}>{cat.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span className="text-[10px] text-amber-600 font-bold">+{tpl.points} {t.habits_points_word}</span>
                                {sched && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700">📅 {sched}</span>}
                              </div>
                              <div className="font-bold text-sm text-eq-ink leading-tight">{tpl.title}</div>
                              {others.length > 0 && <div className="text-[10px] text-eq-ink/50 mt-0.5">{lang === 'ms' ? 'Juga untuk' : lang === 'id' ? 'Juga untuk' : lang === 'ar' ? 'أيضاً لـ' : 'Also for'}: {others.join(', ')}</div>}
                            </div>
                            <button onClick={() => deleteFamTemplate(tpl)} aria-label="delete template" data-testid={`famtpl-del-${tpl.id}`}
                              className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center flex-shrink-0 self-center">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                            <button onClick={() => toggleFamTemplate(tpl)} disabled={famBusy === tpl.id} data-testid={`famtpl-toggle-${tpl.id}`}
                              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 self-center ${assigned ? 'bg-emerald-500' : 'border-2 border-emerald-500'} ${famBusy === tpl.id ? 'opacity-50' : ''}`}>
                              {assigned ? <Check className="w-5 h-5 text-white" strokeWidth={3} /> : <Plus className="w-4 h-4 text-emerald-500" strokeWidth={3} />}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {templates
                    .filter(tpl => activeCategory === null || tpl.category === activeCategory)
                    .map(tpl => {
                      const cat = HABIT_CATEGORIES[tpl.category]
                      const catLabel = getCategoryLabel(tpl.category, t)
                      const assignedHabit = templateIdToHabit[tpl.id]
                      const isAssigned = !!assignedHabit
                      const isBusy = busyTemplateId === tpl.id || busyTemplateId === '__unassign__' + assignedHabit?.id
                      return (
                        <button
                          key={tpl.id}
                          disabled={isBusy}
                          onClick={() => toggleTemplate(tpl)}
                          className={`w-full text-left rounded-2xl p-3 border-2 transition-all flex items-start gap-2 active:scale-[0.99] ${
                            isAssigned
                              ? 'bg-emerald-50 border-emerald-400'
                              : 'bg-white border-eq-cream hover:border-emerald-300 hover:bg-emerald-50/30'
                          } ${isBusy ? 'opacity-60' : ''}`}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ background: `${cat.color}22` }}
                          >
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>{catLabel}</span>
                              <span className="text-[10px] text-amber-600 font-bold">+{tpl.points} {t.habits_points_word}</span>
                            </div>
                            <div className="font-bold text-sm text-eq-ink leading-tight">{getTemplateTitle(tpl, lang)}</div>
                            <div className="text-[11px] text-eq-ink/60 mt-0.5 leading-snug">{getTemplateDesc(tpl, lang)}</div>
                          </div>
                          <div className="flex-shrink-0 self-center">
                            {isAssigned ? (
                              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="w-5 h-5 text-white" strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-emerald-500" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  <div className="h-4" />
                </div>

                {/* Sticky bottom done button */}
                <div className="sticky bottom-0 bg-white border-t border-eq-cream/50 px-5 py-3">
                  <button
                    onClick={() => setView('list')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl active:scale-[0.99]"
                  >
                    {t.habits_pick_done(habits.length)}
                  </button>
                </div>
              </div>
            )}

            {/* ═══ CUSTOM HABIT FORM ═══ */}
            {view === 'custom' && (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => { resetCustomForm(); setView('list') }} className="text-emerald-700 font-bold text-sm flex items-center gap-1">
                    {t.setup_back}
                  </button>
                  <div className="text-xs text-eq-ink/60 flex items-center gap-1">
                    {editingHabit ? (
                      <>
                        <Edit3 className="w-3 h-3 text-blue-600" />
                        <span className="text-blue-700 font-black">
                          {lang === 'ar' ? 'تعديل العادة' : lang === 'en' ? 'Edit habit' : lang === 'id' ? 'Edit kebiasaan' : 'Edit habit'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Pencil className="w-3 h-3" /> {t.habits_custom_title}
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-eq-ink block mb-1">{t.habits_custom_title_label}</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={t.habits_custom_title_placeholder}
                    className="w-full bg-eq-cream/50 border-2 border-transparent focus:border-eq-green focus:bg-white outline-none rounded-xl px-4 py-3 text-eq-ink font-medium"
                    maxLength={80}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-eq-ink block mb-1">{t.habits_custom_desc}</label>
                  <textarea
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder={t.habits_custom_desc_placeholder}
                    rows={2}
                    className="w-full bg-eq-cream/50 border-2 border-transparent focus:border-eq-green focus:bg-white outline-none rounded-xl px-4 py-2 text-eq-ink text-sm resize-none"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-eq-ink block mb-1">{t.habits_custom_category}</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Object.entries(HABIT_CATEGORIES).map(([id, cat]) => (
                      <button key={id}
                        onClick={() => setCustomCategory(id)}
                        className={`rounded-xl p-2 border-2 flex flex-col items-center gap-0.5 transition-all ${
                          customCategory === id ? 'scale-[1.02]' : 'opacity-60'
                        }`}
                        style={customCategory === id
                          ? { borderColor: cat.color, background: `${cat.color}15` }
                          : { borderColor: 'transparent', background: '#F5F5F0' }}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-[9px] font-bold text-eq-ink text-center leading-tight">{getCategoryLabel(id, t)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-eq-ink block mb-1">{t.habits_custom_points}</label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map(p => (
                      <button key={p}
                        onClick={() => setCustomPoints(p)}
                        className={`flex-1 rounded-xl py-2 font-extrabold text-sm border-2 transition-all ${
                          customPoints === p ? 'border-eq-green bg-eq-green/10 text-eq-green' : 'border-transparent bg-eq-cream/50 text-eq-ink'
                        }`}
                      >
                        +{p}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={customPoints}
                      onChange={(e) => setCustomPoints(e.target.value)}
                      className="w-16 rounded-xl border-2 border-transparent bg-eq-cream/50 focus:border-eq-green focus:bg-white outline-none text-center font-extrabold text-sm text-eq-ink"
                    />
                  </div>
                </div>

                {/* Session (waktu) picker */}
                <div>
                  <label className="block text-[11px] font-extrabold text-eq-ink/70 mb-1.5 uppercase tracking-wider">
                    {lang === 'ar' ? 'الوقت' : lang === 'en' ? 'Time' : lang === 'id' ? 'Waktu' : 'Waktu'}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['anytime','subuh','zohor','asar','maghrib','isyak','sebelumTidur'].map(sid => {
                      const meta = SESSIONS.find(s => s.id === sid)
                      const active = customSession === sid
                      return (
                        <button
                          key={sid}
                          type="button"
                          onClick={() => setCustomSession(sid)}
                          disabled={customRecurring === 'perPrayer' && sid !== 'anytime'}
                          className={`rounded-xl border-2 py-1.5 px-1 text-center transition-all ${active ? 'scale-[1.02]' : 'opacity-60'} disabled:opacity-30 disabled:cursor-not-allowed`}
                          style={active
                            ? { borderColor: meta?.color, background: `${meta?.color}18` }
                            : { borderColor: 'transparent', background: 'rgba(0,0,0,0.03)' }}
                        >
                          <div className="text-base leading-none">{meta?.icon}</div>
                          <div className="text-[9px] font-black mt-0.5 leading-tight truncate" style={{ color: active ? meta?.color : undefined }}>
                            {getSessionLabel(sid, lang).replace('Selepas ', '').replace('After ', '').replace('Setelah ', '').replace('بعد ', '')}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Recurring toggle */}
                <div>
                  <label className="block text-[11px] font-extrabold text-eq-ink/70 mb-1.5 uppercase tracking-wider">
                    {lang === 'ar' ? 'التكرار' : lang === 'en' ? 'Repetition' : lang === 'id' ? 'Pengulangan' : 'Pengulangan'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomRecurring('daily')}
                      className={`rounded-xl border-2 py-2 px-2 text-left transition-all ${customRecurring === 'daily' ? 'border-emerald-500 bg-emerald-50' : 'border-transparent bg-eq-cream/50 opacity-70'}`}
                    >
                      <div className="text-xs font-black text-eq-ink">📅 {lang === 'ar' ? 'مرة يومياً' : lang === 'en' ? 'Once daily' : lang === 'id' ? 'Sekali sehari' : 'Sekali sehari'}</div>
                      <div className="text-[9px] text-eq-ink/60 mt-0.5">{lang === 'ar' ? 'مرة واحدة في اليوم' : lang === 'en' ? '1× per day' : lang === 'id' ? '1× per hari' : '1× sehari'}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCustomRecurring('perPrayer'); setCustomSession('anytime') }}
                      className={`rounded-xl border-2 py-2 px-2 text-left transition-all ${customRecurring === 'perPrayer' ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-eq-cream/50 opacity-70'}`}
                    >
                      <div className="text-xs font-black text-eq-ink">🔁 {lang === 'ar' ? 'كل صلاة' : lang === 'en' ? 'Each prayer' : lang === 'id' ? 'Tiap salat' : 'Tiap solat'}</div>
                      <div className="text-[9px] text-eq-ink/60 mt-0.5">{lang === 'ar' ? '٥× في اليوم' : lang === 'en' ? '5× per day' : lang === 'id' ? '5× per hari' : '5× sehari'}</div>
                    </button>
                  </div>
                  {customRecurring === 'perPrayer' && (
                    <div className="mt-1.5 text-[10px] text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1 leading-relaxed">
                      💡 {lang === 'ar' ? 'ستظهر هذه العادة في كل صلوات اليوم الخمس، ويمكن تحديدها بشكل منفصل' : lang === 'en' ? 'This habit will appear in all 5 daily prayers and can be checked independently' : lang === 'id' ? 'Kebiasaan ini akan muncul di 5 salat & bisa dicentang terpisah' : 'Habit ini akan muncul di 5 solat harian & boleh ditick berasingan'}
                    </div>
                  )}
                </div>

                <SchedulePicker lang={lang} schedule={customSchedule} days={customDays} schoolDays={schoolDays}
                  onChange={(sc, d) => { setCustomSchedule(sc); setCustomDays(d) }} onSchoolDays={saveSchoolDays} />

                {!editingHabit && allKids.length > 1 && (
                  <div data-testid="habits-kid-picker">
                    <label className="block text-[11px] font-extrabold text-eq-ink/70 mb-1.5 uppercase tracking-wider">
                      {lang === 'ms' ? 'Beri kepada' : lang === 'id' ? 'Berikan kepada' : lang === 'ar' ? 'أعطِ لـ' : 'Give to'}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {allKids.map(k => {
                        const on = targetKids.includes(k.id)
                        const src = AVATAR_BY_ID[k.avatarId]?.src || (k.gender === 'female' ? AVATAR_BY_ID[DEFAULT_GIRL_ID].src : AVATAR_BY_ID[DEFAULT_BOY_ID].src)
                        return (
                          <button key={k.id} type="button" data-testid={`habits-kid-${k.id}`}
                            onClick={() => setTargetKids(prev => on ? prev.filter(x => x !== k.id) : [...prev, k.id])}
                            className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border-2 text-xs font-extrabold transition-all ${on ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-eq-cream bg-white text-eq-ink/50'}`}>
                            <img src={src} alt="" className="w-6 h-6 rounded-full object-cover object-top bg-amber-50" />
                            {k.nickname} {on ? '✓' : ''}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-1 text-[10px] text-eq-ink/50 leading-snug">
                      {lang === 'ms' ? 'Disimpan sebagai template keluarga — boleh ditambah kepada anak lain bila-bila masa dari "Tambah dari template".' : lang === 'id' ? 'Disimpan sebagai template keluarga — bisa ditambahkan ke anak lain kapan saja.' : lang === 'ar' ? 'يُحفظ كقالب عائلي — يمكن إضافته لطفل آخر في أي وقت.' : 'Saved as a family template — add it to another child any time from "Add from templates".'}
                    </p>
                  </div>
                )}

                <button
                  onClick={submitCustom}
                  disabled={!customTitle.trim() || saving || (!editingHabit && allKids.length > 1 && targetKids.length === 0)}
                  className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 disabled:from-eq-ink/20 disabled:to-eq-ink/20 disabled:cursor-not-allowed hover:brightness-110 text-white font-extrabold py-3.5 rounded-2xl shadow-lg active:scale-[0.99]"
                >
                  {editingHabit
                    ? (lang === 'ar' ? 'حفظ التغييرات' : lang === 'en' ? 'Save changes' : lang === 'id' ? 'Simpan perubahan' : 'Simpan perubahan')
                    : t.habits_custom_create}
                </button>
                <div className="h-2" />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Rubric picker popup — for parent-log mode long-press */}
      {rubricPickerHabit && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 pointer-events-none"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            style={{ zIndex: 0 }}
            onClick={() => setRubricPickerHabit(null)}
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
            style={{ zIndex: 10 }}
          >
            <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/60">{t.parent_log_choose}</div>
                <div className="mt-1 font-extrabold text-emerald-900 text-base leading-tight">
                  {getHabitTitle(rubricPickerHabit, lang)}
                </div>
              </div>
              <button
                onClick={tutIhsan.forceOpen}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 flex items-center justify-center active:scale-95"
                aria-label="What is Ihsan?"
                title="What is Ihsan?"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2">
              <button onClick={() => applyRubricPick('belum')}
                className="rounded-2xl border-2 border-slate-300 bg-gradient-to-br from-slate-100 to-slate-200 py-3 active:scale-[0.97]">
                <div className="text-xl">↩️</div>
                <div className="text-[13px] font-extrabold text-slate-700 mt-1">{t.rubric_belum_label}</div>
                <div className="text-[9px] font-semibold mt-0.5 opacity-80 text-slate-600">{t.rubric_belum_hint}</div>
              </button>
              <button onClick={() => applyRubricPick('sah')}
                className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-100 to-emerald-200 py-3 active:scale-[0.97]">
                <div className="text-xl">✅</div>
                <div className="text-[13px] font-extrabold text-emerald-900 mt-1">{t.rubric_sah_label}</div>
                <div className="text-[9px] font-semibold mt-0.5 opacity-80 text-emerald-800">{t.rubric_sah_hint}</div>
              </button>
              <button onClick={() => applyRubricPick('ihsan')}
                className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-100 to-amber-200 py-3 active:scale-[0.97]">
                <div className="text-xl">🌟</div>
                <div className="text-[13px] font-extrabold text-amber-900 mt-1">{t.rubric_ihsan_label}</div>
                <div className="text-[9px] font-semibold mt-0.5 opacity-80 text-amber-800">{t.rubric_ihsan_hint}</div>
              </button>
            </div>
            <div className="px-4 pb-4">
              <button onClick={() => setRubricPickerHabit(null)} className="w-full text-center text-eq-ink/60 text-sm py-2 font-bold">
                {t.cancel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      {/* Tutorial: parent habit categories */}
      <Tutorial open={tutCats.open}  onClose={tutCats.close}  config={getTutorial('parent_habit_categories', lang)} />
      <Tutorial open={tutIhsan.open} onClose={tutIhsan.close} config={getTutorial('ihsan_meaning', lang)} />

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            style={{ zIndex: 0 }}
            onClick={() => setConfirmDeleteId(null)}
          />
          <motion.div
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 pointer-events-auto"
            style={{ zIndex: 10 }}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-black text-eq-ink mb-0.5">
                  {lang === 'ar' ? 'حذف العادة؟' : lang === 'en' ? 'Delete this habit?' : lang === 'id' ? 'Hapus kebiasaan ini?' : 'Padam habit ini?'}
                </div>
                <div className="text-xs text-eq-ink/60 leading-relaxed">
                  {lang === 'ar' ? 'لا يمكن التراجع عن هذا الإجراء.' : lang === 'en' ? 'This action cannot be undone.' : lang === 'id' ? 'Tindakan ini tidak bisa dibatalkan.' : 'Tindakan ini tidak boleh dibatalkan.'}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-2xl border-2 border-eq-cream text-eq-ink font-extrabold py-2.5 text-sm active:scale-[0.98]"
              >
                {lang === 'ar' ? 'إلغاء' : lang === 'en' ? 'Cancel' : lang === 'id' ? 'Batal' : 'Batal'}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold py-2.5 text-sm active:scale-[0.98] flex items-center justify-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                {lang === 'ar' ? 'حذف' : lang === 'en' ? 'Delete' : lang === 'id' ? 'Hapus' : 'Padam'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default HabitsSheet

// ─────────────────────────────────────────────────────────────────
// HabitCategoryChip — icon + label + score chip for filtering (parent view)

const HabitCategoryChip = ({ active, label, icon, color, done, total, allDone, disabled, onClick }) => {
  const pct = total > 0 ? (done / total) : 0
  const isUrgent = !active && !allDone && total > 0 && done === 0

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border-2 px-1.5 py-1.5 flex items-center gap-1.5 transition-all active:scale-[0.97] ${
        active
          ? 'text-white shadow-md'
          : disabled
            ? 'bg-eq-cream/30 border-eq-cream/60 text-eq-ink/30 opacity-60 cursor-not-allowed'
            : allDone
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isUrgent
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-white border-eq-cream text-eq-ink'
      }`}
      style={active ? { background: color, borderColor: color } : !disabled && !allDone ? { boxShadow: `0 0 0 1px ${color}22` } : undefined}
      title={total > 0 ? `${label} · ${done}/${total}` : label}
    >
      <div className="relative w-9 h-9 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke={active ? 'rgba(255,255,255,0.35)' : disabled ? '#e5e5e5' : `${color}22`} strokeWidth="3" />
          {total > 0 && (
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={active ? '#fff' : color}
              strokeWidth="3"
              strokeDasharray={`${pct * 94.25} 94.25`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base">
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0 text-left leading-tight">
        <div className={`text-[10px] font-extrabold uppercase tracking-tight truncate ${active ? 'text-white' : ''}`}>
          {label}
        </div>
        <div className={`text-[10px] font-bold leading-none mt-0.5 ${active ? 'text-white/95' : disabled ? 'text-eq-ink/30' : 'text-eq-ink/60'}`}>
          {total > 0 ? `${done}/${total}` : '—'}
        </div>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// SchedulePicker — which days a habit appears: every day / school days / weekends / chosen days
const SP_L = (lang, ms, en, id, ar) => (lang === 'ms' ? ms : lang === 'id' ? id : lang === 'ar' ? ar : en)
const SchedulePicker = ({ lang, schedule, days, schoolDays, onChange, onSchoolDays }) => {
  const [editSchool, setEditSchool] = useState(false)
  const schoolTxt = WEEK_ORDER.filter(d => schoolDays.includes(d)).map(d => dayShort(d, lang)).join(' · ')
  const weekendTxt = WEEK_ORDER.filter(d => !schoolDays.includes(d)).map(d => dayShort(d, lang)).join(' · ')
  const opts = [
    { id: 'daily', icon: '📅', sub: SP_L(lang, '7 hari', '7 days', '7 hari', '٧ أيام') },
    { id: 'school', icon: '🎒', sub: schoolTxt },
    { id: 'weekend', icon: '🏡', sub: weekendTxt },
    { id: 'custom', icon: '✍️', sub: SP_L(lang, 'Pilih sendiri', 'Pick days', 'Pilih sendiri', 'اختر') },
  ]
  const toggleDay = (d) => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d]
    onChange('custom', next)
  }
  const toggleSchool = (d) => {
    const next = schoolDays.includes(d) ? schoolDays.filter(x => x !== d) : [...schoolDays, d]
    if (next.length === 0 || next.length === 7) return
    onSchoolDays([...next].sort())
  }
  return (
    <div data-testid="habit-schedule-picker">
      <label className="block text-[11px] font-extrabold text-eq-ink/70 mb-1.5 uppercase tracking-wider">
        {SP_L(lang, 'Hari', 'Days', 'Hari', 'الأيام')}
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {opts.map(o => (
          <button key={o.id} type="button" data-testid={`habit-schedule-${o.id}`}
            onClick={() => onChange(o.id, o.id === 'custom' ? days : [])}
            className={`rounded-xl border-2 py-2 px-2 text-left transition-all ${schedule === o.id ? 'border-emerald-500 bg-emerald-50' : 'border-transparent bg-eq-cream/50 opacity-70'}`}>
            <div className="text-xs font-black text-eq-ink">{o.icon} {scheduleName(o.id, lang)}</div>
            <div className="text-[9px] text-eq-ink/60 mt-0.5 truncate">{o.sub}</div>
          </button>
        ))}
      </div>
      {schedule === 'custom' && (
        <div className="mt-2 flex gap-1" data-testid="habit-schedule-days">
          {WEEK_ORDER.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)} data-testid={`habit-day-${d}`}
              className={`flex-1 rounded-lg py-1.5 text-[10px] font-black border-2 ${days.includes(d) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-eq-cream text-eq-ink/50'}`}>
              {dayShort(d, lang)}
            </button>
          ))}
        </div>
      )}
      {(schedule === 'school' || schedule === 'weekend') && (
        <div className="mt-2 rounded-xl bg-indigo-50/70 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] text-indigo-800 font-bold">
              🎒 {SP_L(lang, 'Hari sekolah keluarga', 'Family school days', 'Hari sekolah keluarga', 'أيام المدرسة')}: {schoolTxt}
            </div>
            <button type="button" onClick={() => setEditSchool(v => !v)} data-testid="habit-school-edit" className="text-[10px] font-black text-indigo-700 underline flex-shrink-0">
              {editSchool ? SP_L(lang, 'Siap', 'Done', 'Selesai', 'تم') : SP_L(lang, 'Tukar', 'Change', 'Ubah', 'تغيير')}
            </button>
          </div>
          {editSchool && (
            <>
              <div className="mt-1.5 flex gap-1">
                {WEEK_ORDER.map(d => (
                  <button key={d} type="button" onClick={() => toggleSchool(d)} data-testid={`school-day-${d}`}
                    className={`flex-1 rounded-lg py-1.5 text-[10px] font-black border-2 ${schoolDays.includes(d) ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-indigo-100 text-indigo-300'}`}>
                    {dayShort(d, lang)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[9px] text-indigo-700/70">{SP_L(lang, 'Berlaku untuk semua habit "Hari sekolah" & "Hujung minggu" dalam keluarga.', 'Applies to every "School days" and "Weekends" habit in your family.', 'Berlaku untuk semua kebiasaan "Hari sekolah" & "Akhir pekan".', 'ينطبق على كل عادات «أيام المدرسة» و«نهاية الأسبوع».')}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
