'use client'

import { useState, useEffect } from 'react'
import { X, Tv, Cast } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'

/**
 * TVTutorialModal — brand-by-brand guide to open EQrel on a TV (TV-first QR link),
 * plus a "cast your phone screen" guide for TVs without a usable browser.
 * Remote-friendly: big focus rings, Back/Escape closes. Langs: en (default), ms, id, ar.
 */
const BACK_KEYS = new Set(['Escape', 'GoBack', 'BrowserBack', 'Backspace'])
const BACK_CODES = new Set([10009, 461, 27])   // Tizen back, webOS back, Esc

const T = {
  en: {
    title: 'Open EQrel on your TV', sub: 'Pick your TV — 3 simple steps', fast: 'Every TV with a browser:',
    fastSteps: (h) => [`Open the browser on the TV and go to ${h}/tv`, 'A QR code appears — scan it with your phone camera', 'Tap “Connect this TV” on your phone. Done — no typing codes!'],
    bookmark: 'Tip: bookmark the page or add it to the TV home screen so next time it opens in one click.',
    cast: 'No browser? Cast from phone',
    brands: {
      android: { name: 'Android / Google TV', who: 'TCL · Xiaomi · Sony · Philips · Sharp · Haier', steps: (h) => ['Open Google Play on the TV and install “TV Bro” (free browser)', `Open TV Bro and type ${h}/tv`, 'Scan the QR with your phone and tap Connect'], note: 'Xiaomi TVs without Google Play (China ROM): use “Cast from phone”.' },
      samsung: { name: 'Samsung', who: 'Tizen Smart TV', steps: (h) => ['Press Home → Apps → open “Internet”', `Select the address bar and type ${h}/tv`, 'Scan the QR with your phone and tap Connect'], note: 'Samsung 2018+ also supports AirPlay from iPhone.' },
      lg: { name: 'LG', who: 'webOS Smart TV', steps: (h) => ['Press Home → open “Web Browser”', `Type ${h}/tv in the address bar`, 'Scan the QR with your phone and tap Connect'], note: 'Use the Magic Remote pointer or arrow keys to move around.' },
      hisense: { name: 'Hisense / Toshiba', who: 'VIDAA OS', steps: (h) => ['Press Home → Apps → open “Browser”', `Type ${h}/tv`, 'Scan the QR with your phone and tap Connect'], note: 'No Browser app? Update the TV software, or use “Cast from phone”.' },
      fire: { name: 'Fire TV', who: 'Amazon Fire TV Stick', steps: (h) => ['Open Find → search “Silk Browser” → install', `Open Silk and go to ${h}/tv`, 'Scan the QR with your phone and tap Connect'], note: '' },
    },
    castTitle: 'No browser on the TV? Mirror your phone',
    castBlocks: (h) => [
      { t: 'Android phone → Chromecast / Google TV / Miracast TV', s: ['Open Quick Settings and tap “Cast”, “Smart View” (Samsung) or “Screen cast” (Xiaomi)', 'Choose your TV', `On the phone open ${h}/display and turn the phone sideways`] },
      { t: 'iPhone → Apple TV / AirPlay TV (Samsung, LG, Sony 2018+)', s: ['Open Control Centre → “Screen Mirroring”', 'Choose your TV', `Open ${h}/display in Safari and turn the phone sideways`] },
    ],
    castNote: 'Keep the phone charging while mirroring. For an always-on display, a low-cost Google TV stick works best.',
    close: 'Close',
  },
  ms: {
    title: 'Buka EQrel di TV anda', sub: 'Pilih TV anda — 3 langkah mudah', fast: 'Semua TV yang ada pelayar:',
    fastSteps: (h) => [`Buka pelayar di TV dan pergi ke ${h}/tv`, 'Kod QR akan muncul — imbas dengan kamera telefon', 'Tekan “Sambung TV ini” di telefon. Siap — tak perlu taip kod!'],
    bookmark: 'Tip: simpan (bookmark) halaman ini atau tambah ke skrin utama TV supaya lain kali buka dengan satu klik.',
    cast: 'Tiada pelayar? Cast dari telefon',
    brands: {
      android: { name: 'Android / Google TV', who: 'TCL · Xiaomi · Sony · Philips · Sharp · Haier', steps: (h) => ['Buka Google Play di TV dan pasang “TV Bro” (pelayar percuma)', `Buka TV Bro dan taip ${h}/tv`, 'Imbas QR dengan telefon dan tekan Sambung'], note: 'TV Xiaomi tanpa Google Play (ROM China): guna “Cast dari telefon”.' },
      samsung: { name: 'Samsung', who: 'Tizen Smart TV', steps: (h) => ['Tekan Home → Apps → buka “Internet”', `Pilih bar alamat dan taip ${h}/tv`, 'Imbas QR dengan telefon dan tekan Sambung'], note: 'Samsung 2018+ juga sokong AirPlay dari iPhone.' },
      lg: { name: 'LG', who: 'webOS Smart TV', steps: (h) => ['Tekan Home → buka “Web Browser”', `Taip ${h}/tv di bar alamat`, 'Imbas QR dengan telefon dan tekan Sambung'], note: 'Guna penunjuk Magic Remote atau butang anak panah.' },
      hisense: { name: 'Hisense / Toshiba', who: 'VIDAA OS', steps: (h) => ['Tekan Home → Apps → buka “Browser”', `Taip ${h}/tv`, 'Imbas QR dengan telefon dan tekan Sambung'], note: 'Tiada app Browser? Kemas kini perisian TV, atau guna “Cast dari telefon”.' },
      fire: { name: 'Fire TV', who: 'Amazon Fire TV Stick', steps: (h) => ['Buka Find → cari “Silk Browser” → pasang', `Buka Silk dan pergi ke ${h}/tv`, 'Imbas QR dengan telefon dan tekan Sambung'], note: '' },
    },
    castTitle: 'TV tiada pelayar? Paparkan skrin telefon',
    castBlocks: (h) => [
      { t: 'Telefon Android → Chromecast / Google TV / TV Miracast', s: ['Buka Quick Settings, tekan “Cast”, “Smart View” (Samsung) atau “Screen cast” (Xiaomi)', 'Pilih TV anda', `Di telefon buka ${h}/display dan pusingkan telefon melintang`] },
      { t: 'iPhone → Apple TV / TV AirPlay (Samsung, LG, Sony 2018+)', s: ['Buka Control Centre → “Screen Mirroring”', 'Pilih TV anda', `Buka ${h}/display di Safari dan pusingkan telefon melintang`] },
    ],
    castNote: 'Pastikan telefon dicas semasa cast. Untuk paparan sepanjang masa, Google TV stick murah adalah pilihan terbaik.',
    close: 'Tutup',
  },
  id: {
    title: 'Buka EQrel di TV kamu', sub: 'Pilih TV kamu — 3 langkah mudah', fast: 'Semua TV yang punya browser:',
    fastSteps: (h) => [`Buka browser di TV dan kunjungi ${h}/tv`, 'Kode QR muncul — pindai dengan kamera HP', 'Ketuk “Hubungkan TV ini” di HP. Selesai — tanpa ketik kode!'],
    bookmark: 'Tips: simpan halaman ini atau tambahkan ke layar utama TV agar berikutnya cukup satu klik.',
    cast: 'Tanpa browser? Cast dari HP',
    brands: {
      android: { name: 'Android / Google TV', who: 'TCL · Xiaomi · Sony · Philips · Sharp · Polytron', steps: (h) => ['Buka Google Play di TV dan pasang “TV Bro” (browser gratis)', `Buka TV Bro dan ketik ${h}/tv`, 'Pindai QR dengan HP lalu ketuk Hubungkan'], note: 'TV Xiaomi tanpa Google Play: gunakan “Cast dari HP”.' },
      samsung: { name: 'Samsung', who: 'Tizen Smart TV', steps: (h) => ['Tekan Home → Apps → buka “Internet”', `Ketik ${h}/tv`, 'Pindai QR dengan HP lalu ketuk Hubungkan'], note: '' },
      lg: { name: 'LG', who: 'webOS Smart TV', steps: (h) => ['Tekan Home → buka “Web Browser”', `Ketik ${h}/tv`, 'Pindai QR dengan HP lalu ketuk Hubungkan'], note: '' },
      hisense: { name: 'Hisense / Toshiba', who: 'VIDAA OS', steps: (h) => ['Tekan Home → Apps → buka “Browser”', `Ketik ${h}/tv`, 'Pindai QR dengan HP lalu ketuk Hubungkan'], note: '' },
      fire: { name: 'Fire TV', who: 'Amazon Fire TV Stick', steps: (h) => ['Cari “Silk Browser” → pasang', `Buka Silk dan kunjungi ${h}/tv`, 'Pindai QR dengan HP lalu ketuk Hubungkan'], note: '' },
    },
    castTitle: 'TV tanpa browser? Tampilkan layar HP',
    castBlocks: (h) => [
      { t: 'HP Android → Chromecast / Google TV / TV Miracast', s: ['Buka Quick Settings, ketuk “Cast”, “Smart View” atau “Screen cast”', 'Pilih TV kamu', `Di HP buka ${h}/display dan putar HP mendatar`] },
      { t: 'iPhone → Apple TV / TV AirPlay', s: ['Buka Control Center → “Screen Mirroring”', 'Pilih TV kamu', `Buka ${h}/display di Safari dan putar HP mendatar`] },
    ],
    castNote: 'Pastikan HP diisi daya saat cast. Untuk tampilan terus-menerus, Google TV stick murah paling baik.',
    close: 'Tutup',
  },
  ar: {
    title: 'افتح EQrel على التلفاز', sub: 'اختر تلفازك — ٣ خطوات بسيطة', fast: 'أي تلفاز فيه متصفح:',
    fastSteps: (h) => [`افتح المتصفح على التلفاز واذهب إلى ${h}/tv`, 'سيظهر رمز QR — امسحه بكاميرا الهاتف', 'اضغط «ربط هذا التلفاز» على الهاتف. انتهى!'],
    bookmark: 'نصيحة: احفظ الصفحة في المفضلة لفتحها بنقرة واحدة.',
    cast: 'لا يوجد متصفح؟ بث من الهاتف',
    brands: {
      android: { name: 'Android / Google TV', who: 'TCL · Xiaomi · Sony · Philips', steps: (h) => ['ثبّت متصفح «TV Bro» من Google Play', `افتحه واكتب ${h}/tv`, 'امسح الرمز بالهاتف واضغط ربط'], note: '' },
      samsung: { name: 'Samsung', who: 'Tizen', steps: (h) => ['Home ← Apps ← «Internet»', `اكتب ${h}/tv`, 'امسح الرمز بالهاتف واضغط ربط'], note: '' },
      lg: { name: 'LG', who: 'webOS', steps: (h) => ['Home ← «Web Browser»', `اكتب ${h}/tv`, 'امسح الرمز بالهاتف واضغط ربط'], note: '' },
      hisense: { name: 'Hisense / Toshiba', who: 'VIDAA', steps: (h) => ['Home ← Apps ← «Browser»', `اكتب ${h}/tv`, 'امسح الرمز بالهاتف واضغط ربط'], note: '' },
      fire: { name: 'Fire TV', who: 'Fire TV Stick', steps: (h) => ['ثبّت «Silk Browser»', `اذهب إلى ${h}/tv`, 'امسح الرمز بالهاتف واضغط ربط'], note: '' },
    },
    castTitle: 'لا يوجد متصفح؟ اعرض شاشة الهاتف',
    castBlocks: (h) => [
      { t: 'هاتف Android ← Chromecast / Miracast', s: ['من الإعدادات السريعة اضغط «Cast» أو «Smart View»', 'اختر التلفاز', `افتح ${h}/display وأدر الهاتف أفقياً`] },
      { t: 'iPhone ← Apple TV / AirPlay', s: ['مركز التحكم ← «Screen Mirroring»', 'اختر التلفاز', `افتح ${h}/display وأدر الهاتف أفقياً`] },
    ],
    castNote: 'اترك الهاتف على الشاحن أثناء البث.',
    close: 'إغلاق',
  },
}

export function guessBrand() {
  if (typeof navigator === 'undefined') return 'android'
  const u = navigator.userAgent || ''
  if (/Tizen/i.test(u)) return 'samsung'
  if (/Web0S|webOS|NetCast/i.test(u)) return 'lg'
  if (/VIDAA|Hisense/i.test(u)) return 'hisense'
  if (/AFT[A-Z]|Silk/.test(u)) return 'fire'
  return 'android'
}

export default function TVTutorialModal({ open, onClose, defaultTab }) {
  const { lang, dir } = useLang()
  const L = T[lang] || T.en
  const [tab, setTab] = useState(defaultTab || 'android')
  const host = typeof window !== 'undefined' ? window.location.host : 'eqrel.app'

  useEffect(() => { if (open) setTab(defaultTab || guessBrand()) }, [open, defaultTab])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      if (e.key === 'Backspace' && (tag === 'input' || tag === 'textarea')) return
      if (BACK_KEYS.has(e.key) || BACK_CODES.has(e.keyCode)) { e.preventDefault(); onClose?.() }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null
  const brandIds = Object.keys(L.brands)
  const b = L.brands[tab]

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} dir={dir} data-testid="tv-guide">
      <div className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col text-emerald-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex-shrink-0">
          <Tv className="w-7 h-7" />
          <div className="flex-1">
            <h2 className="text-lg font-black leading-tight">{L.title}</h2>
            <p className="text-xs text-emerald-50/90">{L.sub}</p>
          </div>
          <button onClick={onClose} aria-label={L.close} data-testid="tv-guide-close" className="tv-focus w-11 h-11 rounded-full bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-4">
            <div className="font-black text-sm text-amber-900 mb-2">⚡ {L.fast}</div>
            <ol className="space-y-1.5">
              {L.fastSteps(host).map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-amber-950"><span className="w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{i + 1}</span><span>{s}</span></li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-2" role="tablist">
            {brandIds.map(id => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`tv-guide-tab-${id}`}
                className={`tv-focus px-4 py-2.5 rounded-2xl text-sm font-extrabold border-2 ${tab === id ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-emerald-100 text-emerald-900'}`}>
                {L.brands[id].name}
              </button>
            ))}
            <button role="tab" aria-selected={tab === 'cast'} onClick={() => setTab('cast')} data-testid="tv-guide-tab-cast"
              className={`tv-focus px-4 py-2.5 rounded-2xl text-sm font-extrabold border-2 inline-flex items-center gap-1.5 ${tab === 'cast' ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-sky-100 text-sky-900'}`}>
              <Cast className="w-4 h-4" /> {L.cast}
            </button>
          </div>

          {tab === 'cast' ? (
            <div className="space-y-3" data-testid="tv-guide-cast">
              <div className="font-black text-base">{L.castTitle}</div>
              {L.castBlocks(host).map((blk, i) => (
                <div key={i} className="rounded-2xl border-2 border-sky-100 bg-sky-50/60 p-4">
                  <div className="font-extrabold text-sm text-sky-900 mb-2">{blk.t}</div>
                  <ol className="space-y-1.5">
                    {blk.s.map((s, j) => <li key={j} className="flex gap-2 text-sm"><span className="font-black text-sky-600">{j + 1}.</span><span>{s}</span></li>)}
                  </ol>
                </div>
              ))}
              <p className="text-xs text-emerald-900/60">{L.castNote}</p>
            </div>
          ) : b && (
            <div className="rounded-2xl border-2 border-emerald-100 p-4" data-testid={`tv-guide-brand-${tab}`}>
              <div className="font-black text-base">{b.name}</div>
              <div className="text-xs text-emerald-900/55 mb-3">{b.who}</div>
              <ol className="space-y-2">
                {b.steps(host).map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm"><span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{i + 1}</span><span className="pt-1">{s}</span></li>
                ))}
              </ol>
              {b.note && <p className="mt-3 text-xs text-emerald-900/60">ℹ️ {b.note}</p>}
            </div>
          )}

          <p className="text-xs text-emerald-900/60">🔖 {L.bookmark}</p>
        </div>
      </div>
    </div>
  )
}
