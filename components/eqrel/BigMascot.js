'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BRAND } from '@/lib/brand'

/**
 * BigMascot — Large animated EQrel mascot with mood/reactions.
 * Permanent presence in the Family Display bottom-right corner.
 *
 * Props:
 *   mood: 'idle' | 'celebrate' | 'praying' | 'greeting' | 'sleeping' | 'listening'
 *   bubble?: { intro?: string, message: string, variant: 'hadith'|'doa'|'celebrate'|'prayer'|'greet', keyId: any }
 *   lang?: 'ms'|'en'|'id'|'ar'
 *   size?: number  (mascot px, default 220)
 */
export default function BigMascot({ mood = 'idle', bubble = null, lang = 'ms', size = 220 }) {
  const isRTL = lang === 'ar'
  const mascotUrl = BRAND.mascot.default

  // Mood-specific animation configs
  const anim = useMemo(() => {
    switch (mood) {
      case 'celebrate':
        return { y: [0, -22, 0, -14, 0], rotate: [-4, 4, -4, 4, 0], transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } }
      case 'praying':
        return { y: [0, -3, 0], rotate: [-1, 1, -1], transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } }
      case 'greeting':
        return { rotate: [-6, 6, -6, 6, 0], y: [0, -8, 0], transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }
      case 'sleeping':
        return { y: [0, -1.5, 0], rotate: [-2, 2, -2], transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }
      case 'listening':
        return { y: [0, -4, 0], scale: [1, 1.03, 1], transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }
      case 'idle':
      default:
        return { y: [0, -8, 0], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }
    }
  }, [mood])

  // Bubble accent per variant
  const variantMeta = {
    hadith:    { emoji: '📖', accent: 'from-amber-400 to-orange-500',   ring: 'ring-amber-300/60' },
    doa:       { emoji: '🤲', accent: 'from-emerald-400 to-teal-500',   ring: 'ring-emerald-300/60' },
    celebrate: { emoji: '🎉', accent: 'from-pink-400 to-fuchsia-500',   ring: 'ring-pink-300/60' },
    prayer:    { emoji: '🕌', accent: 'from-sky-400 to-indigo-500',     ring: 'ring-sky-300/60' },
    greet:     { emoji: '👋', accent: 'from-yellow-400 to-amber-500',   ring: 'ring-yellow-300/60' },
  }
  const meta = bubble ? (variantMeta[bubble.variant] || variantMeta.hadith) : null

  return (
    <div className="w-full flex items-center justify-end gap-3 pointer-events-none px-3 py-2" dir="ltr">
      {/* Speech bubble on LEFT of mascot — constrained to ~half screen */}
      <div className="min-w-0 flex justify-end" style={{ maxWidth: 'min(50vw, 780px)' }}>
        <AnimatePresence mode="wait">
          {bubble && (
            <motion.div
              key={bubble.keyId ?? 'b'}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.95 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 220, damping: 22 }}
              className={`relative bg-white/95 backdrop-blur px-5 py-3.5 rounded-3xl shadow-2xl ring-4 ${meta.ring}`}
            >
              {/* Speech tail — pointing right toward mascot */}
              <div className={`absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 bg-white/95 rotate-45 ring-4 ${meta.ring}`}
                style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />

              {bubble.intro && (
                <div className={`text-[11px] uppercase tracking-widest font-black mb-1 bg-gradient-to-r ${meta.accent} bg-clip-text text-transparent`}>
                  {meta.emoji} {bubble.intro}
                </div>
              )}
              <div
                className={`text-slate-800 text-base md:text-lg font-semibold leading-snug ${isRTL ? 'text-right' : 'text-left'}`}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {bubble.message}
              </div>
              <div className="mt-1.5 flex items-center justify-end gap-1">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">— {BRAND.name}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mascot on RIGHT — fixed size */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {/* Glow ring under mascot */}
        <motion.div
          className={`absolute inset-0 rounded-full blur-3xl ${mood === 'celebrate' ? 'bg-amber-400/40' : mood === 'praying' ? 'bg-emerald-400/30' : mood === 'greeting' ? 'bg-sky-400/30' : 'bg-white/10'}`}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Celebration particles (sparkles) */}
        {mood === 'celebrate' && (
          <div className="absolute inset-0 pointer-events-none">
            {['✨', '🌟', '🎊', '⭐', '✨', '💫'].map((p, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl"
                initial={{ opacity: 0, x: size / 2, y: size / 2, scale: 0.5 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: size / 2 + Math.cos((i * Math.PI) / 3) * (size * 0.6),
                  y: size / 2 + Math.sin((i * Math.PI) / 3) * (size * 0.6),
                  scale: [0.5, 1.2, 0.8],
                  rotate: [0, 360],
                }}
                transition={{ duration: 2, delay: i * 0.15, repeat: Infinity, ease: 'easeOut' }}
              >{p}</motion.div>
            ))}
          </div>
        )}

        {/* Prayer aura — moon+stars */}
        {mood === 'praying' && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <motion.div
              className="text-3xl"
              animate={{ y: [0, -4, 0], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >🌙</motion.div>
          </div>
        )}

        {/* Sleeping Z's */}
        {mood === 'sleeping' && (
          <div className="absolute -top-2 -right-2 pointer-events-none">
            {['z', 'z', 'z'].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-white/70 font-black text-lg"
                style={{ left: i * 6, top: -i * 8 }}
                animate={{ opacity: [0, 1, 0], y: [-4, -14, -24] }}
                transition={{ duration: 3, delay: i * 0.9, repeat: Infinity }}
              >Z</motion.div>
            ))}
          </div>
        )}

        {/* Greeting wave */}
        {mood === 'greeting' && (
          <div className="absolute -top-2 left-2 pointer-events-none">
            <motion.div
              className="text-3xl origin-bottom-right"
              animate={{ rotate: [-15, 20, -15] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >👋</motion.div>
          </div>
        )}

        <motion.img
          src={mascotUrl}
          alt="EQ"
          animate={anim}
          className="relative w-full h-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
        />
      </div>
    </div>
  )
}
