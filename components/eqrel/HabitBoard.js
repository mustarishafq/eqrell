'use client'

import { motion } from 'framer-motion'
import { AVATAR_BY_ID } from '@/lib/avatars'
import {
  SESSION_BY_ID,
  getSessionLabel,
  currentSessionFromClock,
  inferSession,
  inferRecurring,
} from '@/lib/prayerSession'

/**
 * HabitBoard — Skylight-calendar-inspired per-child habit board for Family Display.
 *
 * Auto-layout by kid count:
 *   1 kid   → single big card (uses full width)
 *   2-3 kids → 2-column card grid
 *   4+ kids → LIST layout — 1 full-width row per kid (name never truncates)
 *
 * Priority: TIME-grouped habits (prayer sessions) shown FIRST — because those are
 * time-bound and urgent. Anytime habits shown last, condensed.
 *
 * Current prayer session AUTO-highlighted with glow + pulse.
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
  pending: { icon: '○',  bg: 'rgba(255,255,255,0.05)', ring: 'rgba(255,255,255,0.1)', text: 'rgba(255,248,231,0.55)' },
}

const PRAYER_ORDER = ['subuh', 'zohor', 'asar', 'maghrib', 'isyak', 'sebelumTidur']

export default function HabitBoard({ kids, lang = 'ms', title }) {
  if (!kids || kids.length === 0) return null
  const currentSession = currentSessionFromClock()
  const count = kids.length

  // Layout decision
  const layout = count === 1 ? 'single' : count <= 3 ? 'grid' : 'list'

  return (
    <div className="rounded-3xl bg-emerald-950/60 backdrop-blur border border-emerald-400/20 shadow-2xl p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="text-[10px] uppercase tracking-widest font-black mb-2 flex items-center gap-1 flex-shrink-0" style={{ color: '#FFB703' }}>
        <span className="text-base">📋</span> {title}
        <span className="ml-auto text-[9px] font-bold opacity-60">{count} {lang === 'ar' ? 'أطفال' : lang === 'en' ? 'kids' : 'anak'}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {layout === 'list' ? (
          <div className="h-full flex flex-col gap-1.5 overflow-hidden">
            {kids.map(kid => (
              <KidRow key={kid.id} kid={kid} lang={lang} currentSession={currentSession} totalKids={count} />
            ))}
          </div>
        ) : (
          <div className={`grid gap-2 h-full ${layout === 'single' ? 'grid-cols-1' : 'grid-cols-2'} auto-rows-fr`}>
            {kids.map(kid => (
              <KidCard key={kid.id} kid={kid} lang={lang} currentSession={currentSession} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper — split habits into buckets (prayer-sessions first, anytime last)
// ═══════════════════════════════════════════════════════════════════════════
function bucketHabits(habits) {
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
  return { anytime, bySession }
}

// ═══════════════════════════════════════════════════════════════════════════
// KidCard — for 1-3 kids grid layout
// ═══════════════════════════════════════════════════════════════════════════
const KidCard = ({ kid, lang, currentSession }) => {
  const avatar = kid.avatarId ? AVATAR_BY_ID[kid.avatarId] : null
  const habits = kid.habits || []
  const { anytime, bySession } = bucketHabits(habits)
  const total = habits.length
  const doneCount = habits.filter(h => h.status !== 'pending').length
  const pct = total > 0 ? doneCount / total : 0
  const orderedSessions = PRAYER_ORDER.filter(sid => bySession[sid]?.length > 0)

  return (
    <div className="rounded-2xl backdrop-blur border p-2 flex flex-col min-h-0 overflow-hidden"
      style={{ background: 'rgba(0,184,148,0.08)', borderColor: 'rgba(0,184,148,0.25)' }}>
      {/* Kid header */}
      <div className="flex items-center gap-2 mb-1.5 flex-shrink-0">
        <div className="relative w-9 h-9 rounded-full overflow-hidden bg-white/10 border-2 flex-shrink-0"
          style={{ borderColor: kid.favColor || '#00B894' }}>
          {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
            <div className="w-full h-full flex items-center justify-center text-sm">🧒</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black leading-tight"
            style={{ color: '#FFF8E7', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
            {kid.nickname}
          </div>
          <div className="text-[10px] tabular-nums leading-none mt-0.5" style={{ color: '#FFF8E7', opacity: 0.65 }}>{doneCount}/{total}</div>
        </div>
        <div className="relative w-7 h-7 flex-shrink-0">
          <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
            <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,184,148,0.15)" strokeWidth="3" />
            <circle cx="12" cy="12" r="10" fill="none" stroke={kid.favColor || '#00B894'} strokeWidth="3"
              strokeDasharray={`${pct * 62.83} 62.83`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black tabular-nums" style={{ color: '#FFF8E7' }}>
            {Math.round(pct * 100)}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden space-y-1">
        {/* PRIORITY 1 — Prayer sessions FIRST */}
        {orderedSessions.map(sid => {
          const list = bySession[sid]
          const meta = SESSION_BY_ID[sid]
          const isCurrent = sid === currentSession
          const sessDone = list.filter(h => h.status !== 'pending').length
          const sessTotal = list.length
          const sessPct = sessTotal > 0 ? sessDone / sessTotal : 0
          return (
            <div key={sid}>
              <SessionHeaderRow meta={meta} sid={sid} lang={lang} isCurrent={isCurrent} sessDone={sessDone} sessTotal={sessTotal} sessPct={sessPct} />
              <div className="space-y-0.5 pl-2 border-l" style={{ borderColor: `${meta.color}33` }}>
                {list.slice(0, 2).map(h => <HabitRow key={h.id} habit={h} lang={lang} />)}
                {list.length > 2 && <MoreRow count={list.length - 2} lang={lang} />}
              </div>
            </div>
          )
        })}

        {/* PRIORITY 2 — Anytime last (condensed) */}
        {anytime.length > 0 && (
          <div>
            <div className="text-[8px] font-black uppercase tracking-wider mb-0.5" style={{ color: '#FFF8E7', opacity: 0.5 }}>
              🕰 {lang === 'ar' ? 'طوال اليوم' : lang === 'en' ? 'Anytime' : lang === 'id' ? 'Kapan saja' : 'Sepanjang'}
            </div>
            <div className="space-y-0.5">
              {anytime.slice(0, 3).map(h => <HabitRow key={h.id} habit={h} lang={lang} />)}
              {anytime.length > 3 && <MoreRow count={anytime.length - 3} lang={lang} />}
            </div>
          </div>
        )}

        {habits.length === 0 && (
          <div className="text-[10px] italic text-center py-2" style={{ color: '#FFF8E7', opacity: 0.4 }}>
            {lang === 'ar' ? 'لا توجد عادات بعد' : lang === 'en' ? 'No habits yet' : lang === 'id' ? 'Belum ada kebiasaan' : 'Belum ada habit'}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// KidRow — for 4+ kids list layout (1 full-width row per kid, name never truncates)
// ═══════════════════════════════════════════════════════════════════════════
const KidRow = ({ kid, lang, currentSession, totalKids }) => {
  const avatar = kid.avatarId ? AVATAR_BY_ID[kid.avatarId] : null
  const habits = kid.habits || []
  const { anytime, bySession } = bucketHabits(habits)
  const total = habits.length
  const doneCount = habits.filter(h => h.status !== 'pending').length
  const pct = total > 0 ? doneCount / total : 0
  const orderedSessions = PRAYER_ORDER.filter(sid => bySession[sid]?.length > 0)

  return (
    <div className="rounded-xl backdrop-blur border px-2 py-1.5 flex items-center gap-2 flex-shrink-0 overflow-hidden"
      style={{ background: 'rgba(0,184,148,0.08)', borderColor: 'rgba(0,184,148,0.25)', minHeight: totalKids >= 5 ? 56 : 68 }}>

      {/* Left: Avatar + Name — FIXED width, full name shown */}
      <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: 120 }}>
        <div className="relative w-9 h-9 rounded-full overflow-hidden bg-white/10 border-2 flex-shrink-0"
          style={{ borderColor: kid.favColor || '#00B894' }}>
          {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
            <div className="w-full h-full flex items-center justify-center text-sm">🧒</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-black leading-tight"
            style={{ color: '#FFF8E7', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
            {kid.nickname}
          </div>
          <div className="text-[9px] tabular-nums leading-none mt-0.5" style={{ color: '#FFF8E7', opacity: 0.65 }}>{doneCount}/{total} · {Math.round(pct * 100)}%</div>
        </div>
      </div>

      {/* Middle: Prayer session pills — PRIORITY, shown first */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
        {orderedSessions.length === 0 && anytime.length === 0 && (
          <div className="text-[9px] italic" style={{ color: '#FFF8E7', opacity: 0.4 }}>
            {lang === 'ar' ? 'لا عادات' : lang === 'en' ? 'No habits' : lang === 'id' ? 'Belum ada' : 'Belum ada habit'}
          </div>
        )}
        {orderedSessions.map(sid => {
          const list = bySession[sid]
          const meta = SESSION_BY_ID[sid]
          const isCurrent = sid === currentSession
          const sessDone = list.filter(h => h.status !== 'pending').length
          const sessTotal = list.length
          const sessPct = sessTotal > 0 ? sessDone / sessTotal : 0
          const allDone = sessDone === sessTotal && sessTotal > 0
          return (
            <div key={sid}
              className={`flex items-center gap-1 rounded-lg px-1.5 py-1 flex-shrink-0 ${isCurrent ? 'ring-2 animate-pulse' : ''}`}
              style={{
                background: allDone ? `${meta.color}33` : `${meta.color}15`,
                borderColor: `${meta.color}44`,
                border: '1px solid',
                ...(isCurrent ? { boxShadow: `0 0 0 2px ${meta.color}88` } : {}),
              }}>
              <span className="text-[11px] leading-none">{meta.icon}</span>
              <div className="flex flex-col leading-none">
                <span className="text-[8px] font-black uppercase tracking-wider"
                  style={{ color: isCurrent ? meta.color : 'rgba(255,248,231,0.75)' }}>
                  {getSessionLabel(sid, lang).replace('Selepas ', '').replace('After ', '').replace('Setelah ', '').replace('بعد ', '').slice(0, 6)}
                </span>
                <span className="text-[9px] font-black tabular-nums mt-0.5" style={{ color: '#FFF8E7' }}>
                  {sessDone}/{sessTotal}
                </span>
              </div>
              {/* Progress bar mini */}
              <div className="w-6 h-1 rounded-full ml-0.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${sessPct * 100}%`, background: meta.color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Right: Anytime chip — condensed, last priority */}
      {anytime.length > 0 && (
        <div className="flex items-center gap-1 rounded-lg px-1.5 py-1 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <span className="text-[11px] leading-none">🕰</span>
          <div className="flex flex-col leading-none">
            <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,248,231,0.7)' }}>
              {lang === 'ar' ? 'ط.ي' : lang === 'en' ? 'Any' : 'Bila-bila'}
            </span>
            <span className="text-[9px] font-black tabular-nums mt-0.5" style={{ color: '#FFF8E7' }}>
              {anytime.filter(h => h.status !== 'pending').length}/{anytime.length}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════
const SessionHeaderRow = ({ meta, sid, lang, isCurrent, sessDone, sessTotal, sessPct }) => (
  <div className="flex items-center gap-1 mb-0.5">
    <span className="text-[10px] leading-none" style={{ color: meta.color }}>{meta.icon}</span>
    <span className={`text-[8px] font-black uppercase tracking-wider truncate ${isCurrent ? 'animate-pulse' : ''}`}
      style={{ color: isCurrent ? meta.color : 'rgba(255,248,231,0.55)' }}>
      {getSessionLabel(sid, lang).replace('Selepas ', '').replace('After ', '').replace('Setelah ', '').replace('بعد ', '')}
    </span>
    <span className="text-[8px] tabular-nums opacity-60" style={{ color: '#FFF8E7' }}>
      {sessDone}/{sessTotal}
    </span>
    <div className="flex-1 h-0.5 rounded-full ml-0.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${sessPct * 100}%`, background: meta.color }} />
    </div>
  </div>
)

const HabitRow = ({ habit, lang }) => {
  const meta = STATUS_META[habit.status] || STATUS_META.pending
  const categoryColor = CATEGORY_DOTS[habit.category] || CATEGORY_DOTS.default
  const titleText = habit.i18n?.[lang]?.title || habit.title
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-md flex items-center gap-1 px-1 py-0.5 border"
      style={{ background: meta.bg, borderColor: meta.ring }}
    >
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
      <span className="text-[9px] font-black tabular-nums w-2.5 text-center flex-shrink-0" style={{ color: meta.text }}>
        {meta.icon}
      </span>
      <span className="text-[10px] flex-shrink-0">{habit.icon}</span>
      <span className={`text-[9px] flex-1 truncate ${habit.status === 'pending' ? '' : 'line-through'}`}
        style={{ color: habit.status === 'pending' ? '#FFF8E7' : 'rgba(255,248,231,0.5)' }}>
        {titleText}
      </span>
      {habit._perPrayer && (
        <span className="text-[7px] font-black px-1 rounded-sm flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.3)', color: '#C7D2FE' }}>
          5×
        </span>
      )}
    </motion.div>
  )
}

const MoreRow = ({ count, lang }) => (
  <div className="text-[8px] text-center py-0" style={{ color: '#FFF8E7', opacity: 0.5 }}>
    +{count} {lang === 'ar' ? 'المزيد' : lang === 'en' ? 'more' : lang === 'id' ? 'lagi' : 'lagi'}
  </div>
)
