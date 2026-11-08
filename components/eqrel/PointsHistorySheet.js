'use client'

// Parent view: a simple history of each child's points — earned (habits, quiz) and
// spent (World buildings, rewards) — for Build points ⭐ and Reward points 🎁.
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'

const CI = { green: '#00B894', yellow: '#FFB703', coral: '#FF5D6E', blue: '#2D9CDB', ink: '#0F2E25', cream: '#FFF8E7' }
const pick = (lang) => (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)
const txt = (v, lang) => (v && typeof v === 'object' ? (v[lang] || v.en || v.ms || Object.values(v)[0] || '') : String(v || ''))
const LOCALE = { ms: 'ms-MY', en: 'en-GB', id: 'id-ID', ar: 'ar' }

export default function PointsHistorySheet({ open, onClose, lang = 'en', child }) {
  const L = pick(lang)
  const [days, setDays] = useState(30)
  const [filter, setFilter] = useState('all')   // all | earned | spent
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!child?.id) return
    setData(null); setError(false)
    try {
      const r = await fetch(`/api/children/${child.id}/points-history?days=${days}`, { credentials: 'include', cache: 'no-store' })
      if (!r.ok) throw new Error()
      setData(await r.json())
    } catch { setError(true) }
  }, [child?.id, days])
  useEffect(() => { if (open) load() }, [open, load])
  useEffect(() => { if (open) setFilter('all') }, [open])

  const items = (data?.items || []).filter(i => filter === 'all' ? true : filter === 'earned' ? (i.build > 0 || i.reward > 0) : (i.build < 0 || i.reward < 0))
  // group by local day
  const groups = []
  for (const it of items) {
    const d = new Date(it.at)
    const key = d.toDateString()
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) { g = { key, date: d, items: [] }; groups.push(g) }
    g.items.push(it)
  }
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const dayLabel = (g) => g.key === today ? L('Hari ini', 'Today', 'Hari ini', 'اليوم')
    : g.key === yesterday ? L('Semalam', 'Yesterday', 'Kemarin', 'أمس')
      : g.date.toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const typeLabel = (it) => ({
    habit: it.auto ? L('Habit · disahkan Mod Percaya', 'Habit · verified by Trust Mode', 'Kebiasaan · Mode Percaya', 'عادة · وضع الثقة')
      : it.rubric === 'ihsan' ? L('Habit · Ihsan ✨', 'Habit · Ihsan ✨', 'Kebiasaan · Ihsan ✨', 'عادة · إحسان ✨') : L('Habit disahkan', 'Habit verified', 'Kebiasaan diverifikasi', 'عادة مؤكدة'),
    quiz: L('Kuiz', 'Quiz', 'Kuis', 'اختبار'),
    build: L('Dibina di World', 'Built in the World', 'Dibangun di World', 'بُني في العالم'),
    reward: L('Ganjaran ditebus', 'Reward redeemed', 'Hadiah ditukar', 'مكافأة مستبدلة'),
  }[it.type])
  const chip = (n, kind) => {
    if (!n) return null
    const pos = n > 0
    const bg = pos ? (kind === 'build' ? `${CI.green}1F` : `${CI.yellow}33`) : `${CI.coral}1F`
    const fg = pos ? (kind === 'build' ? CI.green : '#B07800') : CI.coral
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums whitespace-nowrap" style={{ backgroundColor: bg, color: fg }}>{pos ? '+' : '−'}{Math.abs(n)} {kind === 'build' ? '⭐' : '🎁'}</span>
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="points-history-sheet">
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col overflow-hidden" style={{ backgroundColor: CI.cream }}>
            <div className="p-4 pb-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-extrabold text-lg leading-tight truncate" style={{ color: CI.ink }}>{L('Sejarah Mata', 'Points History', 'Riwayat Poin', 'سجل النقاط')} · {child?.nickname}</h2>
                  <p className="text-[11px]" style={{ color: `${CI.ink}99` }}>{L('Mata yang diperoleh dan digunakan', 'Points earned and spent', 'Poin yang didapat dan dipakai', 'النقاط المكتسبة والمستخدمة')}</p>
                </div>
                <button onClick={onClose} aria-label="close" data-testid="points-history-close" className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl p-3" style={{ backgroundColor: CI.ink, border: `2px solid ${CI.green}` }} data-testid="points-history-build-balance">
                  <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: `${CI.cream}AA` }}>⭐ {L('Mata Bina', 'Build points', 'Poin Bangun', 'نقاط البناء')}</div>
                  <div className="text-2xl font-black tabular-nums" style={{ color: CI.yellow }}>{data ? data.balances.build : '–'}</div>
                  <div className="text-[10px]" style={{ color: `${CI.cream}88` }}>{data ? `+${data.summary.buildEarned} / −${data.summary.buildSpent} · ${days}${L('h', 'd', 'h', 'ي')}` : ''}</div>
                </div>
                <div className="rounded-2xl p-3 bg-white" style={{ border: `2px solid ${CI.yellow}` }} data-testid="points-history-reward-balance">
                  <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: `${CI.ink}88` }}>🎁 {L('Mata Ganjaran', 'Reward points', 'Poin Hadiah', 'نقاط المكافأة')}</div>
                  <div className="text-2xl font-black tabular-nums" style={{ color: CI.ink }}>{data ? data.balances.reward : '–'}</div>
                  <div className="text-[10px]" style={{ color: `${CI.ink}77` }}>{data ? `+${data.summary.rewardEarned} / −${data.summary.rewardSpent} · ${days}${L('h', 'd', 'h', 'ي')}` : ''}</div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5">
                {[['all', L('Semua', 'All', 'Semua', 'الكل')], ['earned', L('Diperoleh', 'Earned', 'Didapat', 'مكتسبة')], ['spent', L('Digunakan', 'Spent', 'Dipakai', 'مستخدمة')]].map(([k, label]) => (
                  <button key={k} onClick={() => setFilter(k)} data-testid={`points-history-filter-${k}`}
                    className="rounded-full px-3 py-1.5 text-[11px] font-extrabold" style={filter === k ? { backgroundColor: CI.green, color: '#fff' } : { backgroundColor: '#fff', color: CI.ink }}>{label}</button>
                ))}
                <div className="flex-1" />
                {[7, 30, 90].map(d => (
                  <button key={d} onClick={() => setDays(d)} data-testid={`points-history-days-${d}`}
                    className="rounded-full px-2.5 py-1.5 text-[11px] font-extrabold tabular-nums" style={days === d ? { backgroundColor: CI.ink, color: CI.cream } : { backgroundColor: '#fff', color: CI.ink }}>{d}{L('h', 'd', 'h', 'ي')}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }} data-testid="points-history-list">
              {!data && !error && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: CI.green }} /></div>}
              {error && <div className="py-8 text-center text-sm font-bold" style={{ color: CI.coral }}>{L('Gagal dimuatkan. Cuba lagi.', 'Could not load. Please try again.', 'Gagal memuat.', 'تعذر التحميل.')}</div>}
              {data && !groups.length && (
                <div className="py-10 text-center" data-testid="points-history-empty">
                  <div className="text-4xl">🌱</div>
                  <div className="text-sm font-bold mt-2" style={{ color: `${CI.ink}AA` }}>{L('Belum ada mata dalam tempoh ini.', 'No points in this period yet.', 'Belum ada poin di periode ini.', 'لا توجد نقاط بعد.')}</div>
                  <div className="text-[11px] mt-1" style={{ color: `${CI.ink}77` }}>{L('Mata muncul selepas anda sahkan habit anak.', "Points appear after you verify your child's habits.", 'Poin muncul setelah Anda memverifikasi kebiasaan anak.', 'تظهر النقاط بعد تأكيد عادات طفلك.')}</div>
                </div>
              )}
              {groups.map(g => {
                const dayBuild = g.items.reduce((a, i) => a + i.build, 0)
                return (
                  <div key={g.key}>
                    <div className="flex items-center justify-between px-1 mb-1.5">
                      <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: `${CI.ink}88` }}>{dayLabel(g)}</div>
                      <div className="text-[11px] font-black tabular-nums" style={{ color: dayBuild >= 0 ? CI.green : CI.coral }}>{dayBuild >= 0 ? '+' : '−'}{Math.abs(dayBuild)} ⭐</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-eq-card divide-y" style={{ borderColor: `${CI.ink}0F` }}>
                      {g.items.map((it, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5" data-testid={`points-history-item-${it.type}`}>
                          <span className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: CI.cream }}>{txt(it.icon, lang) || '•'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-extrabold truncate" style={{ color: CI.ink }}>{txt(it.title, lang)}</div>
                            <div className="text-[10.5px]" style={{ color: `${CI.ink}88` }}>{typeLabel(it)} · {new Date(it.at).toLocaleTimeString(LOCALE[lang] || 'en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">{chip(it.build, 'build')}{chip(it.reward, 'reward')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {data?.resetAt && (
                <div className="text-center text-[10.5px] pt-1" style={{ color: `${CI.ink}66` }}>
                  {L('Kiraan mata bermula semula pada', 'Points counting restarted on', 'Penghitungan poin dimulai ulang pada', 'أُعيد بدء احتساب النقاط في')} {new Date(data.resetAt).toLocaleDateString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
