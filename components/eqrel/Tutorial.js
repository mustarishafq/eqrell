'use client'

/**
 * Tutorial modal — interactive multi-step guide.
 * Auto-opens on first render if not dismissed (via localStorage), and can be re-opened
 * anytime via the exported `useTutorial(id)` hook's `forceOpen()`.
 *
 * Usage:
 *   const tut = useTutorial('kid_welcome')
 *   <Tutorial open={tut.open} onClose={tut.close} config={TUTORIALS.kid_welcome} lang={lang} />
 *   <button onClick={tut.forceOpen}><HelpCircle /></button>
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'

const STORAGE_PREFIX = 'eqrel-tut-v1-'

// ─────────────────────────────────────────────────────────────────
// Hook: track "seen" state + auto-open on first render

export function useTutorial(tutorialId, { autoOpenFirstTime = true } = {}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!autoOpenFirstTime || typeof window === 'undefined') return
    try {
      const seen = localStorage.getItem(STORAGE_PREFIX + tutorialId)
      if (!seen) {
        // Small delay so the tutorial doesn't fight with page-load animations
        const timer = setTimeout(() => setOpen(true), 500)
        return () => clearTimeout(timer)
      }
    } catch (e) { /* localStorage unavailable */ }
  }, [tutorialId, autoOpenFirstTime])

  const close = useCallback(() => {
    try { localStorage.setItem(STORAGE_PREFIX + tutorialId, '1') } catch (e) { /* ignore */ }
    setOpen(false)
  }, [tutorialId])

  const forceOpen = useCallback(() => setOpen(true), [])

  return { open, close, forceOpen }
}

// Helper for consumers to render a compact help button
export function TutorialHelpButton({ onClick, className = '', label = 'Help' }) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full bg-white/70 hover:bg-white active:scale-95 text-emerald-700 flex items-center justify-center border border-emerald-200 transition-all ${className}`}
      aria-label={label}
      title={label}
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// Component: Tutorial modal

/**
 * config = {
 *   mascot: '🌱',
 *   color: '#00B894',
 *   title: 'Selamat Datang!',
 *   subtitle: 'Cara pakai apps ni',
 *   steps: [{ icon, title, body, hint? }, ...],
 *   ctaFinal: 'Faham!',
 *   ctaNext: 'Seterusnya',
 *   ctaBack: 'Kembali',
 *   ctaSkip: 'Langkau',
 * }
 */
export function Tutorial({ open, onClose, config }) {
  const [stepIdx, setStepIdx] = useState(0)

  // Reset to first step whenever the modal re-opens
  useEffect(() => { if (open) setStepIdx(0) }, [open])

  if (!config) return null
  const steps = config.steps || []
  const step = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1
  const isFirst = stepIdx === 0
  const color = config.color || '#00B894'

  const next = () => {
    if (isLast) onClose()
    else setStepIdx(i => i + 1)
  }
  const back = () => setStepIdx(i => Math.max(0, i - 1))

  return (
    <AnimatePresence>
      {open && step && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            style={{ zIndex: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
            style={{ zIndex: 10 }}
          >
            {/* Colored top strip */}
            <div className="h-1.5 w-full" style={{ background: color }} />

            {/* Skip button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-eq-cream/60 hover:bg-eq-cream flex items-center justify-center z-10"
              aria-label={config.ctaSkip || 'Skip'}
            >
              <X className="w-4 h-4 text-eq-ink/60" />
            </button>

            {/* Header */}
            <div className="pt-6 pb-2 px-6 text-center">
              <div className="text-5xl mb-2">{config.mascot || '💡'}</div>
              <h2 className="text-lg font-extrabold text-eq-ink leading-tight">{config.title}</h2>
              {config.subtitle && (
                <p className="text-xs text-eq-ink/60 mt-0.5">{config.subtitle}</p>
              )}
            </div>

            {/* Step content */}
            <div className="px-6 pb-4 min-h-[180px] flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stepIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col items-center text-center"
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3"
                    style={{ background: `${color}18`, border: `2px solid ${color}33` }}
                  >
                    {step.icon}
                  </div>
                  <h3 className="font-extrabold text-eq-ink text-base leading-tight mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-eq-ink/70 leading-snug">
                    {step.body}
                  </p>
                  {step.hint && (
                    <div className="mt-3 w-full rounded-xl px-3 py-2 text-[11px] leading-snug"
                      style={{ background: `${color}12`, color: color, border: `1px solid ${color}33` }}>
                      💡 {step.hint}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 pb-3">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIdx(i)}
                  className={`transition-all rounded-full ${
                    i === stepIdx ? 'w-6 h-2' : 'w-2 h-2'
                  }`}
                  style={{ background: i === stepIdx ? color : `${color}44` }}
                  aria-label={`Step ${i + 1}`}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div className="px-4 pb-4 flex items-center gap-2">
              <button
                onClick={back}
                disabled={isFirst}
                className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center transition-all ${
                  isFirst ? 'opacity-30 cursor-not-allowed border-eq-cream' : 'border-eq-cream hover:bg-eq-cream/40 active:scale-95'
                }`}
                aria-label={config.ctaBack || 'Back'}
              >
                <ChevronLeft className="w-5 h-5 text-eq-ink/70" />
              </button>
              <button
                onClick={next}
                className="flex-1 rounded-2xl text-white font-extrabold py-3 text-sm active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-md"
                style={{ background: color }}
              >
                {isLast ? (config.ctaFinal || 'Got it!') : (config.ctaNext || 'Next')}
                {!isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Tutorial
