'use client'

import { memo, useState, useEffect, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AVATAR_BY_ID } from '@/lib/avatars'
import {
  SESSION_BY_ID,
  getSessionLabel,
  currentSessionFromClock,
  inferSession,
  inferRecurring,
} from '@/lib/prayerSession'

/**
 * HabitBoard — Solo-kid rotating view for Family Display.
 *
 * Philosophy: NO COMPETITION between siblings — each child gets their own
 * spotlight, rotating one at a time. Islamic tarbiyah: every child is unique.
 *
 * Layout: BIG name, BIG number counter, BIG percentage, then their pending
 * habits grouped by prayer session (prayer-time habits FIRST, anytime LAST).
 *
 * Rotation: 8s per kid (adjustable). If 1 kid, no rotation.
 */

const CATEGORY_DOTS = {
  ibadah: '#10B981',
  akhlak: '#8B5CF6',
  ilmu:   '#3B82F6',
  pembelajaran: '#3B82F6',
  fizikal:'#F59E0B',
  kesihatan: '#F59E0B',
  rumah:  '#EC4899',
  keluarga: '#EC4899',
  default:'#94A3B8',
}

const STATUS_META = {
  ihsan:   { icon: '🌟', bg: 'rgba(255,183,3,0.22)',  ring: 'rgba(255,183,3,0.55)', text: '#FFB703' },
  done:    { icon: '✓',  bg: 'rgba(0,184,148,0.18)',  ring: 'rgba(0,184,148,0.45)', text: '#00B894' },
  pending: { icon: '○',  bg: 'rgba(255,255,255,0.05)', ring: 'rgba(255,255,255,0.1)', text: 'rgba(255,248,231,0.85)' },
}

const PRAYER_ORDER = ['subuh', 'zohor', 'asar', 'maghrib', 'isyak', 'sebelumTidur']
const ROTATE_MS = 8_000  // Rotate to next kid every 8 seconds

// ═══════════════════════════════════════════════════════════════════════════
// pickSuggestion — choose ONE habit for the child to focus on right now
// Scoring priority:
//   +100 pending habit in the CURRENT prayer session (highest urgency)
//   +80  perPrayer habit whose CURRENT session isn't claimed yet
//   +50  anytime pending habit (always doable)
//   +20  pending habit in the NEXT upcoming session (plan-ahead)
//   +  points * 0.05  (mild bias toward higher-point tasks)
// Returns the top-scored habit object, or null if nothing pending.
// ═══════════════════════════════════════════════════════════════════════════
const pickSuggestion = (habits, currentSession) => {
  if (!Array.isArray(habits) || habits.length === 0) return null

  // Find current session index for "next session" scoring
  const curIdx = PRAYER_ORDER.indexOf(currentSession)
  const nextSession = curIdx >= 0 && curIdx < PRAYER_ORDER.length - 1
    ? PRAYER_ORDER[curIdx + 1]
    : null

  const scored = []
  for (const h of habits) {
    const recurring = inferRecurring(h)
    const isPerPrayer = recurring === 'perPrayer'
    const habitSession = inferSession(h)
    const sessionsClaimed = Array.isArray(h.sessionsClaimed) ? h.sessionsClaimed : []

    // Skip if fully done (daily habit already done, or perPrayer current session claimed)
    if (isPerPrayer) {
      // Only suggest perPrayer if current session isn't already claimed
      if (currentSession && sessionsClaimed.includes(currentSession)) continue
      // If we're outside prayer sessions (anytime), skip perPrayer for now
      if (!currentSession || currentSession === 'anytime') continue
    } else {
      // Daily habit — skip if done/ihsan
      if (h.status !== 'pending') continue
    }

    let score = 0
    if (isPerPrayer) {
      score += 80  // Priority 2: perPrayer needing current session
    } else if (habitSession === currentSession && currentSession) {
      score += 100 // Priority 1: current session daily habit
    } else if (habitSession === 'anytime' || !habitSession) {
      score += 50  // Priority 3: anytime
    } else if (habitSession === nextSession) {
      score += 20  // Priority 4: next session preview
    } else {
      score += 5   // Any other pending habit (bottom priority)
    }

    // Mild points bias
    score += (Number(h.points) || 0) * 0.05

    scored.push({ habit: h, score })
  }

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)
  return scored[0].habit
}

// ═══════════════════════════════════════════════════════════════════════════
// AutoFitText — single-line text that auto-shrinks font-size to fit container width
// (Prevents nickname from wrapping to 2 lines; kecil font kalau tak muat)
// ═══════════════════════════════════════════════════════════════════════════
function AutoFitText({ text, maxPx = 32, minPx = 12, className, style }) {
  const containerRef = useRef(null)
  const textRef = useRef(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const el = textRef.current
    if (!container || !el) return

    const fit = () => {
      let size = maxPx
      el.style.fontSize = `${size}px`
      // Linear shrink until fits (single-line, no wrap)
      // Guard: max ~20 iterations for safety
      let guard = 0
      while (el.scrollWidth > container.clientWidth && size > minPx && guard < 40) {
        size -= 1
        el.style.fontSize = `${size}px`
        guard += 1
      }
    }
    fit()

    // Re-fit on container resize (window resize / TV rotation / etc)
    const ro = new ResizeObserver(fit)
    ro.observe(container)
    return () => ro.disconnect()
  }, [text, maxPx, minPx])

  return (
    <div ref={containerRef} className={className} style={{ ...style, overflow: 'hidden', width: '100%' }}>
      <span ref={textRef} style={{ whiteSpace: 'nowrap', display: 'inline-block', lineHeight: 1.1 }}>
        {text}
      </span>
    </div>
  )
}

export default memo(function HabitBoard({ kids, lang = 'ms', title }) {
  const safeKids = kids || []
  const count = safeKids.length
  const currentSession = currentSessionFromClock()

  const [idx, setIdx] = useState(0)

  // Auto-rotate if > 1 kid. Reset idx if kid list shrinks.
  useEffect(() => {
    if (idx >= count) setIdx(0)
  }, [count, idx])

  useEffect(() => {
    if (count <= 1) return
    const tt = setInterval(() => {
      setIdx(i => (i + 1) % count)
    }, ROTATE_MS)
    return () => clearInterval(tt)
  }, [count])

  if (count === 0) return null
  const kid = safeKids[Math.min(idx, count - 1)]
  if (!kid) return null

  return (
    <div className="rounded-3xl bg-emerald-950/60 backdrop-blur border border-emerald-400/20 shadow-2xl p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* Board header — title + pagination dots */}
      <div className="text-[10px] uppercase tracking-widest font-black mb-2 flex items-center gap-1 flex-shrink-0" style={{ color: '#FFB703' }}>
        <span className="text-base">📋</span> {title}
        {count > 1 && (
          <span className="ml-auto flex gap-1 items-center">
            <span className="text-[9px] font-bold opacity-60">{idx + 1}/{count}</span>
            <span className="flex gap-0.5">
              {Array.from({ length: count }).map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{ background: i === idx ? '#FFB703' : 'rgba(255,255,255,0.2)' }} />
              ))}
            </span>
          </span>
        )}
      </div>

      {/* Solo kid view — rotates through each child */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={kid.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="h-full flex flex-col gap-2 overflow-hidden">
            <KidSoloView kid={kid} lang={lang} currentSession={currentSession} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// KidSoloView — one child in spotlight (big name, big number, big %, habits)
// ═══════════════════════════════════════════════════════════════════════════
const KidSoloView = ({ kid, lang, currentSession }) => {
  const avatar = kid.avatarId ? AVATAR_BY_ID[kid.avatarId] : null
  const habits = kid.habits || []

  // Split habits into buckets — prayer sessions FIRST, anytime LAST
  const anytime = []
  const bySession = {}
  habits.forEach(h => {
    const isPerPrayer = inferRecurring(h) === 'perPrayer'
    if (isPerPrayer) { anytime.push({ ...h, _perPrayer: true }); return }
    const sid = inferSession(h)
    if (sid === 'anytime') { anytime.push(h); return }
    if (!bySession[sid]) bySession[sid] = []
    bySession[sid].push(h)
  })

  // Suggestion — the ONE habit the child should focus on right now
  const suggestion = pickSuggestion(habits, currentSession)
  const suggestionId = suggestion?.id || null

  const total = habits.length
  const doneCount = habits.filter(h => h.status !== 'pending').length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const kidColor = kid.favColor || '#00B894'
  const orderedSessions = PRAYER_ORDER.filter(sid => bySession[sid]?.length > 0)

  return (
    <>
      {/* ═══ HEADER — Big Avatar + Big Name + Big Number + Big % ═══ */}
      <div className="flex items-center gap-3 flex-shrink-0 pb-2 border-b" style={{ borderColor: `${kidColor}33` }}>
        {/* Avatar — bigger */}
        <div className="relative rounded-full overflow-hidden bg-white/10 border-4 flex-shrink-0"
          style={{ borderColor: kidColor, width: 'clamp(48px, 5vw, 72px)', height: 'clamp(48px, 5vw, 72px)' }}>
          {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
            <div className="w-full h-full flex items-center justify-center text-2xl">🧒</div>}
        </div>

        {/* Name (auto-fit single line — kecil font kalau nama panjang) + count */}
        <div className="flex-1 min-w-0">
          <AutoFitText
            text={kid.nickname || ''}
            maxPx={36}
            minPx={14}
            className="font-black"
            style={{ color: '#FFF8E7' }}
          />
          {/* Big X/Y number */}
          <div className="flex items-baseline gap-1.5 mt-1">
            <motion.span
              key={doneCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              className="font-black tabular-nums leading-none"
              style={{ color: kidColor, fontSize: 'clamp(1.5rem, 2.2vw, 2.4rem)' }}>
              {doneCount}
            </motion.span>
            <span className="font-black tabular-nums leading-none" style={{ color: 'rgba(255,248,231,0.55)', fontSize: 'clamp(1rem, 1.4vw, 1.5rem)' }}>
              /{total}
            </span>
            <span className="text-[9px] uppercase tracking-widest font-black ml-1" style={{ color: '#FFF8E7', opacity: 0.65 }}>
              {lang === 'ar' ? 'مهام' : lang === 'en' ? 'tasks' : lang === 'id' ? 'tugas' : 'tugas'}
            </span>
          </div>
        </div>

        {/* Big Progress Ring + % */}
        <div className="relative flex-shrink-0" style={{ width: 'clamp(56px, 6vw, 84px)', height: 'clamp(56px, 6vw, 84px)' }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none" stroke={kidColor} strokeWidth="8"
              strokeLinecap="round"
              initial={{ strokeDasharray: '0 263.9' }}
              animate={{ strokeDasharray: `${(pct / 100) * 263.9} 263.9` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
            <motion.span
              key={pct}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
              className="font-black tabular-nums"
              style={{ color: '#FFF8E7', fontSize: 'clamp(0.95rem, 1.4vw, 1.6rem)' }}>
              {pct}
            </motion.span>
            <span className="font-black" style={{ color: 'rgba(255,248,231,0.5)', fontSize: 'clamp(0.5rem, 0.65vw, 0.75rem)' }}>%</span>
          </div>
        </div>
      </div>

      {/* ═══ SUGGESTION CARD — ONE focus habit for this child right now ═══ */}
      <SuggestionCard
        suggestion={suggestion}
        allDone={total > 0 && doneCount === total}
        habitCount={total}
        currentSession={currentSession}
        kidColor={kidColor}
        lang={lang}
      />

      {/* ═══ HABITS LIST — Prayer sessions FIRST, anytime LAST ═══ */}
      <div className="flex-1 min-h-0 overflow-hidden pt-1 space-y-2">
        {orderedSessions.map(sid => {
          const list = bySession[sid]
          const meta = SESSION_BY_ID[sid]
          const isCurrent = sid === currentSession
          const sessDone = list.filter(h => h.status !== 'pending').length
          const sessTotal = list.length
          const sessPct = sessTotal > 0 ? sessDone / sessTotal : 0
          return (
            <div key={sid}>
              {/* Session header */}
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm leading-none" style={{ color: meta.color }}>{meta.icon}</span>
                <span className={`text-[10px] font-black uppercase tracking-wider ${isCurrent ? 'animate-pulse' : ''}`}
                  style={{ color: isCurrent ? meta.color : 'rgba(255,248,231,0.7)' }}>
                  {getSessionLabel(sid, lang).replace('Selepas ', '').replace('After ', '').replace('Setelah ', '').replace('بعد ', '')}
                </span>
                <span className="text-[10px] font-black tabular-nums" style={{ color: '#FFF8E7', opacity: 0.7 }}>
                  {sessDone}/{sessTotal}
                </span>
                <div className="flex-1 h-1 rounded-full ml-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sessPct * 100}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: meta.color }} />
                </div>
              </div>
              {/* Habits list */}
              <div className="space-y-1 pl-3 border-l-2" style={{ borderColor: `${meta.color}44` }}>
                {list.map(h => <HabitRow key={h.id} habit={h} lang={lang} isSuggested={h.id === suggestionId} />)}
              </div>
            </div>
          )
        })}

        {/* Anytime section — LAST */}
        {anytime.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm leading-none">🕰</span>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,248,231,0.7)' }}>
                {lang === 'ar' ? 'طوال اليوم' : lang === 'en' ? 'Anytime' : lang === 'id' ? 'Kapan saja' : 'Bila-bila Masa'}
              </span>
              <span className="text-[10px] font-black tabular-nums" style={{ color: '#FFF8E7', opacity: 0.7 }}>
                {anytime.filter(h => h.status !== 'pending').length}/{anytime.length}
              </span>
            </div>
            <div className="space-y-1 pl-3 border-l-2" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              {anytime.map(h => <HabitRow key={h.id} habit={h} lang={lang} isSuggested={h.id === suggestionId} />)}
            </div>
          </div>
        )}

        {/* Empty state */}
        {habits.length === 0 && (
          <div className="text-xs italic text-center py-8" style={{ color: '#FFF8E7', opacity: 0.4 }}>
            {lang === 'ar' ? 'لا توجد عادات بعد' : lang === 'en' ? 'No habits yet' : lang === 'id' ? 'Belum ada kebiasaan' : 'Belum ada habit ditetapkan'}
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SuggestionCard — the "focus this one" prompt at the top of each kid card.
// Big, pulsing, glowing card that tells the child which habit to tackle now.
// Auto-updates whenever the suggestion changes (habit completed → new one).
// ═══════════════════════════════════════════════════════════════════════════
const SuggestionCard = ({ suggestion, allDone, habitCount, currentSession, kidColor, lang }) => {
  // No habits assigned yet
  if (habitCount === 0) return null

  // All done — celebration state
  if (allDone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 rounded-xl border-2 px-3 py-2 flex items-center gap-2.5"
        style={{
          background: 'linear-gradient(135deg, rgba(0,184,148,0.28), rgba(255,183,3,0.20))',
          borderColor: 'rgba(0,184,148,0.55)',
        }}>
        <span className="text-2xl leading-none">🌟</span>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-widest font-black" style={{ color: '#FFF8E7', opacity: 0.75 }}>
            {lang === 'ar' ? 'الحمد لله' : lang === 'en' ? 'Alhamdulillah' : lang === 'id' ? 'Alhamdulillah' : 'Alhamdulillah'}
          </div>
          <div className="font-black leading-tight" style={{ color: '#FFF8E7', fontSize: 'clamp(0.9rem, 1.2vw, 1.15rem)' }}>
            {lang === 'ar' ? 'كل المهام مكتملة!' : lang === 'en' ? 'All tasks done today!' : lang === 'id' ? 'Semua tugas selesai!' : 'Semua tugas siap hari ini!'}
          </div>
        </div>
      </motion.div>
    )
  }

  // Nothing suggested (e.g. all current-window habits done, only future ones remain)
  if (!suggestion) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 rounded-xl border px-3 py-2 flex items-center gap-2.5"
        style={{
          background: 'rgba(255,255,255,0.06)',
          borderColor: 'rgba(255,255,255,0.18)',
        }}>
        <span className="text-xl leading-none opacity-70">☕</span>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-widest font-black" style={{ color: '#FFF8E7', opacity: 0.6 }}>
            {lang === 'ar' ? 'استرخِ الآن' : lang === 'en' ? 'Rest a while' : lang === 'id' ? 'Istirahat dulu' : 'Rehat sekejap'}
          </div>
          <div className="font-black leading-tight" style={{ color: '#FFF8E7', opacity: 0.8, fontSize: 'clamp(0.8rem, 1vw, 1rem)' }}>
            {lang === 'ar' ? 'لا مهام الآن' : lang === 'en' ? 'No task right now' : lang === 'id' ? 'Tidak ada tugas sekarang' : 'Tiada tugas sekarang'}
          </div>
        </div>
      </motion.div>
    )
  }

  // Active suggestion card
  const categoryColor = CATEGORY_DOTS[suggestion.category] || CATEGORY_DOTS.default
  const title = suggestion.i18n?.[lang]?.title || suggestion.title
  const isPerPrayer = inferRecurring(suggestion) === 'perPrayer'
  const habitSession = inferSession(suggestion)
  const sessMeta = habitSession && habitSession !== 'anytime' ? SESSION_BY_ID[habitSession] : null
  const sessionLabel = sessMeta ? getSessionLabel(habitSession, lang) : null

  const focusLabel = lang === 'ar' ? 'ركّز على هذا' :
                     lang === 'en' ? 'Focus on this' :
                     lang === 'id' ? 'Fokus ini' :
                     'Fokus ini dulu'

  return (
    <motion.div
      key={suggestion.id}
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex-shrink-0 relative rounded-2xl border-2 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${kidColor}30, ${kidColor}10 55%, rgba(0,0,0,0.15))`,
        borderColor: `${kidColor}88`,
        boxShadow: `0 0 24px ${kidColor}55, inset 0 0 0 1px ${kidColor}22`,
      }}
    >
      {/* Soft pulsing glow layer — gentle, doesn't hammer paint */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle at 30% 40%, ${kidColor}22, transparent 60%)` }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex items-center gap-3 px-3 py-2.5">
        {/* Big habit icon in circle */}
        <div
          className="flex-shrink-0 rounded-2xl flex items-center justify-center"
          style={{
            width: 'clamp(48px, 5vw, 68px)',
            height: 'clamp(48px, 5vw, 68px)',
            background: `${categoryColor}33`,
            border: `2px solid ${categoryColor}77`,
            fontSize: 'clamp(1.5rem, 2.2vw, 2.2rem)',
          }}
        >
          {suggestion.icon || '⭐'}
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] uppercase tracking-widest font-black" style={{ color: kidColor }}>
              🎯 {focusLabel}
            </span>
            {isPerPrayer && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-sm"
                style={{ background: 'rgba(99,102,241,0.35)', color: '#C7D2FE' }}>
                5×
              </span>
            )}
          </div>
          <div className="font-black leading-tight truncate" style={{ color: '#FFF8E7', fontSize: 'clamp(1rem, 1.5vw, 1.5rem)' }}>
            {title}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-black" style={{ color: 'rgba(255,248,231,0.75)' }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: categoryColor }} />
              <span>{(suggestion.category || 'ibadah').toUpperCase()}</span>
            </span>
            {sessionLabel && (
              <>
                <span className="opacity-40">·</span>
                <span style={{ color: sessMeta?.color }}>
                  {sessMeta?.icon} {sessionLabel.replace('Selepas ', '').replace('After ', '').replace('Setelah ', '')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Points badge — big */}
        <div className="flex-shrink-0 rounded-xl border-2 flex flex-col items-center justify-center px-2.5 py-1.5"
          style={{
            background: 'rgba(255,183,3,0.18)',
            borderColor: 'rgba(255,183,3,0.55)',
            minWidth: 'clamp(48px, 5vw, 66px)',
          }}>
          <span className="font-black leading-none tabular-nums" style={{ color: '#FFB703', fontSize: 'clamp(1.1rem, 1.6vw, 1.6rem)' }}>
            +{suggestion.points || 0}
          </span>
          <span className="text-[7px] font-black uppercase tracking-widest mt-0.5" style={{ color: '#FFB703', opacity: 0.85 }}>
            {lang === 'ar' ? 'نقطة' : lang === 'en' ? 'pts' : 'mata'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HabitRow — single habit line item
// ═══════════════════════════════════════════════════════════════════════════
const HabitRow = ({ habit, lang, isSuggested }) => {
  const meta = STATUS_META[habit.status] || STATUS_META.pending
  const categoryColor = CATEGORY_DOTS[habit.category] || CATEGORY_DOTS.default
  const titleText = habit.i18n?.[lang]?.title || habit.title
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={isSuggested
        ? { opacity: 1, x: 0, boxShadow: ['0 0 0px rgba(255,183,3,0)', '0 0 12px rgba(255,183,3,0.55)', '0 0 0px rgba(255,183,3,0)'] }
        : { opacity: 1, x: 0 }}
      transition={isSuggested
        ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut', x: { duration: 0.3 }, opacity: { duration: 0.3 } }
        : { duration: 0.3 }}
      className="rounded-lg flex items-center gap-1.5 px-1.5 py-1 border"
      style={{
        background: isSuggested ? 'rgba(255,183,3,0.14)' : meta.bg,
        borderColor: isSuggested ? 'rgba(255,183,3,0.55)' : meta.ring,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
      <span className="text-[11px] font-black tabular-nums w-3.5 text-center flex-shrink-0" style={{ color: isSuggested ? '#FFB703' : meta.text }}>
        {isSuggested ? '🎯' : meta.icon}
      </span>
      <span className="text-xs flex-shrink-0">{habit.icon}</span>
      <span className={`text-[11px] flex-1 truncate ${habit.status === 'pending' ? '' : 'line-through opacity-60'} ${isSuggested ? 'font-black' : ''}`}
        style={{ color: '#FFF8E7' }}>
        {titleText}
      </span>
      {habit._perPrayer && (
        <span className="text-[8px] font-black px-1 rounded-sm flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.3)', color: '#C7D2FE' }}>
          5×
        </span>
      )}
    </motion.div>
  )
}
