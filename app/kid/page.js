'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, LogOut, Star } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { HABIT_CATEGORIES, getCategoryLabel, getHabitTitle, getHabitDesc } from '@/lib/habitTemplates'
import { PinModal } from '@/components/eqrel/PinModal'

function KidHomeInner() {
  const router = useRouter()
  const params = useSearchParams()
  const childId = params.get('childId')
  const { t, lang } = useLang()

  const [child, setChild] = useState(null)
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyHabit, setBusyHabit] = useState(null)
  const [toast, setToast] = useState(null)
  const [exitPinOpen, setExitPinOpen] = useState(false)

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const [cRes, hRes] = await Promise.all([
        fetch('/api/children', { credentials: 'include' }),
        fetch(`/api/children/${childId}/habits`, { credentials: 'include' }),
      ])
      const cData = await cRes.json()
      const hData = await hRes.json()
      const found = (cData.children || []).find(c => c.id === childId)
      setChild(found || null)
      setHabits(hData.habits || [])
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => { load() }, [load])

  const claimHabit = async (habit) => {
    // Locked if already verified/ihsan/belum by parent (child can't undo those)
    if (habit.todayStatus === 'verified' || habit.rubric) {
      showToast('locked', t.kid_locked_msg)
      return
    }
    setBusyHabit(habit.id)
    try {
      if (habit.todayStatus === 'claimed') {
        // Undo (allowed because still pending review)
        await fetch(`/api/habits/${habit.id}/claim`, { method: 'DELETE', credentials: 'include' })
        showToast('undo', t.kid_undo_toast)
      } else {
        // Claim
        await fetch(`/api/habits/${habit.id}/claim`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'claimed' }),
        })
        showToast('success', t.kid_claim_toast)
      }
      await load()
    } finally {
      setBusyHabit(null)
    }
  }

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 2000)
  }

  const avatarSrc = child?.avatarId ? AVATAR_BY_ID[child.avatarId]?.src : null
  const favColor = child?.favColor || '#00B894'

  // Progress calc
  const doneCount = habits.filter(h => ['claimed','verified'].includes(h.todayStatus)).length
  const totalPoints = habits
    .filter(h => h.todayStatus === 'verified')
    .reduce((acc, h) => acc + (h.pointsAwarded ?? h.points ?? 0), 0)
  const pendingPoints = habits
    .filter(h => h.todayStatus === 'claimed')
    .reduce((acc, h) => acc + (h.points ?? 0), 0)

  return (
    <div
      className="min-h-[100dvh] w-full relative overflow-y-auto"
      style={{
        background: `linear-gradient(180deg, ${favColor}15 0%, ${favColor}08 50%, #FFF8E7 100%)`,
        paddingTop: 'max(env(safe-area-inset-top), 16px)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom), 16px) + 88px)',
      }}
    >
      {/* Decorative bg */}
      <div className="pointer-events-none absolute top-0 left-0 w-72 h-72 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3" style={{ background: `${favColor}22` }} />
      <div className="pointer-events-none absolute bottom-40 right-0 w-72 h-72 rounded-full blur-3xl translate-x-1/3" style={{ background: '#FFB70322' }} />

      <div className="relative z-10 max-w-md mx-auto px-5">
        {/* Header — avatar + greeting */}
        <div className="pt-2 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="w-28 h-28 rounded-full overflow-hidden ring-4 shadow-lg bg-white"
            style={{ borderColor: favColor, boxShadow: `0 0 0 5px ${favColor}22, 0 8px 30px -8px rgba(0,0,0,0.25)` }}
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">🧒</div>
            )}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-3 text-xl font-extrabold text-emerald-900 text-center"
          >
            {child ? t.kid_greeting(child.nickname) : '…'}
          </motion.h1>
        </div>

        {/* Progress stats */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 grid grid-cols-2 gap-2"
          >
            <div className="rounded-2xl p-3 bg-white/80 backdrop-blur border-2 border-white/90 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/70">{t.kid_progress_label}</div>
              <div className="text-2xl font-extrabold text-emerald-800 mt-0.5">
                {doneCount}<span className="text-sm opacity-60">/{habits.length}</span>
              </div>
            </div>
            <div className="rounded-2xl p-3 bg-white/80 backdrop-blur border-2 border-white/90 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{t.kid_mata_label}</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-0.5 flex items-baseline gap-1">
                +{totalPoints}
                <Sparkles className="w-4 h-4 text-amber-500" fill="#FFB703" />
                {pendingPoints > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700/70 ms-1">(+{pendingPoints}?)</span>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Habit list */}
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="text-center text-emerald-900/50 py-10">{t.loading}</div>
          ) : habits.length === 0 ? (
            <div className="text-center py-14">
              <div className="text-5xl mb-2">🌱</div>
              <p className="text-emerald-900/70 text-sm">{t.kid_empty}</p>
            </div>
          ) : doneCount === habits.length ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">🌟</div>
              <p className="text-emerald-900 font-extrabold">{t.kid_all_done}</p>
            </div>
          ) : null}

          {habits.map((habit) => (
            <KidHabitCard
              key={habit.id}
              habit={habit}
              busy={busyHabit === habit.id}
              onTap={() => claimHabit(habit)}
              t={t}
              lang={lang}
            />
          ))}
        </div>
      </div>

      {/* Sticky bottom exit */}
      <div className="fixed bottom-0 inset-x-0 z-20 px-5 pb-3 pt-2 bg-gradient-to-t from-white/95 via-white/80 to-transparent backdrop-blur-sm max-w-md mx-auto"
           style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 12px))' }}>
        <button
          onClick={() => setExitPinOpen(true)}
          className="w-full bg-white/90 border-2 border-eq-cream rounded-2xl py-2.5 px-3 flex items-center justify-center gap-2 text-emerald-800 font-bold text-sm active:scale-[0.98] shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          {t.kid_exit}
        </button>
      </div>

      {/* Toasts */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className={`fixed left-1/2 -translate-x-1/2 z-30 max-w-[92%] rounded-2xl px-4 py-2.5 shadow-2xl border-2 flex items-center gap-2 text-sm font-bold ${
              toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
              toast.type === 'locked'  ? 'bg-amber-500 text-white border-amber-400' :
                                         'bg-slate-600 text-white border-slate-500'
            }`}
            style={{ bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}
          >
            {toast.type === 'success' && <Sparkles className="w-4 h-4" fill="currentColor" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit PIN modal */}
      <PinModal
        open={exitPinOpen}
        mode="enter"
        onClose={() => setExitPinOpen(false)}
        onSuccess={() => {
          setExitPinOpen(false)
          router.push('/')
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
const KidHabitCard = ({ habit, busy, onTap, t, lang }) => {
  const cat = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.ibadah
  const catLabel = getCategoryLabel(habit.category, t)
  const title = getHabitTitle(habit, lang)
  const desc = getHabitDesc(habit, lang)
  const status = habit.todayStatus
  const rubric = habit.rubric

  const isVerified = status === 'verified'
  const isIhsan = rubric === 'ihsan'
  const isClaimed = status === 'claimed'
  const isLocked = isVerified

  let statusLabel = t.kid_status_pending
  if (isIhsan) statusLabel = t.kid_status_ihsan(habit.pointsAwarded ?? habit.points)
  else if (isVerified) statusLabel = t.kid_status_verified(habit.pointsAwarded ?? habit.points)
  else if (isClaimed) statusLabel = t.kid_status_claimed

  return (
    <motion.button
      layout
      onClick={onTap}
      disabled={busy || isLocked}
      className={`w-full text-left rounded-2xl p-3 border-2 flex items-center gap-3 transition-all active:scale-[0.99] ${
        isIhsan   ? 'bg-amber-50 border-amber-300' :
        isVerified? 'bg-emerald-50 border-emerald-300' :
        isClaimed ? 'bg-white border-emerald-300' :
                    'bg-white border-eq-cream hover:border-emerald-200'
      } ${busy || isLocked ? 'opacity-70' : ''}`}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: `${cat.color}22` }}
      >
        {cat.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>{catLabel}</span>
          <span className="text-[10px] text-eq-ink/40">·</span>
          <span className="text-[10px] text-amber-600 font-extrabold">+{habit.points} {t.habits_points_word}</span>
        </div>
        <div className={`font-bold text-sm text-eq-ink leading-tight ${isVerified ? 'line-through opacity-60' : ''}`}>
          {title}
        </div>
        <div className="text-[11px] mt-0.5 leading-snug font-semibold" style={{
          color: isIhsan ? '#B45309' : isVerified ? '#047857' : isClaimed ? '#059669' : '#6b7280'
        }}>
          {statusLabel}
        </div>
      </div>
      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        isIhsan    ? 'bg-amber-500 border-amber-500' :
        isVerified ? 'bg-emerald-500 border-emerald-500' :
        isClaimed  ? 'bg-white border-emerald-500' :
                     'bg-white border-eq-ink/25'
      }`}>
        {isIhsan     ? <Star className="w-5 h-5 text-white" fill="white" /> :
         isVerified  ? <Check className="w-5 h-5 text-white" strokeWidth={3} /> :
         isClaimed   ? <Check className="w-5 h-5 text-emerald-500" strokeWidth={3} /> : null}
      </div>
    </motion.button>
  )
}

export default function KidHomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-emerald-800">Loading…</div>}>
      <KidHomeInner />
    </Suspense>
  )
}
