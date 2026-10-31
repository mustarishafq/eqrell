'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pick } from '@/components/eqrel/tabs/tabUtils'

const CONFETTI = ['🎉', '⭐', '✨', '🌟', '💚', '🎊', '🛡️']

/**
 * Lencana Mod Percaya — full-screen celebration in Kid Mode when a habit becomes trusted
 * (verified 7 days in a row). Shown once per badge, then marked seen.
 */
export function TrustCelebration({ childId, child, lang = 'ms', avatarSrc }) {
  const L = pick(lang)
  const [queue, setQueue] = useState([])
  const current = queue[0]

  useEffect(() => {
    if (!childId) return
    let alive = true
    const t = setTimeout(() => {
      fetch(`/api/children/${childId}/celebrations`, { credentials: 'include' })
        .then(r => (r.ok ? r.json() : { celebrations: [] }))
        .then(d => { if (alive) setQueue(d.celebrations || []) })
        .catch(() => {})
    }, 1200)   // let the home screen settle first
    return () => { alive = false; clearTimeout(t) }
  }, [childId])

  useEffect(() => { if (current) { try { navigator.vibrate?.([40, 60, 40]) } catch { /* ignore */ } } }, [current])

  const dismiss = async () => {
    const c = queue[0]
    setQueue(q => q.slice(1))
    if (c) fetch(`/api/children/${childId}/celebrations/seen`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [c.id] }) }).catch(() => {})
  }

  const name = child?.nickname || ''
  const title = current ? (current.i18n?.[lang]?.title || current.title) : ''
  return (
    <AnimatePresence>
      {current && (
        <motion.div key={current.id} className="fixed inset-0 z-[90] flex items-center justify-center p-5 bg-emerald-950/70 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="trust-celebration">
          {/* confetti */}
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.span key={i} className="absolute text-2xl pointer-events-none select-none"
              style={{ left: `${(i * 53) % 100}%`, top: '-8%' }}
              animate={{ y: ['0vh', '110vh'], rotate: [0, (i % 2 ? 1 : -1) * 360] }}
              transition={{ duration: 3 + (i % 5) * 0.5, delay: (i % 6) * 0.25, repeat: Infinity, ease: 'linear' }}>
              {CONFETTI[i % CONFETTI.length]}
            </motion.span>
          ))}
          <motion.div initial={{ scale: 0.6, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            className="relative w-full max-w-sm bg-white rounded-[32px] p-6 text-center shadow-2xl">
            <div className="relative mx-auto w-40 h-40">
              <motion.div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-yellow-200 to-emerald-300"
                animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
              <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                <motion.span className="text-7xl" animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>🛡️</motion.span>
              </div>
              {avatarSrc && <img src={avatarSrc} alt="" className="absolute -bottom-2 -right-2 w-16 h-16 rounded-full bg-amber-50 border-4 border-white object-contain" />}
            </div>
            <div className="mt-4 inline-flex px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black uppercase tracking-wider">
              {L('Lencana Dipercayai', 'Trusted Badge', 'Lencana Dipercaya', 'شارة الثقة')}
            </div>
            <h2 className="mt-2 text-2xl font-extrabold text-emerald-950 leading-tight">
              {L(`MasyaAllah, ${name}!`, `MashaAllah, ${name}!`, `MasyaAllah, ${name}!`, `ما شاء الله يا ${name}!`)}
            </h2>
            <p className="mt-2 text-[15px] text-emerald-900/80 leading-snug">
              {L('Kamu buat', 'You did', 'Kamu melakukan', 'لقد أدّيت')} <b className="text-emerald-700">{current.icon ? `${current.icon} ` : ''}{title}</b> {L('7 hari berturut-turut!', '7 days in a row!', '7 hari berturut-turut!', '٧ أيام متتالية!')}
            </p>
            <p className="mt-2 text-[13px] text-emerald-900/70 leading-snug">
              {L('Ibu & Ayah kini PERCAYA kamu. Mulai sekarang, habit ini terus disahkan bila kamu siapkan. 🌟',
                'Mum & Dad now TRUST you. From now on, this habit is approved as soon as you finish it. 🌟',
                'Ayah & Ibu sekarang PERCAYA kamu. Mulai sekarang, kebiasaan ini langsung disetujui. 🌟',
                'أبوك وأمك يثقان بك الآن. من اليوم تُعتمد هذه العادة فور إنجازها. 🌟')}
            </p>
            <p className="mt-3 text-[11px] text-amber-700 font-bold">{L('“Amalan yang paling Allah cintai ialah yang berterusan.”', '“The deeds most loved by Allah are the consistent ones.”', '“Amalan yang paling dicintai Allah adalah yang terus-menerus.”', '«أحبّ الأعمال إلى الله أدومها»')}</p>
            <button onClick={dismiss} data-testid="trust-celebration-ok"
              className="mt-5 w-full rounded-2xl py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-extrabold text-base shadow-lg active:scale-[0.98]">
              {L('Alhamdulillah! 🎉', 'Alhamdulillah! 🎉', 'Alhamdulillah! 🎉', 'الحمد لله! 🎉')}
            </button>
            {queue.length > 1 && <p className="mt-2 text-[11px] text-emerald-700 font-bold">+{queue.length - 1} {L('lencana lagi!', 'more badges!', 'lencana lagi!', 'شارات أخرى!')}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
