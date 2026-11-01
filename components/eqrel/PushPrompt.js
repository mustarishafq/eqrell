'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pick } from '@/components/eqrel/tabs/tabUtils'
import { pushSupported, isIOS, isStandalone, enablePush, currentSubscription } from '@/lib/pushClient'

const DISMISS_KEY = 'eqrel-push-prompt-dismissed'

/**
 * Asks for notification permission at a meaningful moment (after the plan is activated /
 * on the first days), framed around value — not on first load.
 * variant: 'hero' (diagnosis done page) | 'card' (dashboard home)
 */
export function PushPrompt({ lang = 'en', variant = 'card', childName }) {
  const L = pick(lang)
  const [state, setState] = useState('checking')   // checking | ask | ios | done | hidden
  const [busy, setBusy] = useState(false)
  const [errText, setErrText] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (variant === 'card') {
        const ts = Number(localStorage.getItem(DISMISS_KEY) || 0)
        if (ts && Date.now() - ts < 3 * 86400000) { if (alive) setState('hidden'); return }
      }
      if (isIOS() && !isStandalone()) { if (alive) setState('ios'); return }
      if (!pushSupported()) { if (alive) setState('hidden'); return }
      if (Notification.permission === 'denied') { if (alive) setState('hidden'); return }
      const sub = await currentSubscription().catch(() => null)
      if (alive) setState(sub ? 'hidden' : 'ask')
    })()
    return () => { alive = false }
  }, [variant])

  if (state === 'checking' || state === 'hidden') return null

  const turnOn = async () => {
    setBusy(true); setErrText(null)
    try { await enablePush({ lang }); setState('done') }
    catch (e) {
      setErrText(e?.message === 'denied'
        ? L('Kebenaran ditolak. Anda boleh hidupkan kemudian di Profil → Notifikasi.', 'Permission was blocked. You can turn it on later in Profile → Notifications.', 'Izin ditolak. Bisa diaktifkan nanti di Profil → Notifikasi.', 'تم رفض الإذن. يمكنك تفعيله لاحقاً من الملف ← الإشعارات.')
        : L('Peranti ini tidak menyokong notifikasi.', 'This device does not support notifications.', 'Perangkat ini tidak mendukung notifikasi.', 'هذا الجهاز لا يدعم الإشعارات.'))
    } finally { setBusy(false) }
  }
  const later = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ } setState('hidden') }

  const hero = variant === 'hero'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid="push-prompt"
      className={`rounded-3xl p-4 flex-shrink-0 text-left ${hero ? 'bg-white shadow-lg border-2 border-emerald-100' : 'bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 shadow-eq-card'}`}>
      {state === 'done' ? (
        <div className="flex items-center gap-3" data-testid="push-prompt-done">
          <span className="text-3xl">✅</span>
          <div>
            <div className="font-extrabold text-emerald-900 text-sm">{L('Peringatan lembut diaktifkan', 'Gentle reminders are on', 'Pengingat lembut aktif', 'تم تفعيل التذكيرات')}</div>
            <div className="text-[11px] text-emerald-900/60">{L('Niat Pagi 5:30 pagi · Laporan Malam 9:00 malam. Tukar masa di Profil.', 'Morning Intention 5:30 am · Night Report 9:00 pm. Change times in Profile.', 'Niat Pagi 05:30 · Laporan Malam 21:00.', 'نية الصباح ٥:٣٠ · تقرير الليل ٩:٠٠')}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none">🔔</span>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-emerald-950 text-[15px] leading-tight">
                {childName
                  ? L(`Mahu kami ingatkan anda dengan lembut tentang ${childName}?`, `Want gentle reminders about ${childName}?`, `Mau kami ingatkan dengan lembut tentang ${childName}?`, `هل تريد تذكيرات لطيفة عن ${childName}؟`)
                  : L('Mahu peringatan lembut setiap hari?', 'Want gentle daily reminders?', 'Mau pengingat lembut setiap hari?', 'هل تريد تذكيرات يومية لطيفة؟')}
              </div>
              <div className="text-[12px] text-emerald-900/70 mt-1 leading-snug">
                {L('Hanya 2 kali sehari — 🌅 Niat Pagi dan 🌙 Laporan Malam dengan Sahkan Pantas 10 saat. Tiada gangguan setiap kali anak tuntut tugasan.',
                  'Just twice a day — 🌅 a Morning Intention and a 🌙 Night Report with 10-second Quick Verify. No ping for every claim.',
                  'Hanya 2 kali sehari — 🌅 Niat Pagi dan 🌙 Laporan Malam. Tidak ada gangguan setiap klaim.',
                  'مرتان فقط يومياً — 🌅 نية الصباح و🌙 تقرير الليل.')}
              </div>
            </div>
          </div>
          {state === 'ios' ? (
            <div className="mt-3 rounded-2xl bg-sky-50 border border-sky-100 p-3 text-[12px] text-sky-900 leading-snug" data-testid="push-prompt-ios">
              <div className="font-extrabold mb-1">{L('Di iPhone, 2 langkah dahulu:', 'On iPhone, 2 quick steps first:', 'Di iPhone, 2 langkah dulu:', 'على آيفون، خطوتان أولاً:')}</div>
              <div>1. {L('Tekan butang Kongsi', 'Tap the Share button', 'Ketuk tombol Bagikan', 'اضغط زر المشاركة')} <span className="inline-block px-1 rounded bg-white border">⬆︎</span> → “{L('Tambah ke Skrin Utama', 'Add to Home Screen', 'Tambah ke Layar Utama', 'إضافة إلى الشاشة الرئيسية')}”</div>
              <div>2. {L('Buka EQrel dari ikon itu, kemudian hidupkan peringatan di sini.', 'Open EQrel from that icon, then turn on reminders here.', 'Buka EQrel dari ikon itu, lalu aktifkan di sini.', 'افتح EQrel من الأيقونة ثم فعّل التذكيرات هنا.')}</div>
            </div>
          ) : (
            <button onClick={turnOn} disabled={busy} data-testid="push-prompt-enable"
              className="mt-3 w-full rounded-2xl py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-50 active:scale-[0.99]">
              {busy ? L('Sebentar…', 'One moment…', 'Sebentar…', 'لحظة…') : `🔔 ${L('Ya, hidupkan peringatan lembut', 'Yes, turn on gentle reminders', 'Ya, aktifkan pengingat', 'نعم، فعّل التذكيرات')}`}
            </button>
          )}
          {errText && <p className="text-[11px] text-red-600 font-semibold mt-2" data-testid="push-prompt-error">{errText}</p>}
          <button onClick={later} data-testid="push-prompt-later" className="mt-1.5 w-full text-[11px] font-bold text-emerald-900/45 py-1">{L('Nanti dahulu', 'Maybe later', 'Nanti saja', 'لاحقاً')}</button>
        </>
      )}
    </motion.div>
  )
}
