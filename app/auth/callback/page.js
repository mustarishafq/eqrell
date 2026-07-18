'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Sedang mengesahkan…')
  const [error, setError] = useState(null)

  useEffect(() => {
    async function handle() {
      try {
        // Emergent auth returns session_id in URL fragment (#session_id=xxx)
        const hash = window.location.hash
        let sessionId = null
        if (hash) {
          const params = new URLSearchParams(hash.replace(/^#/, ''))
          sessionId = params.get('session_id')
        }
        // Fallback: also check query param
        if (!sessionId) sessionId = searchParams.get('session_id')

        if (!sessionId) {
          throw new Error('Tiada session_id daripada Emergent auth')
        }

        setStatus('Menyediakan akaun anda…')

        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal log masuk')

        // Clean hash from URL
        window.history.replaceState(null, '', window.location.pathname)

        const next = searchParams.get('next') || '/'
        if (data.needsFamilySetup) {
          router.replace('/family/setup')
        } else {
          router.replace(next)
        }
      } catch (e) {
        setError(e.message || 'Ralat tidak diketahui')
      }
    }
    handle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-emerald-50 to-amber-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
        {!error ? (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
            <p className="text-emerald-900 font-bold">{status}</p>
            <p className="text-emerald-800/60 text-xs mt-1">Sekejap sahaja…</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-700 font-bold mb-2">Log masuk gagal</p>
            <p className="text-red-600/80 text-sm mb-4">{error}</p>
            <button
              onClick={() => router.replace('/login')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl"
            >
              Cuba lagi
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center">Memuatkan…</div>}>
      <CallbackInner />
    </Suspense>
  )
}
