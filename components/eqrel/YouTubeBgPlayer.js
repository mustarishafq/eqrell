'use client'

import { useEffect, useRef, useState } from 'react'
import { parseYouTubeUrl, buildYouTubeEmbedUrl } from '@/lib/youtube'

/**
 * Hidden background audio player — DUAL mode.
 *
 * MODE A (preferred for weak TVs like Android China):
 *   - URL ends in .mp3/.ogg/.wav/.m4a/.aac  → use HTML5 <audio> directly.
 *   - Zero iframe overhead, ~90% lighter than YouTube iframe. No buffering.
 *
 * MODE B (fallback):
 *   - YouTube video/playlist URL → use YT Iframe API.
 *   - Forces quality='small' (audio-only bandwidth).
 *
 * Both modes support duckForAzan (auto-pause during azan/pre-azan chime).
 *
 * Props:
 *  url: string  (any URL — auto-detects mode)
 *  enabled: bool
 *  volume: number (0-100)
 *  audioUnlocked: bool (user gesture required first — browser autoplay policy)
 *  duckForAzan: bool (pause playback when azan plays; resume after)
 */
const AUDIO_EXT_RE = /\.(mp3|ogg|wav|m4a|aac|opus)(\?|#|$)/i

function isDirectAudio(url) {
  if (!url) return false
  return AUDIO_EXT_RE.test(String(url).trim())
}

let ytApiPromise = null
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject()
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
  })
  return ytApiPromise
}

export default function YouTubeBgPlayer({ url, enabled, volume, audioUnlocked, onReady, duckForAzan = false }) {
  const directAudio = isDirectAudio(url)
  if (directAudio) {
    return (
      <DirectAudioPlayer
        url={url}
        enabled={enabled}
        volume={volume}
        audioUnlocked={audioUnlocked}
        onReady={onReady}
        duckForAzan={duckForAzan}
      />
    )
  }
  return (
    <YoutubeIframePlayer
      url={url}
      enabled={enabled}
      volume={volume}
      audioUnlocked={audioUnlocked}
      onReady={onReady}
      duckForAzan={duckForAzan}
    />
  )
}

// ═══════════ MODE A: Direct MP3/audio (lightweight — best for weak TV browsers) ═══════════
function DirectAudioPlayer({ url, enabled, volume, audioUnlocked, onReady, duckForAzan }) {
  const audioRef = useRef(null)
  const wasPlayingRef = useRef(false)

  useEffect(() => {
    if (!enabled || !audioUnlocked || !url) return
    const a = audioRef.current
    if (!a) return
    a.volume = (volume ?? 25) / 100
    a.loop = true
    a.play().then(() => {
      wasPlayingRef.current = true
      if (onReady) onReady()
    }).catch(() => { /* autoplay blocked — user must unlock */ })
    return () => { try { a.pause() } catch (_) { /* ignore */ } }
  }, [enabled, audioUnlocked, url])

  // Volume changes
  useEffect(() => {
    const a = audioRef.current
    if (a) { try { a.volume = (volume ?? 25) / 100 } catch (_) { /* ignore */ } }
  }, [volume])

  // Azan priority — pause during azan, resume after
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    try {
      if (duckForAzan) { a.pause() }
      else if (wasPlayingRef.current) { a.play().catch(() => {}) }
    } catch (_) { /* ignore */ }
  }, [duckForAzan])

  if (!enabled || !audioUnlocked || !url) return null

  return (
    <audio
      ref={audioRef}
      src={url}
      preload="auto"
      style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', bottom: 0, right: 0 }}
    />
  )
}

// ═══════════ MODE B: YouTube iframe (heavy — fallback only) ═══════════
function YoutubeIframePlayer({ url, enabled, volume, audioUnlocked, onReady, duckForAzan }) {
  const [playerId] = useState(() => `yt-bg-${Math.random().toString(36).slice(2, 9)}`)
  const playerRef = useRef(null)
  const wasPlayingRef = useRef(false)
  const parsed = parseYouTubeUrl(url)
  const embedUrl = buildYouTubeEmbedUrl(parsed)

  useEffect(() => {
    if (!enabled || !audioUnlocked || !embedUrl) return
    let mounted = true
    loadYouTubeApi().then(YT => {
      if (!mounted) return
      const el = document.getElementById(playerId)
      if (!el) return
      playerRef.current = new YT.Player(playerId, {
        events: {
          onReady: (e) => {
            e.target.setVolume(volume)
            // Force LOW quality — background audio only, no HD decode needed.
            try { e.target.setPlaybackQuality('small') } catch (_) { /* ignore */ }
            e.target.playVideo()
            wasPlayingRef.current = true
            if (onReady) onReady()
          },
          onPlaybackQualityChange: (e) => {
            try { if (e.data !== 'small') e.target.setPlaybackQuality('small') } catch (_) { /* ignore */ }
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED && parsed?.type === 'video') {
              e.target.playVideo()
            }
          },
        },
      })
    })
    return () => { mounted = false; try { playerRef.current?.destroy() } catch (_) { /* ignore */ } }
  }, [enabled, audioUnlocked, embedUrl])

  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try { playerRef.current.setVolume(volume) } catch (_) { /* ignore */ }
    }
  }, [volume])

  useEffect(() => {
    const p = playerRef.current
    if (!p || typeof p.pauseVideo !== 'function') return
    try {
      if (duckForAzan) { p.pauseVideo() }
      else if (wasPlayingRef.current) { p.playVideo() }
    } catch (_) { /* ignore */ }
  }, [duckForAzan])

  if (!enabled || !embedUrl || !audioUnlocked) return null

  return (
    <div style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', bottom: 0, right: 0, zIndex: -1 }}>
      <iframe
        id={playerId}
        src={embedUrl}
        title="EQrel background audio"
        width="1"
        height="1"
        allow="autoplay; encrypted-media"
        frameBorder="0"
      />
    </div>
  )
}
