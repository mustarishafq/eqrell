'use client'

import { motion } from 'framer-motion'
import { AVATAR_BY_ID } from '@/lib/avatars'

/**
 * HabitBoard — Skylight-calendar-inspired per-child habit board for Family Display.
 *
 * Renders each child as a mini card with their habits listed with status.
 * Status visual:
 *  - ihsan → 🌟 gold background
 *  - done  → ✓ green
 *  - pending → ○ amber
 */
const CATEGORY_DOTS = {
  ibadah: '#10B981',   // emerald
  akhlak: '#8B5CF6',   // violet
  ilmu:   '#3B82F6',   // blue
  fizikal:'#F59E0B',   // amber
  rumah:  '#EC4899',   // pink
  default:'#94A3B8',   // slate
}

const STATUS_META = {
  ihsan:   { icon: '🌟', bg: 'rgba(255,183,3,0.2)',  ring: 'rgba(255,183,3,0.5)', text: '#FFB703' },
  done:    { icon: '✓',  bg: 'rgba(0,184,148,0.15)', ring: 'rgba(0,184,148,0.4)', text: '#00B894' },
  pending: { icon: '○',  bg: 'rgba(255,255,255,0.05)', ring: 'rgba(255,255,255,0.1)', text: 'rgba(255,248,231,0.6)' },
}

export default function HabitBoard({ kids, lang = 'ms', title }) {
  if (!kids || kids.length === 0) return null

  return (
    <div className="rounded-3xl bg-emerald-950/60 backdrop-blur border border-emerald-400/20 shadow-2xl p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="text-[10px] uppercase tracking-widest font-black mb-2 flex items-center gap-1" style={{ color: '#FFB703' }}>
        <span className="text-base">📋</span> {title}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`grid gap-2 h-full ${kids.length === 1 ? 'grid-cols-1' : kids.length === 2 ? 'grid-cols-2' : 'grid-cols-2'} auto-rows-fr`}>
          {kids.map(kid => {
            const avatar = kid.avatarId ? AVATAR_BY_ID[kid.avatarId] : null
            const habits = kid.habits || []
            const total = habits.length
            const doneCount = habits.filter(h => h.status !== 'pending').length
            const pct = total > 0 ? doneCount / total : 0

            return (
              <div key={kid.id}
                className="rounded-2xl backdrop-blur border p-2 flex flex-col min-h-0 overflow-hidden"
                style={{ background: 'rgba(0,184,148,0.08)', borderColor: 'rgba(0,184,148,0.25)' }}>
                {/* Kid header */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white/10 border-2 flex-shrink-0"
                    style={{ borderColor: kid.favColor || '#00B894' }}>
                    {avatar ? <img src={avatar.src} alt="" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center text-sm">🧒</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black leading-tight truncate" style={{ color: '#FFF8E7' }}>{kid.nickname}</div>
                    <div className="text-[9px] tabular-nums leading-none" style={{ color: '#FFF8E7', opacity: 0.6 }}>{doneCount}/{total}</div>
                  </div>
                  {/* Mini progress ring */}
                  <div className="relative w-6 h-6 flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
                      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,184,148,0.15)" strokeWidth="3" />
                      <circle cx="12" cy="12" r="10" fill="none" stroke={kid.favColor || '#00B894'} strokeWidth="3"
                        strokeDasharray={`${pct * 62.83} 62.83`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black tabular-nums" style={{ color: '#FFF8E7' }}>
                      {Math.round(pct * 100)}
                    </div>
                  </div>
                </div>

                {/* Habits list */}
                <div className="flex-1 min-h-0 overflow-hidden space-y-0.5">
                  {habits.slice(0, 6).map(h => {
                    const meta = STATUS_META[h.status] || STATUS_META.pending
                    const categoryColor = CATEGORY_DOTS[h.category] || CATEGORY_DOTS.default
                    const titleText = h.i18n?.[lang]?.title || h.title
                    return (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-lg flex items-center gap-1 px-1.5 py-0.5 border"
                        style={{ background: meta.bg, borderColor: meta.ring }}
                      >
                        {/* Category dot */}
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
                        {/* Status icon */}
                        <span className="text-[10px] font-black tabular-nums w-3 text-center flex-shrink-0" style={{ color: meta.text }}>
                          {meta.icon}
                        </span>
                        {/* Habit icon */}
                        <span className="text-[11px] flex-shrink-0">{h.icon}</span>
                        {/* Title */}
                        <span className={`text-[10px] flex-1 truncate ${h.status === 'pending' ? '' : 'line-through'}`}
                          style={{ color: h.status === 'pending' ? '#FFF8E7' : 'rgba(255,248,231,0.55)' }}>
                          {titleText}
                        </span>
                      </motion.div>
                    )
                  })}
                  {habits.length === 0 && (
                    <div className="text-[10px] italic text-center py-2" style={{ color: '#FFF8E7', opacity: 0.4 }}>
                      {lang === 'ar' ? 'لا توجد عادات بعد' : lang === 'en' ? 'No habits yet' : lang === 'id' ? 'Belum ada kebiasaan' : 'Belum ada habit'}
                    </div>
                  )}
                  {habits.length > 6 && (
                    <div className="text-[9px] text-center pt-0.5" style={{ color: '#FFF8E7', opacity: 0.5 }}>
                      +{habits.length - 6} {lang === 'ar' ? 'المزيد' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
