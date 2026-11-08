// Family Display uses the TV web-app manifest so "Install / Add to Home" on a TV opens the display, not the phone app
export const metadata = { manifest: '/tv-manifest.json' }

export default function DisplayLayout({ children }) {
  return children
}
