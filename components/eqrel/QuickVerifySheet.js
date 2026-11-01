'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Star, RotateCcw, ShieldCheck, ListChecks } from 'lucide-react'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { pick, habitTitle } from '@/components/eqrel/tabs/tabUtils'

/**
 * Sahkan Pantas — verify all of today's claims in one tap (or per child / per item).
 * Designed so a parent finishes in ~10 seconds.
 */
export function QuickVerifySheet({ open, onClose, lang = 'en', onDone, onOpenDetailed }) {
  const L = pick(lang)
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/verify-queue/items', { credentials: 'include' })
      const d = r.ok ? await r.json() : { items: [] }
      setItems(d.items || [])
    } catch { setItems([]) }
  }, [])
  useEffect(() => { if (open) { setItems(null); setResult(null); load() } }, [open, load])

  const groups = (items || []).reduce((acc, it) => {
    const k = it.childId
    ;(acc[k] = acc[k] || { child: it.child, list: [] }).list.push(it)
    return acc
  }, {})

  const verifyAll = async (childId) => {
    setBusy(childId || 'all')
    try {
      const r = await fetch('/api/verify-queue/verify-all', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubric: 'sah', ...(childId ? { childId } : {}) }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        try { navigator.vibrate?.(30) } catch { /* ignore */ }
        setResult(prev => ({ verified: (prev?.verified || 0) + (d.verified || 0), points: (prev?.points || 0) + (d.points || 0), trusted: [...(prev?.trusted || []), ...(d.trustedNow || [])] }))
        await load()
        onDone?.()
      }
    } finally { setBusy(null) }
  }
  const verifyOne = async (it, rubric) => {
    setBusy(it.claimId + rubric)
    try {
      const r = await fetch(`/api/verify-queue/items/${it.claimId}/verify`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubric }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setItems(prev => (prev || []).filter(x => x.claimId !== it.claimId))
        if (rubric !== 'belum') setResult(prev => ({ verified: (prev?.verified || 0) + 1, points: (prev?.points || 0) + (d.points || 0), trusted: [...(prev?.trusted || []), ...(d.trusted ? [{ title: it.habit?.title }] : [])] }))
        onDone?.()
      }
    } finally { setBusy(null) }
  }

  const count = items?.length || 0
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="quick-verify">
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
            className="w-full sm:max-w-md bg-eq-warm rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}>
            <div className="px-4 pt-4 pb-2 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl">⚡</div>
              <div className="flex-1 min-w-0">
                <h2 className="font-extrabold text-eq-ink text-lg leading-tight">{L('Sahkan Pantas', 'Quick Verify', 'Verifikasi Cepat', 'تحقق سريع')}</h2>
                <p className="text-[11px] text-eq-ink/60">{L('Siap dalam 10 saat — anak terus nampak hasil usahanya', 'Done in 10 seconds — your child sees their effort count', 'Selesai dalam 10 detik', 'تنتهي في ١٠ ثوانٍ')}</p>
              </div>
              <button onClick={onClose} aria-label="close" data-testid="quick-verify-close" className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-4 overflow-y-auto flex-1 space-y-2.5 pb-2">
              {result && result.verified > 0 && (
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-3.5" data-testid="quick-verify-result">
                  <div className="font-extrabold">✨ {L(`${result.verified} tugasan disahkan · +${result.points} mata untuk anak`, `${result.verified} verified · +${result.points} points for your kids`, `${result.verified} diverifikasi · +${result.points} poin`, `تم التحقق من ${result.verified} · +${result.points} نقطة`)}</div>
                  <div className="text-[11px] text-white/85 mt-0.5">{L('Jazakallahu khairan. Pengiktirafan kecil anda membina keyakinan besar anak.', 'Jazakallahu khairan. Your small recognition builds big confidence.', 'Jazakallahu khairan. Pengakuan kecil Anda membangun percaya diri anak.', 'جزاك الله خيراً. تقديرك الصغير يبني ثقة كبيرة.')}</div>
                  {result.trusted?.length > 0 && (
                    <div className="mt-2 text-[11px] font-bold bg-white/15 rounded-xl px-2.5 py-1.5" data-testid="quick-verify-trusted">
                      🛡️ {L('Mod Percaya aktif untuk', 'Trust Mode now on for', 'Mode Percaya aktif untuk', 'وضع الثقة مفعّل لـ')}: {result.trusted.map(t => t.title).join(', ')}
                    </div>
                  )}
                </motion.div>
              )}

              {items === null && [0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-white/70 animate-pulse" />)}

              {items && count === 0 && (
                <div className="text-center py-8" data-testid="quick-verify-empty">
                  <div className="text-5xl">🌙</div>
                  <div className="font-extrabold text-eq-ink mt-2">{L('Tiada yang menunggu', 'Nothing waiting', 'Tidak ada yang menunggu', 'لا شيء بالانتظار')}</div>
                  <p className="text-xs text-eq-ink/60 mt-1 max-w-[260px] mx-auto">{L('Semua tugasan hari ini sudah disahkan. Rehatlah — anda sudah buat yang terbaik.', "Everything today is verified. Rest — you've done your best.", 'Semua tugas hari ini sudah diverifikasi. Istirahatlah.', 'تم التحقق من كل شيء اليوم. استرح.')}</p>
                </div>
              )}

              {Object.entries(groups).map(([cid, g]) => (
                <div key={cid} className="bg-white rounded-2xl shadow-eq-card p-3" data-testid={`quick-group-${cid}`}>
                  <div className="flex items-center gap-2.5">
                    <img src={AVATAR_BY_ID[g.child?.avatarId]?.src || '/avatars/boys/B01.png'} alt="" className="w-10 h-10 rounded-full bg-amber-50 object-contain" />
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-eq-ink truncate">{g.child?.nickname}</div>
                      <div className="text-[11px] text-eq-ink/55">{g.list.length} {L('menunggu', 'waiting', 'menunggu', 'بالانتظار')}</div>
                    </div>
                    <button onClick={() => verifyAll(cid)} disabled={!!busy} data-testid={`quick-child-all-${cid}`}
                      className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold active:scale-95 disabled:opacity-50">
                      ✓ {L('Semua', 'All', 'Semua', 'الكل')}
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {g.list.map(it => (
                      <div key={it.claimId} className="flex items-center gap-2 rounded-xl bg-eq-warm/60 px-2.5 py-2" data-testid={`quick-item-${it.claimId}`}>
                        <span className="text-lg">{it.habit?.icon || '⭐'}</span>
                        <span className="flex-1 min-w-0 text-[13px] font-bold text-eq-ink truncate">{habitTitle(it.habit, lang)}</span>
                        <button onClick={() => verifyOne(it, 'belum')} disabled={!!busy} aria-label="belum" title={L('Belum — anak boleh cuba lagi', 'Not yet — child can retry', 'Belum', 'ليس بعد')}
                          className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center active:scale-90 disabled:opacity-40"><RotateCcw className="w-3.5 h-3.5 text-gray-500" /></button>
                        <button onClick={() => verifyOne(it, 'ihsan')} disabled={!!busy} aria-label="ihsan" data-testid={`quick-ihsan-${it.claimId}`}
                          className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center active:scale-90 disabled:opacity-40"><Star className="w-4 h-4 text-amber-600" fill="#F59E0B" /></button>
                        <button onClick={() => verifyOne(it, 'sah')} disabled={!!busy} aria-label="sah" data-testid={`quick-sah-${it.claimId}`}
                          className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center active:scale-90 disabled:opacity-40"><Check className="w-4 h-4 text-white" strokeWidth={3} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-2 text-[11px] text-eq-ink/60 px-1 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                {L('Mod Percaya: habit yang disahkan 7 hari berturut-turut akan disahkan automatik selepas ini. Anda boleh matikan di tab Tugasan.',
                  'Trust Mode: a habit verified 7 days in a row becomes auto-verified. You can turn it off in the Tasks tab.',
                  'Mode Percaya: kebiasaan yang diverifikasi 7 hari berturut-turut akan otomatis terverifikasi. Bisa dimatikan di tab Tugas.',
                  'وضع الثقة: العادة التي يُتحقق منها ٧ أيام متتالية تُعتمد تلقائياً. يمكنك إيقافه من تبويب المهام.')}
              </div>
            </div>

            <div className="px-4 pt-2 space-y-1.5">
              <button onClick={() => verifyAll(null)} disabled={!!busy || count === 0} data-testid="quick-verify-all"
                className="w-full rounded-2xl py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-extrabold shadow-lg shadow-emerald-600/20 disabled:opacity-40 active:scale-[0.99]">
                {busy === 'all' ? L('Mengesahkan…', 'Verifying…', 'Memverifikasi…', 'جارٍ التحقق…') : `✓ ${L(`Sahkan Semua (${count})`, `Verify All (${count})`, `Verifikasi Semua (${count})`, `تحقق من الكل (${count})`)}`}
              </button>
              {onOpenDetailed && count > 0 && (
                <button onClick={onOpenDetailed} data-testid="quick-verify-detailed" className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-eq-ink/60 py-1.5">
                  <ListChecks className="w-4 h-4" /> {L('Semak satu-satu dengan nota', 'Review one by one with notes', 'Periksa satu per satu', 'مراجعة واحدة تلو الأخرى')}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
