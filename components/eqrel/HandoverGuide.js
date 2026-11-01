'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { pick } from '@/components/eqrel/tabs/tabUtils'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { BRAND } from '@/lib/brand'

/**
 * Upacara Serahan Pertama — shown once after the diagnosis: set the parent PIN,
 * then hand the phone to a child (Kid Mode opens with a mascot welcome).
 */
export function HandoverGuide({ open, onClose, lang = 'en', kids = [], hasPin, onSetPin }) {
  const L = pick(lang)
  const step = hasPin ? 2 : 1
  const go = (c) => { onClose?.(); window.location.href = `/kid?childId=${c.id}&welcome=1` }
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[75] bg-emerald-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="handover-guide">
          <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
            className="w-full sm:max-w-md bg-eq-warm rounded-t-3xl sm:rounded-3xl p-5 max-h-[92dvh] overflow-y-auto"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 18px)' }}>
            <div className="text-center">
              <div className="text-5xl">🤲</div>
              <h2 className="text-xl font-extrabold text-eq-ink mt-2">{L('Saat untuk serahkan kepada anak', 'Time to hand it to your child', 'Saatnya menyerahkan kepada anak', 'حان وقت تسليمه لطفلك')}</h2>
              <p className="text-[12px] text-eq-ink/60 mt-1">{L('2 langkah, kurang 1 minit. Anak akan disambut oleh maskot EQ.', '2 steps, under a minute. Your child will be welcomed by the EQ mascot.', '2 langkah, kurang dari 1 menit.', 'خطوتان في أقل من دقيقة.')}</p>
            </div>

            {/* Step 1 — PIN */}
            <div className={`mt-4 rounded-2xl p-3.5 border-2 ${step === 1 ? 'bg-white border-emerald-400' : 'bg-white/60 border-transparent'}`} data-testid="handover-step-pin">
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${hasPin ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{hasPin ? '✓' : '1'}</span>
                <div className="flex-1">
                  <div className="font-extrabold text-sm text-eq-ink">{L('Kunci ruang ibu bapa dengan PIN', 'Lock the parent area with a PIN', 'Kunci area orang tua dengan PIN', 'اقفل مساحة الوالدين برمز')}</div>
                  <div className="text-[11px] text-eq-ink/55">{L('Supaya anak tak boleh sahkan tugasan sendiri.', "So kids can't approve their own tasks.", 'Agar anak tidak bisa menyetujui sendiri.', 'حتى لا يعتمد الطفل مهامه بنفسه.')}</div>
                </div>
                {!hasPin && (
                  <button onClick={onSetPin} data-testid="handover-set-pin" className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-extrabold active:scale-95">
                    {L('Tetapkan', 'Set PIN', 'Atur', 'تعيين')}
                  </button>
                )}
              </div>
            </div>

            {/* Step 2 — hand over */}
            <div className={`mt-2 rounded-2xl p-3.5 border-2 ${step === 2 ? 'bg-white border-emerald-400' : 'bg-white/60 border-transparent opacity-70'}`} data-testid="handover-step-kid">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm">2</span>
                <div className="flex-1">
                  <div className="font-extrabold text-sm text-eq-ink">{L('Serahkan telefon kepada anak', 'Hand the phone to your child', 'Serahkan ponsel kepada anak', 'سلّم الهاتف لطفلك')}</div>
                  <div className="text-[11px] text-eq-ink/55">{L('Katakan: “Ini dunia kamu. Setiap habit baik membina kampung kamu!”', 'Say: “This is your world. Every good habit builds your village!”', 'Katakan: “Ini duniamu. Setiap kebiasaan baik membangun desamu!”', 'قل: «هذا عالمك. كل عادة حسنة تبني قريتك!»')}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, kids.length))}, minmax(0, 1fr))` }}>
                {kids.map(c => (
                  <button key={c.id} onClick={() => go(c)} disabled={!hasPin} data-testid={`handover-kid-${c.id}`}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-eq-warm py-2.5 disabled:opacity-40 active:scale-95">
                    <img src={AVATAR_BY_ID[c.avatarId]?.src || '/avatars/boys/B01.png'} alt="" className="w-12 h-12 object-contain" />
                    <span className="text-[12px] font-extrabold text-eq-ink truncate max-w-full px-1">{c.nickname}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={onClose} data-testid="handover-later" className="mt-3 w-full text-[12px] font-bold text-eq-ink/50 py-2">
              {L('Nanti — saya mahu lihat papan dahulu', 'Later — let me look around first', 'Nanti — saya mau lihat dulu', 'لاحقاً — أريد الاستكشاف أولاً')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Kid Mode welcome after a hand-over (?welcome=1). */
export function KidWelcome({ open, onClose, lang = 'en', child, avatarSrc, habitCount = 0 }) {
  const L = pick(lang)
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[88] bg-gradient-to-b from-emerald-500/90 to-emerald-800/90 flex items-center justify-center p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="kid-welcome">
          <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 15 }}
            className="w-full max-w-sm bg-white rounded-[32px] p-6 text-center shadow-2xl">
            <motion.img src={BRAND.mascot.default} onError={(e) => { e.currentTarget.style.display = 'none' }} alt=""
              className="w-28 h-28 mx-auto object-contain" animate={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
            {avatarSrc && <img src={avatarSrc} alt="" className="w-20 h-20 mx-auto -mt-4 rounded-full bg-amber-50 border-4 border-white object-contain" />}
            <h2 className="text-2xl font-extrabold text-emerald-950 mt-2">{L(`Assalamualaikum, ${child?.nickname || ''}!`, `Assalamualaikum, ${child?.nickname || ''}!`, `Assalamualaikum, ${child?.nickname || ''}!`, `السلام عليكم يا ${child?.nickname || ''}!`)} 👋</h2>
            <p className="text-[15px] text-emerald-900/80 mt-2 leading-snug">
              {L('Ibu & Ayah sudah sediakan dunia khas untuk kamu! 🌍', 'Mum & Dad made a special world just for you! 🌍', 'Ayah & Ibu sudah menyiapkan dunia khusus untukmu! 🌍', 'أعدّ لك أبوك وأمك عالماً خاصاً! 🌍')}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-bold text-emerald-900">
              <div className="rounded-2xl bg-emerald-50 p-2"><div className="text-2xl">✅</div>{L(`Siapkan ${habitCount} habit`, `Do your ${habitCount} habits`, `Selesaikan ${habitCount} kebiasaan`, `أنجز ${habitCount} عادات`)}</div>
              <div className="rounded-2xl bg-amber-50 p-2"><div className="text-2xl">⭐</div>{L('Kumpul mata', 'Collect points', 'Kumpulkan poin', 'اجمع النقاط')}</div>
              <div className="rounded-2xl bg-sky-50 p-2"><div className="text-2xl">🕌</div>{L('Bina kampung', 'Build your village', 'Bangun desa', 'ابنِ قريتك')}</div>
            </div>
            <button onClick={onClose} data-testid="kid-welcome-start"
              className="mt-5 w-full rounded-2xl py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold text-lg shadow-lg active:scale-[0.98]">
              {L('Jom mula! 🚀', "Let's start! 🚀", 'Ayo mulai! 🚀', 'هيا نبدأ! 🚀')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
