import './globals.css'
import { Providers } from './providers'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const SHARE_TITLE = 'EQrel — Build Good Habits, Grow Iman'
const SHARE_DESC = 'Kids build good habits while building their own Islamic world. For Muslim families with children aged 3–12.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'EQrel',
  description: SHARE_DESC,
  applicationName: 'EQrel',
  openGraph: {
    type: 'website',
    siteName: 'EQrel',
    locale: 'en_US',
    url: '/',
    title: SHARE_TITLE,
    description: SHARE_DESC,
    images: [{ url: '/og-image.jpg?v=2', width: 1200, height: 630, alt: "EQrel — a child's Islamic village that grows with every good habit" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESC,
    images: ['/og-image.jpg?v=2'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EQrel',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport = {
  themeColor: '#00B894',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  // Inline script runs BEFORE hydration to set <html lang dir> from saved locale or browser
  // preference. Prevents visible flash when user has Arabic (RTL) saved. Kept minimal and safe.
  const preHydrateLangScript = `
try {
  var STORAGE_KEY = 'eqrel-lang';
  var SUPPORTED = { ms: 'ltr', en: 'ltr', id: 'ltr', ar: 'rtl' };
  var chosen = null;
  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  if (saved && SUPPORTED[saved]) chosen = saved;
  if (!chosen) chosen = 'en';
  document.documentElement.lang = chosen;
  document.documentElement.dir = SUPPORTED[chosen] || 'ltr';
} catch (e) {}
`

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="EQrel" />
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
        <script dangerouslySetInnerHTML={{ __html: preHydrateLangScript }} />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
