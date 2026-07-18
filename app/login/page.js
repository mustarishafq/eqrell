'use client'

import { useState } from 'react'
import { startGoogleLogin } from '@/lib/authClient'
import { OnboardingScaffold } from '@/components/eqrel/OnboardingScaffold'
import { LangPicker } from '@/components/eqrel/LangPicker'
import { useLang } from '@/lib/i18n/LangProvider'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { t } = useLang()

  return (
    <OnboardingScaffold showMascot={true} showQuote={true} mascotSize={96}>
      {/* Language picker — prominent at top */}
      <div className="bg-white/70 backdrop-blur rounded-2xl p-3 border border-emerald-100 mb-3">
        <LangPicker variant="pills" />
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-5 border-2 border-emerald-100">
        <h2 className="text-xl font-extrabold text-emerald-900 text-center mb-1">
          {t.salam} 👋
        </h2>
        <p className="text-emerald-800/60 text-sm text-center mb-4">
          {t.login_welcome}
        </p>

        <button
          onClick={() => { setLoading(true); startGoogleLogin('/') }}
          disabled={loading}
          className="w-full bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-2xl py-3.5 px-4 flex items-center justify-center gap-3 font-bold text-gray-800 active:scale-[0.99] transition-all shadow-sm disabled:opacity-50"
        >
          {loading ? (
            <span>{t.login_connecting}</span>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{t.login_google}</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-emerald-800/50 text-center mt-4 leading-relaxed">
          {t.login_privacy}
        </p>
      </div>

      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
        <p className="text-amber-900 text-xs font-bold mb-0.5 flex items-center gap-1">
          <span>👨‍👩‍👧</span> {t.login_family_tip_title}
        </p>
        <p className="text-amber-800/80 text-[11px] leading-relaxed">
          {t.login_family_tip_body}
        </p>
      </div>
    </OnboardingScaffold>
  )
}
