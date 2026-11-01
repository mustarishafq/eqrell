'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BellRing, BellOff } from 'lucide-react'
import { pick } from '@/components/eqrel/tabs/tabUtils'
import { pushSupported, isIOS, isStandalone, enablePush, disablePush, currentSubscription } from '@/lib/pushClient'

const Toggle = ({ on, onChange, testId }) => (
  <button onClick={() => onChange(!on)} data-testid={testId} role="switch" aria-checked={on}
    className={`w-12 h-7 rounded-full p-0.5 transition-colors flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
    <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
)

/** Parent chooses WHEN they hear from EQrel (morning intention, night report, Sunday weekly story). */
export function NotifySettingsSheet({ open, onClose, lang = 'en' }) {
  const L = pick(lang)
  const [prefs, setPrefs] = useState(null)
  const [subscribed, setSubscribed] = useState(false)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const supported = typeof window !== 'undefined' && pushSupported()
  const iosNeedsInstall = typeof window !== 'undefined' && isIOS() && !isStandalone()

  useEffect(() => {
    if (!open) return
    setStatus(null)
    fetch('/api/notify/prefs', { credentials: 'include' }).then(r => r.json()).then(d => setPrefs(d.prefs)).catch(() => {})
    currentSubscription().then(s => setSubscribed(!!s)).catch(() => setSubscribed(false))
  }, [open])

  const save = async (next) => {
    setPrefs(next); setSaving(true)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      await fetch('/api/notify/prefs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...next, tz, lang }) })
    } finally { setSaving(false) }
  }
  const turnOn = async () => {
    setStatus(null)
    try {
      await enablePush({ lang }); setSubscribed(true)
      setStatus({ ok: true, text: L('Notifikasi diaktifkan pada peranti ini ✅', 'Notifications enabled on this device ✅', 'Notifikasi diaktifkan ✅', 'تم تفعيل الإشعارات ✅') })
    } catch (e) {
      const m = e?.message
      setStatus({ ok: false, text: m === 'denied'
        ? L('Kebenaran ditolak. Benarkan notifikasi untuk EQrel dalam tetapan pelayar.', 'Permission denied. Allow notifications for EQrel in browser settings.', 'Izin ditolak. Izinkan notifikasi di pengaturan browser.', 'تم رفض الإذن. اسمح بالإشعارات من إعدادات المتصفح.')
        : L('Peranti ini tidak menyokong notifikasi.', 'This device does not support notifications.', 'Perangkat ini tidak mendukung notifikasi.', 'هذا الجهاز لا يدعم الإشعارات.') })
    }
  }
  const turnOff = async () => { await disablePush().catch(() => {}); setSubscribed(false) }
  const test = async (kind) => {
    setStatus(null)
    const r = await fetch('/api/push/test', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
    const d = await r.json().catch(() => ({}))
    setStatus(d.sent > 0
      ? { ok: true, text: L('Notifikasi contoh dihantar — semak telefon anda.', 'Sample sent — check your device.', 'Contoh terkirim — cek perangkat Anda.', 'تم الإرسال — تحقق من جهازك.') }
      : { ok: false, text: L('Tiada peranti aktif. Hidupkan notifikasi dahulu.', 'No active device. Turn notifications on first.', 'Tidak ada perangkat aktif.', 'لا يوجد جهاز مفعّل.') })
  }

  const Slot = ({ k, emoji, title, sub }) => (
    <div className="bg-white rounded-2xl p-3.5 shadow-eq-card" data-testid={`notify-slot-${k}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-sm text-eq-ink">{title}</div>
          <div className="text-[11px] text-eq-ink/55 leading-snug">{sub}</div>
        </div>
        <Toggle on={!!prefs?.[k]?.enabled} testId={`notify-toggle-${k}`} onChange={(v) => save({ ...prefs, [k]: { ...prefs[k], enabled: v } })} />
      </div>
      {k !== 'weekly' && prefs?.[k]?.enabled && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[11px] font-bold text-eq-ink/60">{L('Masa', 'Time', 'Waktu', 'الوقت')}</span>
          <input type="time" value={prefs[k].time} data-testid={`notify-time-${k}`}
            onChange={e => e.target.value && save({ ...prefs, [k]: { ...prefs[k], time: e.target.value } })}
            className="bg-eq-warm border border-eq-cream rounded-xl px-3 py-1.5 text-sm font-bold text-eq-ink" />
          <button onClick={() => test(k)} data-testid={`notify-test-${k}`} className="ml-auto text-[11px] font-bold text-emerald-700 underline">{L('Cuba hantar', 'Send test', 'Kirim tes', 'أرسل تجربة')}</button>
        </div>
      )}
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="notify-settings">
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
            className="w-full sm:max-w-md bg-eq-warm rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto p-4 space-y-2.5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center"><BellRing className="w-5 h-5 text-emerald-700" /></div>
              <div className="flex-1">
                <h2 className="font-extrabold text-lg text-eq-ink leading-tight">{L('Notifikasi Tenang', 'Calm Notifications', 'Notifikasi Tenang', 'إشعارات هادئة')}</h2>
                <p className="text-[11px] text-eq-ink/60">{L('Hanya 2 kali sehari, pada masa pilihan anda. Tiada gangguan setiap kali anak tuntut tugasan.', 'Only twice a day, at times you choose. No pings for every claim.', 'Hanya 2 kali sehari, pada waktu pilihan Anda.', 'مرتان فقط يومياً في الأوقات التي تختارها.')}</p>
              </div>
              <button onClick={onClose} aria-label="close" data-testid="notify-close" className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            {/* Device push status */}
            <div className="bg-white rounded-2xl p-3.5 shadow-eq-card" data-testid="notify-device">
              {!supported ? (
                <p className="text-xs text-eq-ink/70">{iosNeedsInstall
                  ? L('Di iPhone: tekan Kongsi → "Tambah ke Skrin Utama", buka EQrel dari ikon itu, kemudian hidupkan notifikasi di sini.', 'On iPhone: tap Share → "Add to Home Screen", open EQrel from that icon, then enable notifications here.', 'Di iPhone: ketuk Bagikan → "Tambah ke Layar Utama", lalu aktifkan di sini.', 'على آيفون: مشاركة ← «إضافة إلى الشاشة الرئيسية» ثم فعّل الإشعارات هنا.')
                  : L('Pelayar ini tidak menyokong notifikasi. Kad laporan tetap dipaparkan di Laman Utama.', 'This browser does not support notifications. Report cards still show on Home.', 'Browser ini tidak mendukung notifikasi.', 'هذا المتصفح لا يدعم الإشعارات.')}</p>
              ) : subscribed ? (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📲</span>
                  <div className="flex-1 text-sm font-bold text-emerald-800">{L('Notifikasi aktif pada peranti ini', 'Notifications on for this device', 'Notifikasi aktif di perangkat ini', 'الإشعارات مفعّلة على هذا الجهاز')}</div>
                  <button onClick={turnOff} data-testid="notify-disable" className="text-[11px] font-bold text-red-600 flex items-center gap-1"><BellOff className="w-3.5 h-3.5" />{L('Matikan', 'Turn off', 'Matikan', 'إيقاف')}</button>
                </div>
              ) : (
                <button onClick={turnOn} data-testid="notify-enable" className="w-full rounded-xl py-3 bg-emerald-500 text-white font-extrabold text-sm active:scale-[0.99]">
                  🔔 {L('Hidupkan notifikasi pada peranti ini', 'Turn on notifications on this device', 'Aktifkan notifikasi di perangkat ini', 'فعّل الإشعارات على هذا الجهاز')}
                </button>
              )}
              {status && <p className={`text-[11px] mt-2 font-semibold ${status.ok ? 'text-emerald-700' : 'text-red-600'}`} data-testid="notify-status">{status.text}</p>}
            </div>

            {!prefs ? <div className="h-40 rounded-2xl bg-white/70 animate-pulse" /> : (
              <>
                <Slot k="morning" emoji="🌅" title={L('Niat Pagi', 'Morning Intention', 'Niat Pagi', 'نية الصباح')}
                  sub={L('Hadis motivasi + fokus setiap anak hari ini. Cadangan: sebelum/selepas Subuh.', 'A motivating hadith + each child\'s focus today. Tip: around Subuh.', 'Hadis motivasi + fokus anak hari ini.', 'حديث محفّز + تركيز كل طفل اليوم.')} />
                <Slot k="night" emoji="🌙" title={L('Laporan Malam', 'Night Report', 'Laporan Malam', 'تقرير الليل')}
                  sub={L('Prestasi anak hari ini + Sahkan Pantas dalam 10 saat.', "Today's progress + Quick Verify in 10 seconds.", 'Prestasi hari ini + Verifikasi Cepat.', 'إنجاز اليوم + تحقق سريع.')} />
                <Slot k="weekly" emoji="📖" title={L('Laporan Perubahan Mingguan', 'Weekly Progress Story', 'Laporan Perubahan Mingguan', 'قصة التقدم الأسبوعية')}
                  sub={L('Setiap Ahad bersama Laporan Malam — perubahan anak minggu ini.', "Every Sunday with the Night Report — this week's change.", 'Setiap Minggu bersama Laporan Malam.', 'كل أحد مع تقرير الليل.')} />
                <p className="text-[10px] text-eq-ink/45 text-center">{saving ? L('Menyimpan…', 'Saving…', 'Menyimpan…', 'جارِ الحفظ…') : `${L('Zon waktu', 'Time zone', 'Zona waktu', 'المنطقة الزمنية')}: ${prefs.tz}`}</p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
