'use client'

import { useEffect, useRef, useState } from 'react'
import { Tv, ExternalLink, RefreshCw } from 'lucide-react'

/**
 * TVPreview — renders /display inside a landscape 16:9 iframe scaled to container width.
 *
 * The iframe is loaded at native TV resolution (1920x1080), then CSS-transformed to fit.
 * Cookies are inherited (same-origin), so the iframe shows the family's real data.
 *
 * Props:
 *   src?: string  (default '/display?preview=1&tv=1')
 *   reloadKey?: any  (change to force iframe reload — useful after save)
 *   showOpenBtn?: bool
 *   label?: string
 */
export default function TVPreview({
  src = '/display?preview=1&tv=1',
  reloadKey = 0,
  showOpenBtn = true,
  label = 'TV Preview',
}) {
  const containerRef = useRef(null)
  const iframeRef = useRef(null)
  const [scale, setScale] = useState(0.2)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        setScale(width / 1920)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Force iframe reload when reloadKey changes
  useEffect(() => {
    if (reloadKey) setNonce(n => n + 1)
  }, [reloadKey])

  // ═══════════════════════════════════════════════════════════════════
  // MacBook/Safari wheel fix — iframe with `pointer-events: none` does
  // NOT reliably let wheel/trackpad scroll bubble to parent on macOS
  // Safari & Chrome (known WebKit/Blink quirk). Overlay <div> on top of
  // iframe helps for mouse-wheel but macOS trackpad may still route the
  // wheel directly into the iframe. Since /display is same-origin, we
  // reach into the iframe's contentWindow on `load` and attach a wheel
  // listener there that forwards deltaY back to the parent via
  // `window.scrollBy`. This is the only 100% reliable pattern across
  // Safari macOS, Chrome macOS, Firefox, and Chromium mobile.
  // ═══════════════════════════════════════════════════════════════════
  const attachIframeWheelForward = () => {
    try {
      const iframe = iframeRef.current
      if (!iframe) return
      const doc = iframe.contentDocument
      const win = iframe.contentWindow
      if (!doc || !win) return
      const forward = (e) => {
        try {
          // Best-effort: mimic wheel scrolling the parent page
          window.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: 'auto' })
          e.preventDefault()
          e.stopPropagation()
        } catch (_) {}
      }
      // Non-passive so we can preventDefault the iframe's internal scroll
      doc.addEventListener('wheel', forward, { passive: false, capture: true })
      // Also handle touchmove on iOS Safari desktop-mode
      const touchStart = { y: 0 }
      doc.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) touchStart.y = e.touches[0].clientY
      }, { passive: true, capture: true })
      doc.addEventListener('touchmove', (e) => {
        try {
          if (!e.touches || !e.touches[0]) return
          const dy = touchStart.y - e.touches[0].clientY
          touchStart.y = e.touches[0].clientY
          window.scrollBy({ top: dy, left: 0, behavior: 'auto' })
        } catch (_) {}
      }, { passive: true, capture: true })
    } catch (_) {
      // cross-origin (shouldn't happen — same origin) or timing issue
    }
  }

  const reload = () => setNonce(n => n + 1)
  const openInNewTab = () => window.open(src.replace('&preview=1', '').replace('preview=1&', '').replace('preview=1', ''), '_blank')

  const iframeSrc = `${src}${src.includes('?') ? '&' : '?'}_n=${nonce}`

  return (
    <div className="w-full">
      {/* Frame + controls */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-emerald-800/70">
          <Tv className="w-3 h-3" /> {label}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={reload} title="Refresh"
            className="w-7 h-7 rounded-lg bg-eq-cream hover:bg-emerald-100 flex items-center justify-center">
            <RefreshCw className="w-3 h-3 text-emerald-700" />
          </button>
          {showOpenBtn && (
            <button onClick={openInNewTab} title="Open full"
              className="w-7 h-7 rounded-lg bg-eq-cream hover:bg-emerald-100 flex items-center justify-center">
              <ExternalLink className="w-3 h-3 text-emerald-700" />
            </button>
          )}
        </div>
      </div>

      {/* TV bezel container — 16:9 aspect */}
      <div className="relative w-full rounded-xl shadow-2xl overflow-hidden bg-slate-800 p-1.5">
        <div ref={containerRef}
          className="relative w-full rounded-lg overflow-hidden bg-slate-950"
          style={{ aspectRatio: '16 / 9' }}>
          {/* Scaled iframe */}
          <div
            className="origin-top-left"
            style={{
              width: '1920px',
              height: '1080px',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              pointerEvents: 'none', // Prevent interaction (preview only)
            }}
          >
            <iframe
              ref={iframeRef}
              key={nonce}
              src={iframeSrc}
              width="1920"
              height="1080"
              className="border-0 block bg-slate-950"
              title={label}
              sandbox="allow-scripts allow-same-origin"
              scrolling="no"
              onLoad={attachIframeWheelForward}
              style={{ pointerEvents: 'none' }}
            />
          </div>
          {/* Transparent overlay — swallows pointer/wheel events so the page can
              still be scrolled by mouse wheel when the cursor is over the
              preview iframe (iframe would otherwise capture the wheel).
              onWheel handler manually scrolls the outer page. */}
          <div
            aria-hidden="true"
            onWheel={(e) => {
              // Forward wheel to window scroll so parent page still scrolls
              window.scrollBy({ top: e.deltaY, left: 0, behavior: 'auto' })
            }}
            onTouchMove={(e) => { /* allow native touch scroll to pass */ }}
            className="absolute inset-0 z-10 cursor-default"
            style={{ background: 'transparent' }}
          />
        </div>
      </div>
    </div>
  )
}
