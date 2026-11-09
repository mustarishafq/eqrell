'use client'
// Refresh helpers: auto-refresh (on return to the app + every N seconds), pull-to-refresh, and a refresh button.
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

/** Calls fn when the app comes back to the foreground, and every `intervalMs` while visible. */
export function useAutoRefresh(fn, intervalMs = 20000) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn }, [fn])
  useEffect(() => {
    let last = Date.now()
    const run = () => { if (document.visibilityState === 'visible' && Date.now() - last > 3000) { last = Date.now(); ref.current?.() } }
    const onVis = () => run()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    window.addEventListener('online', onVis)
    const t = intervalMs ? setInterval(run, intervalMs) : null
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
      window.removeEventListener('online', onVis)
      if (t) clearInterval(t)
    }
  }, [intervalMs])
}

/**
 * Pull-to-refresh on a scroll container (or the window when ref is null).
 * Returns { pull (0..1), refreshing, refresh } — render <PullIndicator {...} />.
 */
export function usePullToRefresh(scrollRef, onRefresh, { threshold = 70 } = {}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const fnRef = useRef(onRefresh)
  useEffect(() => { fnRef.current = onRefresh }, [onRefresh])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try { await fnRef.current?.() } catch { /* ignore */ }
    finally { setTimeout(() => setRefreshing(false), 400) }
  }, [])

  useEffect(() => {
    const el = scrollRef?.current || window
    const topOf = () => (scrollRef?.current ? scrollRef.current.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0))
    let startY = null, dist = 0
    const onStart = (e) => { if (topOf() <= 0 && e.touches?.length === 1) { startY = e.touches[0].clientY; dist = 0 } else startY = null }
    const onMove = (e) => {
      if (startY == null) return
      dist = e.touches[0].clientY - startY
      if (dist <= 0 || topOf() > 0) { setPull(0); return }
      setPull(Math.min(1, dist / threshold))
    }
    const onEnd = () => {
      if (startY != null && dist >= threshold) refresh()
      startY = null; dist = 0; setPull(0)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollRef, threshold, refresh])

  return { pull, refreshing, refresh }
}

/** Small floating indicator shown while pulling / refreshing. */
export function PullIndicator({ pull = 0, refreshing = false, label = 'Refreshing…' }) {
  if (!refreshing && pull <= 0.05) return null
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[120] pointer-events-none" data-testid="pull-indicator"
      style={{ transform: `translate(-50%, ${refreshing ? 8 : pull * 24}px)`, opacity: refreshing ? 1 : pull }}>
      <div className="flex items-center gap-1.5 rounded-full bg-white shadow-lg border border-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">
        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} style={!refreshing ? { transform: `rotate(${pull * 270}deg)` } : undefined} />
        {refreshing ? label : (pull >= 1 ? '↓' : '')}
      </div>
    </div>
  )
}

/** Round refresh button (spins while working). */
export function RefreshButton({ onClick, refreshing = false, className = '', label = 'Refresh', testId = 'refresh-btn' }) {
  return (
    <button onClick={onClick} disabled={refreshing} aria-label={label} title={label} data-testid={testId}
      className={`w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-md border border-emerald-100 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-70 ${className}`}>
      <RefreshCw className={`w-4.5 h-4.5 text-emerald-700 ${refreshing ? 'animate-spin' : ''}`} style={{ width: 18, height: 18 }} />
    </button>
  )
}
