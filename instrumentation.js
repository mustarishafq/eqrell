/**
 * Next.js instrumentation hook — runs ONCE per Node.js server worker startup.
 * We use it to PRE-WARM the on-demand compilation of critical routes so the
 * first real user visit never hits the 2-6s Turbopack cold-compile penalty.
 *
 * Fires only on the Node.js runtime (not edge). Uses global fetch (Node 18+).
 * Non-blocking: kicks off requests and lets them run in background.
 *
 * Zero visual/functional impact — this only causes Next.js to compile routes
 * ahead of user demand. Safe to keep on/off any time.
 */

export async function register() {
  // Guard: only run on the main Node.js server (avoid edge runtime).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Delay so the HTTP server is actually listening before we curl ourselves.
  const DELAY_MS = 1500

  const routes = [
    '/',
    '/login',
    '/kid',
    '/world',
    '/display',
    '/display/setup',
    '/api/family/prayer-times',
    '/api/family/display-config',
  ]

  // Self-URL — Next.js binds 0.0.0.0:3000 via supervisor, but localhost works.
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`

  const warm = async () => {
    const t0 = Date.now()
    // Fire in parallel but don't await individually — we just want to trigger
    // route compilation. HEAD would be ideal but Next dev may not fully compile
    // on HEAD; GET is safe.
    const promises = routes.map(async (path) => {
      try {
        // Short timeout — if a route is very slow it still gets started
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 25000)
        const res = await fetch(base + path, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'x-prewarm': '1', 'accept': 'text/html' },
        })
        clearTimeout(timeout)
        return { path, status: res.status, ms: Date.now() - t0 }
      } catch (e) {
        return { path, error: e.message, ms: Date.now() - t0 }
      }
    })
    const results = await Promise.allSettled(promises)
    const summary = results
      .map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message }))
      .map((v) => (v.error ? `${v.path || '?'}❌${v.error}` : `${v.path}✓${v.ms}ms`))
      .join(' | ')
    console.log(`[prewarm] Completed in ${Date.now() - t0}ms — ${summary}`)
  }

  setTimeout(() => {
    warm().catch((err) => console.log('[prewarm] error:', err?.message))
  }, DELAY_MS)

  console.log(`[prewarm] Scheduled ${routes.length} routes to warm in ${DELAY_MS}ms`)
}
