/**
 * YouTube URL parser + embed URL builder.
 * Supports:
 *  - Video: https://www.youtube.com/watch?v=XXXX  or https://youtu.be/XXXX
 *  - Playlist: https://www.youtube.com/playlist?list=PLXXXX
 *  - Watch-in-playlist: https://www.youtube.com/watch?v=XXXX&list=PLXXXX
 */

const YT_VIDEO_ID_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const YT_PLAYLIST_ID_RE = /[?&]list=([a-zA-Z0-9_-]+)/

export const parseYouTubeUrl = (raw) => {
  if (!raw) return null
  const url = String(raw).trim()
  const videoMatch = url.match(YT_VIDEO_ID_RE)
  const playlistMatch = url.match(YT_PLAYLIST_ID_RE)
  if (playlistMatch) {
    return { type: 'playlist', playlistId: playlistMatch[1], videoId: videoMatch ? videoMatch[1] : null }
  }
  if (videoMatch) {
    return { type: 'video', videoId: videoMatch[1] }
  }
  return null
}

/**
 * Build a YouTube embed URL that:
 *  - autoplays
 *  - loops (single-video needs playlist=VIDEO_ID trick; playlist auto-loops with loop=1)
 *  - hides controls / branding
 *  - enables JS API for volume control
 */
export const buildYouTubeEmbedUrl = (parsed) => {
  if (!parsed) return null
  const common = 'autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&enablejsapi=1'
  if (parsed.type === 'playlist') {
    return `https://www.youtube.com/embed/videoseries?list=${parsed.playlistId}&loop=1&${common}`
  }
  // Single video — use playlist=VIDEO_ID for looping
  return `https://www.youtube.com/embed/${parsed.videoId}?loop=1&playlist=${parsed.videoId}&${common}`
}
