'use client'

import { useLang, SUPPORTED_LANGS } from '@/lib/i18n/LangProvider'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, Globe } from 'lucide-react'

/**
 * LangPicker — language switcher for EQrel
 *
 * Variants:
 *  - 'elegant'  (default for onboarding): floating glassmorphism dropdown
 *  - 'compact'  (for header): small pill with short codes
 */
export function LangPicker({ variant = 'elegant', align = 'right' }) {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = SUPPORTED_LANGS.find(L => L.code === lang) || SUPPORTED_LANGS[0]

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (variant === 'compact') {
    // Small pill row (used in header of authenticated app)
    return (
      <div className="inline-flex bg-white/80 backdrop-blur rounded-full p-0.5 border border-emerald-200/60 shadow-sm">
        {SUPPORTED_LANGS.map((L) => (
          <button key={L.code}
            onClick={() => setLang(L.code)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all ${
              lang === L.code ? 'bg-emerald-500 text-white shadow' : 'text-emerald-800/60'
            }`}
          >
            {L.short}
          </button>
        ))}
      </div>
    )
  }

  // ═══ Elegant dropdown ═══
  const menuAlign =
    align === 'left'   ? 'left-0' :
    align === 'center' ? 'left-1/2 -translate-x-1/2' :
                         'right-0'

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`group inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-white/80 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.15)] hover:bg-white hover:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.2)] active:scale-[0.98] transition-all ${open ? 'ring-2 ring-emerald-300/50' : ''}`}
        dir={current.dir}
      >
        <Globe className="w-3.5 h-3.5 text-emerald-700/70 shrink-0" strokeWidth={2.5} />
        <span className="text-[13px] font-bold text-emerald-900 leading-none tracking-tight">
          {current.label}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-emerald-700/60 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`absolute ${menuAlign} top-full mt-1.5 z-50 min-w-[210px] rounded-2xl bg-white/95 backdrop-blur-xl border border-white/90 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.25)] overflow-hidden`}
            role="listbox"
          >
            {SUPPORTED_LANGS.map((L, i) => {
              const active = L.code === lang
              return (
                <button
                  key={L.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { setLang(L.code); setOpen(false) }}
                  dir={L.dir}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-emerald-900/85 hover:bg-emerald-50/60'
                  } ${i > 0 ? 'border-t border-emerald-100/70' : ''}`}
                >
                  <span className={`text-[14px] leading-none ${active ? 'font-extrabold' : 'font-semibold'}`}>
                    {L.label}
                  </span>
                  {active && (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={3} />
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LangPicker
