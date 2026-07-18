'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { strings, SUPPORTED_LANGS } from './strings'

const LangContext = createContext({
  lang: 'ms',
  dir: 'ltr',
  setLang: () => {},
  t: strings.ms,
})

const STORAGE_KEY = 'eqrel-lang'

// Detect from browser: returns a supported code or null
function detectBrowserLang() {
  try {
    const langs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || []
    for (const raw of langs) {
      if (!raw) continue
      const low = String(raw).toLowerCase()
      const base = low.split('-')[0]
      // Direct map
      if (base === 'ms') return 'ms'
      if (base === 'id') return 'id'
      if (base === 'ar') return 'ar'
      if (base === 'en') return 'en'
    }
  } catch (e) {}
  return null
}

function dirOf(code) {
  const entry = SUPPORTED_LANGS.find((L) => L.code === code)
  return entry?.dir || 'ltr'
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('ms')

  // On mount: load saved, else auto-detect from browser
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && strings[saved]) {
        setLangState(saved)
        return
      }
      const detected = detectBrowserLang()
      if (detected && strings[detected]) {
        setLangState(detected)
        // Do not persist auto-detected value — let explicit user choice persist
      }
    } catch (e) {}
  }, [])

  // Reflect on <html lang> and <html dir>
  useEffect(() => {
    try {
      document.documentElement.lang = lang
      document.documentElement.dir = dirOf(lang)
    } catch (e) {}
  }, [lang])

  const setLang = useCallback((next) => {
    if (!strings[next]) return
    setLangState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch (e) {}
  }, [])

  const value = {
    lang,
    dir: dirOf(lang),
    setLang,
    t: strings[lang] || strings.ms,
  }
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}

export { SUPPORTED_LANGS }
