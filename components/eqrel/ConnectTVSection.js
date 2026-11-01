'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/lib/i18n/LangProvider'

const pick = (lang) => (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)
const ago = (d, lang) => {
  if (!d) return pick(lang)('belum lagi', 'not yet', 'belum', 'ليس بعد')
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 2) return pick(lang)('baru tadi', 'just now', 'baru saja', 'الآن')
  if (m < 60) return `${m} min`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h`
  return new Date(d).toLocaleDateString()
}

/** Display Setup → "Connect a TV": TV-first QR steps, enter the TV's code, list/disconnect linked TVs. */
export default function ConnectTVSection({ onHelp, legacy = null }) {
  const { lang } = useLang()
  const L = pick(lang)
  const [host, setHost] = useState('eqrel.app')
  const [code, setCode] = useState('')
  const [devices, setDevices] = useState(null)
  const [showLegacy, setShowLegacy] = useState(false)

  const load = () => fetch('/api/family/tv-devices', { credentials: 'include' }).then(r => (r.ok ? r.json() : { devices: [] })).then(d => setDevices(d.devices || [])).catch(() => setDevices([]))
  useEffect(() => { setHost(window.location.host); load() }, [])

  const revoke = async (d) => {
    if (!confirm(L(`Putuskan “${d.name}”? TV akan kembali ke skrin QR.`, `Disconnect “${d.name}”? The TV will return to the QR screen.`, `Putuskan “${d.name}”?`, `فصل «${d.name}»؟`))) return
    await fetch(`/api/family/tv-devices/${d.id}/revoke`, { method: 'POST', credentials: 'include' })
    load()
  }

  return (
    <section className="bg-white rounded-2xl border-2 border-eq-cream p-4 mb-4" data-testid="connect-tv-section">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2 className="font-extrabold text-emerald-900 text-sm flex items-center gap-2"><span>📺</span> {L('Sambung ke TV', 'Connect a TV', 'Hubungkan TV', 'ربط التلفاز')}</h2>
        <button onClick={onHelp} data-testid="connect-tv-help" className="rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-1 active:scale-95 flex-shrink-0">
          ❓ {L('Panduan ikut jenama', 'Guide by TV brand', 'Panduan per merek', 'دليل حسب العلامة')}
        </button>
      </div>

      <ol className="space-y-2 mb-3">
        {[
          <>{L('Di TV, buka pelayar dan pergi ke', 'On the TV, open the browser and go to', 'Di TV, buka browser dan kunjungi', 'على التلفاز افتح المتصفح واذهب إلى')} <b className="font-mono text-emerald-700">{host}/tv</b></>,
          L('Imbas kod QR di TV dengan kamera telefon ini', 'Scan the QR on the TV with this phone’s camera', 'Pindai QR di TV dengan kamera HP ini', 'امسح رمز QR بكاميرا هذا الهاتف'),
          L('Tekan “Sambung TV ini” — siap!', 'Tap “Connect this TV” — done!', 'Ketuk “Hubungkan TV ini” — selesai!', 'اضغط «ربط هذا التلفاز» — تم!'),
        ].map((s, i) => (
          <li key={i} className="flex gap-2 text-[12px] text-emerald-900"><span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span><span>{s}</span></li>
        ))}
      </ol>

      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder={L('Atau taip kod TV', 'Or type the TV code', 'Atau ketik kode TV', 'أو اكتب رمز التلفاز')} data-testid="connect-tv-code"
          className="flex-1 min-w-0 rounded-xl border-2 border-eq-cream px-3 py-2 text-sm font-extrabold tracking-widest" dir="ltr" />
        <button onClick={() => (window.location.href = `/link?c=${code}`)} disabled={code.length !== 6} data-testid="connect-tv-go"
          className="rounded-xl bg-emerald-500 text-white font-extrabold px-4 text-sm disabled:opacity-40 active:scale-95">{L('Sambung', 'Connect', 'Hubungkan', 'ربط')}</button>
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800/60 mb-1.5">{L('TV bersambung', 'Connected TVs', 'TV terhubung', 'أجهزة التلفاز المربوطة')}</div>
        {devices === null ? <div className="h-10 rounded-xl bg-eq-cream/40 animate-pulse" /> : devices.length === 0 ? (
          <div className="text-[12px] text-emerald-800/50" data-testid="connect-tv-empty">{L('Belum ada TV disambung.', 'No TVs connected yet.', 'Belum ada TV terhubung.', 'لا يوجد تلفاز مربوط.')}</div>
        ) : (
          <div className="space-y-1.5">
            {devices.map(d => (
              <div key={d.id} className="flex items-center gap-2 rounded-xl bg-emerald-50/60 border border-emerald-100 px-3 py-2" data-testid={`connect-tv-device-${d.id}`}>
                <span className="text-lg">📺</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-emerald-900 truncate">{d.name}</div>
                  <div className="text-[11px] text-emerald-800/55">{d.label} · {L('aktif', 'active', 'aktif', 'نشط')} {ago(d.lastSeenAt, lang)}</div>
                </div>
                <button onClick={() => revoke(d)} data-testid={`connect-tv-revoke-${d.id}`} className="rounded-lg bg-white border border-red-200 text-red-600 text-[11px] font-extrabold px-2.5 py-1 active:scale-95">
                  {L('Putuskan', 'Disconnect', 'Putuskan', 'فصل')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {legacy && (
        <div className="mt-4 border-t border-eq-cream pt-3">
          <button onClick={() => setShowLegacy(v => !v)} data-testid="connect-tv-legacy-toggle" className="text-[12px] font-bold text-emerald-800/70 underline underline-offset-4">
            {showLegacy ? '▾' : '▸'} {L('TV tak boleh imbas? Jana kod di telefon', 'Can’t scan? Generate a code on this phone', 'Tidak bisa pindai? Buat kode di HP', 'لا يمكن المسح؟ أنشئ رمزاً على الهاتف')}
          </button>
          {showLegacy && <div className="mt-3">{legacy}</div>}
        </div>
      )}
    </section>
  )
}
