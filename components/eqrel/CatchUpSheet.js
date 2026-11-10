'use client'
// CatchUpSheet — tick habits from earlier days ("did it last night, forgot to tick").
//  • Kid: yesterday only (until midday) → waits for a parent like any claim.
//  • Parent: up to 7 days back → grade directly (Ihsan / Sah / Not yet).
// Claims are saved on the real day, so streaks & reports update for that day.
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Clock, RotateCcw, Sparkles } from 'lucide-react'
import { getHabitTitle, HABIT_CATEGORIES } from '@/lib/habitTemplates'
import { sessionsOfHabit, SESSION_BY_ID, getSessionLabel } from '@/lib/prayerSession'

const L = (lang, ms, en, id, ar) => (lang === 'ms' ? ms : lang === 'id' ? id : lang === 'ar' ? ar : en)
const dayLabel = (d, lang) => {
  if (d.daysAgo === 1) return L(lang, 'Semalam', 'Yesterday', 'Kemarin', 'أمس')
  try {
    return new Date(`${d.dateStr}T12:00:00Z`).toLocaleDateString(lang === 'ms' ? 'ms-MY' : lang === 'id' ? 'id-ID' : lang === 'ar' ? 'ar' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  } catch { return d.dateStr }
}

/** Fetch the catch-up summary (used for the entry button badge). */
export function useCatchUp(childId, refreshKey = 0) {
  const [days, setDays] = useState([])
  const [until, setUntil] = useState(null)
  useEffect(() => {
    if (!childId) return
    let off = false
    fetch(`/api/children/${childId}/catchup`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { days: [] })).then(d => { if (!off) { setDays(d.days || []); setUntil(d.kidUntil || null) } }).catch(() => {})
    return () => { off = true }
  }, [childId, refreshKey])
  days.kidUntil = until
  return days
}

export default function CatchUpSheet({ open, onClose, child, lang = 'en', mode = 'parent', onChanged }) {
  const [days, setDays] = useState(null)
  const [until, setUntil] = useState(null)
  const [date, setDate] = useState(null)
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const loadDays = useCallback(async () => {
    if (!child?.id) return
    const r = await fetch(`/api/children/${child.id}/catchup`, { credentials: 'include' }).catch(() => null)
    const d = r?.ok ? await r.json() : { days: [] }
    setDays(d.days || [])
    setUntil(d.kidUntil || null)
    setDate(prev => (prev && (d.days || []).some(x => x.dateStr === prev)) ? prev : (d.days?.[0]?.dateStr || null))
  }, [child?.id])

  const loadRows = useCallback(async () => {
    if (!child?.id || !date) { setRows([]); return }
    const r = await fetch(`/api/children/${child.id}/habits?date=${date}`, { credentials: 'include' }).catch(() => null)
    const d = r?.ok ? await r.json() : { habits: [] }
    const list = []
    for (const h of (d.habits || []).filter(h => !h.locked)) {
      const slots = sessionsOfHabit(h)
      if (slots.length) slots.forEach(sid => {
        const c = h.perPrayerClaims?.[sid]
        list.push({ key: `${h.id}:${sid}`, habit: h, session: sid, status: c?.status || 'pending', rubric: c?.rubric || null })
      })
      else list.push({ key: h.id, habit: h, session: null, status: h.todayStatus || 'pending', rubric: h.rubric || null })
    }
    setRows(list)
  }, [child?.id, date])

  useEffect(() => { if (open) { setMsg(''); loadDays() } }, [open, loadDays])
  useEffect(() => { if (open) loadRows() }, [open, loadRows])

  const act = async (row, kind) => {
    setBusy(row.key + kind); setMsg('')
    try {
      let res
      if (kind === 'undo') {
        const qs = new URLSearchParams({ dateStr: date, ...(row.session ? { session: row.session } : {}) })
        res = await fetch(`/api/habits/${row.habit.id}/claim?${qs}`, { method: 'DELETE', credentials: 'include' })
      } else {
        res = await fetch(`/api/habits/${row.habit.id}/claim`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateStr: date, ...(row.session ? { session: row.session } : {}), ...(kind === 'claim' ? {} : { rubric: kind }) }),
        })
      }
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d?.error || 'Error'); return }
      await Promise.all([loadRows(), loadDays()])
      onChanged?.()
    } finally { setBusy(null) }
  }

  if (!open || !mounted) return null
  const cur = (days || []).find(d => d.dateStr === date)

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center" data-testid="catchup-sheet">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[90dvh]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2 border-b border-indigo-50">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600">🌙 {L(lang, 'Kemas kini hari sebelum', 'Update earlier days', 'Perbarui hari sebelumnya', 'تحديث الأيام السابقة')}</div>
            <div className="font-extrabold text-eq-ink leading-tight">
              {mode === 'kid'
                ? L(lang, 'Dah buat semalam tapi lupa tanda?', 'Did it yesterday but forgot to tick?', 'Sudah dilakukan kemarin tapi lupa centang?', 'فعلتها أمس ونسيت؟')
                : L(lang, `Habit ${child?.nickname} hari sebelum`, `${child?.nickname}'s earlier days`, `Hari sebelumnya ${child?.nickname}`, `أيام ${child?.nickname} السابقة`)}
            </div>
            <div className="text-[10px] text-eq-ink/50 mt-0.5">
              {mode === 'kid'
                ? L(lang, `Boleh tanda semalam sehingga Maghrib${until ? ` (${until})` : ''}. Ibu/Ayah akan sahkan.`, `You can tick yesterday until Maghrib${until ? ` (${until})` : ''}. A parent will check it.`, `Bisa centang kemarin sampai Maghrib${until ? ` (${until})` : ''}.`, `يمكنك حتى المغرب${until ? ` (${until})` : ''}.`)
                : L(lang, 'Sehingga 7 hari ke belakang. Mata, rantaian & laporan dikira untuk hari sebenar.', 'Up to 7 days back. Points, streaks & reports count for the real day.', 'Hingga 7 hari ke belakang.', 'حتى ٧ أيام للخلف.')}
            </div>
          </div>
          <button onClick={onClose} aria-label="close" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {(days || []).length > 1 && (
          <div className="px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar" data-testid="catchup-days">
            {days.map(d => (
              <button key={d.dateStr} onClick={() => setDate(d.dateStr)} data-testid={`catchup-day-${d.dateStr}`}
                className={`flex-shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-black border-2 ${d.dateStr === date ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-transparent bg-gray-50 text-eq-ink/60'}`}>
                {dayLabel(d, lang)}
                <span className={`ml-1 ${d.missed ? 'text-amber-600' : 'text-emerald-600'}`}>{d.missed ? `· ${d.missed}` : '✓'}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {days && days.length === 0 && (
            <div className="text-center py-10 text-[13px] text-eq-ink/50" data-testid="catchup-empty">
              {mode === 'kid' ? L(lang, 'Tiada apa untuk dikemas kini sekarang 🌟', 'Nothing to update right now 🌟', 'Tidak ada yang perlu diperbarui 🌟', 'لا شيء للتحديث 🌟') : L(lang, 'Tiada habit hari sebelum.', 'No habits on earlier days.', 'Tidak ada kebiasaan.', 'لا عادات.')}
            </div>
          )}
          {cur && (
            <div className="text-[11px] font-bold text-eq-ink/60 px-1">
              {dayLabel(cur, lang)} · {cur.done}/{cur.total} ✓{cur.pending ? ` · ${cur.pending} ⏳` : ''}
            </div>
          )}
          {rows === null && date && <div className="text-center py-8 text-eq-ink/40 text-sm">…</div>}
          {(rows || []).map(row => {
            const h = row.habit
            const icon = h.icon || HABIT_CATEGORIES[h.category]?.icon || '⭐'
            const sess = row.session ? SESSION_BY_ID[row.session] : null
            const done = row.status === 'verified'
            const waiting = row.status === 'claimed'
            return (
              <div key={row.key} data-testid={`catchup-row-${row.key}`}
                className={`flex items-center gap-2 rounded-2xl px-2.5 py-2 border ${done ? 'bg-emerald-50 border-emerald-100' : waiting ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}>
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-eq-ink truncate">{getHabitTitle(h, lang)}</div>
                  <div className="text-[10px] text-eq-ink/50 truncate">
                    {sess && <>{sess.icon} {getSessionLabel(row.session, lang)} · </>}+{h.points || 0}
                    {done && <> · ✅ {row.rubric === 'ihsan' ? 'Ihsan' : L(lang, 'Sah', 'Done', 'Sah', 'تم')}</>}
                    {waiting && <> · ⏳ {L(lang, 'Menunggu Ibu/Ayah', 'Waiting for parent', 'Menunggu orang tua', 'بانتظار الوالدين')}</>}
                  </div>
                </div>
                {mode === 'kid' ? (
                  done ? <Check className="w-5 h-5 text-emerald-600" /> : waiting ? (
                    <button onClick={() => act(row, 'undo')} disabled={!!busy} data-testid={`catchup-undo-${row.key}`}
                      className="w-9 h-9 rounded-full bg-white border border-amber-200 flex items-center justify-center active:scale-90"><RotateCcw className="w-4 h-4 text-amber-700" /></button>
                  ) : (
                    <button onClick={() => act(row, 'claim')} disabled={!!busy} data-testid={`catchup-claim-${row.key}`}
                      className="rounded-full bg-emerald-500 text-white text-[12px] font-black px-3 py-2 active:scale-95 disabled:opacity-50">
                      {busy === row.key + 'claim' ? '…' : L(lang, 'Dah buat ✓', 'I did it ✓', 'Sudah ✓', 'فعلتها ✓')}
                    </button>
                  )
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(done || waiting) && (
                      <button onClick={() => act(row, 'belum')} disabled={!!busy} aria-label="not yet" data-testid={`catchup-belum-${row.key}`}
                        className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center active:scale-90"><RotateCcw className="w-3.5 h-3.5 text-gray-500" /></button>
                    )}
                    <button onClick={() => act(row, 'ihsan')} disabled={!!busy} aria-label="ihsan" data-testid={`catchup-ihsan-${row.key}`}
                      className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 ${row.rubric === 'ihsan' ? 'bg-amber-400 text-white' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}><Sparkles className="w-3.5 h-3.5" /></button>
                    <button onClick={() => act(row, 'sah')} disabled={!!busy} aria-label="sah" data-testid={`catchup-sah-${row.key}`}
                      className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 ${done && row.rubric !== 'ihsan' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}><Check className="w-4 h-4" strokeWidth={3} /></button>
                  </div>
                )}
              </div>
            )
          })}
          {msg && <div className="text-[11px] text-red-500 font-bold px-1" data-testid="catchup-error">{msg}</div>}
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Entry button: shows only when an earlier day still has unticked habits. */
export function CatchUpButton({ days = [], lang = 'en', mode = 'parent', onClick, compact = false }) {
  const missed = days.reduce((n, d) => n + (d.missed || 0), 0)
  if (mode === 'kid' && missed === 0) return null
  if (mode !== 'kid' && days.length === 0) return null
  if (compact) {
    return (
      <button onClick={onClick} data-testid="catchup-open"
        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-black px-2.5 py-1 active:scale-95">
        <Clock className="w-3 h-3" /> {L(lang, 'Hari sebelum', 'Earlier days', 'Hari sebelumnya', 'أيام سابقة')}{missed ? ` · ${missed}` : ''}
      </button>
    )
  }
  return (
    <button onClick={onClick} data-testid="catchup-open"
      className="mt-4 w-full rounded-3xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-4 py-3 flex items-center gap-3 shadow-md active:scale-[0.99]">
      <span className="text-2xl">🌙</span>
      <div className="flex-1 text-left">
        <div className="text-[13px] font-black leading-tight">{L(lang, 'Lupa tanda semalam?', 'Forgot to tick yesterday?', 'Lupa centang kemarin?', 'نسيت التحديد أمس؟')}</div>
        <div className="text-[11px] opacity-85">{L(lang, `${missed} habit belum ditanda · sebelum Maghrib${days.kidUntil ? ` (${days.kidUntil})` : ''}`, `${missed} not ticked · update before Maghrib${days.kidUntil ? ` (${days.kidUntil})` : ''}`, `${missed} belum dicentang · sebelum Maghrib`, `${missed} غير محددة · قبل المغرب`)}</div>
      </div>
      <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black">{L(lang, 'Kemas kini', 'Update', 'Perbarui', 'تحديث')}</span>
    </button>
  )
}

/** Self-loading compact chip for a child card (parent side). */
export function CatchUpChip({ childId, lang = 'en', onOpen, refreshKey = 0 }) {
  const days = useCatchUp(childId, refreshKey)
  return <CatchUpButton days={days} lang={lang} mode="parent" compact onClick={onOpen} />
}
