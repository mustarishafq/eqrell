'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2 } from 'lucide-react'
import { pick } from '@/components/eqrel/tabs/tabUtils'

const DAY_NAMES = {
  ms: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  ar: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
}
const first = (n) => String(n || '').trim().split(/\s+/)[0] || '—'
const COLORS = ['#00B894', '#2D9CDB', '#FF8A00', '#9C7BD9']

/** Kongsi Pasangan — invite spouse + share verification duty by weekday. */
export function CoParentSheet({ open, onClose, lang = 'en' }) {
  const L = pick(lang)
  const [data, setData] = useState(null)
  const [rota, setRota] = useState({ mode: 'both', days: {} })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setSaved(false)
    fetch('/api/family/parents', { credentials: 'include' }).then(r => r.json()).then(d => {
      setData(d); setRota({ mode: d.rota?.mode || 'both', days: d.rota?.days || {} })
    }).catch(() => setData({ parents: [] }))
  }, [open])

  const parents = data?.parents || []
  const colorOf = (uid) => COLORS[Math.max(0, parents.findIndex(p => p.id === uid)) % COLORS.length]
  const save = async (next) => {
    setRota(next); setSaving(true); setSaved(false)
    try {
      await fetch('/api/family/rota', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
      setSaved(true)
    } finally { setSaving(false) }
  }
  const setMode = (mode) => {
    if (mode === 'weekday' && parents.length >= 2 && Object.keys(rota.days || {}).length === 0) {
      // sensible default: alternate days between the first two parents
      const days = {}; for (let d = 0; d < 7; d++) days[String(d)] = parents[d % 2].id
      return save({ mode, days })
    }
    save({ ...rota, mode })
  }
  const cycleDay = (d) => {
    const cur = rota.days?.[String(d)]
    const idx = parents.findIndex(p => p.id === cur)
    const nextP = parents[(idx + 1) % parents.length]
    save({ ...rota, days: { ...rota.days, [String(d)]: nextP?.id } })
  }
  const invite = async () => {
    const url = typeof window !== 'undefined' ? window.location.origin : ''
    const text = L(
      `Assalamualaikum! Jom sama-sama didik anak kita dengan EQrel 🌱 Daftar di ${url} dan masukkan kod keluarga: ${data?.code}`,
      `Assalamualaikum! Let's raise our kids together with EQrel 🌱 Sign up at ${url} and enter family code: ${data?.code}`,
      `Assalamualaikum! Ayo bersama mendidik anak dengan EQrel 🌱 Daftar di ${url} dan masukkan kode keluarga: ${data?.code}`,
      `السلام عليكم! لنربِّ أطفالنا معاً مع EQrel 🌱 سجّل في ${url} وأدخل رمز العائلة: ${data?.code}`)
    try { if (navigator.share) { await navigator.share({ text }); return } } catch (e) { if (e?.name === 'AbortError') return }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="coparent-sheet">
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
            className="w-full sm:max-w-md bg-eq-warm rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto p-4 space-y-2.5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl">🤝</div>
              <div className="flex-1">
                <h2 className="font-extrabold text-lg text-eq-ink leading-tight">{L('Kongsi Pasangan', 'Co-Parenting', 'Berbagi Pasangan', 'التربية المشتركة')}</h2>
                <p className="text-[11px] text-eq-ink/60">{L('Didik bersama, ringan bersama. Bergilir sahkan tugasan anak.', 'Raise together, lighter together. Take turns verifying.', 'Mendidik bersama, lebih ringan. Bergiliran memverifikasi.', 'نربّي معاً ونتقاسم المهام.')}</p>
              </div>
              <button onClick={onClose} aria-label="close" data-testid="coparent-close" className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            {!data ? <div className="h-40 rounded-2xl bg-white/70 animate-pulse" /> : (
              <>
                <div className="bg-white rounded-2xl p-3.5 shadow-eq-card" data-testid="coparent-list">
                  <div className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50 mb-2">{L('Ibu bapa dalam keluarga', 'Parents in this family', 'Orang tua di keluarga', 'الوالدان في العائلة')}</div>
                  <div className="space-y-2">
                    {parents.map(p => (
                      <div key={p.id} className="flex items-center gap-2.5" data-testid={`coparent-${p.id}`}>
                        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-black" style={{ background: colorOf(p.id) }}>
                          {p.picture ? <img src={p.picture} alt="" className="w-full h-full object-cover" /> : first(p.name)[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-eq-ink truncate">{p.name}{p.isMe ? ` (${L('anda', 'you', 'Anda', 'أنت')})` : ''}</div>
                          <div className="text-[11px] text-eq-ink/55">{L(`${p.verifiedToday} disahkan hari ini`, `${p.verifiedToday} verified today`, `${p.verifiedToday} diverifikasi hari ini`, `${p.verifiedToday} موثقة اليوم`)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {parents.length < 2 && (
                    <p className="text-[12px] text-eq-ink/70 mt-2.5 leading-snug">{L('Pasangan anda belum menyertai. Jemput mereka — laporan malam & giliran sahkan akan dikongsi bersama.', "Your spouse hasn't joined yet. Invite them — night reports & verify turns will be shared.", 'Pasangan Anda belum bergabung. Undang mereka.', 'لم ينضم شريكك بعد. ادعُه.')}</p>
                  )}
                  <button onClick={invite} data-testid="coparent-invite"
                    className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 bg-[#25D366] text-white font-extrabold text-sm active:scale-[0.99]">
                    <Share2 className="w-4 h-4" /> {L('Jemput pasangan via WhatsApp', 'Invite spouse via WhatsApp', 'Undang pasangan via WhatsApp', 'ادعُ شريكك عبر واتساب')}
                    {data.code && <span className="px-2 py-0.5 rounded-full bg-white/25 text-[11px]">{data.code}</span>}
                  </button>
                </div>

                <div className="bg-white rounded-2xl p-3.5 shadow-eq-card" data-testid="coparent-rota">
                  <div className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50 mb-2">{L('Siapa sahkan tugasan anak?', "Who verifies the kids' tasks?", 'Siapa yang memverifikasi?', 'من يتحقق من مهام الأطفال؟')}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[['both', '👫', L('Kedua-dua', 'Both of us', 'Berdua', 'كلانا')], ['weekday', '📅', L('Bergilir ikut hari', 'Take turns by day', 'Bergiliran per hari', 'بالتناوب يومياً')]].map(([m, e, label]) => (
                      <button key={m} onClick={() => setMode(m)} disabled={m === 'weekday' && parents.length < 2} data-testid={`coparent-mode-${m}`}
                        className={`rounded-xl py-2.5 border-2 text-sm font-extrabold disabled:opacity-40 ${rota.mode === m ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}>
                        {e} {label}
                      </button>
                    ))}
                  </div>
                  {rota.mode === 'weekday' && parents.length >= 2 && (
                    <>
                      <div className="grid grid-cols-7 gap-1 mt-3">
                        {[0, 1, 2, 3, 4, 5, 6].map(d => {
                          const uid = rota.days?.[String(d)]
                          const p = parents.find(x => x.id === uid)
                          return (
                            <button key={d} onClick={() => cycleDay(d)} data-testid={`coparent-day-${d}`}
                              className="flex flex-col items-center gap-1 rounded-xl py-1.5 bg-eq-warm active:scale-95">
                              <span className="text-[10px] font-bold text-eq-ink/60">{(DAY_NAMES[lang] || DAY_NAMES.ms)[d]}</span>
                              <span className="w-7 h-7 rounded-full text-white text-[11px] font-black flex items-center justify-center" style={{ background: p ? colorOf(p.id) : '#CBD5E1' }}>
                                {p ? first(p.name)[0] : '?'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[11px] text-eq-ink/55 mt-2 leading-snug">{L('Tekan hari untuk tukar giliran. Yang bergilir dapat Laporan Malam dengan butang Sahkan; pasangan dapat ringkasan sahaja — boleh berehat.', 'Tap a day to switch. The parent on duty gets the Night Report with Verify; the other just gets a summary.', 'Ketuk hari untuk mengganti giliran.', 'اضغط على اليوم للتبديل.')}</p>
                    </>
                  )}
                  <p className="text-[10px] text-eq-ink/45 text-center mt-2" data-testid="coparent-saved">{saving ? L('Menyimpan…', 'Saving…', 'Menyimpan…', 'جارِ الحفظ…') : saved ? L('Disimpan ✓', 'Saved ✓', 'Tersimpan ✓', 'تم الحفظ ✓') : ''}</p>
                </div>
                <p className="text-[11px] text-eq-ink/55 text-center px-2">{L('“Dan bertolong-tolonglah kamu dalam kebaikan dan takwa.” — Al-Maidah 5:2', '“And cooperate in righteousness and piety.” — Al-Maidah 5:2', '“Dan tolong-menolonglah kamu dalam kebajikan dan takwa.” — Al-Maidah 5:2', '«وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى» — المائدة ٥:٢')}</p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
