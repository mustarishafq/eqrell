'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, Delete } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'

/**
 * PinModal — 4-digit PIN gate for Kid Mode entry/exit.
 *
 * modes:
 *   - 'enter': verify existing PIN. onSuccess called after correct.
 *   - 'set':   create first-time PIN. Two-step: new + confirm.
 *   - 'change': change PIN. Three-step: current + new + confirm.
 */
export function PinModal({ open, mode = 'enter', onClose, onSuccess }) {
  const { t } = useLang()
  const [stage, setStage] = useState('primary')   // 'primary' | 'confirm' | 'current'
  const [primary, setPrimary] = useState('')
  const [confirm, setConfirm] = useState('')
  const [current, setCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [errText, setErrText] = useState('')

  useEffect(() => {
    if (!open) return
    // Reset on open
    setPrimary(''); setConfirm(''); setCurrent(''); setErrText(''); setBusy(false)
    if (mode === 'change') setStage('current')
    else setStage('primary')
  }, [open, mode])

  const activeValue = stage === 'primary' ? primary : stage === 'confirm' ? confirm : current
  const setActiveValue = stage === 'primary' ? setPrimary : stage === 'confirm' ? setConfirm : setCurrent

  const title =
    mode === 'set'    ? t.pin_set_title :
    mode === 'change' ? t.pin_change_title :
                        t.pin_enter_title
  const body =
    mode === 'set'    ? t.pin_set_body :
    mode === 'change' ? (stage === 'current' ? t.pin_current : stage === 'primary' ? t.pin_new : t.pin_confirm) :
                        t.pin_enter_body

  const handleDigit = (d) => {
    if (busy) return
    if (activeValue.length >= 4) return
    const next = activeValue + d
    setActiveValue(next)
    setErrText('')
    if (next.length === 4) {
      // Auto-progress after short delay
      setTimeout(() => proceedStage(next), 180)
    }
  }
  const handleDel = () => {
    if (busy) return
    setActiveValue(activeValue.slice(0, -1))
    setErrText('')
  }

  const proceedStage = async (val) => {
    if (mode === 'enter') {
      await verifyPin(val)
      return
    }
    if (mode === 'change' && stage === 'current') {
      // Move to new pin
      setStage('primary')
      return
    }
    if (stage === 'primary') {
      // Move to confirm
      setStage('confirm')
      return
    }
    if (stage === 'confirm') {
      if (val !== primary) {
        setErrText(t.pin_mismatch)
        setConfirm('')
        return
      }
      await savePin(primary)
    }
  }

  const verifyPin = async (pin) => {
    setBusy(true)
    try {
      const res = await fetch('/api/family/pin/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) {
        setErrText(t.pin_wrong)
        setPrimary('')
        setBusy(false)
        return
      }
      setBusy(false)
      if (onSuccess) onSuccess()
    } catch {
      setErrText(t.verify_error || 'Error')
      setBusy(false)
    }
  }

  const savePin = async (pin) => {
    setBusy(true)
    try {
      const body = mode === 'change' ? { pin, currentPin: current } : { pin }
      const res = await fetch('/api/family/pin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrText(data?.error || t.pin_wrong)
        // reset back to current step
        if (mode === 'change') { setStage('current'); setCurrent(''); setPrimary(''); setConfirm('') }
        else { setStage('primary'); setPrimary(''); setConfirm('') }
        setBusy(false)
        return
      }
      setBusy(false)
      if (onSuccess) onSuccess()
    } catch {
      setErrText(t.verify_error || 'Error')
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-5 pointer-events-none"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md pointer-events-auto"
            style={{ zIndex: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
            style={{ zIndex: 10 }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-extrabold text-emerald-900">{title}</h3>
                </div>
                <p className="text-xs text-emerald-800/60 mt-2">{body}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-eq-cream flex items-center justify-center flex-shrink-0"
                aria-label={t.pin_cancel}
              >
                <X className="w-5 h-5 text-eq-ink/60" />
              </button>
            </div>

            {/* PIN dots */}
            <div className="px-5 py-3 flex justify-center gap-3">
              {[0,1,2,3].map(i => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    activeValue.length > i ? 'bg-emerald-500 scale-110' : 'bg-eq-cream'
                  }`}
                />
              ))}
            </div>

            {errText && (
              <div className="px-5 pb-1 text-center text-red-500 text-xs font-bold">
                {errText}
              </div>
            )}

            {/* Numeric keypad */}
            <div className="px-5 py-3 grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button key={d}
                  onClick={() => handleDigit(d)}
                  disabled={busy}
                  className="h-14 rounded-2xl bg-eq-cream/60 hover:bg-eq-cream text-eq-ink text-2xl font-extrabold active:scale-[0.97] transition-all disabled:opacity-50"
                >{d}</button>
              ))}
              <div />
              <button
                onClick={() => handleDigit('0')}
                disabled={busy}
                className="h-14 rounded-2xl bg-eq-cream/60 hover:bg-eq-cream text-eq-ink text-2xl font-extrabold active:scale-[0.97] transition-all disabled:opacity-50"
              >0</button>
              <button
                onClick={handleDel}
                disabled={busy}
                className="h-14 rounded-2xl bg-eq-cream/30 hover:bg-eq-cream/60 text-eq-ink/70 active:scale-[0.97] flex items-center justify-center disabled:opacity-50"
                aria-label="Delete"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pb-4 text-center text-[10px] text-eq-ink/40">
              {mode !== 'set' && t.pin_forgot}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default PinModal
