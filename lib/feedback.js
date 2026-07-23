// ────────────────────────────────────────────────────────────────
// EQrel — Tactile Feedback Utilities
// Provides haptic (navigator.vibrate) + tiny visual "burst" helpers.
// Sound is intentionally omitted per family preference.
//
// Usage:
//   import { haptic } from '@/lib/feedback'
//   haptic.tap()      // ~25ms — every button press
//   haptic.success()  // task completed (claim / verify sah)
//   haptic.ihsan()    // "Ihsan" — the celebratory approval
//   haptic.undo()     // undo / belum / reset
//   haptic.locked()   // action blocked
//   haptic.milestone()// all tasks done for the day
// ────────────────────────────────────────────────────────────────

// Safe wrapper — vibration is unsupported on iOS and some desktops.
// It should silently no-op there so we never throw.
const doVibrate = (pattern) => {
  if (typeof window === 'undefined') return false
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
      return true
    }
  } catch {
    // Silent — vibration API may be blocked or unsupported
  }
  return false
}

export const haptic = {
  tap:       () => doVibrate(20),                          // light acknowledgement
  select:    () => doVibrate(15),                          // menu / chip select
  success:   () => doVibrate([30, 40, 60]),                // habit claimed / verified sah
  ihsan:     () => doVibrate([25, 30, 25, 30, 90]),        // parent awards Ihsan
  undo:      () => doVibrate([15, 25, 15]),                // undo / reset
  locked:    () => doVibrate([80]),                        // blocked action (long buzz)
  milestone: () => doVibrate([40, 60, 40, 60, 40, 60, 140]) // all-done celebration
}

// ────────────────────────────────────────────────────────────────
// Visual burst — a tiny transient "+X" badge that floats upward.
// Attach to a DOM element; auto-removes itself in ~900ms.
// Zero framer-motion / zero re-renders — pure CSS keyframes.
// ────────────────────────────────────────────────────────────────
let _styleInjected = false
const ensureStyles = () => {
  if (_styleInjected || typeof document === 'undefined') return
  _styleInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-eqrel-feedback', '1')
  style.textContent = `
    @keyframes eqrelBurstFloat {
      0%   { transform: translate(-50%, 0)     scale(0.6); opacity: 0; }
      15%  { transform: translate(-50%, -10px) scale(1.15); opacity: 1; }
      100% { transform: translate(-50%, -80px) scale(1);   opacity: 0; }
    }
    @keyframes eqrelRingPulse {
      0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; }
      100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0;   }
    }
    .eqrel-burst-badge {
      position: fixed;
      transform: translate(-50%, 0);
      pointer-events: none;
      font-weight: 900;
      font-size: 16px;
      padding: 5px 12px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      box-shadow: 0 6px 16px rgba(16,185,129,0.4);
      animation: eqrelBurstFloat 950ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      white-space: nowrap;
      z-index: 9999;
    }
    .eqrel-burst-badge.ihsan {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      box-shadow: 0 6px 16px rgba(245,158,11,0.5);
    }
    .eqrel-burst-ring {
      position: fixed;
      width: 70px;
      height: 70px;
      border-radius: 9999px;
      border: 3px solid #10b981;
      pointer-events: none;
      animation: eqrelRingPulse 750ms ease-out forwards;
      z-index: 9998;
    }
    .eqrel-burst-ring.ihsan { border-color: #f59e0b; }
  `
  document.head.appendChild(style)
}

/**
 * Show a floating "+points" badge + pulse ring anchored to `el`.
 * Renders into document.body using fixed positioning so it survives
 * any React re-render / list re-order.
 *
 * @param {HTMLElement} el  – anchor element (used only to compute position)
 * @param {object} opts
 *   text: string     – e.g. "+10"
 *   variant: 'success'|'ihsan'
 */
export const showBurst = (el, opts = {}) => {
  if (!el || typeof document === 'undefined') return
  ensureStyles()

  const variant = opts.variant === 'ihsan' ? 'ihsan' : 'success'
  const text = opts.text || '+1'

  // Compute anchor position (viewport coords) at click time
  const rect = el.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const topAnchorY = rect.top + Math.min(20, rect.height * 0.25)

  const ring = document.createElement('div')
  ring.className = `eqrel-burst-ring ${variant}`
  ring.style.left = `${centerX}px`
  ring.style.top  = `${centerY}px`
  document.body.appendChild(ring)
  setTimeout(() => ring.remove(), 800)

  const badge = document.createElement('div')
  badge.className = `eqrel-burst-badge ${variant}`
  badge.textContent = text
  badge.style.left = `${centerX}px`
  badge.style.top  = `${topAnchorY}px`
  document.body.appendChild(badge)
  setTimeout(() => badge.remove(), 1000)
}

export default haptic
