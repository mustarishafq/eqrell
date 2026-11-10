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
  // Reward shop inbox: redemption requests + reward ideas from kids
  const [rewardReqs, setRewardReqs] = useState([])
  const [proposals, setProposals] = useState([])
  const [kidsById, setKidsById] = useState({})
  const [inboxMsg, setInboxMsg] = useState('')

  const load = useCallback(async () => {
    try {
      const [r, rr, rp, rc] = await Promise.all([
        fetch('/api/verify-queue/items', { credentials: 'include' }),
        fetch('/api/rewards/requests?status=pending', { credentials: 'include' }),
        fetch('/api/rewards/proposals?status=pending', { credentials: 'include' }),
        fetch('/api/children', { credentials: 'include' }),
      ])
      const d = r.ok ? await r.json() : { items: [] }
      setRewardReqs(rr.ok ? ((await rr.json()).requests || []) : [])
      setProposals(rp.ok ? ((await rp.json()).proposals || []) : [])
      if (rc.ok) { const cd = await rc.json(); setKidsById(Object.fromEntries((cd.children || []).map(c => [c.id, c]))) }
      setItems(d.items || [])
    } catch { setItems([]) }
  }, [])

  const decideReward = async (rq, decision) => {
    setBusy(rq.id + decision); setInboxMsg('')
    try {
      const r = await fetch(`/api/rewards/requests/${rq.id}/decide`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setInboxMsg(d?.error || 'Error'); return }
      try { navigator.vibrate?.(30) } catch { /* ignore */ }
      setRewardReqs(prev => prev.filter(x => x.id !== rq.id))
      onDone?.()
    } finally { setBusy(null) }
  }
  const decideProposal = async (pr, decision) => {
    setBusy(pr.id + decision); setInboxMsg('')
    try {
      const r = await fetch(`/api/rewards/proposals/${pr.id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setInboxMsg(d?.error || 'Error'); return }
      setProposals(prev => prev.filter(x => x.id !== pr.id))
      onDone?.()
    } finally { setBusy(null) }
  }
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
  const inboxCount = count + rewardReqs.length + proposals.length
  const KidAvatar = ({ id }) => (
    <img src={AVATAR_BY_ID[kidsById[id]?.avatarId]?.src || '/avatars/boys/B01.png'} alt="" className="w-8 h-8 rounded-full bg-amber-50 object-contain flex-shrink-0" />
  )
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
                <h2 className="font-extrabold text-eq-ink text-lg leading-tight">{L('Peti Masuk Ibu Bapa', 'Parent Inbox', 'Kotak Masuk Orang Tua', 'صندوق الوالدين')}</h2>
                <p className="text-[11px] text-eq-ink/60">{L('Tugasan, tebusan ganjaran & cadangan anak — semua di sini', 'Habits, reward requests & kids\' ideas — all in one place', 'Tugas, penukaran hadiah & usulan anak — semua di sini', 'العادات وطلبات المكافآت والاقتراحات — في مكان واحد')}</p>
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

              {/* 🎁 Reward requests */}
              {rewardReqs.length > 0 && (
                <div className="bg-white rounded-2xl shadow-eq-card p-3" data-testid="inbox-reward-requests">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-700 mb-1.5">🎁 {L('Permintaan ganjaran', 'Reward requests', 'Permintaan hadiah', 'طلبات المكافآت')} · {rewardReqs.length}</div>
                  <div className="space-y-1.5">
                    {rewardReqs.map(rq => {
                      const kid = kidsById[rq.childId]
                      const short = kid && Number(kid.mataReward || 0) < Number(rq.snapshot?.cost || 0)
                      return (
                        <div key={rq.id} className="flex items-center gap-2 rounded-xl bg-amber-50/70 px-2.5 py-2" data-testid={`inbox-rr-${rq.id}`}>
                          <KidAvatar id={rq.childId} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold text-eq-ink truncate">{rq.snapshot?.icon} {rq.snapshot?.title}</div>
                            <div className={`text-[10px] font-bold ${short ? 'text-red-500' : 'text-eq-ink/55'}`}>
                              {kid?.nickname} · {rq.snapshot?.cost} 🎁{kid ? ` · ${L('baki', 'balance', 'saldo', 'الرصيد')} ${kid.mataReward || 0}` : ''}
                            </div>
                          </div>
                          <button onClick={() => decideReward(rq, 'rejected')} disabled={!!busy} aria-label="reject" data-testid={`inbox-rr-reject-${rq.id}`}
                            className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center active:scale-90 disabled:opacity-40"><X className="w-3.5 h-3.5 text-gray-500" /></button>
                          <button onClick={() => decideReward(rq, 'approved')} disabled={!!busy || short} aria-label="approve" data-testid={`inbox-rr-approve-${rq.id}`}
                            className="px-3 h-8 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center gap-1 active:scale-90 disabled:opacity-40"><Check className="w-3.5 h-3.5" strokeWidth={3} />{L('Lulus', 'Approve', 'Setujui', 'موافقة')}</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 💡 Reward ideas from kids */}
              {proposals.length > 0 && (
                <div className="bg-white rounded-2xl shadow-eq-card p-3" data-testid="inbox-proposals">
                  <div className="text-[11px] font-black uppercase tracking-wider text-violet-700 mb-1.5">💡 {L('Cadangan ganjaran anak', 'Reward ideas from kids', 'Usulan hadiah anak', 'اقتراحات الأطفال')} · {proposals.length}</div>
                  <div className="space-y-1.5">
                    {proposals.map(pr => (
                      <div key={pr.id} className="flex items-center gap-2 rounded-xl bg-violet-50/70 px-2.5 py-2" data-testid={`inbox-prop-${pr.id}`}>
                        <KidAvatar id={pr.childId} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-eq-ink truncate">{pr.icon} {pr.title}</div>
                          <div className="text-[10px] font-bold text-eq-ink/55 truncate">{kidsById[pr.childId]?.nickname} · {pr.cost} 🎁{pr.desc ? ` · ${pr.desc}` : ''}</div>
                        </div>
                        <button onClick={() => decideProposal(pr, 'rejected')} disabled={!!busy} aria-label="reject" data-testid={`inbox-prop-reject-${pr.id}`}
                          className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center active:scale-90 disabled:opacity-40"><X className="w-3.5 h-3.5 text-gray-500" /></button>
                        <button onClick={() => decideProposal(pr, 'approved')} disabled={!!busy} aria-label="add to shop" data-testid={`inbox-prop-approve-${pr.id}`}
                          className="px-3 h-8 rounded-full bg-violet-500 text-white text-[11px] font-black flex items-center gap-1 active:scale-90 disabled:opacity-40"><Check className="w-3.5 h-3.5" strokeWidth={3} />{L('Masuk kedai', 'Add to shop', 'Tambahkan', 'أضف')}</button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-eq-ink/50 mt-1.5">{L('Nak ubah harga atau nama? Buka Kedai Ganjaran.', 'Want to change the price or name? Open the Reward Shop.', 'Ingin ubah harga? Buka Toko Hadiah.', 'لتعديل السعر افتح المتجر.')}</p>
                </div>
              )}
              {inboxMsg && <div className="text-[11px] text-red-500 font-bold px-1" data-testid="inbox-error">{inboxMsg}</div>}

              {items && count > 0 && (rewardReqs.length > 0 || proposals.length > 0) && (
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700 px-1 pt-1">✅ {L('Tugasan untuk disahkan', 'Habits to verify', 'Tugas untuk diverifikasi', 'عادات للتحقق')} · {count}</div>
              )}

              {items && inboxCount === 0 && (
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
                        <span className="flex-1 min-w-0 text-[13px] font-bold text-eq-ink truncate">{habitTitle(it.habit, lang)}
                          {it.session && <span className="ml-1 text-[9px] font-black text-indigo-600 uppercase">{it.session}</span>}
                          {it.daysAgo > 0 && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-black align-middle" data-testid={`quick-late-${it.claimId}`}>🌙 {it.daysAgo === 1 ? L('Semalam', 'Yesterday', 'Kemarin', 'أمس') : L(`${it.daysAgo} hari lalu`, `${it.daysAgo} days ago`, `${it.daysAgo} hari lalu`, `قبل ${it.daysAgo} أيام`)}</span>}
                        </span>
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
