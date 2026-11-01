'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import { HelpCircle, Keyboard, QrCode, RefreshCw, Zap } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import TVTutorialModal from '@/components/eqrel/TVTutorialModal'
import { useLang, SUPPORTED_LANGS } from '@/lib/i18n/LangProvider'
import { getTvCreds, saveTvCreds, clearTvCreds, connectTvDevice, detectLite, applyLite, setLiteOverride } from '@/lib/tvClient'

const COPY = {
  en: { tag: 'Family Display', scan: 'Scan with your phone camera', or: 'or on your phone open', enterCode: 'and enter this code', waiting: 'Waiting for your phone…', expires: 'New code in', connected: 'Connected!', opening: 'Opening your Family Display…', manual: 'I have a code from the app', backQr: 'Show QR instead', enter: 'Enter the 6-digit code from Display Setup', help: 'How to set up', lite: 'Lite mode', on: 'On', off: 'Off', newCode: 'New code', err_short: 'Please enter the 6-digit code', err_invalid: 'Invalid or expired code', err_conn: 'Connection problem — retrying…', remote: 'Tip: use the number keys on your remote', revoked: 'This TV was disconnected. Scan again to reconnect.' },
  ms: { tag: 'Paparan Keluarga', scan: 'Imbas dengan kamera telefon', or: 'atau di telefon buka', enterCode: 'dan masukkan kod ini', waiting: 'Menunggu telefon anda…', expires: 'Kod baharu dalam', connected: 'Bersambung!', opening: 'Membuka Paparan Keluarga…', manual: 'Saya ada kod dari app', backQr: 'Tunjuk QR semula', enter: 'Masukkan kod 6 digit dari Tetapan Paparan', help: 'Cara sediakan', lite: 'Mod ringan', on: 'Hidup', off: 'Mati', newCode: 'Kod baharu', err_short: 'Sila masukkan 6 digit kod', err_invalid: 'Kod tidak sah atau tamat tempoh', err_conn: 'Masalah sambungan — mencuba semula…', remote: 'Tip: guna butang nombor pada remote', revoked: 'TV ini telah diputuskan. Imbas semula untuk sambung.' },
  id: { tag: 'Tampilan Keluarga', scan: 'Pindai dengan kamera HP', or: 'atau di HP buka', enterCode: 'lalu masukkan kode ini', waiting: 'Menunggu HP kamu…', expires: 'Kode baru dalam', connected: 'Terhubung!', opening: 'Membuka Tampilan Keluarga…', manual: 'Saya punya kode dari aplikasi', backQr: 'Tampilkan QR', enter: 'Masukkan kode 6 digit dari Pengaturan Tampilan', help: 'Cara mengatur', lite: 'Mode ringan', on: 'Nyala', off: 'Mati', newCode: 'Kode baru', err_short: 'Masukkan kode 6 digit', err_invalid: 'Kode tidak valid atau kedaluwarsa', err_conn: 'Masalah koneksi — mencoba lagi…', remote: 'Tips: gunakan tombol angka di remote', revoked: 'TV ini telah diputus. Pindai lagi untuk menghubungkan.' },
  ar: { tag: 'شاشة العائلة', scan: 'امسح بكاميرا الهاتف', or: 'أو افتح على الهاتف', enterCode: 'وأدخل هذا الرمز', waiting: 'بانتظار هاتفك…', expires: 'رمز جديد خلال', connected: 'تم الربط!', opening: 'جارٍ فتح شاشة العائلة…', manual: 'لدي رمز من التطبيق', backQr: 'إظهار QR', enter: 'أدخل الرمز المكون من ٦ أرقام', help: 'طريقة الإعداد', lite: 'الوضع الخفيف', on: 'تشغيل', off: 'إيقاف', newCode: 'رمز جديد', err_short: 'أدخل ٦ أرقام', err_invalid: 'رمز غير صالح أو منتهي', err_conn: 'مشكلة اتصال — إعادة المحاولة…', remote: 'نصيحة: استخدم أزرار الأرقام في جهاز التحكم', revoked: 'تم فصل هذا التلفاز. امسح مرة أخرى.' },
}
const BACK_CODES = new Set([10009, 461])
const fmtCode = (c) => (c ? `${c.slice(0, 3)} ${c.slice(3)}` : '––– –––')
const goDisplay = () => window.location.replace('/display?tv=1')

export default function TVPairPage() {
  const { lang, setLang, dir } = useLang()
  const L = COPY[lang] || COPY.en
  const [host, setHost] = useState('')
  const [lite, setLite] = useState(false)
  const [phase, setPhase] = useState('boot')     // boot | qr | manual | done
  const [device, setDevice] = useState(null)      // { deviceId, secret, code, expiresAt }
  const [qr, setQr] = useState('')
  const [left, setLeft] = useState(0)
  const [netErr, setNetErr] = useState(false)
  const [notice, setNotice] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const primaryRef = useRef(null)
  const startingRef = useRef(false)

  useEffect(() => { setHost(window.location.host); setLite(applyLite(detectLite())) }, [])

  const startDevice = useCallback(async () => {
    if (startingRef.current) return
    startingRef.current = true
    try {
      const r = await fetch('/api/tv/device/start', { method: 'POST', credentials: 'include' })
      if (!r.ok) throw new Error('start')
      const d = await r.json()
      setDevice(d); setNetErr(false)
      const link = `${window.location.origin}/link?c=${d.code}`
      setQr(await QRCode.toDataURL(link, { margin: 1, width: 520, errorCorrectionLevel: 'M', color: { dark: '#022c22', light: '#ffffff' } }))
    } catch {
      setNetErr(true)
      setTimeout(() => { startingRef.current = false; startDevice() }, 5000)
      return
    }
    startingRef.current = false
  }, [])

  // Boot: already linked on this TV? → straight to the display.
  useEffect(() => {
    (async () => {
      const creds = getTvCreds()
      if (creds) {
        const res = await connectTvDevice(creds)
        if (res.status === 'approved') { setFamilyName(res.familyName || ''); setPhase('done'); setTimeout(goDisplay, 600); return }
        if (res.status === 'revoked') setNotice(L.revoked)
        if (res.status !== 'error') clearTvCreds()
      }
      setPhase('qr'); startDevice()
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for approval + countdown
  useEffect(() => {
    if (!device || phase === 'done') return
    const tick = setInterval(() => setLeft(Math.max(0, Math.round((new Date(device.expiresAt) - Date.now()) / 1000))), 1000)
    const poll = setInterval(async () => {
      const res = await connectTvDevice(device)
      if (res.status === 'error') { setNetErr(true); return }
      setNetErr(false)
      if (res.status === 'approved') {
        saveTvCreds(device); setFamilyName(res.familyName || ''); setPhase('done')
        clearInterval(poll); setTimeout(goDisplay, 1800)
      } else if (res.status === 'expired' || res.status === 'unknown') {
        clearInterval(poll); setDevice(null); setQr(''); startDevice()
      }
    }, 2500)
    return () => { clearInterval(tick); clearInterval(poll) }
  }, [device, phase, startDevice])

  useEffect(() => { if (phase === 'qr' || phase === 'manual') setTimeout(() => primaryRef.current?.focus(), 50) }, [phase])

  // Manual code (legacy: code generated in Display Setup on the phone)
  const submit = useCallback(async () => {
    if (!/^[0-9]{6}$/.test(code)) { setErr(L.err_short); return }
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/tv-pair/redeem', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok) { setPhase('done'); setTimeout(goDisplay, 1200) } else setErr(L.err_invalid)
    } catch { setErr(L.err_conn) }
    setLoading(false)
  }, [code, L])

  // Remote keys: digits / Enter / Back
  useEffect(() => {
    const onKey = (e) => {
      if (showHelp) return
      if (phase === 'manual') {
        if (/^[0-9]$/.test(e.key)) { e.preventDefault(); setCode(c => (c.length < 6 ? c + e.key : c)); return }
        if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); setCode(c => c.slice(0, -1)); return }
        if (e.key === 'Enter' && document.activeElement?.dataset?.digit === undefined && code.length === 6) { e.preventDefault(); submit(); return }
        if (BACK_CODES.has(e.keyCode) || e.key === 'GoBack' || e.key === 'Escape') { e.preventDefault(); setPhase('qr') }
      } else if (phase === 'qr' && /^[0-9]$/.test(e.key)) {
        setPhase('manual'); setCode(e.key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, code, submit, showHelp])

  const toggleLite = () => { const v = !lite; setLiteOverride(v); setLite(applyLite(v)) }
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  const btn = 'tv-focus rounded-2xl border-2 border-white/20 bg-white/10 hover:bg-white/20 font-extrabold active:scale-95'

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white relative" dir={dir} data-testid="tv-page">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button onClick={toggleLite} data-testid="tv-lite-toggle" className={`${btn} px-3 py-1.5 text-[11px] inline-flex items-center gap-1`}>
          <Zap className="w-3.5 h-3.5" style={{ color: '#FFB703' }} /> {L.lite}: {lite ? L.on : L.off}
        </button>
        <div className="flex gap-1 bg-white/10 border border-white/15 rounded-full p-1">
          {SUPPORTED_LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} aria-label={l.label}
              className={`tv-focus px-2.5 py-1 rounded-full text-[11px] font-black ${lang === l.code ? 'bg-white text-emerald-900' : 'text-white/75'}`}>{l.short}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <img src={BRAND.mascot.default} alt="EQ" className="w-14 h-14" />
        <div>
          <div className="text-3xl font-black tracking-tight">{BRAND.name}</div>
          <div className="text-xs uppercase tracking-widest font-bold" style={{ color: '#FFB703' }}>{L.tag}</div>
        </div>
      </div>

      {notice && phase !== 'done' && <div className="mb-4 rounded-2xl bg-amber-500/20 border border-amber-300/40 px-4 py-2 text-sm font-bold" data-testid="tv-notice">{notice}</div>}

      {phase === 'boot' && <div className="h-72 w-full max-w-3xl rounded-3xl bg-white/5 border border-white/10 animate-pulse" />}

      {phase === 'done' && (
        <div className="text-center rounded-3xl bg-white/10 border border-white/20 px-10 py-12" data-testid="tv-connected">
          <div className="text-7xl mb-3">✅</div>
          <div className="text-4xl font-black">{L.connected}</div>
          {familyName && <div className="text-xl mt-2 text-white/85">Assalamualaikum, {familyName} 🤍</div>}
          <div className="text-sm mt-3 text-white/60">{L.opening}</div>
        </div>
      )}

      {phase === 'qr' && (
        <div className="w-full max-w-4xl rounded-3xl bg-white/[0.07] border border-white/15 p-6 sm:p-8 grid sm:grid-cols-[auto,1fr] gap-8 items-center" data-testid="tv-qr-panel">
          <div className="mx-auto">
            <div className="bg-white rounded-3xl p-3 w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center shadow-2xl">
              {qr ? <img src={qr} alt="QR" className="w-full h-full" data-testid="tv-qr" /> : <div className="w-full h-full rounded-2xl bg-emerald-50 animate-pulse" />}
            </div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl sm:text-3xl font-black leading-tight inline-flex items-center gap-2"><QrCode className="w-7 h-7" style={{ color: '#FFB703' }} /> {L.scan}</div>
            <div className="mt-4 text-white/75 text-base">{L.or} <span className="font-black text-white">{host}/link</span> {L.enterCode}</div>
            <div className="mt-2 text-6xl sm:text-7xl font-black tabular-nums tracking-[0.12em]" style={{ color: '#FFB703' }} data-testid="tv-device-code">{fmtCode(device?.code)}</div>
            <div className="mt-3 text-sm text-white/60 flex items-center gap-2 justify-center sm:justify-start">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              {netErr ? L.err_conn : L.waiting}{device && !netErr ? ` · ${L.expires} ${mm}` : ''}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 justify-center sm:justify-start">
              <button ref={primaryRef} onClick={() => setShowHelp(true)} data-testid="tv-help" className={`${btn} px-5 py-3 text-sm inline-flex items-center gap-2`}>
                <HelpCircle className="w-5 h-5" style={{ color: '#FFB703' }} /> {L.help}
              </button>
              <button onClick={() => { setPhase('manual'); setCode(''); setErr('') }} data-testid="tv-manual" className={`${btn} px-5 py-3 text-sm inline-flex items-center gap-2`}>
                <Keyboard className="w-5 h-5" /> {L.manual}
              </button>
              <button onClick={() => { setDevice(null); setQr(''); startDevice() }} data-testid="tv-new-code" className={`${btn} px-5 py-3 text-sm inline-flex items-center gap-2`}>
                <RefreshCw className="w-5 h-5" /> {L.newCode}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'manual' && (
        <div className="w-full max-w-md rounded-3xl bg-white/[0.07] border border-white/15 p-6" data-testid="tv-manual-panel">
          <div className="text-center text-lg font-black mb-1">{L.enter}</div>
          <div className="text-center text-xs text-white/55 mb-4">{L.remote}</div>
          <div className="flex justify-center gap-2 mb-5" dir="ltr">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center text-3xl font-black ${code[i] ? 'bg-white/20 border-white/60' : 'bg-white/5 border-white/20'}`} style={code[i] ? { color: '#FFB703' } : {}}>{code[i] || ''}</div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4" dir="ltr">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d, i) => (
              <button key={d} ref={i === 0 ? primaryRef : undefined} data-digit={d} onClick={() => setCode(c => (c.length < 6 ? c + d : c))} className={`${btn} h-14 text-2xl`}>{d}</button>
            ))}
            <button onClick={() => setCode(c => c.slice(0, -1))} data-digit="del" className={`${btn} h-14 text-lg`}>⌫</button>
            <button onClick={() => setCode(c => (c.length < 6 ? c + '0' : c))} data-digit="0" className={`${btn} h-14 text-2xl`}>0</button>
            <button onClick={submit} disabled={loading || code.length !== 6} data-testid="tv-manual-submit"
              className="tv-focus h-14 rounded-2xl text-slate-900 text-base font-black disabled:opacity-40" style={{ backgroundColor: '#FFB703' }}>{loading ? '…' : 'OK'}</button>
          </div>
          {err && <div className="rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-sm p-2 text-center mb-3" data-testid="tv-manual-error">{err}</div>}
          <button onClick={() => setPhase('qr')} data-testid="tv-back-qr" className={`${btn} w-full py-3 text-sm inline-flex items-center justify-center gap-2`}><QrCode className="w-4 h-4" /> {L.backQr}</button>
        </div>
      )}

      <TVTutorialModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
