'use client'

import { useState, useEffect } from 'react'
import { X, Tv, Cast, Smartphone, Chrome, Home, Wifi, KeyRound, Globe, Download, CheckCircle2 } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'

/**
 * TVTutorialModal — Panduan cara buka EQrel Family Display di TV
 * 3 tab: Browser TV, Cast Phone, Install PWA
 * Fully i18n: ms / en / id / ar (with RTL support for ar)
 */
export default function TVTutorialModal({ open, onClose, defaultTab = 'browser' }) {
  const { lang, dir } = useLang()
  const [tab, setTab] = useState(defaultTab)
  const L = TR[lang] || TR.ms
  const isRTL = dir === 'rtl'

  // Dynamic host — use current origin for preview/staging, production uses eqrel.app
  const [host, setHost] = useState('eqrel.app')
  const [tvUrl, setTvUrl] = useState('{{TV_URL}}')
  const [displayUrl, setDisplayUrl] = useState('eqrel.app/display')
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const h = window.location.host
      setHost(h)
      setTvUrl(`${h}/tv`)
      setDisplayUrl(`${h}/display`)
    } catch { /* ignore */ }
  }, [])

  const isPreview = host && !host.includes('eqrel.app')
  const qrTvUrl = typeof window !== 'undefined'
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(`https://${host}/tv`)}`
    : ''

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
    { id: 'browser', label: L.tab_browser, sub: L.tab_browser_sub, icon: Tv },
    { id: 'cast', label: L.tab_cast, sub: L.tab_cast_sub, icon: Cast },
    { id: 'pwa', label: L.tab_pwa, sub: L.tab_pwa_sub, icon: Download },
  ]

  // Preview banner content (i18n)
  const previewBanner = isPreview && ({
    ms: 'Preview mode aktif — cara paling mudah untuk cuba di TV: gunakan Chrome Cast dari phone/laptop (lihat tab "Cast Phone") atau imbas QR code di bawah.',
    en: 'Preview mode active — easiest way to test on TV: use Chrome Cast from your phone/laptop (see "Cast Phone" tab) or scan the QR code below.',
    id: 'Mode Preview aktif — cara termudah tes di TV: gunakan Chrome Cast dari HP/laptop (lihat tab "Cast HP") atau pindai QR di bawah.',
    ar: 'وضع المعاينة نشط — أسهل طريقة للتجربة على التلفاز: استخدم Chrome Cast من الهاتف أو الحاسوب (انظر تبويب "بث الهاتف") أو امسح رمز QR أدناه.',
  }[lang] || 'Preview mode — use Chrome Cast or scan QR below')

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose} dir={dir}>
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-emerald-100 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <Tv className="w-6 h-6" />
          <div className="flex-1">
            <h2 className="text-base font-black leading-tight">{L.title}</h2>
            <p className="text-[11px] text-emerald-50/90">{L.subtitle}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview mode QR banner — only shown on preview/staging domains */}
        {isPreview && (
          <div className="px-4 pt-3 pb-2 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/60">
            <div className="flex items-start gap-3">
              <img
                src={qrTvUrl}
                alt="QR Code"
                className="w-20 h-20 rounded-lg border border-amber-300 bg-white flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-0.5">
                  🧪 {lang === 'ar' ? 'وضع المعاينة' : lang === 'en' ? 'Preview Mode' : lang === 'id' ? 'Mode Preview' : 'Mode Preview'}
                </div>
                <p className="text-[11px] text-amber-900 leading-tight mb-1">{previewBanner}</p>
                <div className="font-mono text-[9px] bg-white/70 border border-amber-200 rounded px-1.5 py-0.5 inline-block break-all leading-tight">
                  https://{tvUrl}
                </div>
              </div>
            </div>
          </div>
        )}

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
          {tab === 'browser' && <BrowserTab L={L} tvUrl={tvUrl} />}
          {tab === 'cast' && <CastTab L={L} displayUrl={displayUrl} />}
          {tab === 'pwa' && <PWATab L={L} tvUrl={tvUrl} />}
        </div>

        {/* Footer */}
        <div className="border-t border-emerald-100 px-5 py-3 bg-emerald-50/50 flex-shrink-0">
          <button onClick={onClose}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2.5 text-sm active:scale-[0.99]">
            {L.done} ✓
          </button>
        </div>
      </div>
    </div>
  )
}

/* ————————————————————— Tab 1: Smart TV Browser ————————————————————— */
const BrowserTab = ({ L, tvUrl = '{{TV_URL}}' }) => (
  <div>
    <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-3 mb-4">
      <p className="text-xs text-emerald-900 font-bold flex items-start gap-2">
        <Tv className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span dangerouslySetInnerHTML={{ __html: L.browser_intro }} />
      </p>
    </div>

    <StepList
      steps={[
        { icon: Wifi, title: L.b_step1_t, desc: L.b_step1_d },
        { icon: Globe, title: L.b_step2_t, desc: L.b_step2_d },
        { icon: KeyRound, title: L.b_step3_t, desc: null, highlight: tvUrl },
        { icon: Smartphone, title: L.b_step4_t, desc: L.b_step4_d },
        { icon: CheckCircle2, title: L.b_step5_t, desc: L.b_step5_d },
      ]}
    />

    <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
      <p className="text-[11px] text-amber-900" dangerouslySetInnerHTML={{ __html: `<b>💡 ${L.tip}:</b> ${L.browser_tip}` }} />
    </div>
  </div>
)

/* ————————————————————— Tab 2: Cast dari Phone ————————————————————— */
const CastTab = ({ L, displayUrl = 'eqrel.app/display' }) => (
  <div>
    <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-3 mb-4">
      <p className="text-xs text-blue-900 font-bold flex items-start gap-2">
        <Cast className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span dangerouslySetInnerHTML={{ __html: L.cast_intro }} />
      </p>
    </div>

    <StepList
      steps={[
        { icon: Wifi, title: L.c_step1_t, desc: L.c_step1_d },
        { icon: Chrome, title: L.c_step2_t, desc: L.c_step2_d },
        { icon: Globe, title: L.c_step3_t, desc: L.c_step3_d, highlight: displayUrl },
        { icon: Cast, title: L.c_step4_t, desc: L.c_step4_d },
        { icon: CheckCircle2, title: L.c_step5_t, desc: L.c_step5_d },
      ]}
    />

    <div className="mt-4 rounded-xl bg-purple-50 border border-purple-200 p-3">
      <p className="text-[11px] text-purple-900" dangerouslySetInnerHTML={{ __html: `<b>🍎 iPhone / iPad:</b> ${L.cast_ios}` }} />
    </div>
  </div>
)

/* ————————————————————— Tab 3: Install PWA ————————————————————— */
const PWATab = ({ L, tvUrl = '{{TV_URL}}' }) => (
  <div>
    <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 p-3 mb-4">
      <p className="text-xs text-purple-900 font-bold flex items-start gap-2">
        <Download className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span dangerouslySetInnerHTML={{ __html: L.pwa_intro }} />
      </p>
    </div>

    <div className="space-y-3">
      <BrandCard emoji="📺" color="emerald" title="Android TV / Google TV / Chromecast" sub={L.pwa_android_sub} items={L.pwa_android_steps.map(s => s.replace(/\{\{TV_URL\}\}/g, tvUrl))} />
      <BrandCard emoji="📱" color="blue" title="Samsung Smart TV (Tizen)" sub={L.pwa_samsung_sub} items={L.pwa_samsung_steps.map(s => s.replace(/\{\{TV_URL\}\}/g, tvUrl))} />
      <BrandCard emoji="🖥️" color="pink" title="LG Smart TV (WebOS)" sub={L.pwa_lg_sub} items={L.pwa_lg_steps.map(s => s.replace(/\{\{TV_URL\}\}/g, tvUrl))} />
      <BrandCard emoji="📺" color="amber" title={L.pwa_fallback_title} sub={L.pwa_fallback_sub} paragraph={L.pwa_fallback_body} />
    </div>

    <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
      <p className="text-[11px] text-emerald-900 leading-relaxed">
        <Home className="w-3.5 h-3.5 inline mr-1" />
        <span dangerouslySetInnerHTML={{ __html: `<b>${L.pwa_after_install}:</b> ${L.pwa_after_body}` }} />
      </p>
    </div>
  </div>
)

/* ————————————————————— Shared: BrandCard ————————————————————— */
const BrandCard = ({ emoji, color, title, sub, items, paragraph }) => {
  const colors = {
    emerald: { border: 'border-emerald-200', chip: 'bg-emerald-100', head: 'text-emerald-900', body: 'text-emerald-900', mono: 'bg-emerald-50' },
    blue:    { border: 'border-blue-200',    chip: 'bg-blue-100',    head: 'text-blue-900',    body: 'text-blue-900',    mono: 'bg-blue-50' },
    pink:    { border: 'border-pink-200',    chip: 'bg-pink-100',    head: 'text-pink-900',    body: 'text-pink-900',    mono: 'bg-pink-50' },
    amber:   { border: 'border-amber-200',   chip: 'bg-amber-100',   head: 'text-amber-900',   body: 'text-amber-900',   mono: 'bg-amber-50' },
  }
  const c = colors[color] || colors.emerald
  return (
    <div className={`rounded-xl border-2 ${c.border} bg-white p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${c.chip} flex items-center justify-center text-lg`}>{emoji}</div>
        <div>
          <div className={`text-sm font-black ${c.head}`}>{title}</div>
          <div className="text-[10px] opacity-60">{sub}</div>
        </div>
      </div>
      {items && (
        <ol className={`text-[11px] ${c.body} space-y-1 list-decimal list-inside leading-relaxed`}>
          {items.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: it.replace(/`([^`]+)`/g, `<span class="font-mono ${c.mono} px-1 rounded">$1</span>`) }} />
          ))}
        </ol>
      )}
      {paragraph && (
        <p className={`text-[11px] ${c.body} leading-relaxed`} dangerouslySetInnerHTML={{ __html: paragraph }} />
      )}
    </div>
  )
}

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
            {s.desc && <div className="text-[11px] text-emerald-800/75 mt-0.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: s.desc }} />}
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

/* ————————————————————— TRANSLATIONS ————————————————————— */
const TR = {
  ms: {
    title: 'Cara Buka di TV',
    subtitle: 'Panduan mudah untuk parent',
    done: 'Sudah Faham',
    tip: 'Tip',
    tab_browser: 'Browser TV',
    tab_browser_sub: 'Paling mudah',
    tab_cast: 'Cast Phone',
    tab_cast_sub: 'Chromecast',
    tab_pwa: 'Install PWA',
    tab_pwa_sub: 'Home screen',

    // Browser tab
    browser_intro: 'Sesuai untuk <b>Smart TV</b> yang ada browser terbina (Samsung Tizen, LG WebOS, Android TV, Google TV, Chromecast dengan Google TV).',
    b_step1_t: '1. Pastikan TV bersambung ke internet',
    b_step1_d: 'TV mesti sambung WiFi/LAN yang sama dengan phone tuan.',
    b_step2_t: '2. Buka Browser di TV',
    b_step2_d: 'Cari app "Internet", "Web Browser", atau "Chrome" pada TV. Biasa ada di menu Apps.',
    b_step3_t: '3. Taip alamat ini di address bar',
    b_step4_t: '4. Kembali ke phone → Jana Kod',
    b_step4_d: 'Di skrin Setup phone tuan, tekan butang <b>🔑 Jana Kod TV Baru</b>. Kod 6-digit akan keluar.',
    b_step5_t: '5. Masukkan kod di TV',
    b_step5_d: 'Guna remote TV untuk taip 6-digit tadi → TV akan auto-load Family Display. Selamat menikmati!',
    browser_tip: 'Kod sah untuk 15 minit. Kalau tamat, jana semula dari phone.',

    // Cast tab
    cast_intro: 'Sesuai kalau TV tuan ada <b>Chromecast</b>, <b>Android TV</b>, atau <b>Google TV</b>. Boleh guna dari Chrome di phone/laptop.',
    c_step1_t: '1. Phone & TV mesti WiFi yang sama',
    c_step1_d: 'Kalau tak, phone tak akan nampak TV.',
    c_step2_t: '2. Buka Chrome browser',
    c_step2_d: 'Guna Chrome di phone Android, laptop, atau desktop.',
    c_step3_t: '3. Lawat Family Display',
    c_step3_d: 'Taip alamat penuh Family Display tuan (bukan /tv):',
    c_step4_t: '4. Tekan menu ⋮ → Cast',
    c_step4_d: 'Di Chrome, klik 3-titik menu di kanan atas → pilih <b>Cast…</b> → pilih TV/Chromecast tuan.',
    c_step5_t: '5. Nikmati di TV besar',
    c_step5_d: 'Family Display akan mirror ke TV. Nak stop, tekan Cast icon → <b>Stop casting</b>.',
    cast_ios: 'Untuk AirPlay ke Apple TV — buka Safari → tekan Share → <b>AirPlay</b> → pilih Apple TV tuan.',

    // PWA tab
    pwa_intro: 'Simpan EQrel sebagai <b>shortcut</b> di home screen TV supaya boleh buka terus tanpa taip URL setiap kali.',
    pwa_android_sub: 'Ada Chrome browser',
    pwa_android_steps: [
      'Buka <b>Chrome</b> di TV → Lawat `{{TV_URL}}`',
      'Tekan menu <b>⋮</b> (3-titik) di penjuru → <b>Add to Home screen</b> atau <b>Install</b>',
      'Shortcut EQrel akan muncul di home TV — klik untuk buka full-screen',
    ],
    pwa_samsung_sub: 'Internet Browser app',
    pwa_samsung_steps: [
      'Buka <b>Internet</b> app dari Apps → Lawat `{{TV_URL}}`',
      'Tekan <b>Bookmark ★</b> di menu browser → tandakan sebagai favourite',
      'Bookmark akan muncul di halaman utama browser TV setiap kali buka',
    ],
    pwa_lg_sub: 'Web Browser',
    pwa_lg_steps: [
      'Buka <b>Web Browser</b> dari Launcher → Lawat `{{TV_URL}}`',
      'Tekan <b>★ Bookmark</b> untuk simpan',
      'Pilihannya: <b>Pin to Home</b> untuk letak shortcut terus di menu utama TV',
    ],
    pwa_fallback_title: 'TV lama / tiada browser?',
    pwa_fallback_sub: 'Guna Chromecast/Fire Stick',
    pwa_fallback_body: 'Beli <b>Chromecast</b> (~RM150) atau <b>Amazon Fire Stick</b> (~RM200) — pasang ke port HDMI TV, kemudian ikut cara di tab <b>Cast Phone</b>.',
    pwa_after_install: 'Selepas install',
    pwa_after_body: 'Buka shortcut → masukkan Kod TV → biar terbuka. Family Display akan hidup sepanjang hari sebagai photo frame + habit board keluarga tuan. 🕌',
  },

  en: {
    title: 'How to Open on TV',
    subtitle: 'Simple guide for parents',
    done: 'Got it',
    tip: 'Tip',
    tab_browser: 'TV Browser',
    tab_browser_sub: 'Easiest',
    tab_cast: 'Cast Phone',
    tab_cast_sub: 'Chromecast',
    tab_pwa: 'Install PWA',
    tab_pwa_sub: 'Home screen',

    browser_intro: 'Best for <b>Smart TVs</b> with a built-in browser (Samsung Tizen, LG WebOS, Android TV, Google TV, Chromecast with Google TV).',
    b_step1_t: '1. Make sure the TV is online',
    b_step1_d: 'The TV must be on the same WiFi/LAN as your phone.',
    b_step2_t: '2. Open the Browser on your TV',
    b_step2_d: 'Look for the "Internet", "Web Browser" or "Chrome" app on the TV — usually under Apps.',
    b_step3_t: '3. Type this address in the URL bar',
    b_step4_t: '4. Back on your phone → Generate Code',
    b_step4_d: 'On the Setup screen, tap <b>🔑 Generate New TV Code</b>. A 6-digit code will appear.',
    b_step5_t: '5. Enter the code on the TV',
    b_step5_d: 'Use the TV remote to type the 6 digits → the TV will auto-load Family Display. Enjoy!',
    browser_tip: 'Codes are valid for 15 minutes. If expired, just generate a new one from your phone.',

    cast_intro: 'Great if your TV has <b>Chromecast</b>, <b>Android TV</b>, or <b>Google TV</b>. Works from Chrome on your phone or laptop.',
    c_step1_t: '1. Phone & TV must share WiFi',
    c_step1_d: 'Otherwise your phone won\'t see the TV.',
    c_step2_t: '2. Open Chrome browser',
    c_step2_d: 'Use Chrome on Android, laptop, or desktop.',
    c_step3_t: '3. Visit Family Display',
    c_step3_d: 'Type your full Family Display URL (not /tv):',
    c_step4_t: '4. Tap menu ⋮ → Cast',
    c_step4_d: 'In Chrome, click the 3-dot menu top-right → choose <b>Cast…</b> → pick your TV/Chromecast.',
    c_step5_t: '5. Enjoy on the big screen',
    c_step5_d: 'Family Display will mirror to the TV. To stop, tap the Cast icon → <b>Stop casting</b>.',
    cast_ios: 'For AirPlay to Apple TV — open Safari → tap Share → <b>AirPlay</b> → select your Apple TV.',

    pwa_intro: 'Save EQrel as a <b>shortcut</b> on your TV home screen so you can open it directly without typing the URL every time.',
    pwa_android_sub: 'Has Chrome browser',
    pwa_android_steps: [
      'Open <b>Chrome</b> on TV → Visit `{{TV_URL}}`',
      'Tap the <b>⋮</b> (3-dot) menu → <b>Add to Home screen</b> or <b>Install</b>',
      'The EQrel shortcut will appear on the TV home — tap to open full-screen',
    ],
    pwa_samsung_sub: 'Internet Browser app',
    pwa_samsung_steps: [
      'Open <b>Internet</b> app from Apps → Visit `{{TV_URL}}`',
      'Tap <b>Bookmark ★</b> in the browser menu → mark as favourite',
      'The bookmark will appear on the browser home page every time you open it',
    ],
    pwa_lg_sub: 'Web Browser',
    pwa_lg_steps: [
      'Open <b>Web Browser</b> from Launcher → Visit `{{TV_URL}}`',
      'Tap <b>★ Bookmark</b> to save',
      'Optionally: <b>Pin to Home</b> to place the shortcut on the main TV menu',
    ],
    pwa_fallback_title: 'Old TV / no browser?',
    pwa_fallback_sub: 'Use Chromecast/Fire Stick',
    pwa_fallback_body: 'Get a <b>Chromecast</b> (~$35) or <b>Amazon Fire Stick</b> (~$45) — plug into the TV\'s HDMI port, then follow the <b>Cast Phone</b> tab.',
    pwa_after_install: 'After install',
    pwa_after_body: 'Open the shortcut → enter the TV Code → leave it running. Family Display will stay on all day as a photo frame + your family\'s habit board. 🕌',
  },

  id: {
    title: 'Cara Buka di TV',
    subtitle: 'Panduan mudah untuk orang tua',
    done: 'Sudah Paham',
    tip: 'Tips',
    tab_browser: 'Browser TV',
    tab_browser_sub: 'Paling mudah',
    tab_cast: 'Cast HP',
    tab_cast_sub: 'Chromecast',
    tab_pwa: 'Install PWA',
    tab_pwa_sub: 'Layar utama',

    browser_intro: 'Cocok untuk <b>Smart TV</b> yang punya browser bawaan (Samsung Tizen, LG WebOS, Android TV, Google TV, Chromecast dengan Google TV).',
    b_step1_t: '1. Pastikan TV terhubung ke internet',
    b_step1_d: 'TV harus terhubung ke WiFi/LAN yang sama dengan HP Anda.',
    b_step2_t: '2. Buka Browser di TV',
    b_step2_d: 'Cari aplikasi "Internet", "Web Browser", atau "Chrome" di TV. Biasanya ada di menu Apps.',
    b_step3_t: '3. Ketik alamat ini di address bar',
    b_step4_t: '4. Kembali ke HP → Buat Kode',
    b_step4_d: 'Di layar Setup HP Anda, tekan tombol <b>🔑 Buat Kode TV Baru</b>. Kode 6-digit akan muncul.',
    b_step5_t: '5. Masukkan kode di TV',
    b_step5_d: 'Gunakan remote TV untuk mengetik 6-digit tadi → TV akan auto-load Family Display. Selamat menikmati!',
    browser_tip: 'Kode berlaku 15 menit. Kalau habis, buat baru dari HP.',

    cast_intro: 'Cocok kalau TV Anda punya <b>Chromecast</b>, <b>Android TV</b>, atau <b>Google TV</b>. Bisa dari Chrome di HP/laptop.',
    c_step1_t: '1. HP & TV harus WiFi yang sama',
    c_step1_d: 'Kalau tidak, HP tidak akan lihat TV.',
    c_step2_t: '2. Buka Chrome browser',
    c_step2_d: 'Gunakan Chrome di HP Android, laptop, atau desktop.',
    c_step3_t: '3. Buka Family Display',
    c_step3_d: 'Ketik alamat lengkap Family Display Anda (bukan /tv):',
    c_step4_t: '4. Tekan menu ⋮ → Cast',
    c_step4_d: 'Di Chrome, klik menu 3-titik di kanan atas → pilih <b>Cast…</b> → pilih TV/Chromecast Anda.',
    c_step5_t: '5. Nikmati di TV besar',
    c_step5_d: 'Family Display akan mirror ke TV. Untuk stop, tekan icon Cast → <b>Stop casting</b>.',
    cast_ios: 'Untuk AirPlay ke Apple TV — buka Safari → tekan Share → <b>AirPlay</b> → pilih Apple TV Anda.',

    pwa_intro: 'Simpan EQrel sebagai <b>shortcut</b> di layar utama TV supaya bisa buka langsung tanpa ketik URL setiap kali.',
    pwa_android_sub: 'Ada Chrome browser',
    pwa_android_steps: [
      'Buka <b>Chrome</b> di TV → Buka `{{TV_URL}}`',
      'Tekan menu <b>⋮</b> (3-titik) di pojok → <b>Add to Home screen</b> atau <b>Install</b>',
      'Shortcut EQrel akan muncul di layar utama TV — klik untuk buka full-screen',
    ],
    pwa_samsung_sub: 'Internet Browser app',
    pwa_samsung_steps: [
      'Buka aplikasi <b>Internet</b> dari Apps → Buka `{{TV_URL}}`',
      'Tekan <b>Bookmark ★</b> di menu browser → tandai sebagai favorit',
      'Bookmark akan muncul di halaman utama browser TV setiap kali buka',
    ],
    pwa_lg_sub: 'Web Browser',
    pwa_lg_steps: [
      'Buka <b>Web Browser</b> dari Launcher → Buka `{{TV_URL}}`',
      'Tekan <b>★ Bookmark</b> untuk simpan',
      'Opsional: <b>Pin to Home</b> untuk menaruh shortcut di menu utama TV',
    ],
    pwa_fallback_title: 'TV lama / tanpa browser?',
    pwa_fallback_sub: 'Pakai Chromecast/Fire Stick',
    pwa_fallback_body: 'Beli <b>Chromecast</b> (~Rp500rb) atau <b>Amazon Fire Stick</b> (~Rp650rb) — colokkan ke port HDMI TV, kemudian ikuti tab <b>Cast HP</b>.',
    pwa_after_install: 'Setelah install',
    pwa_after_body: 'Buka shortcut → masukkan Kode TV → biarkan menyala. Family Display akan hidup sepanjang hari sebagai photo frame + papan habit keluarga Anda. 🕌',
  },

  ar: {
    title: 'كيفية الفتح على التلفاز',
    subtitle: 'دليل بسيط لأولياء الأمور',
    done: 'فهمت',
    tip: 'نصيحة',
    tab_browser: 'متصفح التلفاز',
    tab_browser_sub: 'الأسهل',
    tab_cast: 'بث من الهاتف',
    tab_cast_sub: 'Chromecast',
    tab_pwa: 'تثبيت PWA',
    tab_pwa_sub: 'الشاشة الرئيسية',

    browser_intro: 'مناسب <b>لأجهزة التلفاز الذكية</b> التي بها متصفح مدمج (Samsung Tizen، LG WebOS، Android TV، Google TV، Chromecast مع Google TV).',
    b_step1_t: '١. تأكد من اتصال التلفاز بالإنترنت',
    b_step1_d: 'يجب أن يكون التلفاز على نفس شبكة WiFi/LAN الخاصة بهاتفك.',
    b_step2_t: '٢. افتح المتصفح على التلفاز',
    b_step2_d: 'ابحث عن تطبيق "Internet" أو "Web Browser" أو "Chrome" على التلفاز، عادةً في قائمة التطبيقات.',
    b_step3_t: '٣. اكتب هذا العنوان في شريط العناوين',
    b_step4_t: '٤. ارجع للهاتف → أنشئ الرمز',
    b_step4_d: 'في شاشة الإعداد بالهاتف، اضغط زر <b>🔑 إنشاء رمز تلفاز جديد</b>. سيظهر رمز من ٦ أرقام.',
    b_step5_t: '٥. أدخل الرمز في التلفاز',
    b_step5_d: 'استخدم ريموت التلفاز لكتابة الأرقام الستة → سيتم تحميل Family Display تلقائيًا. استمتع!',
    browser_tip: 'الرمز صالح لمدة ١٥ دقيقة. إذا انتهت، أنشئ رمزًا جديدًا من الهاتف.',

    cast_intro: 'مناسب إذا كان تلفازك يدعم <b>Chromecast</b> أو <b>Android TV</b> أو <b>Google TV</b>. يعمل من Chrome على الهاتف أو الحاسوب.',
    c_step1_t: '١. الهاتف والتلفاز على نفس WiFi',
    c_step1_d: 'وإلا فلن يرى الهاتف التلفاز.',
    c_step2_t: '٢. افتح متصفح Chrome',
    c_step2_d: 'استخدم Chrome على هاتف Android أو الحاسوب.',
    c_step3_t: '٣. افتح Family Display',
    c_step3_d: 'اكتب العنوان الكامل لـ Family Display (وليس /tv):',
    c_step4_t: '٤. اضغط قائمة ⋮ → Cast',
    c_step4_d: 'في Chrome، اضغط قائمة ٣ نقاط أعلى اليمين → اختر <b>Cast…</b> → اختر التلفاز/Chromecast.',
    c_step5_t: '٥. استمتع على الشاشة الكبيرة',
    c_step5_d: 'سيتم عرض Family Display على التلفاز. للإيقاف: اضغط أيقونة Cast → <b>Stop casting</b>.',
    cast_ios: 'للبث AirPlay إلى Apple TV — افتح Safari → اضغط مشاركة → <b>AirPlay</b> → اختر Apple TV.',

    pwa_intro: 'احفظ EQrel كـ <b>اختصار</b> على الشاشة الرئيسية للتلفاز لتفتحه مباشرة دون كتابة العنوان في كل مرة.',
    pwa_android_sub: 'به متصفح Chrome',
    pwa_android_steps: [
      'افتح <b>Chrome</b> على التلفاز → اذهب إلى `{{TV_URL}}`',
      'اضغط قائمة <b>⋮</b> (٣ نقاط) → <b>Add to Home screen</b> أو <b>Install</b>',
      'سيظهر اختصار EQrel على الشاشة الرئيسية — اضغطه ليفتح ملء الشاشة',
    ],
    pwa_samsung_sub: 'تطبيق Internet Browser',
    pwa_samsung_steps: [
      'افتح تطبيق <b>Internet</b> من التطبيقات → اذهب إلى `{{TV_URL}}`',
      'اضغط <b>Bookmark ★</b> في قائمة المتصفح → أضفه للمفضلة',
      'سيظهر الإشارة المرجعية في الصفحة الرئيسية للمتصفح كل مرة',
    ],
    pwa_lg_sub: 'Web Browser',
    pwa_lg_steps: [
      'افتح <b>Web Browser</b> من Launcher → اذهب إلى `{{TV_URL}}`',
      'اضغط <b>★ Bookmark</b> للحفظ',
      'اختياري: <b>Pin to Home</b> لوضع الاختصار في القائمة الرئيسية للتلفاز',
    ],
    pwa_fallback_title: 'تلفاز قديم / بدون متصفح؟',
    pwa_fallback_sub: 'استخدم Chromecast/Fire Stick',
    pwa_fallback_body: 'اشترِ <b>Chromecast</b> أو <b>Amazon Fire Stick</b> — وصّله بمنفذ HDMI في التلفاز، ثم اتبع تعليمات تبويب <b>بث من الهاتف</b>.',
    pwa_after_install: 'بعد التثبيت',
    pwa_after_body: 'افتح الاختصار → أدخل رمز التلفاز → اتركه يعمل. سيبقى Family Display مفتوحًا طوال اليوم كإطار صور ولوحة عادات لعائلتك. 🕌',
  },
}
