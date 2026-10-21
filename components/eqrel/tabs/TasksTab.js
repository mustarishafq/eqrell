'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Settings2, CheckCircle2, Clock, Circle, Star } from 'lucide-react'
import { pick, colorOf, habitTitle, TabHeader } from './tabUtils'

const FILTERS = ['all', 'pending', 'waiting', 'done']

const statusOf = (h) => {
  if (h.recurring === 'perPrayer') return (h.sessionsClaimed?.length || 0) > 0 ? 'waiting' : 'pending'
  if (h.todayStatus === 'verified') return h.rubric === 'ihsan' ? 'ihsan' : 'done'
  if (h.todayStatus === 'claimed') return 'waiting'
  return 'pending'
}

export default function TasksTab({ kids = [], lang = 'ms', icon, avatarSrc, pendingVerifyCount = 0, refreshKey = 0, onOpenVerify, onOpenHabits, onAddChild }) {
  const L = pick(lang)
  const [habitsByChild, setHabitsByChild] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const map = {}
    await Promise.all(kids.map(async (c) => {
      try {
        const r = await fetch(`/api/children/${c.id}/habits`, { credentials: 'include' })
        if (r.ok) map[c.id] = (await r.json()).habits || []
      } catch { /* ignore */ }
    }))
    setHabitsByChild(map)
    setLoading(false)
  }, [kids])
  useEffect(() => { load() }, [load, refreshKey])

  const filterLabel = {
    all: L('Semua', 'All', 'Semua', 'الكل'),
    pending: L('Belum', 'To do', 'Belum', 'لم تنجز'),
    waiting: L('Tunggu Sah', 'To verify', 'Tunggu', 'بانتظار'),
    done: L('Siap', 'Done', 'Selesai', 'منجز'),
  }
  const statusChip = {
    pending: { label: L('Belum', 'To do', 'Belum', 'لم تنجز'), cls: 'bg-slate-100 text-slate-600', Icon: Circle },
    waiting: { label: L('Tunggu sah', 'To verify', 'Tunggu', 'بانتظار'), cls: 'bg-sky-100 text-sky-700', Icon: Clock },
    done: { label: L('Siap', 'Done', 'Selesai', 'منجز'), cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2 },
    ihsan: { label: 'Ihsan', cls: 'bg-amber-100 text-amber-700', Icon: Star },
  }

  return (
    <div className="flex flex-col gap-2" data-testid="tab-tasks">
      <TabHeader icon={icon}
        title={L('Tugasan Hari Ini', "Today's Tasks", 'Tugas Hari Ini', 'مهام اليوم')}
        sub={L('Habit setiap anak untuk hari ini', "Each child's habits for today", 'Kebiasaan setiap anak hari ini', 'عادات كل طفل اليوم')} />

      <button onClick={onOpenVerify} data-testid="tasks-verify-btn"
        className="w-full bg-eq-blue/10 border-2 border-eq-blue/20 rounded-2xl px-3 py-2.5 flex items-center gap-2.5 active:scale-[0.99] flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-lg">✅</div>
        <div className="flex-1 text-left font-bold text-eq-ink text-sm">
          {pendingVerifyCount > 0
            ? L(`${pendingVerifyCount} tugasan menunggu pengesahan`, `${pendingVerifyCount} tasks waiting to verify`, `${pendingVerifyCount} tugas menunggu verifikasi`, `${pendingVerifyCount} مهام بانتظار التحقق`)
            : L('Tiada tugasan menunggu pengesahan', 'Nothing waiting to verify', 'Tidak ada yang menunggu verifikasi', 'لا شيء بانتظار التحقق')}
        </div>
        <ChevronRight className="w-5 h-5 text-eq-blue" strokeWidth={2.5} />
      </button>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-shrink-0">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`tasks-filter-${f}`}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${filter === f ? 'bg-eq-ink text-white border-eq-ink' : 'bg-white text-eq-ink/70 border-eq-cream'}`}>
            {filterLabel[f]}
          </button>
        ))}
      </div>

      {kids.length === 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-eq-card text-center">
          <div className="text-4xl mb-2">👶</div>
          <p className="text-eq-ink/70 text-sm mb-3">{L('Tambah anak dahulu untuk mula menetapkan habit.', 'Add a child first to start assigning habits.', 'Tambahkan anak dulu untuk mulai menetapkan kebiasaan.', 'أضف طفلاً أولاً.')}</p>
          <button onClick={onAddChild} className="bg-eq-green text-white font-bold text-sm px-4 py-2 rounded-full active:scale-95">
            + {L('Tambah Anak', 'Add Child', 'Tambah Anak', 'أضف طفلاً')}
          </button>
        </div>
      )}

      {kids.map((c, ci) => {
        const list = habitsByChild[c.id] || []
        const withStatus = list.map(h => ({ ...h, _s: statusOf(h) }))
        const doneCount = withStatus.filter(h => h._s === 'done' || h._s === 'ihsan').length
        const shown = withStatus.filter(h => filter === 'all' ? true : filter === 'done' ? (h._s === 'done' || h._s === 'ihsan') : h._s === filter)
        const color = colorOf(c)
        const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0
        return (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.05 }}
            className="bg-white rounded-3xl p-3.5 shadow-eq-card flex-shrink-0" data-testid={`tasks-child-${c.id}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 flex-shrink-0 bg-amber-50" style={{ borderColor: color }}>
                <img src={avatarSrc(c)} alt={c.nickname} className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-eq-ink text-base leading-tight truncate">{c.nickname}</div>
                <div className="text-[11px] text-eq-ink/55 font-semibold">{doneCount}/{list.length} {L('siap', 'done', 'selesai', 'منجز')} · {pct}%</div>
              </div>
              <button onClick={() => onOpenHabits?.(c)} data-testid={`tasks-manage-${c.id}`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-eq-cream/60 text-eq-ink text-[11px] font-bold active:scale-95">
                <Settings2 className="w-3.5 h-3.5" /> {L('Urus Habit', 'Manage', 'Kelola', 'إدارة')}
              </button>
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-eq-cream/70 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
            </div>

            <div className="mt-2.5 flex flex-col gap-1.5">
              {loading && list.length === 0 && [0, 1, 2].map(i => <div key={i} className="h-9 rounded-xl bg-eq-cream/40 animate-pulse" />)}
              {!loading && list.length === 0 && (
                <button onClick={() => onOpenHabits?.(c)} className="text-xs text-eq-green font-bold py-2 rounded-xl border-2 border-dashed border-eq-green/30">
                  + {L('Tetapkan habit pertama', 'Assign the first habit', 'Tetapkan kebiasaan pertama', 'أضف أول عادة')}
                </button>
              )}
              {!loading && list.length > 0 && shown.length === 0 && (
                <div className="text-center text-[11px] text-eq-ink/45 py-2">{L('Tiada tugasan dalam kategori ini', 'No tasks in this filter', 'Tidak ada tugas di filter ini', 'لا توجد مهام')}</div>
              )}
              {shown.map(h => {
                const chip = statusChip[h._s]
                const ChipIcon = chip.Icon
                return (
                  <div key={h.id} className="flex items-center gap-2.5 rounded-xl bg-eq-warm/60 px-2.5 py-2">
                    <span className="text-lg leading-none">{h.icon || '⭐'}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-bold truncate ${h._s === 'done' || h._s === 'ihsan' ? 'text-eq-ink/50 line-through' : 'text-eq-ink'}`}>{habitTitle(h, lang)}</div>
                      {h.recurring === 'perPrayer' && (
                        <div className="text-[10px] text-eq-ink/45">{(h.sessionsClaimed?.length || 0)}/5 {L('waktu solat', 'prayers', 'waktu sholat', 'صلوات')}</div>
                      )}
                    </div>
                    {Number(h.points) > 0 && <span className="text-[10px] font-black text-amber-600">+{h.points}</span>}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${chip.cls}`}>
                      <ChipIcon className="w-3 h-3" /> {chip.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
