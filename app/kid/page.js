'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, LogOut, Star, Plus, X, HelpCircle } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { TrustCelebration } from '@/components/eqrel/TrustCelebration'
import { KidWelcome } from '@/components/eqrel/HandoverGuide'
import { HABIT_CATEGORIES, getCategoryLabel, getHabitTitle, getHabitDesc } from '@/lib/habitTemplates'
import { SESSIONS, SESSION_BY_ID, getSessionLabel, groupHabitsBySession, currentSessionFromClock } from '@/lib/prayerSession'
import { REWARD_TEMPLATES, REWARD_CATEGORIES, getRewardTitle, getRewardDesc, getRewardCategoryLabel } from '@/lib/rewardTemplates'
import { PinModal } from '@/components/eqrel/PinModal'
import { Tutorial, useTutorial } from '@/components/eqrel/Tutorial'
import { getTutorial } from '@/lib/tutorials'
import { QuizSheet } from '@/components/eqrel/QuizSheet'
import ZikirTasbih from '@/components/eqrel/ZikirTasbih'
import { haptic, showBurst } from '@/lib/feedback'
import { KidRestBanner } from '@/components/eqrel/RestModeSheet'
import HabitFocusCard from '@/components/eqrel/HabitFocusCard'

const KID_REWARD_EMOJIS = ['🎁','📺','🍪','🍦','📖','🍜','🌳','📚','🧸','🎬','🕌','🎨','⚽','🎮','🚴','🎈','🍫','🧁','🎪','🏊','🚀','🦄','🐻','🌟']

function KidHomeInner() {
  const router = useRouter()
  const params = useSearchParams()
  const childId = params.get('childId')
  const { t, lang } = useLang()

  // If no childId → show Kid Chooser (list of children in family)
  if (!childId) {
    return <KidChooser router={router} t={t} lang={lang} />
  }

  return <KidHomeActive router={router} childId={childId} t={t} lang={lang} />
}

// ─────────────────────────────────────────────────────────────────
// KidChooser — screen shown when no childId provided (shared kid device)
const KidChooser = ({ router, t, lang }) => {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [exitPinOpen, setExitPinOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/children', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (!cancelled) setChildren(d.children || []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="h-[100dvh] w-full relative overflow-y-auto overscroll-contain bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50">
      <div className="relative z-10 max-w-md mx-auto px-5 pt-6 pb-24">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">👋</div>
          <h1 className="text-2xl font-extrabold text-emerald-900">{t.kid_chooser_title}</h1>
          <p className="text-sm text-emerald-800/70 mt-1">{t.kid_chooser_subtitle}</p>
        </div>

        {loading ? (
          <div className="text-center text-emerald-900/50 py-10">{t.loading}</div>
        ) : children.length === 0 ? (
          <div className="text-center py-10 text-emerald-900/60">
            <div className="text-4xl mb-2">🌱</div>
            <p className="text-sm">{t.kid_chooser_empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {children.map(child => {
              const avatar = child.avatarId ? AVATAR_BY_ID[child.avatarId] : null
              const color = child.favColor || '#00B894'
              return (
                <button
                  key={child.id}
                  onClick={() => router.push(`/kid?childId=${encodeURIComponent(child.id)}`)}
                  className="rounded-3xl bg-white/85 backdrop-blur border-2 shadow-md p-3 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
                  style={{ borderColor: `${color}55` }}
                >
                  <div
                    className="w-24 h-24 rounded-full ring-4 overflow-hidden bg-eq-cream flex-shrink-0"
                    style={{ '--tw-ring-color': color, borderColor: color, boxShadow: `0 0 0 4px ${color}` }}
                  >
                    {avatar ? (
                      <img src={avatar.src} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🧒</div>
                    )}
                  </div>
                  <div className="text-lg font-extrabold text-eq-ink leading-tight text-center">
                    {child.nickname}
                  </div>
                  <div className="text-[11px] font-bold text-amber-700 flex items-center gap-0.5">
                    {Number(child.mataReward || 0)} <Sparkles className="w-3 h-3" fill="#FFB703" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Exit button — bottom fixed */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 border-t border-eq-cream/80 bg-white/85 backdrop-blur px-4 py-2"
        style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 8px))' }}
      >
        <button
          onClick={() => setExitPinOpen(true)}
          className="w-full max-w-md mx-auto flex items-center justify-center gap-2 text-emerald-900/70 text-sm font-bold py-2"
        >
          <LogOut className="w-4 h-4" /> {t.kid_exit}
        </button>
      </div>

      <PinModal
        open={exitPinOpen}
        mode="enter"
        onClose={() => setExitPinOpen(false)}
        onSuccess={() => { setExitPinOpen(false); router.push('/?parent=1') }}
      />
    </div>
  )
}

function KidHomeActive({ router, childId, t, lang }) {
  const [child, setChild] = useState(null)
  const [habits, setHabits] = useState([])
  const [solatPause, setSolatPause] = useState(null)
  const [restMode, setRestMode] = useState(null)
  const [prayerTimings, setPrayerTimings] = useState(null)   // real prayer windows for the Now card (optional)
  useEffect(() => {
    fetch('/api/family/prayer-times', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)).then(d => setPrayerTimings(d?.timings || null)).catch(() => {})
  }, [])
  const [welcomeOpen, setWelcomeOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('welcome') === '1')
  const closeWelcome = () => {
    setWelcomeOpen(false)
    try { const sp = new URLSearchParams(window.location.search); sp.delete('welcome'); window.history.replaceState(null, '', `${window.location.pathname}?${sp}`) } catch { /* ignore */ }
  }
  const [rewardRequests, setRewardRequests] = useState([])
  const [customRewards, setCustomRewards] = useState([])
  const [myProposals, setMyProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyHabit, setBusyHabit] = useState(null)
  const [busyReward, setBusyReward] = useState(null)
  const [toast, setToast] = useState(null)
  const [exitPinOpen, setExitPinOpen] = useState(false)
  const [showRewards, setShowRewards] = useState(false)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [catFilter, setCatFilter] = useState('all')  // 'all' | 'ibadah' | 'akhlak' | ...
  const [viewMode, setViewMode] = useState('session')  // default 'session' (By Time) — 'category' also available
  const [expandedSession, setExpandedSession] = useState(null)  // which session accordion is open

  // Load saved viewMode preference (per child) — falls back to 'session' default
  useEffect(() => {
    if (!childId) return
    try {
      const saved = localStorage.getItem(`eqrel-viewmode-${childId}`)
      if (saved === 'session' || saved === 'category') setViewMode(saved)
    } catch { /* ignore storage errors */ }
    // Auto-open current session on first mount (session mode default)
    setExpandedSession(prev => prev || currentSessionFromClock())
  }, [childId])

  // Persist viewMode changes + auto-open current session on first switch
  const changeViewMode = (mode) => {
    setViewMode(mode)
    try { localStorage.setItem(`eqrel-viewmode-${childId}`, mode) } catch { /* ignore storage errors */ }
    if (mode === 'session' && !expandedSession) {
      setExpandedSession(currentSessionFromClock())
    }
  }
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizStatus, setQuizStatus] = useState({ doneToday: false, correctCount: 0, total: 0 })
  const [zikirOpen, setZikirOpen] = useState(false)

  // Tutorials
  const tutWelcome = useTutorial('kid_welcome')
  const tutCats    = useTutorial('kid_categories', { autoOpenFirstTime: false })
  const tutRewards = useTutorial('kid_rewards',    { autoOpenFirstTime: false })

  const load = useCallback(async (silent = false) => {
    if (!childId) return
    if (!silent) setLoading(true)
    try {
      const [cRes, hRes, rRes, catRes, pRes, qRes] = await Promise.all([
        fetch('/api/children', { credentials: 'include' }),
        fetch(`/api/children/${childId}/habits`, { credentials: 'include' }),
        fetch(`/api/rewards/requests?childId=${encodeURIComponent(childId)}`, { credentials: 'include' }),
        fetch('/api/rewards/catalog', { credentials: 'include' }),
        fetch(`/api/rewards/proposals?childId=${encodeURIComponent(childId)}`, { credentials: 'include' }),
        fetch(`/api/quiz/status?childId=${encodeURIComponent(childId)}`, { credentials: 'include' }),
      ])
      const cData   = await cRes.json()
      const hData   = await hRes.json()
      const rData   = await rRes.json()
      const catData = await catRes.json()
      const pData   = await pRes.json()
      const qData   = await qRes.json()
      const found = (cData.children || []).find(c => c.id === childId)
      setChild(found || null)
      setHabits(hData.habits || [])
      setSolatPause(hData.solatPause || null)
      setRestMode(hData.restMode || null)
      setRewardRequests(rData.requests || [])
      setCustomRewards(catData.custom || [])
      setMyProposals(pData.proposals || [])
      setQuizStatus(qData || { doneToday: false, correctCount: 0, total: 0 })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [childId])

  useEffect(() => { load() }, [load])

  // Milestone haptic: fires once when the last remaining habit becomes done
  // (transition from "some pending" → "all complete"). Guards against re-firing.
  const [milestoneFired, setMilestoneFired] = useState(false)
  useEffect(() => {
    if (!habits || habits.length === 0) return
    const done = habits.filter(h => ['claimed', 'verified'].includes(h.todayStatus)).length
    const allDone = done === habits.length
    if (allDone && !milestoneFired) {
      haptic.milestone()
      setMilestoneFired(true)
    } else if (!allDone && milestoneFired) {
      // Reset if a habit is somehow unclaimed again (undo path)
      setMilestoneFired(false)
    }
  }, [habits, milestoneFired])

  const claimHabit = async (habit) => {
    // Locked if already verified/ihsan/belum by parent (child can't undo those)
    if (habit.todayStatus === 'verified' || habit.rubric) {
      haptic.locked()
      showToast('locked', t.kid_locked_msg)
      return
    }
    // Immediate tap acknowledgement — feels responsive even before network
    haptic.tap()

    // Determine session for per-prayer habits (e.g. Wudhu 5×/day).
    // - Session view provides `_sessionInstance` per rendered row.
    // - Category view / aggregated views fall back to the current clock session.
    const isPerPrayer = habit._isPerPrayer || habit.recurring === 'perPrayer'
    const sessionForClaim = isPerPrayer
      ? (habit._sessionInstance || currentSessionFromClock())
      : null

    // For per-prayer, determine "done" from THIS session (not aggregate)
    const sessionsClaimed = Array.isArray(habit.sessionsClaimed) ? habit.sessionsClaimed : []
    const thisIsDone = isPerPrayer
      ? sessionsClaimed.includes(sessionForClaim)
      : habit.todayStatus === 'claimed'

    // Busy key includes session to allow parallel taps across different sessions
    const busyKey = sessionForClaim ? `${habit.id}::${sessionForClaim}` : habit.id
    setBusyHabit(busyKey)
    try {
      if (thisIsDone) {
        // Undo (allowed because still pending review)
        const url = sessionForClaim
          ? `/api/habits/${habit.id}/claim?session=${encodeURIComponent(sessionForClaim)}`
          : `/api/habits/${habit.id}/claim`
        await fetch(url, { method: 'DELETE', credentials: 'include' })
        haptic.undo()
        showToast('undo', t.kid_undo_toast)
      } else {
        // Claim
        const body = { status: 'claimed' }
        if (sessionForClaim) body.session = sessionForClaim
        const res = await fetch(`/api/habits/${habit.id}/claim`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          // Server rejected — surface a clear message instead of silent failure
          haptic.locked()
          showToast('locked', t.kid_locked_msg)
          return
        }
        haptic.success()
        // Floating "+points" burst on the tapped card
        const cardEl = typeof document !== 'undefined'
          ? document.querySelector(`[data-habit-card-id="${busyKey}"]`)
          : null
        if (cardEl) {
          showBurst(cardEl, { text: `+${habit.points}`, variant: 'success' })
        }
        showToast('success', t.kid_claim_toast)
      }
      await load(true) // silent — keep habit cards mounted so burst survives
    } finally {
      setBusyHabit(null)
    }
  }

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 2000)
  }

  const requestReward = async (r, isTemplate) => {
    if (!child) return
    const balance = Number(child.mataReward || 0)
    if (balance < r.cost) { showToast('locked', t.reward_not_enough); return }
    // Prevent duplicate pending
    const already = rewardRequests.find(rr => rr.rewardId === r.id && rr.status === 'pending')
    if (already) { showToast('locked', t.reward_requested); return }
    setBusyReward(r.id)
    try {
      const title = isTemplate ? getRewardTitle(r, lang) : r.title
      const desc  = isTemplate ? getRewardDesc(r, lang)  : (r.desc || '')
      const res = await fetch('/api/rewards/request', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: child.id, rewardId: r.id, isTemplate: !!isTemplate,
          snapshot: { title, desc, cost: r.cost, icon: r.icon, category: r.category },
        }),
      })
      if (res.ok) {
        showToast('success', t.reward_requested)
        await load()
      } else {
        const d = await res.json().catch(() => ({}))
        showToast('locked', d.error || t.verify_error)
      }
    } finally {
      setBusyReward(null)
    }
  }

  const submitProposal = async ({ title, desc, cost, icon, category }) => {
    if (!child) return
    const res = await fetch('/api/rewards/proposals', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: child.id, title, desc, cost, icon, category }),
    })
    if (res.ok) {
      showToast('success', t.reward_propose_ok)
      setProposeOpen(false)
      await load()
      return true
    } else {
      const d = await res.json().catch(() => ({}))
      showToast('locked', d.error || t.verify_error)
      return false
    }
  }

  const cancelProposal = async (id) => {
    setBusyReward(id)
    try {
      const res = await fetch(`/api/rewards/proposals/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) await load()
    } finally { setBusyReward(null) }
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
      className="h-[100dvh] w-full relative overflow-x-hidden overflow-y-auto overscroll-contain"
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
        {/* Help button — top-right */}
        <div className="absolute top-2 right-4 z-20">
          <button
            onClick={tutWelcome.forceOpen}
            className="w-9 h-9 rounded-full bg-white/80 backdrop-blur border-2 border-white/90 shadow-sm text-emerald-700 flex items-center justify-center active:scale-95"
            aria-label="Help"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

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

        {/* TV-style "Now" card — the one habit to do right now */}
        {!loading && (
          <HabitFocusCard habits={habits} lang={lang} t={t} busyHabit={busyHabit} onClaim={claimHabit} timings={prayerTimings} childId={childId}
            onOpenWorld={() => router.push(`/world?childId=${encodeURIComponent(childId)}`)} />
        )}

        {/* Progress stats */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 grid grid-cols-3 gap-2"
          >
            <div className="rounded-2xl p-3 bg-white/80 backdrop-blur border-2 border-white/90 shadow-sm">
              <div className="text-[9px] font-bold uppercase tracking-wide text-emerald-800/70 leading-tight">{t.kid_progress_label}</div>
              <div className="text-xl font-extrabold text-emerald-800 mt-0.5">
                {doneCount}<span className="text-xs opacity-60">/{habits.length}</span>
              </div>
            </div>
            <div className="rounded-2xl p-3 bg-white/80 backdrop-blur border-2 border-white/90 shadow-sm">
              <div className="text-[9px] font-bold uppercase tracking-wide text-amber-700 leading-tight">{t.kid_mata_label}</div>
              <div className="text-xl font-extrabold text-amber-700 mt-0.5 flex items-baseline gap-0.5">
                +{totalPoints}<Sparkles className="w-3.5 h-3.5 text-amber-500" fill="#FFB703" />
              </div>
            </div>
            <div className="rounded-2xl p-3 bg-white/80 backdrop-blur border-2 border-white/90 shadow-sm">
              <div className="text-[9px] font-bold uppercase tracking-wide text-purple-700 leading-tight">{t.reward_balance}</div>
              <div className="text-xl font-extrabold text-purple-700 mt-0.5 flex items-baseline gap-0.5">
                {Number(child?.mataReward || 0)}<span className="text-base">🎁</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quiz + Reward Shop + World tiles row */}
        {!loading && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {/* Quiz tile */}
            <button
              onClick={() => setQuizOpen(true)}
              disabled={quizStatus.doneToday}
              className={`rounded-2xl px-3 py-2.5 border-2 font-extrabold text-xs flex items-center justify-between transition-all ${
                quizStatus.doneToday
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-not-allowed'
                  : 'bg-white/80 backdrop-blur border-white/90 text-blue-800 hover:border-blue-300 active:scale-[0.98]'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-lg flex-shrink-0">{quizStatus.doneToday ? '✅' : '🎓'}</span>
                <span className="truncate">{t.quiz_tile_title}</span>
              </span>
              {quizStatus.doneToday && (
                <span className="text-[10px] font-bold text-emerald-700 flex-shrink-0">
                  {quizStatus.correctCount}/{quizStatus.total}
                </span>
              )}
            </button>

            {/* Reward Shop tile */}
            <button
              onClick={() => {
                const opening = !showRewards
                setShowRewards(opening)
                if (opening) {
                  try {
                    if (!localStorage.getItem('eqrel-tut-v1-kid_rewards')) {
                      tutRewards.forceOpen()
                    }
                  } catch (e) { /* ignore */ }
                }
              }}
              className={`rounded-2xl px-3 py-2.5 border-2 transition-all font-extrabold text-xs flex items-center justify-between ${
                showRewards
                  ? 'bg-purple-500 border-purple-500 text-white'
                  : 'bg-white/80 backdrop-blur border-white/90 text-purple-800'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-lg flex-shrink-0">🎁</span>
                <span className="truncate">{t.reward_shop_title}</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] opacity-80 flex-shrink-0">
                {showRewards && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); tutRewards.forceOpen() }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/25 hover:bg-white/40 cursor-pointer"
                    aria-label="Help"
                    title="Help"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                )}
                {showRewards ? '×' : '→'}
              </span>
            </button>

            {/* World tile — enter the Phaser 3 sandbox */}
            <button
              onClick={() => router.push(`/world?childId=${encodeURIComponent(childId)}`)}
              className="rounded-2xl px-3 py-2.5 border-2 transition-all font-extrabold text-xs flex items-center justify-between bg-white/80 backdrop-blur border-white/90 text-emerald-800 hover:border-emerald-300 active:scale-[0.98]"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-lg flex-shrink-0">🌍</span>
                <span className="truncate">{t.world_tile_title || 'Dunia Saya'}</span>
              </span>
              <span className="text-[11px] opacity-80 flex-shrink-0">→</span>
            </button>
          </div>
        )}

        {/* Zikir tile — full width, family shared */}
        {!loading && (
          <button
            onClick={() => setZikirOpen(true)}
            className="mt-2 w-full rounded-2xl border-2 border-white/90 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-2.5 font-extrabold text-xs flex items-center justify-between shadow-lg active:scale-[0.98] transition-transform"
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">📿</span>
              <span>{t.zikir_tile_title || 'Family Zikir'}</span>
            </span>
            <span className="text-[10px] opacity-90">{t.zikir_tile_cta || 'Tap to start →'}</span>
          </button>
        )}

        {/* Rewards grid — shown when toggled on */}
        {showRewards && !loading && (
          <div className="mt-3 space-y-3">
            {/* Propose new reward CTA */}
            <button
              onClick={() => setProposeOpen(true)}
              className="w-full rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/70 py-2.5 px-3 flex items-center justify-center gap-2 font-extrabold text-sm text-purple-800 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> {t.reward_propose_cta}
            </button>

            {/* My pending proposals */}
            {myProposals.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700/80 mb-1.5">
                  {t.reward_my_proposals}
                </div>
                <div className="space-y-1.5">
                  {myProposals.slice(0, 6).map(p => {
                    const badgeCls =
                      p.status === 'pending'  ? 'bg-amber-100 text-amber-800' :
                      p.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                                'bg-red-100 text-red-800'
                    const badgeText =
                      p.status === 'pending'  ? t.reward_proposal_status_pending :
                      p.status === 'approved' ? t.reward_proposal_status_approved :
                                                t.reward_proposal_status_rejected
                    return (
                      <div key={p.id} className={`rounded-xl border-2 p-2 flex items-center gap-2 ${
                        p.status === 'pending' ? 'bg-white border-purple-200' : 'bg-eq-cream/40 border-transparent'
                      }`}>
                        <div className="text-xl">{p.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-xs text-eq-ink truncate">{p.title}</div>
                          <div className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5">
                            {p.finalCost ?? p.cost}<Sparkles className="w-2.5 h-2.5" fill="#FFB703" />
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badgeCls}`}>
                          {badgeText}
                        </span>
                        {p.status === 'pending' && (
                          <button
                            onClick={() => cancelProposal(p.id)}
                            disabled={busyReward === p.id}
                            className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center disabled:opacity-40"
                            aria-label="cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Reward grid: custom (family) + templates */}
            <div className="grid grid-cols-2 gap-2">
              {/* Family custom rewards first */}
              {customRewards.map(r => {
                const balance = Number(child?.mataReward || 0)
                const affordable = balance >= r.cost
                const pending = rewardRequests.find(rr => rr.rewardId === r.id && rr.status === 'pending')
                const cat = REWARD_CATEGORIES[r.category] || REWARD_CATEGORIES.activity
                const isBusy = busyReward === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => requestReward(r, false)}
                    disabled={!affordable || !!pending || isBusy}
                    className={`text-left rounded-2xl p-2.5 border-2 transition-all active:scale-[0.98] relative ${
                      pending    ? 'bg-amber-50 border-amber-200' :
                      affordable ? 'bg-white border-emerald-200 hover:border-emerald-300' :
                                   'bg-eq-cream/40 border-transparent opacity-60'
                    } ${isBusy ? 'opacity-70' : ''}`}
                  >
                    <span className="absolute top-1 left-1 text-[8px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">
                      {t.reward_custom_badge}
                    </span>
                    <div className="flex items-start justify-between pt-3">
                      <div className="text-2xl">{r.icon}</div>
                      <div className="text-[10px] font-extrabold text-amber-700 flex items-center gap-0.5">
                        {r.cost}<Sparkles className="w-3 h-3" fill="#FFB703" />
                      </div>
                    </div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>
                      {getRewardCategoryLabel(r.category, t)}
                    </div>
                    <div className="font-bold text-xs text-eq-ink leading-tight mt-0.5 line-clamp-2">
                      {r.title}
                    </div>
                    {pending && (
                      <div className="text-[10px] mt-1 text-amber-700 font-bold">{t.reward_requested}</div>
                    )}
                  </button>
                )
              })}
              {/* Templates */}
              {REWARD_TEMPLATES.map(r => {
                const balance = Number(child?.mataReward || 0)
                const affordable = balance >= r.cost
                const pending = rewardRequests.find(rr => rr.rewardId === r.id && rr.status === 'pending')
                const cat = REWARD_CATEGORIES[r.category] || REWARD_CATEGORIES.activity
                const isBusy = busyReward === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => requestReward(r, true)}
                    disabled={!affordable || !!pending || isBusy}
                    className={`text-left rounded-2xl p-2.5 border-2 transition-all active:scale-[0.98] ${
                      pending    ? 'bg-amber-50 border-amber-200' :
                      affordable ? 'bg-white border-eq-cream hover:border-purple-300' :
                                   'bg-eq-cream/40 border-transparent opacity-60'
                    } ${isBusy ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-2xl">{r.icon}</div>
                      <div className="text-[10px] font-extrabold text-amber-700 flex items-center gap-0.5">
                        {r.cost}<Sparkles className="w-3 h-3" fill="#FFB703" />
                      </div>
                    </div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>
                      {getRewardCategoryLabel(r.category, t)}
                    </div>
                    <div className="font-bold text-xs text-eq-ink leading-tight mt-0.5 line-clamp-2">
                      {getRewardTitle(r, lang)}
                    </div>
                    {pending && (
                      <div className="text-[10px] mt-1 text-amber-700 font-bold">{t.reward_requested}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* View mode toggle: Category ⇆ Session */}
        {!loading && habits.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 bg-white/70 backdrop-blur rounded-full p-1 border border-eq-cream w-fit mx-auto">
            <button
              onClick={() => changeViewMode('category')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-all flex items-center gap-1 ${viewMode === 'category' ? 'bg-emerald-500 text-white shadow' : 'text-emerald-800/70 hover:text-emerald-800'}`}
            >
              🏷️ {t.kid_view_category || (lang === 'ar' ? 'حسب الفئة' : lang === 'en' ? 'By Category' : lang === 'id' ? 'Kategori' : 'Kategori')}
            </button>
            <button
              onClick={() => changeViewMode('session')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-all flex items-center gap-1 ${viewMode === 'session' ? 'bg-emerald-500 text-white shadow' : 'text-emerald-800/70 hover:text-emerald-800'}`}
            >
              🕰️ {t.kid_view_session || (lang === 'ar' ? 'حسب الوقت' : lang === 'en' ? 'By Time' : lang === 'id' ? 'Waktu' : 'Waktu')}
            </button>
          </div>
        )}

        <KidRestBanner rest={restMode} lang={lang} />

        {solatPause && (
          <div className="mt-4 rounded-3xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-100 px-4 py-3 flex items-center gap-3" data-testid="kid-solat-paused">
            <span className="text-3xl">{solatPause.reason === 'haid' ? '🌸' : '🤒'}</span>
            <div className="text-[13px] text-rose-900 font-semibold leading-snug">
              {solatPause.reason === 'haid'
                ? (lang === 'ms' ? 'Cuti Solat — Allah sayang kamu. Teruskan zikir, doa & selawat ya! 💗' : lang === 'id' ? 'Cuti sholat — Allah sayang kamu. Teruskan zikir & doa ya! 💗' : lang === 'ar' ? 'إجازة الصلاة — الله يحبك. واصلي الذكر والدعاء 💗' : 'Prayer break — Allah loves you. Keep up your dhikr, du’a & salawat! 💗')
                : (lang === 'ms' ? 'Semoga cepat sembuh! Ibu/Ayah jeda solat seketika. Berdoalah dari katil ya 🤲' : lang === 'id' ? 'Semoga cepat sembuh! Berdoalah ya 🤲' : lang === 'ar' ? 'شفاك الله! ادعُ الله من سريرك 🤲' : 'Get well soon! Prayers are paused for now — make du’a from your bed 🤲')}
            </div>
          </div>
        )}

        {/* Habit list — grouped by category or session */}
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-center text-emerald-900/50 py-10">{t.loading}</div>
          ) : habits.length === 0 ? (
            <div className="text-center py-14">
              <div className="text-5xl mb-2">🌱</div>
              <p className="text-emerald-900/70 text-sm">{t.kid_empty}</p>
            </div>
          ) : viewMode === 'session' ? (
            <SessionView
              habits={habits}
              expandedSession={expandedSession}
              setExpandedSession={setExpandedSession}
              busyHabit={busyHabit}
              onTap={claimHabit}
              t={t}
              lang={lang}
            />
          ) : (() => {
            // ── Build category groups once (used by chips + list) ──
            const groups = {}
            habits.forEach(h => {
              const c = h.category || 'ibadah'
              if (!groups[c]) groups[c] = []
              groups[c].push(h)
            })
            Object.values(groups).forEach(list => {
              list.sort((a, b) => {
                const aDone = a.todayStatus === 'claimed' || a.todayStatus === 'verified'
                const bDone = b.todayStatus === 'claimed' || b.todayStatus === 'verified'
                return aDone === bDone ? 0 : (aDone ? 1 : -1)
              })
            })
            // Order groups by HABIT_CATEGORIES declaration; complete-all groups sink to bottom
            const orderedIds = Object.keys(HABIT_CATEGORIES).filter(id => groups[id])
            const groupList = orderedIds.map(id => {
              const list = groups[id]
              const done = list.filter(h => h.todayStatus === 'claimed' || h.todayStatus === 'verified').length
              return { id, list, done, total: list.length, allDone: done === list.length }
            })
            groupList.sort((a, b) => (a.allDone === b.allDone ? 0 : a.allDone ? 1 : -1))

            const filteredGroups = catFilter === 'all' ? groupList : groupList.filter(g => g.id === catFilter)

            return (
              <>
                {/* Category shortcut chips — 3×2 grid, all visible with icon + label */}
                <div className="relative">
                  <button
                    onClick={tutCats.forceOpen}
                    className="absolute -top-1 right-0 z-10 w-6 h-6 rounded-full bg-white/70 hover:bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center active:scale-95"
                    aria-label="Help"
                    title="Help"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                  <div className="grid grid-cols-3 gap-1.5">
                  <CategoryChip
                    active={catFilter === 'all'}
                    label={t.kid_cat_all}
                    icon="✨"
                    color="#00B894"
                    done={doneCount}
                    total={habits.length}
                    onClick={() => setCatFilter('all')}
                  />
                  {Object.keys(HABIT_CATEGORIES).map(id => {
                    const cat = HABIT_CATEGORIES[id]
                    const g = groupList.find(x => x.id === id)
                    if (!g) {
                      return (
                        <CategoryChip
                          key={id}
                          active={false}
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
                      <CategoryChip
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
                </div>

                {doneCount === habits.length && catFilter === 'all' && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-center rounded-3xl p-4 bg-gradient-to-br from-amber-100 to-emerald-100 border-2 border-amber-300"
                  >
                    <div className="text-5xl mb-1">🌟</div>
                    <p className="text-emerald-900 font-extrabold">{t.kid_all_done}</p>
                  </motion.div>
                )}

                {filteredGroups.map(g => (
                  <CategoryGroup
                    key={g.id}
                    catId={g.id}
                    habitsInCat={g.list}
                    done={g.done}
                    total={g.total}
                    allDone={g.allDone}
                    busyHabit={busyHabit}
                    onTap={claimHabit}
                    t={t}
                    lang={lang}
                  />
                ))}
              </>
            )
          })()}
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
          router.push('/?parent=1')
        }}
      />

      {/* Propose reward modal */}
      <ProposeRewardModal
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        onSubmit={submitProposal}
        t={t}
      />

      {/* Tutorials */}
      <Tutorial open={tutWelcome.open && !welcomeOpen} onClose={tutWelcome.close} config={getTutorial('kid_welcome', lang)} />
      <Tutorial open={tutCats.open}    onClose={tutCats.close}    config={getTutorial('kid_categories', lang)} />
      <Tutorial open={tutRewards.open} onClose={tutRewards.close} config={getTutorial('kid_rewards', lang)} />

      {/* Quiz overlay */}
      <QuizSheet
        open={quizOpen}
        onClose={() => { setQuizOpen(false); load() }}
        childId={childId}
        onComplete={load}
      />

      {/* Zikir bottom sheet */}
      <AnimatePresence>
        {zikirOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setZikirOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-eq-cream rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-eq-cream/95 backdrop-blur px-4 py-3 border-b border-emerald-100 flex items-center justify-between rounded-t-3xl">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📿</span>
                  <div>
                    <div className="text-sm font-black text-emerald-900 leading-tight">{t.zikir_tile_title || 'Family Zikir'}</div>
                    <div className="text-[10px] text-emerald-800/60">{t.zikir_tile_sub || 'Kaunter dikongsi keluarga'}</div>
                  </div>
                </div>
                <button onClick={() => setZikirOpen(false)}
                  className="w-9 h-9 rounded-full bg-white border border-emerald-200 flex items-center justify-center active:scale-95">
                  <X className="w-4 h-4 text-emerald-800" />
                </button>
              </div>
              <div className="p-4">
                <ZikirTasbih />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lencana Mod Percaya — celebrate habits that became trusted (7 days consistent) */}
      <KidWelcome open={welcomeOpen} onClose={closeWelcome} lang={lang} child={child} avatarSrc={avatarSrc} habitCount={habits.length} />
      {!welcomeOpen && <TrustCelebration childId={childId} child={child} lang={lang} avatarSrc={avatarSrc} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
const ProposeRewardModal = ({ open, onClose, onSubmit, t }) => {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [cost, setCost] = useState(50)
  const [icon, setIcon] = useState('🎁')
  const [category, setCategory] = useState('activity')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setTitle(''); setDesc(''); setCost(20); setIcon('🎁'); setCategory('activity') }
  }, [open])

  const canSave = title.trim() && Number.isInteger(cost) && cost >= 1 && cost <= 999

  const submit = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      await onSubmit({ title: title.trim(), desc: desc.trim(), cost, icon, category })
    } finally { setBusy(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            style={{ zIndex: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden pointer-events-auto"
            style={{ zIndex: 10 }}
          >
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-purple-900">{t.reward_propose_title}</h3>
                <p className="text-[11px] text-purple-700/70 mt-0.5">{t.reward_propose_subtitle}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-eq-cream/60 flex items-center justify-center">
                <X className="w-4 h-4 text-eq-ink/70" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <label className="block">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-900/70 mb-1">
                  {t.reward_propose_title_label}
                </div>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
                  placeholder={t.reward_propose_title_ph}
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-purple-300 outline-none px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-900/70 mb-1">
                  {t.reward_propose_desc_label}
                </div>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} rows={2}
                  placeholder={t.reward_propose_desc_ph}
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-purple-300 outline-none px-3 py-2 text-sm resize-none" />
              </label>
              <label className="block">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-900/70 mb-1">
                  {t.reward_propose_cost_label}
                </div>
                <input type="number" min={1} max={999} value={cost}
                  onChange={e => setCost(parseInt(e.target.value || '0', 10))}
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-purple-300 outline-none px-3 py-2 text-sm" />
              </label>
              <div className="block">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-900/70 mb-1">
                  {t.reward_propose_icon_label}
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {KID_REWARD_EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => setIcon(e)}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center text-lg transition-all ${
                        icon === e ? 'border-purple-400 bg-purple-50 scale-105' : 'border-eq-cream bg-white'
                      }`}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="block">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-900/70 mb-1">
                  {t.reward_custom_category_label}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {['screen','food','learning','outing','activity','spiritual'].map(id => {
                    const cat = REWARD_CATEGORIES[id]
                    return (
                      <button key={id} type="button" onClick={() => setCategory(id)}
                        className={`rounded-lg border-2 py-1.5 px-2 text-[11px] font-extrabold transition-all flex flex-col items-center gap-0.5 ${
                          category === id ? 'border-purple-400 bg-purple-50' : 'border-eq-cream bg-white'
                        }`}
                        style={category === id ? { color: cat.color } : undefined}>
                        <span className="text-base">{cat.icon}</span>
                        <span>{getRewardCategoryLabel(id, t)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="border-t border-eq-cream/60 px-5 py-3">
              <button onClick={submit} disabled={!canSave || busy}
                className="w-full rounded-2xl bg-purple-500 text-white font-extrabold py-3 text-sm active:scale-[0.99] disabled:opacity-40">
                {busy ? t.reward_propose_submitting : t.reward_propose_submit}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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

  // Per-prayer aggregate rendering (Category view): compute per-session status
  const isPerPrayerAggregate = !habit._isPerPrayer && habit.recurring === 'perPrayer'
  const sessionsClaimed = Array.isArray(habit.sessionsClaimed) ? habit.sessionsClaimed : []
  const currentSession = isPerPrayerAggregate ? currentSessionFromClock() : null
  const currentSessionClaimed = isPerPrayerAggregate ? sessionsClaimed.includes(currentSession) : false

  const isVerified = status === 'verified'
  const isIhsan = rubric === 'ihsan'
  // For aggregate per-prayer, "claimed look" reflects CURRENT session (not the aggregate flag)
  const isClaimed = isPerPrayerAggregate ? currentSessionClaimed : (status === 'claimed')
  const isLocked = isVerified

  let statusLabel = t.kid_status_pending
  if (isIhsan) statusLabel = t.kid_status_ihsan(habit.pointsAwarded ?? habit.points)
  else if (isVerified) statusLabel = t.kid_status_verified(habit.pointsAwarded ?? habit.points)
  else if (isPerPrayerAggregate) {
    // Show progress "N/5 hari ini" instead of the daily-habit labels
    const doneCount = sessionsClaimed.length
    const sessionLabel = getSessionLabel(currentSession, lang)
    if (currentSessionClaimed) {
      statusLabel = lang === 'ar' ? `تم ✓ (${doneCount}/5)`
                  : lang === 'en' ? `Done for ${sessionLabel} ✓  ·  ${doneCount}/5 today`
                  : lang === 'id' ? `Selesai untuk ${sessionLabel} ✓  ·  ${doneCount}/5 hari ini`
                  : `Siap untuk ${sessionLabel} ✓  ·  ${doneCount}/5 hari ini`
    } else {
      statusLabel = lang === 'ar' ? `اضغط لـ ${sessionLabel} (${doneCount}/5)`
                  : lang === 'en' ? `Tap for ${sessionLabel}  ·  ${doneCount}/5 today`
                  : lang === 'id' ? `Tap untuk ${sessionLabel}  ·  ${doneCount}/5 hari ini`
                  : `Tekan untuk ${sessionLabel}  ·  ${doneCount}/5 hari ini`
    }
  }
  else if (isClaimed) statusLabel = t.kid_status_claimed

  // Stable id used by the burst helper to locate this specific card
  const cardKey = habit._isPerPrayer
    ? `${habit.id}::${habit._sessionInstance || ''}`
    : isPerPrayerAggregate
      ? `${habit.id}::${currentSession}`
      : habit.id

  return (
    <motion.button
      layout
      data-habit-card-id={cardKey}
      onClick={onTap}
      disabled={busy || isLocked}
      className={`relative w-full text-left rounded-2xl p-3 border-2 flex items-center gap-3 transition-all active:scale-[0.97] ${
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
          {habit._isPerPrayer && (
            <>
              <span className="text-[10px] text-eq-ink/40">·</span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                🔁 {lang === 'ar' ? 'كل صلاة' : lang === 'en' ? 'Each prayer' : lang === 'id' ? 'Tiap salat' : 'Tiap solat'}
              </span>
            </>
          )}
        </div>
        <div className={`font-bold text-sm text-eq-ink leading-tight ${isVerified ? 'line-through opacity-60' : ''}`}>
          {title}
          {habit.core && (
            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black align-middle" data-testid={`kid-core-${habit.id}`}>🕌</span>
          )}
          {habit.autoVerify && (
            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black align-middle no-underline" data-testid={`kid-trusted-${habit.id}`}
              title={lang === 'ms' ? 'Dipercayai' : 'Trusted'}>🛡️</span>
          )}
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

// ─────────────────────────────────────────────────────────────────
// CategoryChip — chip with icon + label + score (fits 3 in a row on mobile)

const CategoryChip = ({ active, label, icon, color, done, total, allDone, disabled, onClick }) => {
  const pct = total > 0 ? (done / total) : 0
  const isUrgent = !active && !allDone && total > 0 && done === 0

  return (
    <button
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
                : 'bg-white/85 backdrop-blur border-white/90 text-eq-ink'
      }`}
      style={active ? { background: color, borderColor: color } : !disabled && !allDone ? { boxShadow: `0 0 0 1px ${color}22` } : undefined}
      title={total > 0 ? `${label} · ${done}/${total}` : label}
    >
      {/* Icon in progress ring */}
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
      {/* Label + score stacked */}
      <div className="flex-1 min-w-0 text-left leading-tight">
        <div className={`text-[10px] font-extrabold uppercase tracking-tight truncate ${
          active ? 'text-white' : ''
        }`}>
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
// CategoryGroup — visual grouping of habits with progress bar

const CategoryGroup = ({ catId, habitsInCat, done, total, allDone, busyHabit, onTap, t, lang }) => {
  const cat = HABIT_CATEGORIES[catId] || HABIT_CATEGORIES.ibadah
  const catLabel = getCategoryLabel(catId, t)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border-2 p-2.5 transition-all ${
        allDone ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-300' : 'bg-white/70 backdrop-blur border-white/90'
      }`}
      style={!allDone ? { boxShadow: `0 0 0 1px ${cat.color}22` } : undefined}
    >
      {/* Category header */}
      <div className="flex items-center gap-2.5 px-1 pb-2">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: allDone ? `${cat.color}33` : `${cat.color}22` }}
        >
          {allDone ? '✅' : cat.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-extrabold uppercase tracking-wide" style={{ color: cat.color }}>
              {catLabel}
            </div>
            <div className="text-xs font-bold text-eq-ink/60">
              {done}/{total}
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-1 h-2 rounded-full bg-eq-cream/70 overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${cat.color}, ${cat.color}dd)` }}
            />
          </div>
        </div>
      </div>
      {/* Habits list */}
      <div className="space-y-2 pt-1">
        {habitsInCat.map(habit => (
          <KidHabitCard
            key={habit.id}
            habit={habit}
            busy={busyHabit === habit.id}
            onTap={() => onTap(habit)}
            t={t}
            lang={lang}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SessionView — habits grouped by prayer-time anchor (Selepas Subuh, Zohor, etc.)
// Renders "Sepanjang Hari" section on top (always expanded) then chronological
// prayer sessions as accordion (current session auto-expanded).

const SessionView = ({ habits, expandedSession, setExpandedSession, busyHabit, onTap, t, lang }) => {
  const groups = groupHabitsBySession(habits)
  if (groups.length === 0) return null

  // Split: anywhere = always expanded, others = accordion
  const anywhere = groups.find(g => g.sessionId === 'anytime')
  const timed = groups.filter(g => g.sessionId !== 'anytime')

  return (
    <div className="space-y-3">
      {/* Anywhere zone — always visible, no accordion */}
      {anywhere && (
        <SessionCard
          group={anywhere}
          expanded={true}
          canCollapse={false}
          busyHabit={busyHabit}
          onTap={onTap}
          onToggle={() => {}}
          t={t}
          lang={lang}
        />
      )}

      {/* Timed sessions — accordion */}
      {timed.map(g => {
        const isOpen = expandedSession === g.sessionId
        return (
          <SessionCard
            key={g.sessionId}
            group={g}
            expanded={isOpen}
            canCollapse={true}
            busyHabit={busyHabit}
            onTap={onTap}
            onToggle={() => setExpandedSession(isOpen ? null : g.sessionId)}
            t={t}
            lang={lang}
          />
        )
      })}
    </div>
  )
}

const SessionCard = ({ group, expanded, canCollapse, busyHabit, onTap, onToggle, t, lang }) => {
  const meta = SESSION_BY_ID[group.sessionId] || SESSION_BY_ID.anytime
  const label = getSessionLabel(group.sessionId, lang)
  const pct = group.total > 0 ? Math.round((group.done / group.total) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border-2 transition-all overflow-hidden ${
        group.allDone ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-300' : 'bg-white/70 backdrop-blur border-white/90'
      }`}
      style={!group.allDone ? { boxShadow: `0 0 0 1px ${meta.color}22` } : undefined}
    >
      {/* Session header (clickable if canCollapse) */}
      <button
        onClick={canCollapse ? onToggle : undefined}
        disabled={!canCollapse}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left ${canCollapse ? 'active:scale-[0.99]' : ''}`}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: group.allDone ? `${meta.color}33` : `${meta.color}22` }}
        >
          {group.allDone ? '✅' : meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-extrabold uppercase tracking-wide" style={{ color: meta.color }}>
              {label}
            </div>
            <div className="text-xs font-bold text-eq-ink/60">
              {group.done}/{group.total}
            </div>
          </div>
          <div className="mt-1 h-2 rounded-full bg-eq-cream/70 overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}dd)` }}
            />
          </div>
        </div>
        {canCollapse && (
          <div className="text-emerald-800/50 text-xs font-black flex-shrink-0">
            {expanded ? '▲' : '▼'}
          </div>
        )}
      </button>

      {/* Habits list (collapsible for timed sessions) */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-2.5 pb-2.5 pt-1">
              {group.habits.map(habit => {
                // For perPrayer habits, use composite key (habitId + session) so all 5 instances render distinctly
                const key = habit._isPerPrayer ? `${habit.id}::${habit._sessionInstance}` : habit.id
                const busyKey = habit._isPerPrayer ? `${habit.id}::${habit._sessionInstance}` : habit.id
                return (
                  <KidHabitCard
                    key={key}
                    habit={habit}
                    busy={busyHabit === busyKey}
                    onTap={() => onTap(habit)}
                    t={t}
                    lang={lang}
                  />
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

