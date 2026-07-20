'use client'

import { useState, useEffect } from 'react'
import { X, Tv, Cast, Smartphone, Chrome, Home, Wifi, KeyRound, Globe, Download, CheckCircle2 } from 'lucide-react'

/**
 * TVTutorialModal — Panduan cara buka EQrel Family Display di TV
 * 3 tab:
 *   1. Smart TV Browser (paling mudah)
 *   2. Cast dari Phone
 *   3. Install PWA di TV
 */
export default function TVTutorialModal({ open, onClose, defaultTab = 'browser' }) {
  const [tab, setTab] = useState(defaultTab)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const tabs = [
    { id: 'browser', label: 'Browser TV', icon: Tv, sub: 'Paling mudah' },
    { id: 'cast', label: 'Cast Phone', icon: Cast, sub: 'Chromecast' },
    { id: 'pwa', label: 'Install PWA', icon: Download, sub: 'Home screen' },
  ]

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-emerald-100 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <Tv className="w-6 h-6" />
          <div className="flex-1">
            <h2 className="text-base font-black leading-tight">Cara Buka di TV</h2>
            <p className="text-[11px] text-emerald-50/90">Panduan mudah untuk parent</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-emerald-100 bg-emerald-50/60 flex-shrink-0">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 border-b-2 transition-all ${active ? 'border-emerald-500 bg-white text-emerald-800' : 'border-transparent text-emerald-800/60 hover:bg-white/60'}`}>
                <Icon className="w-4 h-4" />
                <div className="text-[11px] font-extrabold leading-tight">{t.label}</div>
                <div className="text-[9px] opacity-70 leading-tight hidden sm:block">{t.sub}</div>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'browser' && <BrowserTab />}
          {tab === 'cast' && <CastTab />}
          {tab === 'pwa' && <PWATab />}
        </div>

        {/* Footer */}
        <div className="border-t border-emerald-100 px-5 py-3 bg-emerald-50/50 flex-shrink-0">
          <button onClick={onClose}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2.5 text-sm active:scale-[0.99]">
            Sudah Faham ✓
          </button>
        </div>
      </div>
    </div>
  )
}

/* ————————————————————— Tab 1: Smart TV Browser ————————————————————— */
const BrowserTab = () => (
  <div>
    <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-3 mb-4">
      <p className="text-xs text-emerald-900 font-bold flex items-start gap-2">
        <Tv className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Sesuai untuk <b>Smart TV</b> yang ada browser terbina (Samsung Tizen, LG WebOS, Android TV, Google TV, Chromecast dengan Google TV).</span>
      </p>
    </div>

    <StepList
      steps={[
        {
          icon: Wifi,
          title: '1. Pastikan TV bersambung ke internet',
          desc: 'TV mesti sambung WiFi/LAN yang sama dengan phone tuan.',
        },
        {
          icon: Globe,
          title: '2. Buka Browser di TV',
          desc: 'Cari app "Internet", "Web Browser", atau "Chrome" pada TV. Biasa ada di menu Apps.',
        },
        {
          icon: KeyRound,
          title: '3. Taip alamat ini di address bar',
          desc: null,
          highlight: 'eqrel.app/tv',
        },
        {
          icon: Smartphone,
          title: '4. Kembali ke phone → Jana Kod',
          desc: 'Di skrin Setup phone tuan, tekan butang "🔑 Jana Kod TV Baru". Kod 6-digit akan keluar.',
        },
        {
          icon: CheckCircle2,
          title: '5. Masukkan kod di TV',
          desc: 'Guna remote TV untuk taip 6-digit tadi → TV akan auto-load Family Display. Selamat menikmati!',
        },
      ]}
    />

    <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
      <p className="text-[11px] text-amber-900">
        <b>💡 Tip:</b> Kod sah untuk 15 minit. Kalau tamat, jana semula dari phone.
      </p>
    </div>
  </div>
)

/* ————————————————————— Tab 2: Cast dari Phone ————————————————————— */
const CastTab = () => (
  <div>
    <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-3 mb-4">
      <p className="text-xs text-blue-900 font-bold flex items-start gap-2">
        <Cast className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Sesuai kalau TV tuan ada <b>Chromecast</b>, <b>Android TV</b>, atau <b>Google TV</b>. Boleh guna dari Chrome di phone/laptop.</span>
      </p>
    </div>

    <StepList
      steps={[
        {
          icon: Wifi,
          title: '1. Phone & TV mesti WiFi yang sama',
          desc: 'Kalau tak, phone tak akan nampak TV.',
        },
        {
          icon: Chrome,
          title: '2. Buka Chrome browser',
          desc: 'Guna Chrome di phone Android, laptop, atau desktop.',
        },
        {
          icon: Globe,
          title: '3. Lawat Family Display',
          desc: 'Taip alamat penuh Family Display tuan (bukan /tv):',
          highlight: 'eqrel.app/display',
        },
        {
          icon: Cast,
          title: '4. Tekan menu ⋮ → "Cast..."',
          desc: 'Di Chrome, klik 3-titik menu di kanan atas → pilih "Cast..." → pilih TV/Chromecast tuan.',
        },
        {
          icon: CheckCircle2,
          title: '5. Nikmati di TV besar',
          desc: 'Family Display akan mirror ke TV. Nak stop, tekan Cast icon → "Stop casting".',
        },
      ]}
    />

    <div className="mt-4 rounded-xl bg-purple-50 border border-purple-200 p-3">
      <p className="text-[11px] text-purple-900">
        <b>🍎 iPhone / iPad:</b> Untuk AirPlay ke Apple TV — buka Safari → tekan Share → <b>AirPlay</b> → pilih Apple TV tuan.
      </p>
    </div>
  </div>
)

/* ————————————————————— Tab 3: Install PWA ————————————————————— */
const PWATab = () => (
  <div>
    <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 p-3 mb-4">
      <p className="text-xs text-purple-900 font-bold flex items-start gap-2">
        <Download className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Simpan EQrel sebagai <b>shortcut</b> di home screen TV supaya boleh buka terus tanpa taip URL setiap kali.</span>
      </p>
    </div>

    <div className="space-y-3">
      {/* Android TV / Google TV */}
      <div className="rounded-xl border-2 border-emerald-200 bg-white p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-lg">📺</div>
          <div>
            <div className="text-sm font-black text-emerald-900">Android TV / Google TV / Chromecast</div>
            <div className="text-[10px] text-emerald-800/60">Ada Chrome browser</div>
          </div>
        </div>
        <ol className="text-[11px] text-emerald-900 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Buka <b>Chrome</b> di TV → Lawat <span className="font-mono bg-emerald-50 px-1 rounded">eqrel.app/tv</span></li>
          <li>Tekan menu <b>⋮</b> (3-titik) di penjuru → <b>Add to Home screen</b> atau <b>Install</b></li>
          <li>Shortcut EQrel akan muncul di home TV — klik untuk buka full-screen</li>
        </ol>
      </div>

      {/* Samsung TV */}
      <div className="rounded-xl border-2 border-blue-200 bg-white p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-lg">📱</div>
          <div>
            <div className="text-sm font-black text-blue-900">Samsung Smart TV (Tizen)</div>
            <div className="text-[10px] text-blue-800/60">Internet Browser app</div>
          </div>
        </div>
        <ol className="text-[11px] text-blue-900 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Buka <b>Internet</b> app dari Apps → Lawat <span className="font-mono bg-blue-50 px-1 rounded">eqrel.app/tv</span></li>
          <li>Tekan <b>Bookmark ★</b> di menu browser → tandakan sebagai favourite</li>
          <li>Bookmark akan muncul di halaman utama browser TV setiap kali buka</li>
        </ol>
      </div>

      {/* LG WebOS */}
      <div className="rounded-xl border-2 border-pink-200 bg-white p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-lg">🖥️</div>
          <div>
            <div className="text-sm font-black text-pink-900">LG Smart TV (WebOS)</div>
            <div className="text-[10px] text-pink-800/60">Web Browser</div>
          </div>
        </div>
        <ol className="text-[11px] text-pink-900 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Buka <b>Web Browser</b> dari Launcher → Lawat <span className="font-mono bg-pink-50 px-1 rounded">eqrel.app/tv</span></li>
          <li>Tekan <b>★ Bookmark</b> untuk simpan</li>
          <li>Pilihannya: <b>Pin to Home</b> untuk letak shortcut terus di menu utama TV</li>
        </ol>
      </div>

      {/* Fallback */}
      <div className="rounded-xl border-2 border-amber-200 bg-white p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-lg">📺</div>
          <div>
            <div className="text-sm font-black text-amber-900">TV lama / tiada browser?</div>
            <div className="text-[10px] text-amber-800/60">Guna Chromecast/Fire Stick</div>
          </div>
        </div>
        <p className="text-[11px] text-amber-900 leading-relaxed">
          Beli <b>Chromecast</b> (~RM150) atau <b>Amazon Fire Stick</b> (~RM200) — pasang ke port HDMI TV, kemudian ikut cara di tab <b>Cast Phone</b>.
        </p>
      </div>
    </div>

    <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
      <p className="text-[11px] text-emerald-900 leading-relaxed">
        <Home className="w-3.5 h-3.5 inline mr-1" />
        <b>Selepas install:</b> Buka shortcut → masukkan Kod TV → biar terbuka. Family Display akan hidup sepanjang hari sebagai photo frame + habit board keluarga tuan. 🕌
      </p>
    </div>
  </div>
)

/* ————————————————————— Shared: Step list ————————————————————— */
const StepList = ({ steps }) => (
  <div className="space-y-2.5">
    {steps.map((s, i) => {
      const Icon = s.icon
      return (
        <div key={i} className="flex gap-3 items-start rounded-xl bg-white border-2 border-emerald-100 p-3 hover:border-emerald-200 transition-all">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-emerald-900 leading-tight">{s.title}</div>
            {s.desc && <div className="text-[11px] text-emerald-800/75 mt-0.5 leading-relaxed">{s.desc}</div>}
            {s.highlight && (
              <div className="mt-1.5 inline-block font-mono text-sm font-black text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-lg px-2.5 py-1">
                {s.highlight}
              </div>
            )}
          </div>
        </div>
      )
    })}
  </div>
)
