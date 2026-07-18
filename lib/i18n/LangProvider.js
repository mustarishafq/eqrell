'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { strings, SUPPORTED_LANGS } from './strings'

const LangContext = createContext({
  lang: 'ms',
  setLang: () => {},
  t: strings.ms,
})

const STORAGE_KEY = 'eqrel-lang'

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('ms')

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && strings[saved]) setLangState(saved)
      // else default 'ms'
    } catch (e) {}
  }, [])

  // Reflect on <html lang>
  useEffect(() => {
    try { document.documentElement.lang = lang } catch (e) {}
  }, [lang])

  const setLang = useCallback((next) => {
    if (!strings[next]) return
    setLangState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch (e) {}
  }, [])

  const value = {
    lang,
    setLang,
    t: strings[lang] || strings.ms,
  }
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}

export { SUPPORTED_LANGS }
