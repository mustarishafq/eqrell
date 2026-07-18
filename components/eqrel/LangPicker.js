'use client'

import { useLang, SUPPORTED_LANGS } from '@/lib/i18n/LangProvider'

/**
 * LangPicker — pill toggle for BM/EN.
 * variant: 'pills' (large, for login screen) | 'compact' (small, for header)
 */
export function LangPicker({ variant = 'pills' }) {
  const { lang, setLang, t } = useLang()

  if (variant === 'compact') {
    return (
      <div className="inline-flex bg-white/80 backdrop-blur rounded-full p-0.5 border border-emerald-200/60 shadow-sm">
        {SUPPORTED_LANGS.map((L) => (
          <button key={L.code}
            onClick={() => setLang(L.code)}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition-all ${
              lang === L.code ? 'bg-emerald-500 text-white shadow' : 'text-emerald-800/60'
            }`}
          >
            {L.short}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/60 text-center mb-1.5">
        {t.lang_picker_label}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SUPPORTED_LANGS.map((L) => (
          <button key={L.code}
            onClick={() => setLang(L.code)}
            className={`rounded-2xl py-2.5 px-3 border-2 flex items-center justify-center gap-2 font-extrabold text-sm transition-all ${
              lang === L.code
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 scale-[1.02] shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg">{L.flag}</span>
            <span>{L.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default LangPicker
