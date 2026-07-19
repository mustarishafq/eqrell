'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { BRAND } from '@/lib/brand'

/**
 * MascotSpeech — the EQrel mascot ("EQ") delivering a message via speech bubble.
 * Used on Family Display Mode to make Hadith / Doa feel personal.
 *
 * Props:
 *  - message: string (the hadith / doa / doa text)
 *  - intro?: string   (small intro line above message — e.g. "Rasulullah ﷺ bersabda…")
 *  - variant?: 'hadith' | 'doa' | 'greet' (controls emoji + color accent)
 *  - lang?: 'ms' | 'en' | 'id' | 'ar' (for RTL support)
 *  - keyId?: string | number  (used to trigger enter animation on rotate)
 *  - size?: 'sm' | 'md' | 'lg'
 *  - pose?: 'default' | 'reading' | 'praying' | 'greeting'
 *  - side?: 'right' | 'left'  (which side the mascot stands on)
 */
export default function MascotSpeech({
  message,
  intro,
  variant = 'hadith',
  lang = 'ms',
  keyId = 0,
  size = 'md',
  pose = 'default',
  side = 'right',
}) {
  const emoji = variant === 'hadith' ? '📖' : variant === 'doa' ? '🤲' : '👋'
  const accent = variant === 'hadith' ? 'from-amber-400 to-amber-500' : variant === 'doa' ? 'from-emerald-400 to-emerald-500' : 'from-sky-400 to-sky-500'
  const mascotUrl = BRAND.mascot[pose] || BRAND.mascot.default
  const isRTL = lang === 'ar'
  const mascotSize = size === 'sm' ? 'w-16 h-16' : size === 'lg' ? 'w-28 h-28' : 'w-20 h-20'

  const mascotEl = (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className="relative flex-shrink-0"
    >
      <motion.img
        src={mascotUrl}
        alt="EQ"
        className={`${mascotSize} object-contain drop-shadow-2xl`}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  )

  const bubbleEl = (
    <div className="relative flex-1 max-w-2xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={keyId}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.5 }}
          className={`relative rounded-2xl bg-white/95 backdrop-blur px-4 py-3 shadow-2xl border-2 border-white/40 ${isRTL ? 'text-right' : 'text-left'}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Speech tail — pointing towards mascot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white/95 border-2 border-white/40 rotate-45 ${side === 'right' ? '-right-2 border-b-transparent border-l-transparent' : '-left-2 border-t-transparent border-r-transparent'}`}
          />

          {intro && (
            <div className={`text-[10px] uppercase tracking-widest font-black mb-1 bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>
              {emoji} {intro}
            </div>
          )}
          <div className="text-slate-800 text-sm md:text-base font-semibold leading-snug">
            {message}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Brand watermark under bubble */}
      <div className={`mt-1.5 flex items-center gap-1 ${side === 'right' ? 'justify-end pr-2' : 'justify-start pl-2'}`}>
        <span className="text-[9px] uppercase tracking-widest text-white/60 font-bold">— {BRAND.name}</span>
      </div>
    </div>
  )

  return (
    <div className={`flex items-center gap-3 ${side === 'right' ? 'flex-row' : 'flex-row-reverse'}`}>
      {side === 'right' ? bubbleEl : mascotEl}
      {side === 'right' ? mascotEl : bubbleEl}
    </div>
  )
}
