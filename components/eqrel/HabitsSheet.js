'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Check, Sparkles, ChevronRight } from 'lucide-react'
import { HABIT_CATEGORIES, TEMPLATES_BY_CATEGORY, templatesForAgeBand } from '@/lib/habitTemplates'
import { AVATAR_BY_ID, DEFAULT_BOY_ID, DEFAULT_GIRL_ID } from '@/lib/avatars'

/**
 * HabitsSheet — bottom sheet for viewing/adding habits for a child.
 * Props: { open, onClose, child, onCountChange?(count) }
 */
export function HabitsSheet({ open, onClose, child, onCountChange }) {
  const [view, setView] = useState('list')  // 'list' | 'add'
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(null)

  const avatarSrc = child ? (AVATAR_BY_ID[child.avatarId]?.src ||
    (child.gender === 'female' ? AVATAR_BY_ID[DEFAULT_GIRL_ID].src : AVATAR_BY_ID[DEFAULT_BOY_ID].src)) : null

  // Load habits when child changes
  useEffect(() => {
    if (!open || !child) return
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/children/${child.id}/habits`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setHabits(data.habits || [])
          onCountChange?.(data.habits?.length || 0)
        }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    })()
  }, [open, child, onCountChange])

  const templates = useMemo(() => {
    return templatesForAgeBand(child?.ageBand)
  }, [child?.ageBand])

  const assignedTemplateIds = useMemo(
    () => new Set(habits.map(h => h.templateId).filter(Boolean)),
    [habits]
  )

  const assignFromTemplate = async (tpl) => {
    if (!child) return
    try {
      const res = await fetch(`/api/children/${child.id}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          templateId: tpl.id,
          category: tpl.category,
          title: tpl.title,
          desc: tpl.desc,
          points: tpl.points,
          frequency: tpl.frequency,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const updated = [...habits, { ...data.habit, todayStatus: 'pending' }]
        setHabits(updated)
        onCountChange?.(updated.length)
      }
    } catch (e) { console.error(e) }
  }

  const removeHabit = async (habitId) => {
    if (!confirm('Padam habit ini?')) return
    try {
      const res = await fetch(`/api/habits/${habitId}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        const updated = habits.filter(h => h.id !== habitId)
        setHabits(updated)
        onCountChange?.(updated.length)
      }
    } catch (e) { console.error(e) }
  }

  const toggleClaim = async (habit) => {
    const nextStatus = habit.todayStatus === 'claimed' || habit.todayStatus === 'verified' ? 'pending' : 'claimed'
    try {
      const res = await fetch(`/api/habits/${habit.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, todayStatus: nextStatus } : h))
      }
    } catch (e) { console.error(e) }
  }

  const totalPoints = habits.reduce((sum, h) =>
    sum + ((h.todayStatus === 'claimed' || h.todayStatus === 'verified') ? h.points : 0), 0)
  const completedCount = habits.filter(h => h.todayStatus === 'claimed' || h.todayStatus === 'verified').length

  return (
    <AnimatePresence>
      {open && child && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-t-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
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
                <div className="text-xs text-eq-ink/60">Habits untuk</div>
                <div className="font-extrabold text-eq-ink text-lg leading-tight truncate">{child.nickname}</div>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-eq-cream flex items-center justify-center flex-shrink-0">
                <X className="w-5 h-5 text-eq-ink/60" />
              </button>
            </div>

            {view === 'list' ? (
              /* ─── LIST VIEW ─── */
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {/* Stats row */}
                {habits.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200">
                      <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Selesai hari ni</div>
                      <div className="text-2xl font-extrabold text-emerald-800 mt-0.5">
                        {completedCount}<span className="text-sm opacity-60">/{habits.length}</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200">
                      <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Mata Bina</div>
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
                  <div className="text-center py-8">
                    <div className="text-5xl mb-2">🌱</div>
                    <p className="text-eq-ink font-bold">Belum ada habits</p>
                    <p className="text-eq-ink/60 text-sm mt-1">Tambah dari template atau cipta sendiri</p>
                  </div>
                )}

                {!loading && habits.map(habit => {
                  const cat = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.ibadah
                  const isDone = habit.todayStatus === 'claimed' || habit.todayStatus === 'verified'
                  return (
                    <div key={habit.id} className={`rounded-2xl p-3 border-2 transition-all ${
                      isDone ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-eq-cream'
                    }`}>
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleClaim(habit)}
                          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isDone
                              ? 'bg-emerald-500 border-emerald-500 scale-105'
                              : 'bg-white border-eq-ink/20 hover:border-emerald-400'
                          }`}
                          aria-label={isDone ? 'Undo' : 'Tandakan selesai'}
                        >
                          {isDone && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-sm">{cat.icon}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>{cat.label}</span>
                            <span className="text-[10px] text-eq-ink/40">·</span>
                            <span className="text-[10px] text-amber-600 font-bold">+{habit.points} mata</span>
                          </div>
                          <div className={`font-bold text-sm leading-tight ${isDone ? 'text-emerald-900 line-through opacity-70' : 'text-eq-ink'}`}>
                            {habit.title}
                          </div>
                          {habit.desc && (
                            <div className="text-[11px] text-eq-ink/60 mt-0.5 leading-snug">{habit.desc}</div>
                          )}
                        </div>
                        <button
                          onClick={() => removeHabit(habit.id)}
                          className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center flex-shrink-0"
                          aria-label="Padam habit"
                        >
                          <Trash2 className="w-4 h-4 text-red-500/70" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Add habit button */}
                <button
                  onClick={() => setView('add')}
                  className="w-full mt-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.99]"
                >
                  <Plus className="w-5 h-5" strokeWidth={3} /> Tambah habit
                </button>

                <div className="h-2" />
              </div>
            ) : (
              /* ─── ADD VIEW (template picker) ─── */
              <div className="flex-1 overflow-y-auto">
                <div className="sticky top-0 bg-white z-10 px-5 pt-3 pb-2 border-b border-eq-cream/50">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setView('list')} className="text-emerald-700 font-bold text-sm flex items-center gap-1">
                      ← Balik
                    </button>
                    <div className="text-xs text-eq-ink/60">
                      Untuk umur <span className="font-bold text-emerald-700">{child.ageBand}</span>
                    </div>
                  </div>
                  {/* Category chips */}
                  <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-1 no-scrollbar">
                    <button
                      onClick={() => setActiveCategory(null)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        activeCategory === null ? 'bg-emerald-500 text-white' : 'bg-eq-cream/50 text-eq-ink'
                      }`}
                    >
                      Semua
                    </button>
                    {Object.entries(HABIT_CATEGORIES).map(([id, cat]) => (
                      <button key={id}
                        onClick={() => setActiveCategory(id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                          activeCategory === id ? 'text-white' : 'bg-eq-cream/50 text-eq-ink'
                        }`}
                        style={activeCategory === id ? { background: cat.color } : {}}
                      >
                        <span>{cat.icon}</span> {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-3 space-y-2">
                  {templates
                    .filter(t => activeCategory === null || t.category === activeCategory)
                    .map(t => {
                      const cat = HABIT_CATEGORIES[t.category]
                      const isAssigned = assignedTemplateIds.has(t.id)
                      return (
                        <button
                          key={t.id}
                          disabled={isAssigned}
                          onClick={() => assignFromTemplate(t)}
                          className={`w-full text-left rounded-2xl p-3 border-2 transition-all flex items-start gap-2 ${
                            isAssigned
                              ? 'bg-eq-cream/30 border-eq-cream opacity-60 cursor-not-allowed'
                              : 'bg-white border-eq-cream hover:border-emerald-300 hover:bg-emerald-50/30 active:scale-[0.99]'
                          }`}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ background: `${cat.color}22` }}
                          >
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>{cat.label}</span>
                              <span className="text-[10px] text-amber-600 font-bold">+{t.points} mata</span>
                            </div>
                            <div className="font-bold text-sm text-eq-ink leading-tight">{t.title}</div>
                            <div className="text-[11px] text-eq-ink/60 mt-0.5 leading-snug">{t.desc}</div>
                          </div>
                          {isAssigned ? (
                            <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5 flex-shrink-0">
                              <Check className="w-3 h-3" /> Ada
                            </div>
                          ) : (
                            <ChevronRight className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  <div className="h-4" />
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default HabitsSheet
