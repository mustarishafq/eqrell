'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share, PlusSquare, Download, Copy, Check } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'
import {
  isStandalone, detectPlatform, getLocalInstalled, getServerInstalled, markInstalledIfStandalone,
  getInstallEvent, onInstallEvent, promptInstall,
} from '@/lib/pwaInstall'

const DISMISS_KEY = 'eqrel-install-dismissed'
const DISMISS_DAYS = 3
const pick = (lang) => (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)

/**
 * Install state shared by the banner and the Profile row.
 * mode: 'installed' | 'native' (one-tap) | 'ios-safari' | 'ios-other' | 'open-in-safari' | 'manual' | 'none'
 */
export function useInstallState() {
  const [state, setState] = useState({ mode: 'none', checked: false, platform: null })
  useEffect(() => {
    const p = detectPlatform()
    const compute = (bip) => {
      if (isStandalone() || getLocalInstalled()) return 'installed'
      if (bip) return 'native'
      if (p.os === 'ios') return p.inApp ? 'open-in-safari' : p.browser === 'safari' ? 'ios-safari' : (p.browser === 'chrome' || p.browser === 'edge') ? 'ios-other' : 'open-in-safari'
      if (p.os === 'android' && p.browser === 'firefox') return 'manual'
      if (p.os === 'android' && p.inApp) return 'manual'
      return 'none'      // Chrome/Edge/Samsung without the install event → already installed or not installable here
    }
    let alive = true
    setState({ mode: compute(getInstallEvent()), checked: false, platform: p })
    if (isStandalone()) markInstalledIfStandalone()
    const off = onInstallEvent((bip) => alive && setState(s => ({ ...s, mode: compute(bip) })))
    getServerInstalled(p.os).then(yes => { if (alive) setState(s => ({ ...s, checked: true, mode: yes ? 'installed' : s.mode })) })
    return () => { alive = false; off() }
  }, [])
  return state
}

/** Bottom banner — shows only when NOT installed. One tap = native install where the browser supports it. */
export function InstallPrompt() {
  const { lang } = useLang()
  const L = pick(lang)
  const { mode, checked, platform } = useInstallState()
  const [visible, setVisible] = useState(false)
  const [guide, setGuide] = useState(false)
  const [firstTime, setFirstTime] = useState(true)

  useEffect(() => {
    if (!checked || mode === 'installed' || mode === 'none') { setVisible(false); return }
    try {
      const d = localStorage.getItem(DISMISS_KEY)
      if (d) { setFirstTime(false); if ((Date.now() - parseInt(d, 10)) / 86400000 < DISMISS_DAYS) return }
    } catch { /* ignore */ }
    const tt = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(tt)
  }, [mode, checked])

  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ } setVisible(false); setGuide(false) }
  const install = async () => {
    if (mode === 'native') {
      const r = await promptInstall()
      if (r === 'accepted') setVisible(false)
      else if (r === 'unavailable') setGuide(true)
      return
    }
    setGuide(true)
  }

  const native = mode === 'native'
  return (
    <>
      <AnimatePresence>
        {visible && !guide && (
          <motion.div initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="fixed bottom-20 inset-x-3 z-50 max-w-md mx-auto" data-testid="install-banner" data-mode={mode}>
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-eq-green p-3.5">
              <div className="flex items-center gap-3">
                <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-2xl flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-sm text-eq-ink leading-tight">
                    {firstTime ? L('Pasang EQrel di telefon anda', 'Get the EQrel app on your phone', 'Pasang EQrel di HP kamu', 'ثبّت تطبيق EQrel على هاتفك') : L('Pasang EQrel', 'Install EQrel', 'Pasang EQrel', 'ثبّت EQrel')}
                  </div>
                  <div className="text-[11px] text-eq-ink/60 leading-snug mt-0.5">
                    {native
                      ? L('Satu tekan · percuma · buka terus dari skrin utama', 'One tap · free · opens right from your home screen', 'Satu ketuk · gratis · buka dari layar utama', 'نقرة واحدة · مجاناً · يفتح من الشاشة الرئيسية')
                      : L('2 langkah mudah — kami tunjukkan caranya', '2 quick steps — we’ll show you where to tap', '2 langkah mudah — kami tunjukkan', 'خطوتان سريعتان — سنريك أين تضغط')}
                  </div>
                </div>
                <button onClick={dismiss} aria-label="close" data-testid="install-dismiss" className="w-8 h-8 rounded-full flex items-center justify-center text-eq-ink/50 flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <button onClick={install} data-testid="install-cta"
                className="mt-3 w-full rounded-2xl bg-eq-green text-white font-extrabold text-sm py-3 inline-flex items-center justify-center gap-2 active:scale-[0.98]">
                {native ? <Download className="w-4 h-4" /> : <PlusSquare className="w-4 h-4" />}
                {native ? L('Pasang sekarang', 'Install now', 'Pasang sekarang', 'ثبّت الآن') : L('Tunjukkan caranya', 'Show me how', 'Tunjukkan caranya', 'أرني الطريقة')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <InstallGuide open={guide} mode={mode} platform={platform} onClose={() => setGuide(false)} onDone={dismiss} />
    </>
  )
}

/** Guided "Add to Home Screen" (iPhone/iPad and browsers without one-tap install), with an arrow to the right button. */
export function InstallGuide({ open, mode, platform, onClose, onDone }) {
  const { lang } = useLang()
  const L = pick(lang)
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    try { await navigator.clipboard?.writeText(window.location.origin); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Where the Share button lives: iPhone Safari = bottom centre, iPad Safari / iOS Chrome & Edge = top right
  const arrowTop = mode === 'ios-other' || (mode === 'ios-safari' && platform?.iPad)
  const showArrow = mode === 'ios-safari' || mode === 'ios-other'

  let steps = []
  if (mode === 'ios-safari') steps = [
    [<Share key="i" className="w-5 h-5" />, L('Tekan butang Kongsi', 'Tap the Share button', 'Ketuk tombol Bagikan', 'اضغط زر المشاركة'), L(platform?.iPad ? 'di bahagian atas skrin' : 'di bar bawah Safari (iOS baharu: tekan ••• dahulu)', platform?.iPad ? 'at the top of the screen' : 'in Safari’s bottom bar (newer iOS: tap ••• first)', platform?.iPad ? 'di bagian atas layar' : 'di bilah bawah Safari (iOS baru: ketuk ••• dulu)', platform?.iPad ? 'أعلى الشاشة' : 'في شريط Safari السفلي (في iOS الأحدث اضغط ••• أولاً)')],
    [<PlusSquare key="i" className="w-5 h-5" />, L('Pilih “Add to Home Screen”', 'Choose “Add to Home Screen”', 'Pilih “Add to Home Screen”', 'اختر «إضافة إلى الشاشة الرئيسية»'), L('scroll ke bawah sedikit jika tak nampak', 'scroll down a little if you don’t see it', 'gulir sedikit jika tidak terlihat', 'مرّر قليلاً إن لم تجده')],
    [<Check key="i" className="w-5 h-5" />, L('Tekan “Add” — siap!', 'Tap “Add” — done!', 'Ketuk “Add” — selesai!', 'اضغط «إضافة» — تم!'), L('EQrel kini di skrin utama anda', 'EQrel is now on your home screen', 'EQrel kini di layar utama', 'EQrel الآن على شاشتك الرئيسية')],
  ]
  else if (mode === 'ios-other') steps = [
    [<Share key="i" className="w-5 h-5" />, L('Tekan ikon Kongsi', 'Tap the Share icon', 'Ketuk ikon Bagikan', 'اضغط أيقونة المشاركة'), L('di bar alamat, atas kanan', 'in the address bar, top right', 'di bilah alamat, kanan atas', 'في شريط العنوان أعلى اليمين')],
    [<PlusSquare key="i" className="w-5 h-5" />, L('Pilih “Add to Home Screen”', 'Choose “Add to Home Screen”', 'Pilih “Add to Home Screen”', 'اختر «إضافة إلى الشاشة الرئيسية»'), L('perlukan iOS 16.4 ke atas', 'needs iOS 16.4 or newer', 'perlu iOS 16.4+', 'يتطلب iOS 16.4 أو أحدث')],
    [<Check key="i" className="w-5 h-5" />, L('Tekan “Add” — siap!', 'Tap “Add” — done!', 'Ketuk “Add” — selesai!', 'اضغط «إضافة» — تم!'), ''],
  ]
  else if (mode === 'open-in-safari') steps = [
    [<Copy key="i" className="w-5 h-5" />, L('Salin pautan EQrel', 'Copy the EQrel link', 'Salin tautan EQrel', 'انسخ رابط EQrel'), L('app ini tidak boleh memasang terus', 'this app can’t install websites', 'aplikasi ini tidak bisa memasang', 'هذا التطبيق لا يمكنه التثبيت')],
    [<Share key="i" className="w-5 h-5" />, L('Buka dalam Safari', 'Open it in Safari', 'Buka di Safari', 'افتحه في Safari'), L('atau tekan ••• → “Open in Safari/Browser”', 'or tap ••• → “Open in Safari / Browser”', 'atau ketuk ••• → “Open in Safari”', 'أو اضغط ••• ← «فتح في Safari»')],
    [<PlusSquare key="i" className="w-5 h-5" />, L('Kemudian Kongsi → “Add to Home Screen”', 'Then Share → “Add to Home Screen”', 'Lalu Bagikan → “Add to Home Screen”', 'ثم مشاركة ← «إضافة إلى الشاشة الرئيسية»'), ''],
  ]
  else steps = [
    [<span key="i" className="font-black">⋮</span>, L('Buka menu pelayar', 'Open the browser menu', 'Buka menu browser', 'افتح قائمة المتصفح'), L('butang ⋮ atau ☰', 'the ⋮ or ☰ button', 'tombol ⋮ atau ☰', 'زر ⋮ أو ☰')],
    [<Download key="i" className="w-5 h-5" />, L('Pilih “Install” atau “Add to Home screen”', 'Choose “Install” or “Add to Home screen”', 'Pilih “Install” atau “Add to Home screen”', 'اختر «تثبيت» أو «إضافة إلى الشاشة»'), ''],
    [<Check key="i" className="w-5 h-5" />, L('Sahkan — siap!', 'Confirm — done!', 'Konfirmasi — selesai!', 'أكّد — تم!'), ''],
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center p-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="install-guide" data-mode={mode}>
          {showArrow && (
            <motion.div className={`fixed z-[81] text-5xl pointer-events-none ${arrowTop ? 'top-2 right-6' : 'bottom-1 left-1/2 -translate-x-1/2'}`}
              animate={{ y: arrowTop ? [-4, -14, -4] : [4, 14, 4] }} transition={{ duration: 1.1, repeat: Infinity }} data-testid="install-arrow">
              {arrowTop ? '⬆️' : '⬇️'}
            </motion.div>
          )}
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
            className={`w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl ${showArrow && !arrowTop ? 'mb-16' : ''} ${arrowTop ? 'mt-16 self-start sm:self-center' : ''}`}>
            <div className="flex items-start gap-3">
              <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-2xl" />
              <div className="flex-1">
                <h3 className="font-extrabold text-lg text-eq-ink leading-tight">{L('Tambah EQrel ke skrin utama', 'Add EQrel to your home screen', 'Tambahkan EQrel ke layar utama', 'أضف EQrel إلى الشاشة الرئيسية')}</h3>
                <p className="text-[12px] text-eq-ink/60">{mode === 'ios-safari' || mode === 'ios-other'
                  ? L('Apple tidak benarkan pasang satu-tekan — hanya 3 tekan', 'Apple doesn’t allow one-tap installs — it’s just 3 taps', 'Apple tidak mengizinkan satu ketuk — cukup 3 ketuk', 'لا تسمح Apple بالتثبيت بنقرة — فقط 3 نقرات')
                  : L('Ikut langkah ini', 'Follow these steps', 'Ikuti langkah ini', 'اتبع الخطوات')}</p>
              </div>
              <button onClick={onClose} aria-label="close" className="w-8 h-8 rounded-full flex items-center justify-center text-eq-ink/50"><X className="w-4 h-4" /></button>
            </div>
            <ol className="mt-4 space-y-3">
              {steps.map(([icon, title, sub], i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl bg-eq-cream text-eq-green flex items-center justify-center flex-shrink-0">{icon}</span>
                  <div className="pt-0.5">
                    <div className="text-sm font-extrabold text-eq-ink">{i + 1}. {title}</div>
                    {sub && <div className="text-[11px] text-eq-ink/55">{sub}</div>}
                  </div>
                </li>
              ))}
            </ol>
            {mode === 'open-in-safari' && (
              <button onClick={copy} data-testid="install-copy-link" className="mt-4 w-full rounded-2xl border-2 border-eq-green text-eq-green font-extrabold text-sm py-2.5 inline-flex items-center justify-center gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? L('Disalin!', 'Copied!', 'Disalin!', 'تم النسخ!') : L('Salin pautan', 'Copy link', 'Salin tautan', 'نسخ الرابط')}
              </button>
            )}
            <button onClick={onDone || onClose} data-testid="install-guide-done" className="mt-3 w-full rounded-2xl bg-eq-green text-white font-extrabold text-sm py-3 active:scale-[0.98]">
              {L('Faham', 'Got it', 'Mengerti', 'فهمت')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
