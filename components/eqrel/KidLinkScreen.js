'use client'

// Child's device, not linked yet: show a QR + code for the parent to scan (way A),
// or let the child type a code the parent generated (way B). No email / WhatsApp needed.
import { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import { QrCode, Keyboard, RefreshCw, Loader2 } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { useLang, SUPPORTED_LANGS } from '@/lib/i18n/LangProvider'
import { saveKidCreds, connectKidDevice } from '@/lib/kidDeviceClient'

const CI = { green: '#00B894', yellow: '#FFB703', coral: '#FF5D6E', ink: '#0F2E25', cream: '#FFF8E7' }
const pick = (lang) => (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)
const fmt = (c) => (c ? `${c.slice(0, 3)} ${c.slice(3)}` : '––– –––')

export default function KidLinkScreen({ notice }) {
  const { lang, setLang, dir } = useLang()
  const L = pick(lang)
  const [tab, setTab] = useState('qr')          // qr | code
  const [host, setHost] = useState('')
  const [device, setDevice] = useState(null)
  const [qr, setQr] = useState('')
  const [left, setLeft] = useState(0)
  const [netErr, setNetErr] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const startingRef = useRef(false)
  const inputRef = useRef(null)

  useEffect(() => { setHost(window.location.host) }, [])

  const finish = useCallback((res) => {
    setDone(res)
    setTimeout(() => window.location.replace(res.childId ? `/kid?childId=${encodeURIComponent(res.childId)}&welcome=1` : '/kid'), 1800)
  }, [])

  const start = useCallback(async () => {
    if (startingRef.current) return
    startingRef.current = true
    try {
      const r = await fetch('/api/kid/device/start', { method: 'POST', credentials: 'include', cache: 'no-store' })
      if (!r.ok) throw new Error('start')
      const d = await r.json()
      setDevice(d); setNetErr(false)
      setQr(await QRCode.toDataURL(`${window.location.origin}/link?k=${d.code}`, { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: CI.ink, light: '#ffffff' } }))
    } catch {
      setNetErr(true)
      setTimeout(() => { startingRef.current = false; start() }, 5000)
      return
    }
    startingRef.current = false
  }, [])
  useEffect(() => { start() }, [start])

  // Poll for the parent's approval + countdown
  useEffect(() => {
    if (!device || done) return
    const tick = setInterval(() => setLeft(Math.max(0, Math.round((new Date(device.expiresAt) - Date.now()) / 1000))), 1000)
    const poll = setInterval(async () => {
      const res = await connectKidDevice(device)
      if (res.status === 'error') { setNetErr(true); return }
      setNetErr(false)
      if (res.status === 'approved') { clearInterval(poll); saveKidCreds(device); finish(res) }
      else if (res.status === 'expired' || res.status === 'unknown') { clearInterval(poll); setDevice(null); setQr(''); start() }
    }, 2500)
    return () => { clearInterval(tick); clearInterval(poll) }
  }, [device, done, start, finish])

  useEffect(() => { if (tab === 'code') setTimeout(() => inputRef.current?.focus(), 60) }, [tab])

  const redeem = async () => {
    if (!/^\d{6}$/.test(code)) { setErr(L('Masukkan 6 nombor', 'Type all 6 numbers', 'Masukkan 6 angka', 'أدخل ٦ أرقام')); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/kid/device/redeem', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.status === 'approved') { saveKidCreds(d); finish(d) }
      else if (r.status === 429) setErr(L('Terlalu banyak cubaan. Tunggu sebentar.', 'Too many tries. Please wait a few minutes.', 'Terlalu banyak percobaan. Tunggu sebentar.', 'محاولات كثيرة. انتظر قليلاً.'))
      else setErr(L('Kod salah atau dah tamat. Minta kod baharu dari ibu bapa.', 'Wrong or expired code. Ask your parent for a new one.', 'Kode salah atau kedaluwarsa. Minta kode baru.', 'رمز خاطئ أو منتهي. اطلب رمزًا جديدًا.'))
    } catch { setErr(L('Tiada sambungan internet', 'No internet connection', 'Tidak ada koneksi', 'لا يوجد اتصال')) }
    setBusy(false)
  }

  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center px-5 pt-6 pb-10" style={{ backgroundColor: CI.cream }} dir={dir} data-testid="kid-link-screen">
      <div className="w-full max-w-md flex justify-end">
        <div className="flex gap-1 bg-white rounded-full p-1 shadow-sm">
          {SUPPORTED_LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} aria-label={l.label}
              className="px-2.5 py-1 rounded-full text-[11px] font-black"
              style={lang === l.code ? { backgroundColor: CI.green, color: '#fff' } : { color: CI.ink }}>{l.short}</button>
          ))}
        </div>
      </div>

      <img src={BRAND.mascot.default} alt="EQ" className="w-24 h-24 object-contain mt-2" />
      <h1 className="text-2xl font-black text-center mt-2 leading-tight" style={{ color: CI.ink }}>
        {done ? L('Siap! 🎉', "You're all set! 🎉", 'Siap! 🎉', 'تم! 🎉') : L('Assalamualaikum! Jom sediakan EQrel kamu', "Assalamualaikum! Let's set up your EQrel", 'Assalamualaikum! Ayo siapkan EQrel kamu', 'السلام عليكم! لنجهّز EQrel الخاص بك')}
      </h1>
      {!done && <p className="text-sm text-center mt-1 max-w-sm" style={{ color: `${CI.ink}AA` }}>{L('Minta ibu atau ayah sambungkan peranti ini. Tak perlu email.', 'Ask your mum or dad to connect this device. No email needed.', 'Minta ayah atau ibu menghubungkan perangkat ini. Tanpa email.', 'اطلب من أمك أو أبيك ربط هذا الجهاز. بدون بريد إلكتروني.')}</p>}

      {notice === 'revoked' && !done && (
        <div className="mt-3 w-full max-w-md rounded-2xl px-4 py-2.5 text-sm font-bold text-center" style={{ backgroundColor: `${CI.yellow}33`, color: CI.ink }} data-testid="kid-link-revoked">
          {L('Peranti ini telah diputuskan oleh ibu bapa. Sambung semula di bawah.', 'This device was disconnected by your parent. Connect again below.', 'Perangkat ini diputus oleh orang tua. Hubungkan lagi di bawah.', 'تم فصل هذا الجهاز. اربطه مجددًا بالأسفل.')}
        </div>
      )}

      {done ? (
        <div className="mt-6 w-full max-w-md rounded-3xl p-6 text-center" style={{ backgroundColor: CI.ink, border: `3px solid ${CI.green}` }} data-testid="kid-link-done">
          <div className="text-6xl">✅</div>
          <div className="text-2xl font-black mt-2" style={{ color: CI.cream }}>
            {done.childName ? L(`Hai ${done.childName}!`, `Hi ${done.childName}!`, `Hai ${done.childName}!`, `مرحبًا ${done.childName}!`) : L('Peranti keluarga bersambung', 'Family device connected', 'Perangkat keluarga terhubung', 'تم ربط جهاز العائلة')}
          </div>
          <div className="text-sm mt-1" style={{ color: `${CI.cream}BB` }}>{L('Membuka EQrel kamu…', 'Opening your EQrel…', 'Membuka EQrel kamu…', 'جارٍ فتح EQrel…')}</div>
        </div>
      ) : (
        <>
          <div className="mt-5 w-full max-w-md grid grid-cols-2 gap-2 bg-white rounded-2xl p-1.5 shadow-sm">
            {[['qr', QrCode, L('Tunjuk QR', 'Show QR', 'Tampilkan QR', 'إظهار QR')], ['code', Keyboard, L('Saya ada kod', 'I have a code', 'Saya punya kode', 'لدي رمز')]].map(([k, Icon, label]) => (
              <button key={k} onClick={() => { setTab(k); setErr('') }} data-testid={`kid-link-tab-${k}`}
                className="rounded-xl py-2.5 text-sm font-extrabold inline-flex items-center justify-center gap-1.5"
                style={tab === k ? { backgroundColor: CI.green, color: '#fff' } : { color: CI.ink }}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {tab === 'qr' ? (
            <div className="mt-3 w-full max-w-md rounded-3xl p-5 text-center" style={{ backgroundColor: CI.ink, border: `3px solid ${CI.green}` }} data-testid="kid-link-qr-panel">
              <div className="text-sm font-extrabold" style={{ color: CI.cream }}>{L('Ibu bapa: imbas dengan kamera telefon anda', 'Parent: scan this with your phone camera', 'Orang tua: pindai dengan kamera HP', 'الوالد: امسح بكاميرا هاتفك')}</div>
              <div className="mx-auto mt-3 bg-white rounded-2xl p-2.5 w-56 h-56 flex items-center justify-center">
                {qr ? <img src={qr} alt="QR" className="w-full h-full" data-testid="kid-link-qr" /> : <div className="w-full h-full rounded-xl animate-pulse" style={{ backgroundColor: CI.cream }} />}
              </div>
              <div className="text-xs mt-3" style={{ color: `${CI.cream}BB` }}>{L('atau di telefon ibu bapa buka', "or on the parent's phone open", 'atau di HP orang tua buka', 'أو على هاتف الوالد افتح')} <b style={{ color: CI.cream }}>{host}/link</b> {L('dan taip', 'and type', 'lalu ketik', 'واكتب')}</div>
              <div className="text-5xl font-black tabular-nums tracking-[0.12em] mt-1" style={{ color: CI.yellow }} dir="ltr" data-testid="kid-link-code">{fmt(device?.code)}</div>
              <div className="mt-2 text-[11px] flex items-center justify-center gap-2" style={{ color: `${CI.cream}99` }}>
                <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: CI.green }} />
                {netErr ? L('Masalah sambungan — mencuba semula…', 'Connection problem — retrying…', 'Masalah koneksi — mencoba lagi…', 'مشكلة اتصال…') : L('Menunggu ibu bapa…', 'Waiting for your parent…', 'Menunggu orang tua…', 'بانتظار الوالد…')}{device && !netErr ? ` · ${mm}` : ''}
              </div>
              <button onClick={() => { setDevice(null); setQr(''); start() }} data-testid="kid-link-new-code"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold" style={{ backgroundColor: `${CI.cream}1A`, color: CI.cream }}>
                <RefreshCw className="w-3.5 h-3.5" /> {L('Kod baharu', 'New code', 'Kode baru', 'رمز جديد')}
              </button>
            </div>
          ) : (
            <div className="mt-3 w-full max-w-md rounded-3xl p-5 bg-white shadow-sm" data-testid="kid-link-code-panel">
              <div className="text-sm font-extrabold text-center" style={{ color: CI.ink }}>{L('Taip kod 6 nombor dari telefon ibu bapa', "Type the 6-number code from your parent's phone", 'Ketik kode 6 angka dari HP orang tua', 'اكتب الرمز من هاتف والدك')}</div>
              <div className="text-[11px] text-center mt-0.5" style={{ color: `${CI.ink}88` }}>{L('Ibu bapa: Profil → Peranti anak → Beri kod', "Parent: Profile → Child's device → Give a code", 'Orang tua: Profil → Perangkat anak → Beri kode', 'الوالد: الملف ← جهاز الطفل ← إعطاء رمز')}</div>
              <label className="relative block mt-4" dir="ltr">
                <input ref={inputRef} value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
                  onKeyDown={e => e.key === 'Enter' && redeem()} inputMode="numeric" autoComplete="one-time-code" maxLength={6} data-testid="kid-link-code-input"
                  className="absolute inset-0 w-full h-full opacity-0" aria-label="code" />
                <div className="flex justify-center gap-2 pointer-events-none">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-11 h-14 rounded-xl flex items-center justify-center text-3xl font-black"
                      style={{ border: `2px solid ${code[i] ? CI.green : `${CI.ink}22`}`, color: CI.ink, backgroundColor: code[i] ? `${CI.green}14` : '#fff' }}>{code[i] || ''}</div>
                  ))}
                </div>
              </label>
              {err && <div className="mt-3 rounded-xl px-3 py-2 text-[12px] font-bold text-center" style={{ backgroundColor: `${CI.coral}1F`, color: CI.coral }} data-testid="kid-link-error">{err}</div>}
              <button onClick={redeem} disabled={busy || code.length !== 6} data-testid="kid-link-submit"
                className="mt-4 w-full rounded-2xl py-3.5 font-black text-base inline-flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98]"
                style={{ backgroundColor: CI.yellow, color: CI.ink }}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} {L('Sambung', 'Connect', 'Hubungkan', 'اربط')} →
              </button>
            </div>
          )}

          <a href="/login" className="mt-6 text-xs font-bold underline underline-offset-4" style={{ color: `${CI.ink}99` }} data-testid="kid-link-parent-login">
            {L('Saya ibu bapa — log masuk', "I'm a parent — sign in", 'Saya orang tua — masuk', 'أنا الوالد — تسجيل الدخول')}
          </a>
        </>
      )}
    </div>
  )
}
