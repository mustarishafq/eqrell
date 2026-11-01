'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pick } from '@/components/eqrel/tabs/tabUtils'

/**
 * Home card that changes with the time of day:
 *  03:00–11:59 → 🌅 Niat Pagi (intention + focus per child)
 *  otherwise   → 🌙 Laporan Malam / Hari ini (progress + one-tap Quick Verify)
 */
export function DigestCard({ lang = 'en', refreshKey = 0, onQuickVerify, onSettings }) {
  const L = pick(lang)
  const hour = new Date().getHours()
  const kind = hour >= 3 && hour < 12 ? 'morning' : 'night'
  const [d, setD] = useState(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/digest/${kind}?lang=${lang}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)).then(x => { if (alive) setD(x) }).catch(() => {})
    return () => { alive = false }
  }, [kind, lang, refreshKey])

  if (!d) return <div className="h-28 rounded-3xl bg-white/70 animate-pulse flex-shrink-0" />

  if (kind === 'morning') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="digest-morning"
        className="rounded-3xl p-4 shadow-eq-card flex-shrink-0 bg-gradient-to-br from-amber-50 via-white to-emerald-50 border border-amber-100">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-black uppercase tracking-wider text-amber-700">🌅 {L('Niat Pagi', 'Morning Intention', 'Niat Pagi', 'نية الصباح')}</div>
          <button onClick={onSettings} data-testid="digest-settings" className="text-[10px] font-bold text-eq-ink/50 underline">{L('Tetapkan masa', 'Set times', 'Atur waktu', 'الأوقات')}</button>
        </div>
        <p className="text-[13px] text-eq-ink font-semibold leading-snug mt-1.5">“{d.quote?.text}”</p>
        <p className="text-[10px] text-eq-ink/50 mt-0.5">{d.quote?.source}</p>
        <p className="text-[12px] text-emerald-900/80 mt-2 leading-snug">{d.niat}</p>
        {d.kids?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.kids.map(k => (
              <span key={k.id} className="px-2.5 py-1 rounded-full bg-white border border-emerald-100 text-[11px] font-bold text-emerald-800">
                {k.nickname}: {k.focus ? `🎯 ${k.focus}` : `${k.total} habit`}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    )
  }

  const t = d.totals || { done: 0, total: 0, pending: 0 }
  const pct = t.total ? Math.round((t.done / t.total) * 100) : 0
  const evening = hour >= 17 || hour < 3
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="digest-night"
      className="rounded-3xl p-4 shadow-eq-card flex-shrink-0 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 border border-indigo-100">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-black uppercase tracking-wider text-indigo-700">
          {evening ? `🌙 ${L('Laporan Malam', 'Night Report', 'Laporan Malam', 'تقرير الليل')}` : `☀️ ${L('Setakat Ini Hari Ini', 'Today So Far', 'Sejauh Ini Hari Ini', 'حتى الآن اليوم')}`}
        </div>
        <button onClick={onSettings} data-testid="digest-settings" className="text-[10px] font-bold text-eq-ink/50 underline">{L('Tetapkan masa', 'Set times', 'Atur waktu', 'الأوقات')}</button>
      </div>
      <div className="flex items-end gap-2 mt-1">
        <div className="text-3xl font-black text-eq-ink leading-none">{t.done}<span className="text-lg text-eq-ink/40">/{t.total}</span></div>
        <div className="text-[11px] font-bold text-eq-ink/55 pb-0.5">{L('habit siap', 'habits done', 'kebiasaan selesai', 'عادات منجزة')} · {pct}%</div>
      </div>
      <div className="mt-2 space-y-1">
        {d.kids?.map(k => (
          <div key={k.id} className="flex items-center gap-2 text-[12px]">
            <span className="font-bold text-eq-ink w-20 truncate">{k.nickname}</span>
            <div className="flex-1 h-1.5 rounded-full bg-indigo-100 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${k.total ? (k.done / k.total) * 100 : 0}%` }} />
            </div>
            <span className="font-black text-eq-ink/70 w-10 text-right">{k.done}/{k.total}{k.ihsan ? '⭐' : ''}</span>
          </div>
        ))}
      </div>
      {(d.duty || d.teamLine) && (
        <div className="mt-2 flex flex-wrap gap-1.5" data-testid="digest-team">
          {d.duty && (
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${d.duty.isMe ? 'bg-emerald-500 text-white' : 'bg-white border border-indigo-100 text-indigo-800'}`} data-testid="digest-duty">
              🤝 {d.duty.isMe
                ? L('Giliran anda malam ini', 'Your turn tonight', 'Giliran Anda malam ini', 'دورك الليلة')
                : L(`Giliran ${d.duty.name} malam ini — rehatlah`, `${d.duty.name}'s turn tonight — rest`, `Giliran ${d.duty.name} malam ini`, `دور ${d.duty.name} الليلة`)}
            </span>
          )}
          {d.teamLine && <span className="px-2.5 py-1 rounded-full bg-white border border-indigo-100 text-[11px] font-bold text-indigo-800">✓ {L('Disahkan', 'Verified', 'Diverifikasi', 'موثق')}: {d.teamLine}{d.autoCount ? ` · 🛡️ ${d.autoCount}` : ''}</span>}
        </div>
      )}
      {d.trustNews?.length > 0 && (
        <div className="mt-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 rounded-xl px-2.5 py-1.5" data-testid="digest-trust-news">
          🛡️ {L('Mod Percaya baru aktif', 'Trust Mode just turned on', 'Mode Percaya baru aktif', 'تم تفعيل وضع الثقة')}: {d.trustNews.map(n => n.i18n?.[lang]?.title || n.title).join(', ')}
        </div>
      )}
      {t.pending > 0 ? (
        <button onClick={onQuickVerify} data-testid="digest-quick-verify"
          className="mt-3 w-full rounded-2xl py-2.5 bg-emerald-500 text-white font-extrabold text-sm active:scale-[0.99]">
          ⚡ {L(`Sahkan ${t.pending} tugasan — 10 saat`, `Verify ${t.pending} tasks — 10 seconds`, `Verifikasi ${t.pending} tugas — 10 detik`, `تحقق من ${t.pending} مهام — ١٠ ثوانٍ`)}
        </button>
      ) : (
        <p className="mt-2 text-[11px] text-indigo-900/70 leading-snug">{d.praise}</p>
      )}
    </motion.div>
  )
}

/** Weekly "Laporan Perubahan" story card (Reports tab). */
export function WeeklyStoryCard({ lang = 'en', refreshKey = 0 }) {
  const L = pick(lang)
  const [d, setD] = useState(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/digest/weekly?lang=${lang}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)).then(x => { if (alive) setD(x) }).catch(() => {})
    return () => { alive = false }
  }, [lang, refreshKey])
  if (!d) return <div className="h-32 rounded-3xl bg-white/70 animate-pulse flex-shrink-0" />
  return (
    <div className="bg-white rounded-3xl p-4 shadow-eq-card flex-shrink-0 border border-emerald-100" data-testid="weekly-story">
      <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">📖 {L('Laporan Perubahan Minggu Ini', "This Week's Progress Story", 'Laporan Perubahan Minggu Ini', 'قصة تقدّم هذا الأسبوع')}</div>
      <div className="text-[10px] text-eq-ink/45 font-bold">{d.from} → {d.to}</div>
      <div className="mt-2.5 space-y-3">
        {(d.kids || []).map(k => (
          <div key={k.id} data-testid={`weekly-kid-${k.id}`}>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-eq-ink">{k.nickname}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${k.delta > 0 ? 'bg-emerald-100 text-emerald-700' : k.delta < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                {k.pctPrev}% → {k.pct}%
              </span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {k.lines.map((ln, i) => <li key={i} className="text-[12px] text-eq-ink/80 leading-snug">{ln}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-emerald-900/60 italic leading-snug">“{d.quote?.text}” — {d.quote?.source}</p>
    </div>
  )
}
