'use client'

import { useEffect, useRef, useState } from 'react'
import { parseYouTubeUrl, buildYouTubeEmbedUrl } from '@/lib/youtube'

/**
 * Hidden YouTube background audio player using Iframe API.
 *
 * Props:
 *  url: string  (YouTube video or playlist URL)
 *  enabled: bool
 *  volume: number (0-100)
 *  audioUnlocked: bool (parent must unlock audio via user gesture first — same flow as azan)
 *
 * Renders a 1x1 invisible iframe. Uses YT.Player API for volume/mute control.
 */
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

export default function YouTubeBgPlayer({ url, enabled, volume, audioUnlocked, onReady }) {
  const [playerId] = useState(() => `yt-bg-${Math.random().toString(36).slice(2, 9)}`)
  const playerRef = useRef(null)
  const parsed = parseYouTubeUrl(url)
  const embedUrl = buildYouTubeEmbedUrl(parsed)

  useEffect(() => {
    if (!enabled || !audioUnlocked || !embedUrl) return
    let mounted = true
    loadYouTubeApi().then(YT => {
      if (!mounted) return
      // Wait for DOM
      const el = document.getElementById(playerId)
      if (!el) return
      playerRef.current = new YT.Player(playerId, {
        events: {
          onReady: (e) => {
            e.target.setVolume(volume)
            e.target.playVideo()
            if (onReady) onReady()
          },
          onStateChange: (e) => {
            // If ended (single video without loop), replay
            if (e.data === YT.PlayerState.ENDED && parsed?.type === 'video') {
              e.target.playVideo()
            }
          },
        },
      })
    })
    return () => { mounted = false; try { playerRef.current?.destroy() } catch (e) { /* ignore */ } }
  }, [enabled, audioUnlocked, embedUrl])

  // Volume changes
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try { playerRef.current.setVolume(volume) } catch (e) { /* ignore */ }
    }
  }, [volume])

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
