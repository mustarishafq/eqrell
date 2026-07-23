'use client'

import { useState, useEffect } from 'react'
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

export default function HabitBoard({ kids, lang = 'ms', title }) {
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
}

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

        {/* Name + count */}
        <div className="flex-1 min-w-0">
          <div className="font-black leading-tight"
            style={{
              color: '#FFF8E7',
              fontSize: 'clamp(1.1rem, 1.8vw, 2rem)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}>
            {kid.nickname}
          </div>
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
                {list.map(h => <HabitRow key={h.id} habit={h} lang={lang} />)}
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
              {anytime.map(h => <HabitRow key={h.id} habit={h} lang={lang} />)}
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
// HabitRow — single habit line item
// ═══════════════════════════════════════════════════════════════════════════
const HabitRow = ({ habit, lang }) => {
  const meta = STATUS_META[habit.status] || STATUS_META.pending
  const categoryColor = CATEGORY_DOTS[habit.category] || CATEGORY_DOTS.default
  const titleText = habit.i18n?.[lang]?.title || habit.title
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg flex items-center gap-1.5 px-1.5 py-1 border"
      style={{ background: meta.bg, borderColor: meta.ring }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
      <span className="text-[11px] font-black tabular-nums w-3.5 text-center flex-shrink-0" style={{ color: meta.text }}>
        {meta.icon}
      </span>
      <span className="text-xs flex-shrink-0">{habit.icon}</span>
      <span className={`text-[11px] flex-1 truncate ${habit.status === 'pending' ? '' : 'line-through opacity-60'}`}
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
