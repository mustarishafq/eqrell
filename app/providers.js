'use client'

import { LangProvider } from '@/lib/i18n/LangProvider'

export function Providers({ children }) {
  return (
    <LangProvider>
      {children}
    </LangProvider>
  )
}
