'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tv, Smartphone, CheckCircle2, Loader2 } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { useLang } from '@/lib/i18n/LangProvider'
import { startGoogleLogin } from '@/lib/authClient'
import TVTutorialModal from '@/components/eqrel/TVTutorialModal'

const pick = (lang) => (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)

function LinkInner() {
  const { lang, dir } = useLang()
  const L = pick(lang)
  const sp = useSearchParams()
  const [me, setMe] = useState(undefined)         // undefined = loading, null = signed out
  const kidParam = !!sp.get('k')                  // QR from a child's device → /link?k=CODE
  const [code, setCode] = useState((sp.get('c') || sp.get('k') || '').replace(/\D/g, '').slice(0, 6))
  const [kind, setKind] = useState(null)          // 'kid' | 'tv' (what the code belongs to)
  const [kids, setKids] = useState([])
  const [target, setTarget] = useState(undefined) // kid device: childId | null (all children)
  const [device, setDevice] = useState(null)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [help, setHelp] = useState(false)
  const NAMES = [L('TV ruang tamu', 'Living room TV', 'TV ruang tamu', 'تلفاز الصالة'), L('TV bilik anak', "Kids' room TV", 'TV kamar anak', 'تلفاز غرفة الأطفال'), L('TV surau rumah', 'Prayer room TV', 'TV mushola', 'تلفاز المصلى')]

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).then(d => setMe(d)).catch(() => setMe(null))
  }, [])

  // Auto look-up once 6 digits are present and we're signed in
  useEffect(() => {
    setDevice(null); setErr(''); setKind(null)
    if (!me || code.length !== 6) return
    let cancelled = false
    const get = (u) => fetch(u, { credentials: 'include', cache: 'no-store' }).then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
    ;(async () => {
      // A code can belong to a child's device or a TV — check the child device first
      const k = await get(`/api/kid/device/lookup?code=${code}`)
      if (cancelled) return
      if (k.ok) {
        const c = await get('/api/children')
        if (cancelled) return
        const list = c.d.children || []
        setKids(list); setTarget(list.length === 1 ? list[0].id : undefined)
        setKind('kid'); setDevice(k.d.device); return
      }
      if (kidParam) { setErr(L('Kod tidak sah atau tamat tempoh. Tekan "Kod baharu" di peranti anak.', 'That code is invalid or expired. Tap "New code" on the child\'s device.', 'Kode tidak valid atau kedaluwarsa.', 'الرمز غير صالح أو منتهي.')); return }
      const t = await get(`/api/tv/device/lookup?code=${code}`)
      if (cancelled) return
      if (t.ok) { setKind('tv'); setDevice(t.d.device); setName(n => n || NAMES[0]) }
      else setErr(L('Kod tidak sah atau tamat tempoh. Semak kod di skrin.', 'That code is invalid or expired. Check the code on the screen.', 'Kode tidak valid atau kedaluwarsa.', 'الرمز غير صالح أو منتهي.'))
    })()
    return () => { cancelled = true }
  }, [me, code]) // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async () => {
    setBusy(true); setErr('')
    try {
      const r = kind === 'kid'
        ? await fetch('/api/kid/device/approve', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, childId: target }) })
        : await fetch('/api/tv/device/approve', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) setDone({ ...d.device, kind })
      else setErr(d.error || 'Error')
    } finally { setBusy(false) }
  }

  const familyName = me?.family?.familyName || me?.family?.name || ''

  return (
    <div className="min-h-[100dvh] bg-eq-warm flex flex-col items-center px-4 py-8" dir={dir} data-testid="link-page">
      <div className="flex items-center gap-2 mb-6">
        <img src={BRAND.mascot.default} alt="" className="w-11 h-11" />
        <div className="text-2xl font-black text-emerald-900">{BRAND.name}</div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-eq-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">{kind === 'kid' || kidParam ? <Smartphone className="w-6 h-6 text-emerald-700" /> : <Tv className="w-6 h-6 text-emerald-700" />}</div>
          <div>
            <h1 className="font-extrabold text-lg text-eq-ink leading-tight">{kind === 'kid' || kidParam ? L('Sambung peranti anak', "Connect your child's device", 'Hubungkan perangkat anak', 'ربط جهاز الطفل') : L('Sambung TV atau peranti anak', "Connect a TV or child's device", 'Hubungkan TV atau perangkat anak', 'ربط التلفاز أو جهاز الطفل')}</h1>
            <p className="text-[12px] text-eq-ink/60">{L('Kod dipaparkan di skrin peranti tersebut', 'The code is shown on that screen', 'Kode tampil di layar perangkat', 'الرمز ظاهر على تلك الشاشة')}</p>
          </div>
        </div>

        {me === undefined ? (
          <div className="h-32 rounded-2xl bg-eq-cream/40 animate-pulse" />
        ) : me === null ? (
          <div className="space-y-3" data-testid="link-signin">
            <p className="text-sm text-eq-ink/75">{L('Log masuk dengan akaun ibu bapa untuk sambung TV ini ke keluarga anda.', 'Sign in with your parent account to link this TV to your family.', 'Masuk dengan akun orang tua untuk menghubungkan TV ini.', 'سجّل الدخول بحساب الوالد لربط هذا التلفاز.')}</p>
            <button onClick={() => startGoogleLogin(`/link${code ? `?${kidParam ? 'k' : 'c'}=${code}` : ''}`)} data-testid="link-signin-btn"
              className="w-full rounded-2xl py-3.5 bg-emerald-600 text-white font-extrabold text-sm active:scale-[0.98]">
              {L('Log masuk dengan Google', 'Sign in with Google', 'Masuk dengan Google', 'تسجيل الدخول عبر Google')}
            </button>
          </div>
        ) : done?.kind === 'kid' ? (
          <div className="text-center py-4" data-testid="link-kid-done">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <div className="font-extrabold text-xl text-eq-ink mt-2">{L('Peranti anak bersambung!', "Child's device connected!", 'Perangkat anak terhubung!', 'تم ربط جهاز الطفل!')}</div>
            <p className="text-sm text-eq-ink/65 mt-1">{L(`“${done.name}” akan membuka Kid Mode dalam beberapa saat. Anak tidak boleh masuk ke bahagian ibu bapa.`, `“${done.name}” will open Kid Mode in a few seconds. Parent features stay locked on that device.`, `“${done.name}” akan membuka Kid Mode sebentar lagi.`, `سيفتح «${done.name}» وضع الطفل خلال ثوانٍ.`)}</p>
            <a href="/?parent=1&tab=profile" className="mt-4 inline-block rounded-2xl px-5 py-3 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 font-extrabold text-sm">{L('Kembali ke EQrel', 'Back to EQrel', 'Kembali ke EQrel', 'العودة إلى EQrel')}</a>
          </div>
        ) : done ? (
          <div className="text-center py-4" data-testid="link-done">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <div className="font-extrabold text-xl text-eq-ink mt-2">{L('TV bersambung!', 'TV connected!', 'TV terhubung!', 'تم ربط التلفاز!')}</div>
            <p className="text-sm text-eq-ink/65 mt-1">{L(`“${done.name}” akan membuka Paparan Keluarga dalam beberapa saat.`, `“${done.name}” will open your Family Display in a few seconds.`, `“${done.name}” akan membuka Tampilan Keluarga sebentar lagi.`, `سيفتح «${done.name}» شاشة العائلة خلال ثوانٍ.`)}</p>
            <a href="/display/setup" className="mt-4 inline-block rounded-2xl px-5 py-3 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 font-extrabold text-sm">{L('Tetapan Paparan TV', 'TV Display Setup', 'Pengaturan Tampilan TV', 'إعداد الشاشة')}</a>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50">{L('Kod di skrin', 'Code on the screen', 'Kode di layar', 'الرمز على الشاشة')}</span>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" data-testid="link-code-input"
                className="mt-1 w-full rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 outline-none px-4 py-3 text-3xl font-black tracking-[0.3em] text-center text-eq-ink" dir="ltr" />
            </label>
            {err && <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-[12px] font-bold text-red-700" data-testid="link-error">{err}</div>}
            {device && kind === 'kid' && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 space-y-2.5" data-testid="link-kid-confirm">
                <div className="text-sm text-emerald-900">{L('Siapa yang akan guna', 'Who will use this', 'Siapa yang akan memakai', 'من سيستخدم')} <b>{device.label}</b>?</div>
                <div className="flex flex-wrap gap-1.5">
                  {kids.map(k => (
                    <button key={k.id} onClick={() => setTarget(k.id)} data-testid={`link-kid-target-${k.id}`}
                      className={`px-3 py-1.5 rounded-full text-[13px] font-extrabold ${target === k.id ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-800 border border-emerald-200'}`}>🧒 {k.nickname}</button>
                  ))}
                  {kids.length > 1 && (
                    <button onClick={() => setTarget(null)} data-testid="link-kid-target-all"
                      className={`px-3 py-1.5 rounded-full text-[13px] font-extrabold ${target === null ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-800 border border-emerald-200'}`}>👨‍👩‍👧 {L('Semua anak (tablet kongsi)', 'All children (shared tablet)', 'Semua anak (tablet bersama)', 'كل الأطفال')}</button>
                  )}
                </div>
                {!kids.length && <div className="text-[12px] font-bold text-red-700">{L('Tambah anak dahulu.', 'Add a child first.', 'Tambahkan anak dulu.', 'أضف طفلاً أولاً.')}</div>}
                <p className="text-[11px] text-emerald-900/60">{L('Peranti ini hanya boleh buka Kid Mode & World. Tiada akses ke bahagian ibu bapa.', 'This device can only open Kid Mode & World — no parent features.', 'Perangkat ini hanya bisa membuka Kid Mode & World.', 'هذا الجهاز يفتح وضع الطفل والعالم فقط.')}</p>
                <button onClick={approve} disabled={busy || target === undefined} data-testid="link-kid-approve"
                  className="w-full rounded-2xl py-3.5 bg-emerald-600 text-white font-extrabold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2 active:scale-[0.98]">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} 🧒 {L('Sambung peranti anak', 'Connect this device', 'Hubungkan perangkat ini', 'ربط هذا الجهاز')}
                </button>
              </div>
            )}
            {device && kind === 'tv' && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 space-y-2.5" data-testid="link-confirm">
                <div className="text-sm text-emerald-900">
                  {L('Sambung', 'Connect', 'Hubungkan', 'ربط')} <b>{device.label}</b> {L('ke keluarga', 'to', 'ke keluarga', 'بعائلة')} <b>{familyName || '—'}</b>?
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {NAMES.map(n => (
                    <button key={n} onClick={() => setName(n)} className={`px-3 py-1.5 rounded-full text-[12px] font-extrabold ${name === n ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-800 border border-emerald-200'}`}>{n}</button>
                  ))}
                </div>
                <input value={name} onChange={e => setName(e.target.value.slice(0, 40))} data-testid="link-name-input"
                  className="w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-eq-ink" />
                <button onClick={approve} disabled={busy} data-testid="link-approve"
                  className="w-full rounded-2xl py-3.5 bg-emerald-600 text-white font-extrabold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2 active:scale-[0.98]">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} 📺 {L('Sambung TV ini', 'Connect this TV', 'Hubungkan TV ini', 'ربط هذا التلفاز')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!(kind === 'kid' || kidParam) && <button onClick={() => setHelp(true)} data-testid="link-help" className="mt-4 text-sm font-bold text-emerald-800 underline underline-offset-4">
        {L('TV tak buka? Lihat panduan ikut jenama', "TV won't open it? See the guide for your brand", 'TV tidak bisa? Lihat panduan per merek', 'لا يعمل؟ اطّلع على دليل علامتك')}
      </button>}
      <TVTutorialModal open={help} onClose={() => setHelp(false)} />
    </div>
  )
}

export default function LinkPage() {
  return <Suspense fallback={null}><LinkInner /></Suspense>
}
