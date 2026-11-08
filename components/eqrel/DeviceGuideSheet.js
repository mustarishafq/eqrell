'use client'

// Parent guide: how to set up a child's device (situations, linking steps, locking the
// device to EQrel, home-screen icon & settings, troubleshooting). Content mirrors the
// features we actually ship: Child's Own Device (way A QR / way B code), shared tablet,
// Kid Mode + PIN on the parent's phone, Family Display on TV.
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, BookOpen } from 'lucide-react'

const CI = { green: '#00B894', yellow: '#FFB703', coral: '#FF5D6E', blue: '#2D9CDB', ink: '#0F2E25', cream: '#FFF8E7' }

// {host} is replaced with the real domain (eqrel.app on live)
const CONTENT = {
  en: {
    title: 'Child Device Guide',
    sub: "Set up your child's phone or tablet in a few minutes",
    situationsTitle: 'Which setup fits your family?',
    situations: [
      { e: '📱', t: 'My child has their own phone or tablet', d: "Use Child's Own Device and pick that child. No email or password for your child.", cta: 'kid' },
      { e: '👨‍👩‍👧', t: 'Siblings share one tablet', d: "Use Child's Own Device and choose “All children (shared tablet)”. Each child taps their own avatar; “Switch child” goes back.", cta: 'kid' },
      { e: '🤳', t: 'My child uses my phone', d: 'Open Kid Mode on your phone. Leaving Kid Mode needs your Parent PIN. Device Settings sets how your phone starts.', cta: 'this' },
      { e: '📺', t: 'The whole family on the TV', d: 'Open {host}/tv on the TV browser and scan the QR with your phone.', cta: 'tv' },
    ],
    ctas: { kid: "Open Child's Own Device", this: 'Open Device Settings', tv: 'Open TV Display Setup' },
    sections: [
      { id: 'connect', e: '🔗', t: "Connect a child's device", groups: [
        { h: 'Way A — scan the QR (easiest)', steps: [
          "On your child's device, open {host}/kid (or tap “This is my child's device” on the sign-in page).",
          'It shows a QR code and a 6-number code.',
          "Scan the QR with your phone camera — or go to Profile → Child's Own Device and type the code.",
          'Choose the child (or “All children”) and tap Connect.',
          "Your child's device opens Kid Mode within a few seconds.",
        ] },
        { h: 'Way B — give your child a code', steps: [
          "Profile → Child's Own Device → choose the child → Create code (lasts 15 minutes, works once).",
          "On your child's device open {host}/kid → “I have a code” → type it → Connect.",
        ] },
      ], note: 'Your child stays signed in. They can only see their Kid Mode and World — parent features stay locked on that device.' },
      { id: 'lock', e: '🔒', t: 'Lock the device to EQrel only', groups: [
        { h: 'iPhone / iPad — Guided Access', steps: [
          'Settings → Accessibility → Guided Access → turn On and set a passcode.',
          'Open EQrel, then triple-click the side (or Home) button → Start.',
          'To leave: triple-click again and enter your passcode.',
        ] },
        { h: 'iPhone / iPad — Screen Time', steps: [
          'Settings → Screen Time → Downtime and App Limits to set daily limits.',
          'Add Safari (or the EQrel icon) to “Always Allowed” so habits and prayer times stay open.',
        ] },
        { h: 'Android — App pinning', steps: [
          'Settings → Security → App pinning (or “Pin windows”) → On, with “Ask for PIN before unpinning”.',
          'Open EQrel → Recent apps → tap the EQrel icon → Pin.',
          'To unpin: hold Back + Recent apps (or swipe up and hold), then enter your PIN.',
        ] },
        { h: 'Android — Google Family Link', steps: [
          'Install Family Link on your phone to set screen time, bedtime and which apps your child can use.',
          'Allow Chrome (and the EQrel icon) so EQrel keeps working.',
        ] },
      ] },
      { id: 'setup', e: '✨', t: 'Make it feel like an app', groups: [
        { h: 'Add the EQrel icon to the home screen', steps: [
          'iPhone / iPad: open {host}/kid in Safari → Share button → “Add to Home Screen”.',
          'Android: open {host}/kid in Chrome → ⋮ menu → “Install app” or “Add to Home screen”.',
          'Always open EQrel from that icon — it opens full screen like a real app.',
        ] },
        { h: 'Good settings for kids', steps: [
          'Sound on at medium volume (Bismillah & Alhamdulillah sounds). On iPhone, turn the silent switch off.',
          'Auto-lock 5 minutes or more for younger children, brightness comfortable.',
          'Date & time set to automatic — prayer times depend on it.',
          'Keep the device in a shared family space and charge it there overnight.',
        ] },
      ] },
      { id: 'help', e: '🛟', t: 'When something goes wrong', faq: [
        ['The device shows the “Connect” screen again', 'It was disconnected, or the browser data was cleared. Show the QR again and scan it.'],
        ['A device is lost, sold or broken', "Profile → Child's Own Device → Linked devices → Disconnect. Access ends immediately."],
        ['The wrong child is on a device', 'Disconnect it, then link again and choose the right child (or “All children”).'],
        ['The code expired', 'Tap “New code” on the child\'s device, or “Create code” again on your phone. Codes last 10–15 minutes.'],
        ["I need parent mode on my child's device", 'Tap “Parent? Sign in” in the bottom corner of Kid Mode and sign in with Google. That device becomes a parent device.'],
        ['Ticked habits are not counted yet', "They wait for your check in Quick Verify (unless Trust Mode is on). You get a notification each time your child ticks a habit."],
        ['It opened inside WhatsApp / Instagram', 'Those in-app browsers can\'t stay signed in. Open the link in Safari or Chrome.'],
      ] },
    ],
  },
  ms: {
    title: 'Panduan Peranti Anak',
    sub: 'Sediakan telefon atau tablet anak dalam beberapa minit',
    situationsTitle: 'Situasi keluarga anda?',
    situations: [
      { e: '📱', t: 'Anak ada telefon atau tablet sendiri', d: 'Guna Peranti Anak dan pilih anak itu. Anak tak perlu email atau kata laluan.', cta: 'kid' },
      { e: '👨‍👩‍👧', t: 'Adik-beradik berkongsi satu tablet', d: 'Guna Peranti Anak dan pilih “Semua anak (tablet kongsi)”. Setiap anak tekan avatar sendiri; “Tukar anak” untuk kembali.', cta: 'kid' },
      { e: '🤳', t: 'Anak guna telefon saya', d: 'Buka Kid Mode di telefon anda. Keluar dari Kid Mode perlu PIN Ibu Bapa. Tetapan Peranti tentukan cara telefon bermula.', cta: 'this' },
      { e: '📺', t: 'Seluruh keluarga di TV', d: 'Buka {host}/tv di pelayar TV dan imbas QR dengan telefon anda.', cta: 'tv' },
    ],
    ctas: { kid: 'Buka Peranti Anak', this: 'Buka Tetapan Peranti', tv: 'Buka Tetapan Paparan TV' },
    sections: [
      { id: 'connect', e: '🔗', t: 'Sambung peranti anak', groups: [
        { h: 'Cara A — imbas QR (paling mudah)', steps: [
          'Di peranti anak, buka {host}/kid (atau tekan “Ini peranti anak saya” di halaman log masuk).',
          'Skrin papar kod QR dan kod 6 nombor.',
          'Imbas QR dengan kamera telefon anda — atau Profil → Peranti Anak dan taip kod itu.',
          'Pilih anak (atau “Semua anak”) dan tekan Sambung.',
          'Peranti anak terus buka Kid Mode dalam beberapa saat.',
        ] },
        { h: 'Cara B — beri kod kepada anak', steps: [
          'Profil → Peranti Anak → pilih anak → Jana kod (sah 15 minit, sekali guna).',
          'Di peranti anak buka {host}/kid → “Saya ada kod” → taip → Sambung.',
        ] },
      ], note: 'Anak kekal log masuk. Mereka hanya nampak Kid Mode dan World sendiri — bahagian ibu bapa dikunci di peranti itu.' },
      { id: 'lock', e: '🔒', t: 'Kunci peranti pada EQrel sahaja', groups: [
        { h: 'iPhone / iPad — Guided Access', steps: [
          'Settings → Accessibility → Guided Access → hidupkan dan tetapkan kod laluan.',
          'Buka EQrel, kemudian tekan butang sisi (atau Home) 3 kali → Start.',
          'Untuk keluar: tekan 3 kali lagi dan masukkan kod laluan.',
        ] },
        { h: 'iPhone / iPad — Screen Time', steps: [
          'Settings → Screen Time → Downtime dan App Limits untuk had harian.',
          'Tambah Safari (atau ikon EQrel) ke “Always Allowed” supaya habit dan waktu solat sentiasa boleh dibuka.',
        ] },
        { h: 'Android — App pinning', steps: [
          'Settings → Security → App pinning (atau “Pin windows”) → hidupkan, bersama “Minta PIN sebelum nyahpin”.',
          'Buka EQrel → Recent apps → tekan ikon EQrel → Pin.',
          'Untuk nyahpin: tekan lama Back + Recent apps (atau leret ke atas dan tahan), kemudian masukkan PIN.',
        ] },
        { h: 'Android — Google Family Link', steps: [
          'Pasang Family Link di telefon anda untuk tetapkan masa skrin, waktu tidur dan app yang dibenarkan.',
          'Benarkan Chrome (dan ikon EQrel) supaya EQrel terus berfungsi.',
        ] },
      ] },
      { id: 'setup', e: '✨', t: 'Jadikan seperti app sebenar', groups: [
        { h: 'Letak ikon EQrel di skrin utama', steps: [
          'iPhone / iPad: buka {host}/kid di Safari → butang Kongsi → “Add to Home Screen”.',
          'Android: buka {host}/kid di Chrome → menu ⋮ → “Install app” atau “Add to Home screen”.',
          'Sentiasa buka EQrel dari ikon itu — ia dibuka skrin penuh seperti app sebenar.',
        ] },
        { h: 'Tetapan terbaik untuk anak', steps: [
          'Bunyi dihidupkan pada kelantangan sederhana (bunyi Bismillah & Alhamdulillah). Di iPhone, matikan suis senyap.',
          'Auto-lock 5 minit atau lebih untuk anak kecil, kecerahan selesa.',
          'Tarikh & masa automatik — waktu solat bergantung padanya.',
          'Simpan peranti di ruang keluarga dan cas di situ pada waktu malam.',
        ] },
      ] },
      { id: 'help', e: '🛟', t: 'Bila ada masalah', faq: [
        ['Peranti papar skrin “Sambung” semula', 'Ia telah diputuskan, atau data pelayar dipadam. Papar QR semula dan imbas.'],
        ['Peranti hilang, dijual atau rosak', 'Profil → Peranti Anak → Peranti bersambung → Putuskan. Akses tamat serta-merta.'],
        ['Anak yang salah di peranti', 'Putuskan, kemudian sambung semula dan pilih anak yang betul (atau “Semua anak”).'],
        ['Kod dah tamat', 'Tekan “Kod baharu” di peranti anak, atau “Jana kod” semula di telefon anda. Kod sah 10–15 minit.'],
        ['Saya perlu mod ibu bapa di peranti anak', 'Tekan “Ibu bapa? Log masuk” di penjuru bawah Kid Mode dan log masuk dengan Google. Peranti itu jadi peranti ibu bapa.'],
        ['Habit yang ditanda belum dikira', 'Ia menunggu pengesahan anda di Quick Verify (kecuali Mod Percaya hidup). Anda dapat notifikasi setiap kali anak tanda habit.'],
        ['Terbuka dalam WhatsApp / Instagram', 'Pelayar dalam app itu tak boleh kekal log masuk. Buka pautan di Safari atau Chrome.'],
      ] },
    ],
  },
  id: {
    title: 'Panduan Perangkat Anak',
    sub: 'Siapkan HP atau tablet anak dalam beberapa menit',
    situationsTitle: 'Situasi keluarga Anda?',
    situations: [
      { e: '📱', t: 'Anak punya HP atau tablet sendiri', d: 'Gunakan Perangkat Anak dan pilih anak tersebut. Anak tidak perlu email atau kata sandi.', cta: 'kid' },
      { e: '👨‍👩‍👧', t: 'Kakak-adik berbagi satu tablet', d: 'Gunakan Perangkat Anak dan pilih “Semua anak (tablet bersama)”. Tiap anak mengetuk avatarnya; “Ganti anak” untuk kembali.', cta: 'kid' },
      { e: '🤳', t: 'Anak memakai HP saya', d: 'Buka Kid Mode di HP Anda. Keluar dari Kid Mode perlu PIN Orang Tua. Pengaturan Perangkat menentukan cara HP dibuka.', cta: 'this' },
      { e: '📺', t: 'Seluruh keluarga di TV', d: 'Buka {host}/tv di browser TV lalu pindai QR dengan HP Anda.', cta: 'tv' },
    ],
    ctas: { kid: 'Buka Perangkat Anak', this: 'Buka Pengaturan Perangkat', tv: 'Buka Pengaturan TV' },
    sections: [
      { id: 'connect', e: '🔗', t: 'Hubungkan perangkat anak', groups: [
        { h: 'Cara A — pindai QR (paling mudah)', steps: [
          'Di perangkat anak, buka {host}/kid (atau ketuk “Ini perangkat anak saya” di halaman masuk).',
          'Layar menampilkan kode QR dan kode 6 angka.',
          'Pindai QR dengan kamera HP Anda — atau Profil → Perangkat Anak lalu ketik kodenya.',
          'Pilih anak (atau “Semua anak”) lalu ketuk Hubungkan.',
          'Perangkat anak langsung membuka Kid Mode dalam beberapa detik.',
        ] },
        { h: 'Cara B — beri kode ke anak', steps: [
          'Profil → Perangkat Anak → pilih anak → Buat kode (berlaku 15 menit, sekali pakai).',
          'Di perangkat anak buka {host}/kid → “Saya punya kode” → ketik → Hubungkan.',
        ] },
      ], note: 'Anak tetap masuk. Mereka hanya melihat Kid Mode dan World sendiri — fitur orang tua terkunci di perangkat itu.' },
      { id: 'lock', e: '🔒', t: 'Kunci perangkat hanya untuk EQrel', groups: [
        { h: 'iPhone / iPad — Guided Access', steps: [
          'Settings → Accessibility → Guided Access → aktifkan dan atur kode sandi.',
          'Buka EQrel, lalu tekan tombol samping (atau Home) 3 kali → Start.',
          'Untuk keluar: tekan 3 kali lagi dan masukkan kode sandi.',
        ] },
        { h: 'iPhone / iPad — Screen Time', steps: [
          'Settings → Screen Time → Downtime dan App Limits untuk batas harian.',
          'Tambahkan Safari (atau ikon EQrel) ke “Always Allowed”.',
        ] },
        { h: 'Android — Sematkan aplikasi', steps: [
          'Settings → Security → App pinning → aktifkan, dengan “Minta PIN sebelum melepas”.',
          'Buka EQrel → Recent apps → ketuk ikon EQrel → Pin.',
          'Untuk melepas: tahan Back + Recent apps, lalu masukkan PIN.',
        ] },
        { h: 'Android — Google Family Link', steps: [
          'Pasang Family Link di HP Anda untuk mengatur waktu layar, jam tidur dan aplikasi yang diizinkan.',
          'Izinkan Chrome (dan ikon EQrel) agar EQrel tetap berjalan.',
        ] },
      ] },
      { id: 'setup', e: '✨', t: 'Jadikan seperti aplikasi', groups: [
        { h: 'Tambahkan ikon EQrel ke layar utama', steps: [
          'iPhone / iPad: buka {host}/kid di Safari → tombol Bagikan → “Add to Home Screen”.',
          'Android: buka {host}/kid di Chrome → menu ⋮ → “Install app” atau “Add to Home screen”.',
          'Selalu buka EQrel dari ikon itu — tampil layar penuh seperti aplikasi.',
        ] },
        { h: 'Pengaturan terbaik untuk anak', steps: [
          'Suara aktif dengan volume sedang. Di iPhone, matikan sakelar senyap.',
          'Kunci otomatis 5 menit atau lebih, kecerahan nyaman.',
          'Tanggal & waktu otomatis — waktu salat bergantung padanya.',
          'Simpan perangkat di ruang keluarga dan isi daya di sana pada malam hari.',
        ] },
      ] },
      { id: 'help', e: '🛟', t: 'Jika ada masalah', faq: [
        ['Perangkat menampilkan layar “Hubungkan” lagi', 'Perangkat diputus, atau data browser terhapus. Tampilkan QR lagi dan pindai.'],
        ['Perangkat hilang, dijual atau rusak', 'Profil → Perangkat Anak → Perangkat terhubung → Putuskan. Akses langsung berakhir.'],
        ['Anak yang salah di perangkat', 'Putuskan, lalu hubungkan lagi dan pilih anak yang benar.'],
        ['Kode kedaluwarsa', 'Ketuk “Kode baru” di perangkat anak, atau “Buat kode” lagi. Kode berlaku 10–15 menit.'],
        ['Saya perlu mode orang tua di perangkat anak', 'Ketuk “Orang tua? Masuk” di pojok bawah Kid Mode dan masuk dengan Google.'],
        ['Kebiasaan yang ditandai belum dihitung', 'Menunggu verifikasi Anda di Quick Verify (kecuali Mode Percaya aktif). Anda mendapat notifikasi setiap kali.'],
        ['Terbuka di dalam WhatsApp / Instagram', 'Browser di dalam aplikasi itu tidak bisa tetap masuk. Buka di Safari atau Chrome.'],
      ] },
    ],
  },
  ar: {
    title: 'دليل جهاز الطفل',
    sub: 'جهّز هاتف أو جهاز طفلك في دقائق',
    situationsTitle: 'ما الإعداد المناسب لعائلتك؟',
    situations: [
      { e: '📱', t: 'لطفلي هاتف أو جهاز خاص', d: 'استخدم «جهاز الطفل» واختر الطفل. لا يحتاج الطفل بريدًا أو كلمة مرور.', cta: 'kid' },
      { e: '👨‍👩‍👧', t: 'الإخوة يتشاركون جهازًا واحدًا', d: 'استخدم «جهاز الطفل» واختر «كل الأطفال». يضغط كل طفل على صورته.', cta: 'kid' },
      { e: '🤳', t: 'طفلي يستخدم هاتفي', d: 'افتح وضع الطفل على هاتفك؛ الخروج منه يحتاج رمز الوالدين.', cta: 'this' },
      { e: '📺', t: 'العائلة كلها على التلفاز', d: 'افتح {host}/tv في متصفح التلفاز وامسح الرمز بهاتفك.', cta: 'tv' },
    ],
    ctas: { kid: 'فتح جهاز الطفل', this: 'فتح إعدادات الجهاز', tv: 'فتح إعداد التلفاز' },
    sections: [
      { id: 'connect', e: '🔗', t: 'ربط جهاز الطفل', groups: [
        { h: 'الطريقة أ — امسح رمز QR', steps: [
          'على جهاز الطفل افتح {host}/kid.',
          'يظهر رمز QR ورمز من ٦ أرقام.',
          'امسح الرمز بكاميرا هاتفك أو اكتب الرمز في: الملف ← جهاز الطفل.',
          'اختر الطفل (أو كل الأطفال) واضغط ربط.',
        ] },
        { h: 'الطريقة ب — أعطِ طفلك رمزًا', steps: [
          'الملف ← جهاز الطفل ← اختر الطفل ← إنشاء رمز (١٥ دقيقة، مرة واحدة).',
          'على جهاز الطفل: {host}/kid ← «لدي رمز» ← اكتبه ← ربط.',
        ] },
      ], note: 'يبقى الطفل مسجلاً للدخول ويرى وضع الطفل وعالمه فقط.' },
      { id: 'lock', e: '🔒', t: 'قفل الجهاز على EQrel فقط', groups: [
        { h: 'iPhone / iPad — Guided Access', steps: ['الإعدادات ← تسهيلات الاستخدام ← الوصول الموجّه ← تشغيل.', 'افتح EQrel واضغط الزر الجانبي ٣ مرات ← بدء.'] },
        { h: 'Android — تثبيت التطبيق', steps: ['الإعدادات ← الأمان ← تثبيت التطبيق ← تشغيل.', 'افتح EQrel ← التطبيقات الأخيرة ← تثبيت.'] },
        { h: 'Android — Google Family Link', steps: ['استخدم Family Link لتحديد وقت الشاشة والتطبيقات المسموحة.'] },
      ] },
      { id: 'setup', e: '✨', t: 'اجعله كالتطبيق', groups: [
        { h: 'أضف أيقونة EQrel', steps: ['iPhone: Safari ← مشاركة ← «إضافة إلى الشاشة الرئيسية».', 'Android: Chrome ← ⋮ ← «تثبيت التطبيق».'] },
        { h: 'إعدادات مناسبة للأطفال', steps: ['الصوت متوسط، والتاريخ والوقت تلقائيان، والجهاز في مكان العائلة.'] },
      ] },
      { id: 'help', e: '🛟', t: 'عند حدوث مشكلة', faq: [
        ['ظهرت شاشة «الربط» مجددًا', 'تم فصل الجهاز أو مُسحت بيانات المتصفح. امسح الرمز مجددًا.'],
        ['الجهاز ضاع أو بِيع', 'الملف ← جهاز الطفل ← الأجهزة المرتبطة ← فصل.'],
        ['أحتاج وضع الوالدين على جهاز الطفل', 'اضغط «ولي أمر؟ دخول» أسفل وضع الطفل وسجّل بحساب Google.'],
      ] },
    ],
  },
}

export default function DeviceGuideSheet({ open, onClose, lang = 'en', onOpenKidDevices, onOpenDeviceSettings }) {
  const C = CONTENT[lang] || CONTENT.en
  const [host, setHost] = useState('eqrel.app')
  const [openId, setOpenId] = useState('connect')
  useEffect(() => { if (open) { setHost(window.location.host); setOpenId('connect') } }, [open])
  const H = (txt) => String(txt).replaceAll('{host}', host)

  const runCta = (cta) => {
    if (cta === 'kid') { onClose?.(); setTimeout(() => onOpenKidDevices?.(), 150) }
    else if (cta === 'this') { onClose?.(); setTimeout(() => onOpenDeviceSettings?.(), 150) }
    else if (cta === 'tv') window.location.href = '/display/setup'
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="device-guide-sheet">
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto p-4 space-y-3"
            style={{ backgroundColor: CI.cream, paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${CI.green}22` }}><BookOpen className="w-5 h-5" style={{ color: CI.green }} /></div>
              <div className="flex-1">
                <h2 className="font-extrabold text-lg leading-tight" style={{ color: CI.ink }}>{C.title}</h2>
                <p className="text-[11px]" style={{ color: `${CI.ink}99` }}>{C.sub}</p>
              </div>
              <button onClick={onClose} aria-label="close" data-testid="device-guide-close" className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            {/* Situations */}
            <div className="rounded-2xl p-3.5" style={{ backgroundColor: CI.ink }} data-testid="device-guide-situations">
              <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: CI.yellow }}>{C.situationsTitle}</div>
              <div className="mt-2 space-y-2">
                {C.situations.map((s, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ backgroundColor: `${CI.cream}12`, border: `1px solid ${CI.cream}22` }}>
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl leading-none">{s.e}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-extrabold" style={{ color: CI.cream }}>{s.t}</div>
                        <div className="text-[12px] mt-0.5 leading-snug" style={{ color: `${CI.cream}BB` }}>{H(s.d)}</div>
                        <button onClick={() => runCta(s.cta)} data-testid={`device-guide-cta-${s.cta}-${i}`}
                          className="mt-2 rounded-full px-3 py-1.5 text-[11px] font-black" style={{ backgroundColor: CI.yellow, color: CI.ink }}>
                          {C.ctas[s.cta]} →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accordion sections */}
            {C.sections.map(sec => {
              const isOpen = openId === sec.id
              return (
                <div key={sec.id} className="bg-white rounded-2xl shadow-eq-card overflow-hidden" data-testid={`device-guide-section-${sec.id}`}>
                  <button onClick={() => setOpenId(isOpen ? null : sec.id)} className="w-full flex items-center gap-2.5 px-3.5 py-3 text-start" data-testid={`device-guide-toggle-${sec.id}`}>
                    <span className="text-xl">{sec.e}</span>
                    <span className="flex-1 text-sm font-extrabold" style={{ color: CI.ink }}>{sec.t}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: `${CI.ink}88` }} />
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3.5 space-y-3">
                      {(sec.groups || []).map((g, gi) => (
                        <div key={gi}>
                          <div className="text-[12px] font-black" style={{ color: CI.green }}>{g.h}</div>
                          <ol className="mt-1.5 space-y-1.5">
                            {g.steps.map((st, si) => (
                              <li key={si} className="flex gap-2 text-[12.5px] leading-snug" style={{ color: CI.ink }}>
                                <span className="shrink-0 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center" style={{ backgroundColor: `${CI.green}1F`, color: CI.green }}>{si + 1}</span>
                                <span className="flex-1">{H(st)}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                      {sec.note && (
                        <div className="rounded-xl px-3 py-2 text-[12px] font-bold leading-snug" style={{ backgroundColor: `${CI.yellow}26`, color: CI.ink }}>🛡️ {sec.note}</div>
                      )}
                      {(sec.faq || []).map(([q, a], fi) => (
                        <div key={fi} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: CI.cream }}>
                          <div className="text-[12.5px] font-extrabold" style={{ color: CI.ink }}>{q}</div>
                          <div className="text-[12px] mt-0.5 leading-snug" style={{ color: `${CI.ink}BB` }}>{a}</div>
                        </div>
                      ))}
                      {sec.id === 'connect' && (
                        <button onClick={() => runCta('kid')} data-testid="device-guide-connect-now"
                          className="w-full rounded-2xl py-3 font-extrabold text-sm" style={{ backgroundColor: CI.yellow, color: CI.ink }}>
                          🧒 {C.ctas.kid} →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
