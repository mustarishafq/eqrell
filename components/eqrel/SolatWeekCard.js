'use client'

import { pick } from '@/components/eqrel/tabs/tabUtils'

const PRAYER_NAMES = {
  'ib-01': { ms: 'Subuh', en: 'Fajr', id: 'Subuh', ar: 'الفجر' },
  'ib-02': { ms: 'Zohor', en: 'Dhuhr', id: 'Zuhur', ar: 'الظهر' },
  'ib-03': { ms: 'Asar', en: 'Asr', id: 'Asar', ar: 'العصر' },
  'ib-04': { ms: 'Maghrib', en: 'Maghrib', id: 'Magrib', ar: 'المغرب' },
  'ib-05': { ms: 'Isyak', en: 'Isha', id: 'Isya', ar: 'العشاء' },
}
const DAY = { ms: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], ar: ['أح', 'اث', 'ثل', 'أر', 'خم', 'جم', 'سب'] }

const CELL = {
  done: { cls: 'bg-emerald-500 text-white', ch: '✓' },
  ihsan: { cls: 'bg-amber-400 text-white', ch: '★' },
  pending: { cls: 'bg-amber-50 text-amber-600 border border-amber-300', ch: '◐' },
  missed: { cls: 'bg-rose-50 text-rose-400 border border-rose-200', ch: '✕' },
  paused: { cls: 'bg-rose-50 text-rose-300', ch: '·' },
  none: { cls: 'bg-gray-100 text-gray-300', ch: '' },
  na: { cls: 'bg-transparent', ch: '' },
}

/** Kad Solat Mingguan — 5 prayers × 7 days grid with simple pattern insights. */
export function SolatWeekCard({ child, dates = [], lang = 'en' }) {
  const L = pick(lang)
  const s = child?.solat
  if (!s || !s.prayers?.length) return null
  const lk = ['ms', 'en', 'id', 'ar'].includes(lang) ? lang : 'en'
  const today = new Date().toISOString().slice(0, 10)
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0

  // Patterns: strongest & weakest prayer this week
  const rows = s.prayers.map((p, i) => {
    const r = s.grid[i] || []
    const valid = r.filter(x => x !== 'na' && x !== 'paused').length
    const ok = r.filter(x => x === 'done' || x === 'ihsan').length
    return { ...p, name: PRAYER_NAMES[p.templateId]?.[lk] || p.templateId, valid, ok, rate: valid ? ok / valid : 0 }
  })
  const scored = rows.filter(r => r.valid >= 2)
  const best = scored.length ? scored.reduce((a, b) => (b.rate > a.rate ? b : a)) : null
  const weak = scored.length > 1 ? scored.reduce((a, b) => (b.rate < a.rate ? b : a)) : null
  const TIPS = {
    'ib-01': L('Tip: tidur lebih awal & kejutkan dengan pelukan dan senyuman.', 'Tip: earlier bedtime, and wake them with a hug and a smile.', 'Tip: tidur lebih awal & bangunkan dengan pelukan.', 'نصيحة: نوم مبكر وإيقاظ بحضن وابتسامة.'),
    'ib-02': L('Tip: waktu sekolah — ingatkan solat di sekolah atau sebaik pulang.', 'Tip: school hours — remind them to pray at school or right after.', 'Tip: jam sekolah — ingatkan sholat di sekolah.', 'نصيحة: وقت المدرسة — ذكّره بالصلاة هناك.'),
    'ib-03': L('Tip: jadikan Asar “pintu” sebelum main atau skrin petang.', 'Tip: make Asr the “gate” before afternoon play or screens.', 'Tip: jadikan Asar “pintu” sebelum main.', 'نصيحة: اجعل العصر قبل اللعب.'),
    'ib-04': L('Tip: ajak berjemaah sekeluarga — anak ikut contoh.', 'Tip: pray it together as a family — kids follow your lead.', 'Tip: ajak berjamaah sekeluarga.', 'نصيحة: صلّوا جماعةً كأسرة.'),
    'ib-05': L('Tip: solat Isyak sebelum rutin tidur, bukan selepas penat.', 'Tip: pray Isha before the bedtime routine, not when exhausted.', 'Tip: sholat Isya sebelum rutinitas tidur.', 'نصيحة: صلِّ العشاء قبل روتين النوم.'),
  }

  return (
    <div className="mt-3 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white p-3" data-testid={`reports-solat-${child.id}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">🕌</span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{L('Solat minggu ini', 'Prayers this week', 'Sholat minggu ini', 'صلوات هذا الأسبوع')}</div>
          <div className="text-[12px] font-bold text-emerald-950">{s.done}/{s.total} · {pct}%{s.pending ? ` · ◐ ${s.pending} ${L('menunggu', 'waiting', 'menunggu', 'بانتظار')}` : ''}</div>
        </div>
        {s.pauseReason && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{s.pauseReason === 'haid' ? '🌸' : '🤒'} {L('dijeda', 'paused', 'dijeda', 'موقوفة')}</span>}
      </div>

      <div className="mt-2.5 overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: '3px' }}>
          <thead>
            <tr>
              <th />
              {dates.map(d => (
                <th key={d} className={`text-[9px] font-bold ${d === today ? 'text-emerald-700' : 'text-eq-ink/40'}`}>
                  {DAY[lk][new Date(`${d}T00:00:00Z`).getUTCDay()]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.habitId}>
                <td className="text-[10px] font-extrabold text-eq-ink/70 pr-1 whitespace-nowrap">{r.name}</td>
                {(s.grid[i] || []).map((st, j) => {
                  const c = CELL[st] || CELL.none
                  return (
                    <td key={j} className="p-0">
                      <div className={`h-6 w-full min-w-[22px] rounded-md flex items-center justify-center text-[11px] font-black ${c.cls}`} data-state={st}>{c.ch}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(best && best.ok > 0) || (weak && weak.rate < 0.6) ? (
        <div className="mt-2 space-y-1" data-testid={`reports-solat-insight-${child.id}`}>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {best && best.ok > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">💪 {L('Paling kukuh', 'Strongest', 'Paling kuat', 'الأقوى')}: {best.name} {best.ok}/{best.valid}</span>}
            {weak && weak.habitId !== best?.habitId && weak.rate < 0.6 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">🤲 {L('Perlu sokongan', 'Needs support', 'Perlu dukungan', 'يحتاج دعماً')}: {weak.name} {weak.ok}/{weak.valid}</span>}
          </div>
          {weak && weak.habitId !== best?.habitId && weak.rate < 0.6 && TIPS[weak.templateId] && <p className="text-[11px] text-eq-ink/60 leading-snug">{TIPS[weak.templateId]}</p>}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[9px] font-bold text-eq-ink/45">
        <span>✓ {L('disahkan', 'verified', 'disahkan', 'موثّق')}</span><span>★ Ihsan</span><span>◐ {L('menunggu', 'waiting', 'menunggu', 'بانتظار')}</span><span>✕ {L('belum', 'not yet', 'belum', 'ليس بعد')}</span>
      </div>
    </div>
  )
}
