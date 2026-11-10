'use client'

import CatchUpSheet, { CatchUpChip } from '@/components/eqrel/CatchUpSheet'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Settings2, CheckCircle2, Clock, Circle, Star } from 'lucide-react'
import { pick, colorOf, habitTitle, TabHeader } from './tabUtils'

const FILTERS = ['all', 'pending', 'waiting', 'done']

const statusOf = (h) => {
  if (h.recurring === 'perPrayer' || h.recurring === 'multi') return (h.sessionsClaimed?.length || 0) > 0 ? 'waiting' : 'pending'
  if (h.todayStatus === 'verified') return h.rubric === 'ihsan' ? 'ihsan' : 'done'
  if (h.todayStatus === 'claimed') return 'waiting'
  return 'pending'
}

export default function TasksTab({ kids = [], lang = 'en', icon, avatarSrc, pendingVerifyCount = 0, refreshKey = 0, onOpenVerify, onOpenHabits, onAddChild, onCreateHabit }) {
  const [catchUpChild, setCatchUpChild] = useState(null)   // 🌙 update earlier days
  const [cuTick, setCuTick] = useState(0)
  const L = pick(lang)
  const [habitsByChild, setHabitsByChild] = useState({})
  const [lockedByChild, setLockedByChild] = useState({})
  const [metaByChild, setMetaByChild] = useState({})
  const [pauseMenu, setPauseMenu] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const map = {}, lmap = {}, mmap = {}
    await Promise.all(kids.map(async (c) => {
      try {
        const r = await fetch(`/api/children/${c.id}/habits`, { credentials: 'include' })
        if (r.ok) { const d = await r.json(); map[c.id] = d.habits || []; lmap[c.id] = d.lockedHabits || []; mmap[c.id] = { solatPause: d.solatPause, canCutiSolat: d.canCutiSolat, solatWajib: d.solatWajib, offToday: d.offTodayHabits || [] } }
      } catch { /* ignore */ }
    }))
    setHabitsByChild(map)
    setLockedByChild(lmap)
    setMetaByChild(mmap)
    setLoading(false)
  }, [kids])
  useEffect(() => { load() }, [load, refreshKey])

  // Mod Percaya on/off for one habit (auto-enabled by server after 7 consistent days)
  const toggleTrust = async (childId, h) => {
    const next = !h.autoVerify
    if (!next && !confirm(L('Matikan Mod Percaya? Habit ini perlu disahkan semula oleh anda.', 'Turn off Trust Mode? You will need to verify this habit again.', 'Matikan Mode Percaya?', 'إيقاف وضع الثقة؟'))) return
    setHabitsByChild(prev => ({ ...prev, [childId]: (prev[childId] || []).map(x => x.id === h.id ? { ...x, autoVerify: next } : x) }))
    await fetch(`/api/habits/${h.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoVerify: next }) }).catch(() => {})
  }

  // Start every "next week" habit today (parent decides they're ready)
  const [unlocking, setUnlocking] = useState(null)
  const unlockNow = async (childId) => {
    setUnlocking(childId)
    try { await fetch(`/api/children/${childId}/habits/unlock-now`, { method: 'POST', credentials: 'include' }) } catch { /* ignore */ }
    await load(); setUnlocking(null)
  }

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

      <div className="text-[11px] text-eq-ink/55 px-1 flex-shrink-0 leading-snug">
        🛡️ {L('Mod Percaya: habit yang disahkan 7 hari berturut-turut disahkan automatik. Tekan 🛡️ untuk hidup/matikan.', 'Trust Mode: habits verified 7 days in a row auto-verify. Tap 🛡️ to toggle.', 'Mode Percaya: kebiasaan 7 hari berturut-turut terverifikasi otomatis. Ketuk 🛡️.', 'وضع الثقة: العادة الموثقة ٧ أيام متتالية تُعتمد تلقائياً. اضغط 🛡️.')}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-shrink-0">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`tasks-filter-${f}`}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${filter === f ? 'bg-eq-ink text-white border-eq-ink' : 'bg-white text-eq-ink/70 border-eq-cream'}`}>
            {filterLabel[f]}
          </button>
        ))}
      </div>

      <CatchUpSheet open={!!catchUpChild} child={catchUpChild} lang={lang} mode="parent"
        onClose={() => { setCatchUpChild(null); setCuTick(t => t + 1); load() }} onChanged={() => load()} />

      {kids.length > 0 && onCreateHabit && (
        <button onClick={onCreateHabit} data-testid="tasks-create-habit"
          className="flex-shrink-0 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 px-4 shadow-md flex items-center justify-center gap-2 font-extrabold text-sm active:scale-[0.99]">
          <span className="text-lg leading-none">＋</span>
          {L('Cipta Habit', 'Create Habit', 'Buat Kebiasaan', 'أنشئ عادة')}
          <span className="text-[11px] font-bold opacity-80">· {kids.length > 1 ? L('untuk semua / pilih anak', 'for all or chosen kids', 'untuk semua / pilih anak', 'للجميع أو لأطفال محددين') : L('waktu, hari & mata', 'time, days & points', 'waktu, hari & poin', 'الوقت والأيام والنقاط')}</span>
        </button>
      )}

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
            <div className="mt-2 flex justify-end">
              <CatchUpChip childId={c.id} lang={lang} refreshKey={refreshKey + cuTick} onOpen={() => setCatchUpChild(c)} />
            </div>
            {/* Solat Teras: pause / resume */}
            {(() => {
              const m = metaByChild[c.id] || {}
              const sp = m.solatPause
              const call = async (path, body) => {
                setPauseMenu(null)
                await fetch(`/api/children/${c.id}/${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
                load()
              }
              if (sp) {
                const until = sp.until ? new Date(sp.until).toLocaleDateString(lang === 'ar' ? 'ar' : lang === 'ms' ? 'ms-MY' : lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' }) : ''
                return (
                  <div className="mt-2.5 rounded-2xl bg-rose-50 border border-rose-100 px-3 py-2 flex items-center gap-2" data-testid={`tasks-solat-paused-${c.id}`}>
                    <span className="text-lg">{sp.reason === 'haid' ? '🌸' : '🤒'}</span>
                    <div className="flex-1 text-[11px] text-rose-900 font-semibold leading-snug">
                      {sp.reason === 'haid' ? L('Cuti Solat', 'Prayer break (period)', 'Cuti Sholat', 'إجازة الصلاة') : L('Solat dijeda — sakit', 'Prayers paused — illness', 'Sholat dijeda — sakit', 'الصلاة موقوفة — مرض')}
                      {until ? ` · ${L('hingga', 'until', 'hingga', 'حتى')} ${until}` : ''}
                    </div>
                    <button onClick={() => call('solat-resume')} data-testid={`tasks-solat-resume-${c.id}`} className="px-2.5 py-1 rounded-full bg-white border border-rose-200 text-[11px] font-extrabold text-rose-700 active:scale-95">
                      {L('Sambung', 'Resume', 'Lanjutkan', 'استئناف')}
                    </button>
                  </div>
                )
              }
              return (
                <div className="mt-2 relative">
                  <button onClick={() => setPauseMenu(pauseMenu === c.id ? null : c.id)} data-testid={`tasks-solat-pause-${c.id}`}
                    className="text-[11px] font-bold text-eq-ink/50 px-2 py-1 rounded-full hover:bg-eq-cream/60">
                    ⏸ {L('Jeda Solat Teras', 'Pause core prayers', 'Jeda sholat inti', 'إيقاف الصلاة مؤقتاً')}
                  </button>
                  {pauseMenu === c.id && (
                    <div className="mt-1 rounded-2xl border border-gray-100 bg-white shadow-lg p-2 space-y-1" data-testid={`tasks-solat-menu-${c.id}`}>
                      {m.canCutiSolat && (
                        <button onClick={() => call('solat-pause', { reason: 'haid', days: 7 })} data-testid={`tasks-solat-haid-${c.id}`} className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-rose-50 text-[12px] font-bold text-eq-ink">
                          🌸 {L('Cuti Solat (haid) · 7 hari', 'Prayer break (period) · 7 days', 'Cuti sholat (haid) · 7 hari', 'إجازة الصلاة (حيض) · ٧ أيام')}
                        </button>
                      )}
                      <button onClick={() => call('solat-pause', { reason: 'sakit', days: 1 })} data-testid={`tasks-solat-sick-${c.id}`} className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-amber-50 text-[12px] font-bold text-eq-ink">
                        🤒 {L('Sakit teruk / di hospital · 1 hari', 'Seriously ill / in hospital · 1 day', 'Sakit parah / di rumah sakit · 1 hari', 'مرض شديد / في المستشفى · يوم')}
                      </button>
                      <p className="px-2.5 pb-1 text-[10px] text-eq-ink/50 leading-snug">{L('Solat tetap wajib ketika musafir (jamak/qasar) dan sakit biasa (boleh duduk).', 'Prayer is still required when travelling (combine/shorten) and with mild illness (may sit).', 'Sholat tetap wajib saat safar dan sakit ringan.', 'الصلاة واجبة في السفر (جمع/قصر) والمرض الخفيف.')}</p>
                    </div>
                  )}
                </div>
              )
            })()}
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
                      {(h.recurring === 'perPrayer' || h.recurring === 'multi') && (
                        <div className="text-[10px] text-eq-ink/45">{(h.sessionsClaimed?.length || 0)}/{h.recurring === 'multi' ? (h.sessions?.length || 0) : 5} {h.recurring === 'multi' ? L('kali', 'times', 'kali', 'مرات') : L('waktu solat', 'prayers', 'waktu sholat', 'صلوات')}</div>
                      )}
                    </div>
                    {Number(h.points) > 0 && <span className="text-[10px] font-black text-amber-600">+{h.points}</span>}
                    <button onClick={() => toggleTrust(c.id, h)} data-testid={`tasks-trust-${h.id}`}
                      title={L('Mod Percaya: sah automatik', 'Trust Mode: auto-verify', 'Mode Percaya', 'وضع الثقة')}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black border ${h.autoVerify ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-eq-ink/35 border-eq-cream'}`}>
                      🛡️{h.autoVerify ? ' Auto' : ` ${h.trustStreak || 0}/7`}
                    </button>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${chip.cls}`}>
                      <ChipIcon className="w-3 h-3" /> {chip.label}
                    </span>
                  </div>
                )
              })}
              {(lockedByChild[c.id] || []).length > 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-3 py-2" data-testid={`tasks-locked-${c.id}`}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-eq-ink/45">
                    🔒 {L('Dibuka minggu depan', 'Unlocks next week', 'Dibuka minggu depan', 'يُفتح الأسبوع القادم')}
                    {' · '}{(() => { const d = Math.max(0, Math.ceil((new Date(lockedByChild[c.id][0].unlockAt).getTime() - Date.now()) / 86400000)); return L(`${d} hari lagi`, `in ${d} days`, `${d} hari lagi`, `بعد ${d} أيام`) })()}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {lockedByChild[c.id].map(h => (
                      <span key={h.id} className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-bold text-eq-ink/55">{habitTitle(h, lang)}</span>
                    ))}
                  </div>
                  <button onClick={() => unlockNow(c.id)} disabled={unlocking === c.id} data-testid={`tasks-unlock-now-${c.id}`}
                    className="mt-2 w-full rounded-xl bg-emerald-500 text-white text-[12px] font-extrabold py-2 active:scale-[0.99] disabled:opacity-50">
                    🔓 {unlocking === c.id ? '…' : L('Mulakan semua hari ini', 'Start all of them today', 'Mulai semua hari ini', 'ابدأ الكل اليوم')}
                  </button>
                </div>
              )}
              {(metaByChild[c.id]?.offToday || []).length > 0 && (
                <div className="rounded-xl bg-white/60 px-3 py-2" data-testid={`tasks-offtoday-${c.id}`}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-eq-ink/45">
                    🌙 {L('Rehat hari ini (ikut jadual hari)', 'Not scheduled today', 'Libur hari ini (sesuai jadwal)', 'غير مجدولة اليوم')}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {metaByChild[c.id].offToday.map(h => (
                      <span key={h.id} className="px-2 py-0.5 rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700/70">{habitTitle(h, lang)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
