/**
 * EQrel Audio Manager
 * ─────────────────────────────────────────────────────────────────
 * Lightweight, browser-safe audio player for pedagogical sound cues
 * (Bismillah on action-start, Alhamdulillah on action-completion).
 *
 * Design goals:
 * 1. Client-only — no server calls (module guards typeof window checks).
 * 2. Respects the browser autoplay policy: the first `play()` may fail
 *    silently before user has interacted; audio auto-primes on the first
 *    interaction (pointerdown/keydown) via `primeAudio()`.
 * 3. Persistent mute preference in localStorage (`eqrel-audio-muted`) so
 *    parents can silence the world during quiet hours (naps, prayers).
 * 4. Volume default 60% — never blasting.
 * 5. Concurrent-play guard: if the SAME cue is triggered while it's still
 *    playing, we restart it (feels responsive) rather than layer copies.
 * 6. Different cues can overlap (a Bismillah + Alhamdulillah could
 *    conceivably queue on top of each other during rapid rebuilds; that's
 *    fine and even musical — no forced dedupe across cue types).
 * 7. Preloads on first interaction — no bandwidth wasted for muted users
 *    or SSR crawlers.
 */

const AUDIO_KEYS = {
  bismillah:      '/audio/Bismillah.mp3',
  alhamdulillah:  '/audio/Alhamdulillah.mp3',
  astaghfirullah: '/audio/Astaghfirullah.mp3',
}

// Module-level singletons (survive across React renders)
const _elements = /** @type {Record<string, HTMLAudioElement>} */ ({})
let _primed = false
let _muted  = null // resolved from localStorage on first read

// ─── Persistence ────────────────────────────────────────────────
export function isMuted() {
  if (typeof window === 'undefined') return true
  if (_muted !== null) return _muted
  try { _muted = window.localStorage.getItem('eqrel-audio-muted') === '1' } catch { _muted = false }
  return _muted
}

export function setMuted(v) {
  _muted = !!v
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem('eqrel-audio-muted', v ? '1' : '0') } catch { /* private mode */ }
  // Notify subscribers so UI toggles can update
  window.dispatchEvent(new CustomEvent('eqrel-audio-muted-changed', { detail: { muted: !!v } }))
}

export function toggleMuted() {
  const next = !isMuted()
  setMuted(next)
  return next
}

// ─── Element factory ────────────────────────────────────────────
function _getEl(key) {
  if (typeof window === 'undefined') return null
  if (_elements[key]) return _elements[key]
  const src = AUDIO_KEYS[key]
  if (!src) return null
  const el = new window.Audio(src)
  el.preload = 'auto'
  el.volume = 0.6
  // Suppress unhandled promise rejections from autoplay failures
  el.addEventListener('error', () => { /* ignore load errors — fallback to silent */ })
  _elements[key] = el
  return el
}

// ─── Prime (call once on first user interaction) ────────────────
/**
 * Browsers block audio until the user interacts. Call this from a click/tap
 * handler once at app start — it does a silent play/pause round-trip to
 * "unlock" the audio elements so subsequent calls from non-interaction
 * contexts (e.g., after a 6-second build animation completes) will succeed.
 */
export function primeAudio() {
  if (typeof window === 'undefined' || _primed) return
  _primed = true
  for (const key of Object.keys(AUDIO_KEYS)) {
    const el = _getEl(key)
    if (!el) continue
    // Attempt silent priming: set muted, play, pause immediately, then unmute.
    const prevMuted = el.muted
    el.muted = true
    const p = el.play()
    if (p && typeof p.then === 'function') {
      p.then(() => { el.pause(); el.currentTime = 0; el.muted = prevMuted })
       .catch(() => { el.muted = prevMuted /* still fine; will retry on user gesture */ })
    } else {
      try { el.pause(); el.currentTime = 0 } catch { /* noop */ }
      el.muted = prevMuted
    }
  }
}

// ─── Play a cue ─────────────────────────────────────────────────
/**
 * Play a named audio cue. Silently no-ops if:
 * - User has muted audio globally
 * - Browser is SSR
 * - The MP3 hasn't loaded yet (best-effort; browser will still try)
 *
 * @param {'bismillah' | 'alhamdulillah'} key
 * @param {object} [opts]
 * @param {number} [opts.volume]  0..1 (default 0.6)
 */
export function play(key, opts = {}) {
  if (typeof window === 'undefined') return
  if (isMuted()) return
  const el = _getEl(key)
  if (!el) return
  try {
    if (typeof opts.volume === 'number') el.volume = Math.max(0, Math.min(1, opts.volume))
    // Restart if same cue is still playing — feels more responsive than
    // waiting for the previous instance to finish.
    el.currentTime = 0
    const p = el.play()
    if (p && typeof p.catch === 'function') p.catch(() => { /* browser blocked; ignore */ })
  } catch { /* teardown or race */ }
}

// ─── Convenience shortcuts ──────────────────────────────────────
export const bismillah      = () => play('bismillah')
export const alhamdulillah  = () => play('alhamdulillah')
export const astaghfirullah = () => play('astaghfirullah')

// ─── Global auto-prime on first pointer/keydown ─────────────────
/**
 * Install a one-shot listener that primes audio on the FIRST user
 * interaction anywhere on the page. Call from a top-level client
 * component (mount effect). Safe to call multiple times — it de-dupes.
 */
export function installAutoPrime() {
  if (typeof window === 'undefined' || _primed) return
  const onFirst = () => {
    primeAudio()
    window.removeEventListener('pointerdown', onFirst, true)
    window.removeEventListener('keydown', onFirst, true)
    window.removeEventListener('touchstart', onFirst, true)
  }
  window.addEventListener('pointerdown', onFirst, true)
  window.addEventListener('keydown', onFirst, true)
  window.addEventListener('touchstart', onFirst, true)
}

const audio = { play, bismillah, alhamdulillah, astaghfirullah, isMuted, setMuted, toggleMuted, primeAudio, installAutoPrime }
export default audio
