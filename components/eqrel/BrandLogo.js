'use client'

/**
 * EQrel Brand Logo — image-based wordmark.
 * Asset already contains the tagline "BUILD HABITS. GROW IMAN." so we DO NOT
 * render any additional tagline text on top of it. `showTagline` prop kept
 * for API backward-compat but is a no-op.
 */
export function BrandLogo({ size = 'md', showTagline = false, className = '' }) {
  // Native asset aspect ratio: 724 × 241 ≈ 3.003 : 1
  const sizes = {
    sm: { w: 132, h: 44 },
    md: { w: 192, h: 64 },
    lg: { w: 264, h: 88 },
    xl: { w: 336, h: 112 },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="/assets/brand/eqrel_logo.webp"
        alt="EQrel"
        width={s.w}
        height={s.h}
        style={{ width: s.w, height: 'auto', maxWidth: '100%' }}
        className="drop-shadow-sm select-none"
        draggable={false}
      />
    </div>
  )
}

export default BrandLogo
