'use client'

import { useLang } from '@/lib/i18n/LangProvider'

/**
 * EQrel Brand Logo — wordmark with mascot icon option
 * Uses brand colors: emerald green + golden accent
 */
export function BrandLogo({ size = 'md', showTagline = true, className = '' }) {
  const { t } = useLang()
  const sizes = {
    sm: { icon: 32,  text: 'text-xl',  tag: 'text-[10px]' },
    md: { icon: 48,  text: 'text-3xl', tag: 'text-xs' },
    lg: { icon: 72,  text: 'text-5xl', tag: 'text-sm' },
    xl: { icon: 96,  text: 'text-6xl', tag: 'text-base' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-2">
        {/* Icon mark - stylized EQ with crescent */}
        <svg width={s.icon} height={s.icon} viewBox="0 0 64 64" className="drop-shadow-sm">
          <defs>
            <linearGradient id="eqrel-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00B894" />
              <stop offset="100%" stopColor="#0F7A5A" />
            </linearGradient>
          </defs>
          {/* Rounded square background */}
          <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#eqrel-grad)" />
          {/* Crescent moon */}
          <path
            d="M42 18 A14 14 0 1 0 42 46 A11 11 0 1 1 42 18 Z"
            fill="#FFB703"
          />
          {/* Star */}
          <path
            d="M22 30 L24 34 L28 34 L25 37 L26 41 L22 39 L18 41 L19 37 L16 34 L20 34 Z"
            fill="#FFFFFF"
            opacity="0.95"
          />
        </svg>

        {/* Wordmark */}
        <div className="flex flex-col">
          <div className={`${s.text} font-black tracking-tight leading-none`}>
            <span className="text-emerald-700">EQ</span>
            <span className="text-amber-500">rel</span>
          </div>
        </div>
      </div>

      {showTagline && (
        <p className={`${s.tag} text-emerald-800/70 font-semibold mt-1.5 tracking-wide uppercase`}>
          {t.brand_tagline}
        </p>
      )}
    </div>
  )
}

export default BrandLogo
