'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { pick, colorOf, habitTitle, TabHeader } from './tabUtils'
import { ShareProfileButton } from '@/components/eqrel/ShareProfileCard'
import { WeeklyStoryCard } from '@/components/eqrel/DigestCard'
import { STAGES, tx } from '@/lib/diagnosis'

const DAY = 86400000

const weekdayShort = (dateStr, lang) => {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', timeZone: 'UTC' })
}

export default function ReportsTab({ lang = 'ms', icon, avatarSrc, streak = {}, refreshKey = 0 }) {
  const L = pick(lang)
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setError(false)
    ;(async () => {
      try {
        const r = await fetch('/api/family/report?days=7', { credentials: 'include' })
        if (!r.ok) throw new Error('bad')
        const d = await r.json()
        if (alive) setData(d)
      } catch { if (alive) setError(true) }
    })()
    return () => { alive = false }
  }, [refreshKey, nonce])

  const kids = data?.children || []
  const fam = kids.reduce((a, c) => ({
    done: a.done + (c.totals?.done || 0),
    ihsan: a.ihsan + (c.totals?.ihsan || 0),
    points: a.points + (c.totals?.points || 0),
  }), { done: 0, ihsan: 0, points: 0 })

  const Stat = ({ value, label, tone }) => (
    <div className={`rounded-2xl px-2 py-2.5 text-center ${tone}`}>
      <div className="text-xl font-black text-eq-ink leading-none">{value}</div>
      <div className="text-[10px] font-bold text-eq-ink/60 mt-1 leading-tight">{label}</div>
    </div>
  )

  return (
    <div className="flex flex-col gap-2" data-testid="tab-reports">
      <TabHeader icon={icon}
        title={L('Laporan Mingguan', 'Weekly Report', 'Laporan Mingguan', 'التقرير الأسبوعي')}
        sub={L('Kemajuan habit 7 hari terakhir', 'Habit progress for the last 7 days', 'Kemajuan kebiasaan 7 hari terakhir', 'تقدم العادات لآخر ٧ أيام')}
        right={(
          <button onClick={() => setNonce(n => n + 1)} aria-label="refresh" data-testid="reports-refresh"
            className="w-9 h-9 rounded-full bg-eq-cream/60 flex items-center justify-center active:scale-95">
            <RefreshCw className="w-4 h-4 text-eq-ink/70" />
          </button>
        )} />

      {error && (
        <div className="bg-white rounded-3xl p-5 shadow-eq-card text-center">
          <div className="text-3xl mb-1">📡</div>
          <p className="text-sm text-eq-ink/70 mb-3">{L('Gagal memuatkan laporan.', 'Could not load the report.', 'Gagal memuat laporan.', 'تعذر تحميل التقرير.')}</p>
          <button onClick={() => setNonce(n => n + 1)} className="bg-eq-yellow text-eq-ink font-bold text-sm px-4 py-2 rounded-full active:scale-95">
            🔄 {L('Cuba Lagi', 'Try Again', 'Coba Lagi', 'حاول مرة أخرى')}
          </button>
        </div>
      )}

      {!data && !error && [0, 1].map(i => <div key={i} className="h-40 rounded-3xl bg-white/70 animate-pulse flex-shrink-0" />)}

      {data && (
        <>
          <WeeklyStoryCard lang={lang} refreshKey={refreshKey + nonce} />

          <div className="bg-white rounded-3xl p-3.5 shadow-eq-card flex-shrink-0" data-testid="reports-family-summary">
            <div className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50 mb-2">
              {L('Ringkasan Keluarga', 'Family Summary', 'Ringkasan Keluarga', 'ملخص العائلة')}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Stat value={fam.done} label={L('Habit siap', 'Habits done', 'Kebiasaan selesai', 'عادات')} tone="bg-emerald-50" />
              <Stat value={fam.ihsan} label="Ihsan ⭐" tone="bg-amber-50" />
              <Stat value={fam.points} label={L('Mata', 'Points', 'Poin', 'نقاط')} tone="bg-sky-50" />
              <Stat value={`${streak.streak || 0}🔥`} label={L('Streak hari', 'Day streak', 'Streak hari', 'أيام متتالية')} tone="bg-orange-50" />
            </div>
          </div>

          {kids.length === 0 && (
            <div className="bg-white rounded-3xl p-6 shadow-eq-card text-center text-sm text-eq-ink/60">
              {L('Belum ada anak untuk dilaporkan.', 'No children to report yet.', 'Belum ada anak untuk dilaporkan.', 'لا يوجد أطفال بعد.')}
            </div>
          )}

          {kids.map((c, ci) => {
            const color = colorOf(c)
            const max = Math.max(1, ...c.daily.map(d => d.done))
            const todayStr = data.range?.to
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.05 }}
                className="bg-white rounded-3xl p-3.5 shadow-eq-card flex-shrink-0" data-testid={`reports-child-${c.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 flex-shrink-0 bg-amber-50" style={{ borderColor: color }}>
                    <img src={avatarSrc(c)} alt={c.nickname} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-eq-ink text-base leading-tight truncate">{c.nickname}</div>
                    <div className="text-[11px] text-eq-ink/55 font-semibold">
                      {L(`Aktif ${c.totals.activeDays}/7 hari`, `Active ${c.totals.activeDays}/7 days`, `Aktif ${c.totals.activeDays}/7 hari`, `نشط ${c.totals.activeDays}/7 أيام`)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black leading-none" style={{ color }}>{c.totals.points}</div>
                    <div className="text-[10px] text-eq-ink/50 font-bold">{L('mata minggu ini', 'pts this week', 'poin minggu ini', 'نقاط')}</div>
                  </div>
                </div>

                {/* 7-day bar chart */}
                <div className="mt-3 grid grid-cols-7 gap-1.5 items-end h-28">
                  {c.daily.map(d => {
                    const h = d.done > 0 ? Math.max(10, Math.round((d.done / max) * 100)) : 4
                    const isToday = d.date === todayStr
                    return (
                      <div key={d.date} className="flex flex-col items-center justify-end h-full gap-1">
                        <div className="text-[10px] font-black text-eq-ink/70 leading-none">{d.done > 0 ? d.done : ''}</div>
                        <motion.div className="w-full rounded-t-lg rounded-b-sm relative"
                          style={{ backgroundColor: d.done > 0 ? color : '#F0EAD6', opacity: d.done > 0 ? 1 : 0.8 }}
                          initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.6 }}>
                          {d.ihsan > 0 && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px]">⭐</span>}
                        </motion.div>
                        <div className={`text-[10px] leading-none ${isToday ? 'font-black text-eq-ink' : 'font-semibold text-eq-ink/45'}`}>{weekdayShort(d.date, lang)}</div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <Stat value={c.totals.done} label={L('Habit siap', 'Habits done', 'Selesai', 'عادات')} tone="bg-emerald-50" />
                  <Stat value={c.totals.ihsan} label="Ihsan ⭐" tone="bg-amber-50" />
                  <Stat value={c.totals.claimedPending} label={L('Tunggu sah', 'To verify', 'Tunggu', 'بانتظار')} tone="bg-sky-50" />
                </div>

                {c.topHabits?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50 mb-1.5">
                      {L('Habit paling konsisten', 'Most consistent habits', 'Kebiasaan paling konsisten', 'أكثر العادات ثباتاً')}
                    </div>
                    <div className="flex flex-col gap-1">
                      {c.topHabits.map((h, i) => (
                        <div key={h.id} className="flex items-center gap-2 text-[13px]">
                          <span className="w-5 text-center font-black text-eq-ink/40">{i + 1}</span>
                          <span>{h.icon}</span>
                          <span className="flex-1 truncate font-bold text-eq-ink">{habitTitle(h, lang)}</span>
                          <span className="text-[11px] font-black" style={{ color }}>{h.count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* ── Profil Iman (diagnosis) + monthly re-diagnosis ── */}
                {(() => {
                  const dg = c.diagnosis
                  if (!dg) {
                    return (
                      <a href={`/diagnosis?childId=${c.id}`} data-testid={`reports-diag-cta-${c.id}`}
                        className="mt-3 flex items-center gap-2.5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 px-3 py-2.5 active:scale-[0.99]">
                        <span className="text-2xl">🩺</span>
                        <span className="flex-1 text-[12px] font-bold text-emerald-900 leading-snug">
                          {L(`Buat Diagnosis Iman & Habit untuk ${c.nickname} — dapatkan pelan habit khas`, `Run the Iman & Habit Diagnosis for ${c.nickname} — get a personal plan`, `Lakukan Diagnosis Iman & Kebiasaan untuk ${c.nickname}`, `قم بتشخيص الإيمان والعادات لـ ${c.nickname}`)}
                        </span>
                        <span className="text-emerald-600 font-black">→</span>
                      </a>
                    )
                  }
                  const st = STAGES.find(s => s.id === dg.stage) || STAGES[0]
                  const prev = c.previousDiagnosis
                  const delta = prev ? (dg.overall || 0) - (prev.overall || 0) : null
                  const ageDays = dg.createdAt ? Math.floor((Date.now() - new Date(dg.createdAt).getTime()) / DAY) : 0
                  const due = ageDays >= 30
                  const when = dg.createdAt ? new Date(dg.createdAt).toLocaleDateString(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : lang === 'id' ? 'id-ID' : 'ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
                  return (
                    <div className="mt-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 p-3" data-testid={`reports-diag-${c.id}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-3xl leading-none">{st.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{L('Profil Iman & Habit', 'Iman & Habit Profile', 'Profil Iman & Kebiasaan', 'ملف الإيمان والعادات')}</div>
                          <div className="font-extrabold text-sm text-emerald-950">{tx(st, lang)} · {dg.overall}/100</div>
                          <div className="text-[10px] text-emerald-900/55">{L('Diagnosis', 'Diagnosed', 'Diagnosis', 'التشخيص')}: {when}</div>
                        </div>
                        {delta !== null && (
                          <span className={`text-[11px] font-black px-2 py-1 rounded-full ${delta > 0 ? 'bg-emerald-100 text-emerald-700' : delta < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}
                            title={L('berbanding diagnosis lepas', 'vs previous diagnosis', 'dibanding diagnosis sebelumnya', 'مقارنة بالتشخيص السابق')}>
                            {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '='}
                          </span>
                        )}
                      </div>
                      {due && (
                        <div className="mt-2 rounded-xl bg-amber-100/80 px-2.5 py-1.5 text-[11px] font-bold text-amber-800" data-testid={`reports-diag-due-${c.id}`}>
                          🗓️ {L(`Sudah ${ageDays} hari! Masa untuk diagnosis semula bulanan & lihat kemajuan ${c.nickname}.`, `It's been ${ageDays} days! Time for the monthly re-diagnosis to see ${c.nickname}'s progress.`, `Sudah ${ageDays} hari! Saatnya diagnosis ulang bulanan.`, `مرّ ${ageDays} يوماً! حان وقت التشخيص الشهري.`)}
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <a href={`/diagnosis?childId=${c.id}`} data-testid={`reports-rediag-${c.id}`}
                          className={`flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-extrabold active:scale-[0.98] ${due ? 'bg-amber-500 text-white' : 'bg-white text-emerald-800 border border-emerald-200'}`}>
                          🩺 {L('Diagnosis Semula', 'Re-diagnose', 'Diagnosis Ulang', 'أعد التشخيص')}
                        </a>
                        <ShareProfileButton lang={lang} testId={`reports-share-${c.id}`}
                          child={{ nickname: c.nickname, avatarId: c.avatarId, age: dg.age }} diagnosis={dg} previous={prev}
                          label={L('Kongsi', 'Share', 'Bagikan', 'شارك')}
                          className="flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-extrabold bg-[#25D366] text-white active:scale-[0.98]" />
                      </div>
                    </div>
                  )
                })()}

                {c.totals.done === 0 && (
                  <p className="mt-3 text-center text-[11px] text-eq-ink/50">
                    {L('Belum ada habit disahkan minggu ini. Sahkan tugasan anak untuk lihat kemajuan di sini.', 'No verified habits this week yet. Verify tasks to see progress here.', 'Belum ada kebiasaan diverifikasi minggu ini.', 'لا توجد عادات موثقة هذا الأسبوع.')}
                  </p>
                )}
              </motion.div>
            )
          })}
        </>
      )}
    </div>
  )
}
