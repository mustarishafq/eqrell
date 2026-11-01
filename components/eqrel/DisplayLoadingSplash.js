'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FAMILY_QUOTES } from '@/lib/familyQuotes'

/**
 * DisplayLoadingSplash — full-screen splash shown while the Family Display
 * warms up (config, family data, prayer times, first photo).
 *
 * Props:
 *   lang         : ms | en | id | ar
 *   familyName?  : optional family name to greet
 *   onGone?      : called after the fade-out completes (so parent can safely
 *                  unmount / stop rendering the splash)
 *   visible      : boolean — when false, splash fades out
 */
export default function DisplayLoadingSplash({ lang = 'en', familyName, visible, onGone }) {
  // Pick a stable random quote for this splash instance
  const quote = useMemo(() => {
    const idx = Math.floor(Math.random() * FAMILY_QUOTES.length)
    return FAMILY_QUOTES[idx]
  }, [])

  const isRTL = lang === 'ar'

  const readyLabel = lang === 'ar' ? 'جاري التحضير'
                   : lang === 'en' ? 'Preparing your family display'
                   : lang === 'id' ? 'Menyiapkan tampilan keluarga'
                   : 'Menyiapkan paparan keluarga'

  const greetLabel = familyName
    ? (lang === 'ar' ? `أهلاً بعائلة ${familyName}`
      : lang === 'en' ? `Welcome, ${familyName} family`
      : lang === 'id' ? `Selamat datang, keluarga ${familyName}`
      : `Selamat datang, keluarga ${familyName}`)
    : (lang === 'ar' ? 'السلام عليكم'
      : lang === 'en' ? 'Assalamualaikum'
      : lang === 'id' ? 'Assalamualaikum'
      : 'Assalamualaikum')

  return (
    <AnimatePresence onExitComplete={onGone}>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            background: 'radial-gradient(1400px 900px at 30% 20%, #0d5b4e 0%, #063f36 45%, #021d18 100%)',
          }}
        >
          {/* Ambient star / dust particles */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
            {[...Array(24)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${2 + (i % 4)}px`,
                  height: `${2 + (i % 4)}px`,
                  background: i % 3 === 0 ? '#FFB703' : '#FFF8E7',
                  left: `${(i * 37) % 100}%`,
                  top: `${(i * 53) % 100}%`,
                }}
                animate={{
                  opacity: [0.2, 0.9, 0.2],
                  scale: [0.6, 1.2, 0.6],
                }}
                transition={{
                  duration: 3 + (i % 3),
                  repeat: Infinity,
                  delay: (i * 0.15) % 2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          {/* Glowing halo behind logo */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: '600px',
              height: '600px',
              background: 'radial-gradient(circle, rgba(0,184,148,0.35) 0%, transparent 60%)',
              filter: 'blur(20px)',
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Main content — vertical stack */}
          <div className="relative flex flex-col items-center gap-8 px-8 max-w-4xl text-center">
            {/* Logo (uses public asset) */}
            <motion.img
              src="/eqrel-logo-full.png"
              alt="EQrel"
              className="h-24 md:h-32 lg:h-40 w-auto object-contain drop-shadow-2xl"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />

            {/* Greeting */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="font-black text-3xl md:text-4xl lg:text-5xl"
              style={{ color: '#FFF8E7' }}
            >
              {greetLabel}
            </motion.div>

            {/* Motivational quote card */}
            {quote && (
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.7, ease: 'easeOut' }}
                className="relative rounded-3xl border-2 backdrop-blur-md px-8 py-6 md:px-12 md:py-8 max-w-3xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,184,148,0.10))',
                  borderColor: 'rgba(255,183,3,0.35)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                {/* Decorative Arabic ornament */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl" style={{ color: '#FFB703' }}>
                  ✦
                </div>
                <div
                  className="italic leading-relaxed font-semibold text-lg md:text-xl lg:text-2xl"
                  style={{ color: '#FFF8E7', lineHeight: 1.55 }}
                >
                  &ldquo;{quote.text[lang] || quote.text.ms}&rdquo;
                </div>
                <div
                  className="mt-4 text-xs md:text-sm font-black uppercase tracking-widest"
                  style={{ color: '#FFB703', opacity: 0.85 }}
                >
                  — {quote.source}
                </div>
              </motion.div>
            )}

            {/* Loading indicator — three pulsing dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="flex items-center gap-3 mt-4"
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="rounded-full"
                  style={{ width: 12, height: 12, background: '#00B894' }}
                  animate={{ scale: [0.6, 1.2, 0.6], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="text-sm font-bold tracking-widest uppercase"
              style={{ color: '#FFF8E7', opacity: 0.55 }}
            >
              {readyLabel}…
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
