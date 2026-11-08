'use client'
// "Save EQrel on this TV" — remote-friendly guide (D-pad focusable, Back closes).
// One-tap install where the TV browser supports it; otherwise clear per-brand steps + a short address.
import { useEffect, useRef, useState } from 'react'
import { getInstallEvent, onInstallEvent, promptInstall } from '@/lib/pwaInstall'
import { detectTvPlatform, markTvSaveSeen } from '@/lib/tvPlatform'

const BACK_KEYS = new Set([10009, 461, 8, 27]) // Tizen Back, webOS Back, Backspace, Esc

const C = {
  title: { ms: 'Simpan EQrel di TV ini', en: 'Save EQrel on this TV', id: 'Simpan EQrel di TV ini', ar: 'احفظ EQrel على هذا التلفاز' },
  sub: { ms: 'Lain kali buka Paparan Keluarga dengan satu klik — TV ini kekal bersambung.', en: 'Open your Family Display in one click next time — this TV stays connected.', id: 'Lain kali buka Tampilan Keluarga dengan satu klik — TV ini tetap terhubung.', ar: 'افتح شاشة العائلة بنقرة واحدة في المرة القادمة — يبقى هذا التلفاز متصلاً.' },
  install: { ms: 'Pasang di TV ini', en: 'Install on this TV', id: 'Pasang di TV ini', ar: 'ثبّت على هذا التلفاز' },
  installed: { ms: 'Dipasang! Cari ikon EQrel TV di senarai app.', en: 'Installed! Look for the EQrel TV icon in your apps list.', id: 'Terpasang! Cari ikon EQrel TV di daftar aplikasi.', ar: 'تم التثبيت! ابحث عن أيقونة EQrel TV في قائمة التطبيقات.' },
  pick: { ms: 'Pilih jenama TV anda', en: 'Choose your TV', id: 'Pilih TV kamu', ar: 'اختر نوع تلفازك' },
  detected: { ms: 'dikesan', en: 'detected', id: 'terdeteksi', ar: 'تم الكشف' },
  easiest: { ms: 'Cara paling mudah (semua TV)', en: 'Easiest way (any TV)', id: 'Cara termudah (semua TV)', ar: 'أسهل طريقة (أي تلفاز)' },
  easiestDesc: { ms: 'Buka pelayar TV dan taip alamat pendek ini. TV ini terus masuk ke Paparan Keluarga tanpa perlu sambung semula.', en: 'Open the TV browser and type this short address. This TV goes straight to your Family Display — no need to reconnect.', id: 'Buka browser TV dan ketik alamat pendek ini. TV langsung masuk ke Tampilan Keluarga tanpa perlu menghubungkan ulang.', ar: 'افتح متصفح التلفاز واكتب هذا العنوان القصير. سيفتح التلفاز شاشة العائلة مباشرة دون إعادة الربط.' },
  done: { ms: 'Siap, sudah disimpan', en: 'Done, I saved it', id: 'Selesai, sudah disimpan', ar: 'تم الحفظ' },
  later: { ms: 'Nanti', en: 'Later', id: 'Nanti', ar: 'لاحقاً' },
  noBrowser: { ms: 'Tiada pelayar? Pada Android/Google TV, pasang "TV Bro" dari Google Play (percuma).', en: 'No browser? On Android/Google TV install "TV Bro" from Google Play (free).', id: 'Tidak ada browser? Di Android/Google TV pasang "TV Bro" dari Google Play (gratis).', ar: 'لا يوجد متصفح؟ على Android/Google TV ثبّت "TV Bro" من Google Play (مجاناً).' },
}

// Per-platform steps. {url} → short address.
const PLATFORMS = [
  {
    id: 'android', icon: '📺', label: 'Android / Google TV', brands: 'TCL · Xiaomi · Sony · Philips · Sharp · Skyworth · Haier · TV box',
    steps: {
      en: ['Open the browser you use on this TV (TV Bro, Chrome, Puffin, BrowseHere…).', 'Press the menu button ⋮ → choose "Add to Home screen" / "Add shortcut" / "Install app" if you see it.', 'Not there? Choose ⭐ "Bookmark" — then in browser Settings set Home page to {url}.', 'Next time: open the browser (or the EQrel TV shortcut) and the display opens by itself.'],
      ms: ['Buka pelayar yang anda guna di TV ini (TV Bro, Chrome, Puffin, BrowseHere…).', 'Tekan butang menu ⋮ → pilih "Add to Home screen" / "Add shortcut" / "Install app" jika ada.', 'Tiada? Pilih ⭐ "Bookmark" — kemudian di Settings pelayar, tetapkan Home page kepada {url}.', 'Lain kali: buka pelayar (atau pintasan EQrel TV) dan paparan terus terbuka.'],
      id: ['Buka browser yang kamu pakai di TV ini (TV Bro, Chrome, Puffin, BrowseHere…).', 'Tekan tombol menu ⋮ → pilih "Add to Home screen" / "Add shortcut" / "Install app" jika ada.', 'Tidak ada? Pilih ⭐ "Bookmark" — lalu di Settings browser, atur Home page ke {url}.', 'Lain kali: buka browser (atau pintasan EQrel TV) dan tampilan langsung terbuka.'],
    },
  },
  {
    id: 'samsung', icon: '🟦', label: 'Samsung', brands: 'Smart TV (Tizen) · Internet app',
    steps: {
      en: ['In the Internet app, move up to the address bar and press ⭐ "Add to Bookmarks".', 'Open Bookmarks, highlight EQrel and hold OK (or press ⋯) → "Add to Home". A tile appears on the Home bar.', 'Optional: Settings → General → Homepage → "Current page".', 'Next time: press Home on the remote → EQrel tile.'],
      ms: ['Dalam app Internet, naik ke bar alamat dan tekan ⭐ "Add to Bookmarks".', 'Buka Bookmarks, pilih EQrel dan tekan lama OK (atau ⋯) → "Add to Home". Jubin muncul di bar Home.', 'Pilihan: Settings → General → Homepage → "Current page".', 'Lain kali: tekan Home pada remote → jubin EQrel.'],
      id: ['Di aplikasi Internet, naik ke bilah alamat dan tekan ⭐ "Add to Bookmarks".', 'Buka Bookmarks, pilih EQrel dan tahan OK (atau ⋯) → "Add to Home". Ubin muncul di bilah Home.', 'Opsional: Settings → General → Homepage → "Current page".', 'Lain kali: tekan Home di remote → ubin EQrel.'],
    },
  },
  {
    id: 'lg', icon: '🟥', label: 'LG', brands: 'webOS · Web Browser',
    steps: {
      en: ['In Web Browser, press the menu ☰ (top right) → "Add to Bookmarks".', 'If you see "Pin to Home" / "Add to Home", choose it — a tile appears on the Home launcher.', 'Settings → "Startup page" → "Set page" → {url}.', 'Next time: open Web Browser → it starts on your display.'],
      ms: ['Dalam Web Browser, tekan menu ☰ (atas kanan) → "Add to Bookmarks".', 'Jika ada "Pin to Home" / "Add to Home", pilih — jubin muncul di Home.', 'Settings → "Startup page" → "Set page" → {url}.', 'Lain kali: buka Web Browser → terus ke paparan anda.'],
      id: ['Di Web Browser, tekan menu ☰ (kanan atas) → "Add to Bookmarks".', 'Jika ada "Pin to Home" / "Add to Home", pilih — ubin muncul di Home.', 'Settings → "Startup page" → "Set page" → {url}.', 'Lain kali: buka Web Browser → langsung ke tampilan kamu.'],
    },
  },
  {
    id: 'vidaa', icon: '🟩', label: 'Hisense / Toshiba', brands: 'VIDAA OS · Browser',
    steps: {
      en: ['In the Browser, open the menu → ⭐ "Add bookmark".', 'If offered, choose "Add to Home" so EQrel appears in My Apps.', 'Browser Settings → Homepage → {url}.', 'Next time: open Browser → it starts on your display.'],
      ms: ['Dalam Browser, buka menu → ⭐ "Add bookmark".', 'Jika ada, pilih "Add to Home" supaya EQrel muncul di My Apps.', 'Settings Browser → Homepage → {url}.', 'Lain kali: buka Browser → terus ke paparan anda.'],
      id: ['Di Browser, buka menu → ⭐ "Add bookmark".', 'Jika ada, pilih "Add to Home" agar EQrel muncul di My Apps.', 'Settings Browser → Homepage → {url}.', 'Lain kali: buka Browser → langsung ke tampilan kamu.'],
    },
  },
  {
    id: 'firetv', icon: '🔥', label: 'Fire TV', brands: 'Amazon Silk Browser',
    steps: {
      en: ['In Silk Browser, press the ☰ Menu button → "Add Bookmark".', 'Silk opens bookmarks on its start screen — pick EQrel from there.', 'Optional: Settings → Homepage → {url}.', 'Next time: open Silk → EQrel bookmark.'],
      ms: ['Dalam Silk Browser, tekan butang ☰ Menu → "Add Bookmark".', 'Silk tunjuk bookmark di skrin mula — pilih EQrel dari situ.', 'Pilihan: Settings → Homepage → {url}.', 'Lain kali: buka Silk → bookmark EQrel.'],
      id: ['Di Silk Browser, tekan tombol ☰ Menu → "Add Bookmark".', 'Silk menampilkan bookmark di layar awal — pilih EQrel dari sana.', 'Opsional: Settings → Homepage → {url}.', 'Lain kali: buka Silk → bookmark EQrel.'],
    },
  },
  {
    id: 'other', icon: '🖥️', label: 'Other', brands: 'Huawei · Panasonic · Philips (Saphi) · others',
    steps: {
      en: ['In your TV browser, add this page as a ⭐ Bookmark / Favourite.', 'If the menu has "Add to Home" or "Pin", use it for a one-click tile.', 'Or set the browser Homepage / Start page to {url}.', 'No browser on the TV? Cast or plug in an Android TV box / Fire TV stick.'],
      ms: ['Dalam pelayar TV, tambah halaman ini sebagai ⭐ Bookmark / Favourite.', 'Jika menu ada "Add to Home" atau "Pin", guna untuk jubin satu klik.', 'Atau tetapkan Homepage / Start page pelayar kepada {url}.', 'TV tiada pelayar? Guna kotak Android TV / Fire TV stick.'],
      id: ['Di browser TV, tambahkan halaman ini sebagai ⭐ Bookmark / Favorit.', 'Jika menu punya "Add to Home" atau "Pin", gunakan untuk ubin satu klik.', 'Atau atur Homepage / Start page browser ke {url}.', 'TV tanpa browser? Gunakan box Android TV / Fire TV stick.'],
    },
  },
]
const pickL = (obj, lang) => obj?.[lang] || obj?.en

export default function TvSaveSheet({ open, onClose, lang = 'en' }) {
  const [{ os, brand }] = useState(() => detectTvPlatform())
  const [sel, setSel] = useState(os)
  const [bip, setBip] = useState(null)
  const [msg, setMsg] = useState('')
  const [host, setHost] = useState('')
  const firstRef = useRef(null)
  const L = (k) => pickL(C[k], lang)
  const rtl = lang === 'ar'

  useEffect(() => { setHost(window.location.host); setBip(getInstallEvent()); return onInstallEvent(setBip) }, [])
  useEffect(() => { if (open) { setSel(os); setMsg(''); setTimeout(() => firstRef.current?.focus(), 80) } }, [open, os])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (BACK_KEYS.has(e.keyCode) && !(e.keyCode === 8 && /INPUT|TEXTAREA/.test(document.activeElement?.tagName))) { e.preventDefault(); onClose?.() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const url = `${host || 'eqrel.app'}/tv`
  const plat = PLATFORMS.find(p => p.id === sel) || PLATFORMS[0]
  const steps = (plat.steps[lang] || plat.steps.en).map(s => s.replace('{url}', url))

  const install = async () => {
    const r = await promptInstall()
    if (r === 'accepted') { markTvSaveSeen('installed'); setMsg(L('installed')) }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-[2.5vmin]" data-testid="tv-save-sheet" dir={rtl ? 'rtl' : 'ltr'}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-[1200px] max-h-[95vh] overflow-y-auto rounded-[2.5vmin] border-2 p-[3vmin] text-white"
        style={{ background: 'linear-gradient(160deg,#0d5b4e 0%,#063f36 55%,#04251f 100%)', borderColor: 'rgba(255,183,3,0.45)', fontSize: 'clamp(14px, 1.5vmin + 0.35vw, 26px)' }}>
        <div className="flex items-start gap-[2vmin]">
          <div className="text-[3.2em] leading-none">📌</div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-[1.7em] leading-tight">{L('title')}</h2>
            <p className="opacity-80 mt-1">{L('sub')}</p>
          </div>
        </div>

        {bip && (
          <button ref={firstRef} onClick={install} data-testid="tv-save-install"
            className="tv-focus mt-[2vmin] w-full rounded-[1.6vmin] py-[1.6vmin] font-black text-[1.25em] text-slate-900 shadow-xl active:scale-[0.99]"
            style={{ backgroundColor: '#FFB703' }}>
            ⬇️ {L('install')}
          </button>
        )}
        {msg && <div className="mt-[1.5vmin] rounded-[1.2vmin] bg-emerald-500/25 border border-emerald-300/40 px-[2vmin] py-[1.2vmin] font-bold" data-testid="tv-save-msg">✅ {msg}</div>}

        <div className="mt-[2.4vmin] grid gap-[2vmin] md:grid-cols-[1.45fr_1fr]">
          <div>
            <div className="font-black uppercase tracking-wider text-[0.75em] mb-[1vmin]" style={{ color: '#FFB703' }}>{L('pick')}</div>
            <div className="flex flex-wrap gap-[1vmin] mb-[1.6vmin]">
              {PLATFORMS.map((p, i) => (
                <button key={p.id} ref={!bip && p.id === os ? firstRef : undefined} onClick={() => setSel(p.id)} onFocus={() => setSel(p.id)}
                  data-testid={`tv-save-plat-${p.id}`}
                  className={`tv-focus rounded-full px-[1.6vmin] py-[0.8vmin] font-extrabold border-2 transition-colors ${sel === p.id ? 'bg-white text-emerald-900 border-white' : 'bg-white/5 border-white/25 text-white'}`}>
                  {p.icon} {p.label}{p.id === os ? ` · ${L('detected')}` : ''}
                </button>
              ))}
            </div>
            <div className="rounded-[1.6vmin] bg-black/25 border border-white/15 p-[2vmin]" data-testid="tv-save-steps">
              <div className="text-[0.8em] opacity-70 font-bold mb-[1vmin]">{plat.brands}{brand && plat.id === os ? ` — ${brand}` : ''}</div>
              <ol className="space-y-[1.1vmin]">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-[1.4vmin] items-start">
                    <span className="flex-shrink-0 w-[1.8em] h-[1.8em] rounded-full flex items-center justify-center font-black text-slate-900" style={{ backgroundColor: '#FFB703' }}>{i + 1}</span>
                    <span className="leading-snug font-semibold">{s}</span>
                  </li>
                ))}
              </ol>
              {plat.id === 'android' && <p className="mt-[1.4vmin] text-[0.85em] opacity-75">💡 {L('noBrowser')}</p>}
            </div>
          </div>
          <div className="rounded-[1.6vmin] p-[2vmin] flex flex-col" style={{ backgroundColor: '#FFF8E7', color: '#0F2E25' }}>
            <div className="font-black uppercase tracking-wider text-[0.75em]" style={{ color: '#00B894' }}>⭐ {L('easiest')}</div>
            <div className="mt-[1.2vmin] rounded-[1.2vmin] bg-white border-2 px-[1.6vmin] py-[1.4vmin] text-center font-black text-[1.9em] tracking-wide break-all" style={{ borderColor: '#00B894' }} dir="ltr" data-testid="tv-save-url">
              {url}
            </div>
            <p className="mt-[1.2vmin] font-semibold leading-snug opacity-80">{L('easiestDesc')}</p>
          </div>
        </div>

        <div className="mt-[2.4vmin] flex flex-wrap gap-[1.4vmin] justify-end">
          <button onClick={() => { markTvSaveSeen('later'); onClose?.() }} data-testid="tv-save-later"
            className="tv-focus rounded-[1.4vmin] px-[2.4vmin] py-[1.2vmin] font-extrabold bg-white/10 border-2 border-white/25">
            {L('later')}
          </button>
          <button onClick={() => { markTvSaveSeen('done'); onClose?.() }} data-testid="tv-save-done"
            className="tv-focus rounded-[1.4vmin] px-[2.4vmin] py-[1.2vmin] font-black text-slate-900" style={{ backgroundColor: '#FFB703' }}>
            ✅ {L('done')}
          </button>
        </div>
      </div>
    </div>
  )
}
