'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share, Plus, Download, Sparkles } from 'lucide-react'

const DISMISS_KEY = 'eqrel-install-dismissed'
const DISMISS_DAYS = 3

export function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [platform, setPlatform] = useState('other') // 'ios' | 'android' | 'other'

  useEffect(() => {
    // Skip if already installed as PWA
    if (typeof window === 'undefined') return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (window.navigator.standalone === true) return // iOS Safari standalone

    // Check dismiss cooldown
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (daysSince < DISMISS_DAYS) return
    }

    // Detect platform
    const ua = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(ua) && !window.MSStream
    const isAndroid = /android/.test(ua)

    if (isIOS) setPlatform('ios')
    else if (isAndroid) setPlatform('android')

    // Listen for install prompt event (Android/Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Show prompt after 3 seconds delay (let user see dashboard first)
    const timer = setTimeout(() => setVisible(true), 3000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setVisible(false)
    setShowTutorial(false)
  }

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowTutorial(true)
      return
    }
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
      }
      setDeferredPrompt(null)
    } else {
      // Fallback: show tutorial for android too
      setShowTutorial(true)
    }
  }

  return (
    <>
      <AnimatePresence>
        {visible && !showTutorial && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-20 inset-x-3 z-50 max-w-md mx-auto"
          >
            <div className="bg-gradient-to-br from-eq-green to-emerald-600 text-white rounded-2xl shadow-2xl p-3 pr-2 flex items-center gap-3 border-2 border-white/20">
              <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-eq-yellow" fill="#FFB703" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-sm leading-tight">Pasang EQrel</div>
                <div className="text-white/85 text-[11px] leading-tight mt-0.5">
                  Pengalaman terbaik di skrin utama ✨
                </div>
              </div>
              <button
                onClick={handleInstall}
                className="bg-eq-yellow text-eq-ink font-bold text-xs px-3 py-2 rounded-xl shadow active:scale-95 flex-shrink-0"
              >
                Pasang
              </button>
              <button
                onClick={dismiss}
                className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white flex-shrink-0"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Tutorial Modal */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowTutorial(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-eq-ink font-extrabold text-xl">Pasang EQrel</h3>
                  <p className="text-eq-ink/60 text-sm mt-0.5">
                    {platform === 'ios' ? 'Untuk iPhone / iPad' : 'Untuk peranti anda'}
                  </p>
                </div>
                <button
                  onClick={() => setShowTutorial(false)}
                  className="w-8 h-8 rounded-full hover:bg-eq-cream flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-eq-ink/60" />
                </button>
              </div>

              <div className="space-y-3 mt-4">
                {platform === 'ios' ? (
                  <>
                    <Step num="1" text="Tap butang" icon={<Share className="w-5 h-5" />} suffix="Share di bawah skrin" />
                    <Step num="2" text="Scroll & pilih" icon={<Plus className="w-5 h-5" />} suffix='"Add to Home Screen"' />
                    <Step num="3" text='Tap "Add" untuk pasang EQrel' />
                  </>
                ) : (
                  <>
                    <Step num="1" text="Buka menu Chrome" suffix="(butang ⋮ di penjuru atas)" />
                    <Step num="2" text='Pilih "Install app"' icon={<Download className="w-5 h-5" />} suffix='atau "Add to Home Screen"' />
                    <Step num="3" text='Tap "Install" untuk pasang EQrel' />
                  </>
                )}
              </div>

              <div className="mt-5 bg-eq-cream/60 rounded-xl p-3">
                <p className="text-eq-ink/80 text-xs leading-relaxed">
                  <strong className="text-eq-green">Alhamdulillah</strong> — selepas pasang, EQrel akan buka fullscreen tanpa toolbar, seperti app biasa ✨
                </p>
              </div>

              <button
                onClick={dismiss}
                className="w-full mt-4 bg-eq-green text-white font-bold py-3 rounded-xl active:scale-95"
              >
                Faham, terima kasih
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const Step = ({ num, text, icon, suffix }) => (
  <div className="flex items-start gap-3">
    <div className="w-7 h-7 rounded-full bg-eq-green text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0">
      {num}
    </div>
    <div className="text-eq-ink text-sm leading-snug pt-0.5">
      {text}
      {icon && (
        <span className="inline-flex items-center justify-center w-7 h-7 mx-1 bg-eq-cream rounded-lg align-middle">
          {icon}
        </span>
      )}
      {suffix && <span className="text-eq-ink/70"> {suffix}</span>}
    </div>
  </div>
)
