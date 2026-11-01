'use client'

import { useEffect } from 'react'
import { LangProvider } from '@/lib/i18n/LangProvider'
import { bootPwa } from '@/lib/pwaInstall'

export function Providers({ children }) {
  // Capture the browser's install event as early as possible (any page) + register the service worker
  useEffect(() => { bootPwa() }, [])
  return (
    <LangProvider>
      {children}
    </LangProvider>
  )
}
