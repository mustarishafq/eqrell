// TV routes use their own web-app manifest: landscape, full-screen, opens straight to /tv (auto-reconnects → display)
export const metadata = { manifest: '/tv-manifest.json' }

export default function TvLayout({ children }) {
  return children
}
