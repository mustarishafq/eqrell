'use client'
import { useEffect, useRef } from 'react'

/**
 * Screen Wake Lock — prevents TV/browser from entering screensaver.
 * Uses Screen Wake Lock API (Chrome 84+, Samsung Internet, Edge).
 * Fallback: silent muted video loop for older browsers.
 * Re-acquires lock on visibility change (tab focus).
 */
export function useWakeLock(enabled = true) {
  const wakeLockRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const request = async () => {
      if (cancelled) return
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch (e) { /* ignore — fallback video handles it */ }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') request()
    }

    request()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      try { wakeLockRef.current?.release() } catch { /* ignore */ }
      wakeLockRef.current = null
    }
  }, [enabled])
}
