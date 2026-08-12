'use client'

/**
 * Onboarding Scaffold — shared layout for login / family setup / other onboarding pages.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BrandLogo } from './BrandLogo'
import { LangPicker } from './LangPicker'
import { useLang } from '@/lib/i18n/LangProvider'
import { BRAND } from '@/lib/brand'

const MASCOT_URL = BRAND.mascot.default

const PARENT_QUOTES = {
  ms: [
    { text: 'Anak soleh & solehah bermula di rumah.', by: 'Doa untuk keluarga' },
    { text: 'Rutin yang berkat, hasil yang barakah.', by: 'EQrel' },
    { text: 'Setiap habits adalah sedekah untuk anak.', by: 'EQrel' },
    { text: 'Doa ibubapa adalah pagar kepada anak.', by: 'EQrel' },
    { text: 'Keluarga yang berdoa bersama, kekal bersama.', by: 'Hadis' },
    { text: 'Ibubapa adalah rumah pertama untuk hati anak.', by: 'EQrel' },
    { text: 'Setiap langkah kecil hari ini, hijrah besar esok.', by: 'EQrel' },
  ],
  en: [
    { text: 'Righteous children begin at home.', by: 'A family prayer' },
    { text: 'Blessed routines, blessed outcomes.', by: 'EQrel' },
    { text: 'Every habit is a gift you give your child.', by: 'EQrel' },
    { text: 'A parent\u2019s du\u2019a shields the child.', by: 'EQrel' },
    { text: 'The family that prays together, stays together.', by: 'Hadith' },
    { text: 'Parents are the first home for a child\u2019s heart.', by: 'EQrel' },
    { text: 'Every small step today, a great journey tomorrow.', by: 'EQrel' },
  ],
  id: [
    { text: 'Anak salih & salihah dimulai dari rumah.', by: 'Doa untuk keluarga' },
    { text: 'Rutin yang berkat, hasil yang barakah.', by: 'EQrel' },
    { text: 'Setiap kebiasaan adalah sedekah untuk anak.', by: 'EQrel' },
    { text: 'Bina kebiasaan, tumbuhkan iman.', by: 'EQrel' },
    { text: 'Keluarga yang berdoa bersama, tetap bersama.', by: 'Hadis' },
    { text: 'Orang tua adalah rumah pertama bagi hati anak.', by: 'EQrel' },
    { text: 'Setiap langkah kecil hari ini, hijrah besar esok.', by: 'EQrel' },
  ],
  ar: [
    { text: 'الأبناء الصالحون يبدؤون من البيت.', by: 'دعاء الأسرة' },
    { text: 'روتين مبارك، نتائج مباركة.', by: 'EQrel' },
    { text: 'كل عادة هدية تُهديها لطفلك.', by: 'EQrel' },
    { text: 'ابنِ عاداتك، ينمُ إيمانك.', by: 'EQrel' },
    { text: 'الأسرة التي تصلّي معاً، تبقى معاً.', by: 'حديث' },
    { text: 'الوالدان هما البيت الأول لقلب الطفل.', by: 'EQrel' },
    { text: 'خطوة صغيرة اليوم، رحلة عظيمة غداً.', by: 'EQrel' },
  ],
}

export function useDailyQuote() {
  const { lang } = useLang()
  // Compute quote only after mount to avoid SSR/client hydration mismatch
  // (server date/timezone may differ from client, and lang from localStorage
  //  isn't available at SSR time)
  const [quote, setQuote] = useState(null)
  useEffect(() => {
    const d = new Date()
    const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
    const pool = PARENT_QUOTES[lang] || PARENT_QUOTES.ms
    setQuote(pool[dayOfYear % pool.length])
  }, [lang])
  return quote
}

export function OnboardingScaffold({
  children,
  showMascot = true,
  showQuote = true,
  mascotSize = 96,
}) {
  const quote = useDailyQuote()

  return (
    <div
      className="min-h-[100dvh] w-full bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50 relative overflow-y-auto overflow-x-hidden"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 20px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
      }}
    >
      {/* Decorative bg blobs */}
      <div className="pointer-events-none absolute top-0 left-0 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-72 h-72 bg-amber-200/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative z-10 flex flex-col items-center px-5 py-6 min-h-[100dvh]">
        {/* Header — logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <BrandLogo size="md" />
        </motion.div>

        {/* Mascot */}
        {showMascot && (
          <motion.img
            src={MASCOT_URL}
            alt="EQ Companion"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="drop-shadow-2xl mt-3"
            style={{ width: mascotSize, height: mascotSize, objectFit: 'contain' }}
          />
        )}

        {/* Language picker — centered below mascot for clarity */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-3 z-30 relative"
        >
          <LangPicker variant="elegant" align="center" />
        </motion.div>

        {/* Content slot */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-md mt-4"
        >
          {children}
        </motion.div>

        {/* Motivational quote — hidden until mounted (prevents SSR/client hydration mismatch) */}
        {showQuote && quote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-auto pt-6 w-full max-w-md"
          >
            <div className="bg-white/60 backdrop-blur rounded-2xl px-4 py-3 border border-emerald-200/50 shadow-sm">
              <p className="text-emerald-900 font-bold text-sm text-center leading-snug">
                &ldquo;{quote.text}&rdquo;
              </p>
              <p className="text-emerald-700/60 text-[11px] text-center mt-1">— {quote.by}</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default OnboardingScaffold
