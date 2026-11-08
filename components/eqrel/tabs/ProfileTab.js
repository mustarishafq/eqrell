'use client'

import { ChevronRight, Copy, LogOut, Plus } from 'lucide-react'
import { LangPicker } from '@/components/eqrel/LangPicker'
import { pick, colorOf, TabHeader } from './tabUtils'
import { useState } from 'react'
import { useInstallState, InstallGuide } from '@/components/eqrel/InstallPrompt'
import { promptInstall } from '@/lib/pwaInstall'

const Row = ({ emoji, title, sub, onClick, testId, danger }) => (
  <button onClick={onClick} data-testid={testId}
    className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-eq-cream/40 transition-colors">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${danger ? 'bg-red-50' : 'bg-eq-cream/60'}`}>{emoji}</div>
    <div className="flex-1 min-w-0">
      <div className={`font-bold text-sm ${danger ? 'text-red-600' : 'text-eq-ink'}`}>{title}</div>
      {sub && <div className="text-[11px] text-eq-ink/55 leading-tight truncate">{sub}</div>}
    </div>
    {!danger && <ChevronRight className="w-4 h-4 text-eq-ink/35 flex-shrink-0" />}
  </button>
)

export default function ProfileTab({
  lang = 'en', icon, me, family, kids = [], avatarSrc,
  onEditChild, onAddChild, onChangePin, onDeviceSettings, onRewardShop, onLogout, onDiagnosis, onNotifications, onCoParent, onRestMode, onKidDevices, onDeviceGuide,
}) {
  const L = pick(lang)
  const copyCode = async () => {
    try { await navigator.clipboard?.writeText(family?.code || '') } catch { /* ignore */ }
    alert(`${L('Kod keluarga disalin', 'Family code copied', 'Kode keluarga disalin', 'تم نسخ رمز العائلة')}: ${family?.code}`)
  }

  return (
    <div className="flex flex-col gap-2" data-testid="tab-profile">
      <TabHeader icon={icon} title={L('Profil', 'Profile', 'Profil', 'الملف الشخصي')}
        sub={L('Akaun dan tetapan keluarga', 'Account & family settings', 'Akun dan pengaturan keluarga', 'الحساب وإعدادات العائلة')} />

      {/* Account card */}
      <div className="bg-white rounded-3xl p-4 shadow-eq-card flex items-center gap-3 flex-shrink-0" data-testid="profile-account">
        <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-emerald-200 bg-emerald-100 flex items-center justify-center flex-shrink-0">
          {me?.picture
            ? <img src={me.picture} alt="" className="w-full h-full object-cover" />
            : <span className="text-emerald-700 font-black text-xl">{(me?.name || 'U')[0].toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-eq-ink text-lg leading-tight truncate">{me?.name || '—'}</div>
          <div className="text-xs text-eq-ink/55 truncate">{me?.email}</div>
          <div className="mt-1 inline-flex px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
            {L('Ibu Bapa', 'Parent', 'Orang Tua', 'وليّ الأمر')}
          </div>
        </div>
      </div>

      {/* Family card */}
      <div className="bg-white rounded-3xl p-4 shadow-eq-card flex-shrink-0" data-testid="profile-family">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-wider text-eq-ink/50">{L('Keluarga', 'Family', 'Keluarga', 'العائلة')}</div>
            <div className="font-extrabold text-eq-ink text-base truncate">{family?.familyName || family?.name || '—'}</div>
          </div>
          {family?.code && (
            <button onClick={copyCode} data-testid="profile-copy-code"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black active:scale-95">
              {family.code} <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-eq-ink/50 mt-1">{L('Kongsi kod ini supaya pasangan boleh sertai keluarga.', 'Share this code so your spouse can join the family.', 'Bagikan kode ini agar pasangan bisa bergabung.', 'شارك هذا الرمز لينضم شريكك.')}</p>

        <div className="mt-3 text-[11px] font-black uppercase tracking-wider text-eq-ink/50 mb-2">
          {L('Anak-anak', 'Children', 'Anak-anak', 'الأطفال')} ({kids.length})
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {kids.map(c => (
            <button key={c.id} onClick={() => onEditChild?.(c)} data-testid={`profile-child-${c.id}`}
              className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 bg-amber-50" style={{ borderColor: colorOf(c) }}>
                <img src={avatarSrc(c)} alt={c.nickname} className="w-full h-full object-contain" />
              </div>
              <span className="text-[11px] font-bold text-eq-ink max-w-[64px] truncate">{c.nickname}</span>
            </button>
          ))}
          <button onClick={onAddChild} data-testid="profile-add-child" className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-eq-green/40 bg-eq-green/5 flex items-center justify-center">
              <Plus className="w-6 h-6 text-eq-green" />
            </div>
            <span className="text-[11px] font-bold text-eq-green">{L('Tambah', 'Add', 'Tambah', 'أضف')}</span>
          </button>
        </div>
      </div>

      {/* Settings list */}
      <div className="bg-white rounded-3xl shadow-eq-card overflow-hidden divide-y divide-eq-cream/60 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="w-9 h-9 rounded-xl bg-eq-cream/60 flex items-center justify-center text-lg">🌐</div>
          <div className="flex-1 font-bold text-sm text-eq-ink">{L('Bahasa', 'Language', 'Bahasa', 'اللغة')}</div>
          <LangPicker variant="compact" />
        </div>
        <Row emoji="🤝" testId="profile-coparent" onClick={onCoParent}
          title={L('Kongsi Pasangan', 'Co-Parenting', 'Berbagi Pasangan', 'التربية المشتركة')}
          sub={L('Jemput pasangan & bergilir sahkan tugasan', 'Invite spouse & take turns verifying', 'Undang pasangan & bergiliran', 'ادعُ شريكك وتناوبا')} />
        <InstallAppRow lang={lang} />
        <Row emoji="🧒" testId="profile-kid-devices" onClick={onKidDevices}
          title={L('Peranti Anak', "Child's Own Device", 'Perangkat Anak', 'جهاز الطفل')}
          sub={L('Sambung telefon/tablet anak — tanpa email', "Link your child's phone or tablet — no email needed", 'Hubungkan HP/tablet anak — tanpa email', 'اربط هاتف أو جهاز طفلك — بدون بريد')} />
        <Row emoji="📖" testId="profile-device-guide" onClick={onDeviceGuide}
          title={L('Panduan Peranti Anak', 'Child Device Guide', 'Panduan Perangkat Anak', 'دليل جهاز الطفل')}
          sub={L('Cara sediakan, kunci & selesaikan masalah peranti anak', "How to set up, lock & fix your child's device", 'Cara menyiapkan, mengunci & atasi masalah', 'الإعداد والقفل وحل المشكلات')} />
        <Row emoji="✈️" testId="profile-rest-mode" onClick={onRestMode}
          title={L('Mod Musafir & Hari Rehat', 'Travel & Rest Days', 'Mode Safar & Hari Istirahat', 'وضع السفر والراحة')}
          sub={L('Jeda habit & bekukan streak — Solat Teras kekal', 'Pause habits & freeze streaks — core prayers stay on', 'Jeda kebiasaan & bekukan streak', 'إيقاف العادات وتجميد السلسلة')} />
        <Row emoji="🔔" testId="profile-notifications" onClick={onNotifications}
          title={L('Notifikasi Tenang', 'Calm Notifications', 'Notifikasi Tenang', 'إشعارات هادئة')}
          sub={L('Niat Pagi, Laporan Malam & Mingguan — masa pilihan anda', 'Morning, night & weekly — at your chosen times', 'Niat Pagi, Laporan Malam & Mingguan', 'الصباح والليل والأسبوع — في أوقاتك')} />
        <Row emoji="🩺" testId="profile-diagnosis" onClick={onDiagnosis}
          title={L('Diagnosis Iman & Habit Anak', 'Child Iman & Habit Diagnosis', 'Diagnosis Iman & Kebiasaan Anak', 'تشخيص الإيمان والعادات')}
          sub={L('Kuiz ringkas → pelan habit khas setiap anak', 'Quick quiz → a personal habit plan per child', 'Kuis singkat → rencana kebiasaan khusus', 'اختبار قصير ← خطة عادات لكل طفل')} />
        <Row emoji="🔐" testId="profile-change-pin" onClick={onChangePin}
          title={L('Tukar PIN Ibu Bapa', 'Change Parent PIN', 'Ubah PIN Orang Tua', 'تغيير الرمز')}
          sub={L('PIN untuk keluar dari Mod Kanak-kanak', 'PIN used to exit Kid Mode', 'PIN untuk keluar Mode Anak', 'للخروج من وضع الطفل')} />
        <Row emoji="📱" testId="profile-device" onClick={onDeviceSettings}
          title={L('Tetapan Peranti', 'Device Settings', 'Pengaturan Perangkat', 'إعدادات الجهاز')}
          sub={L('Pilih fungsi peranti ini bila dibuka', 'Choose how this device opens', 'Pilih fungsi perangkat ini', 'اختر سلوك الجهاز')} />
        <Row emoji="🎁" testId="profile-rewards" onClick={onRewardShop}
          title={L('Kedai Ganjaran', 'Reward Shop', 'Toko Hadiah', 'متجر المكافآت')}
          sub={L('Urus ganjaran dan permintaan anak', 'Manage rewards and requests', 'Kelola hadiah dan permintaan', 'إدارة المكافآت')} />
        <Row emoji="📺" testId="profile-display" onClick={() => (window.location.href = '/display')}
          title={L('Paparan Keluarga (TV)', 'Family Display (TV)', 'Tampilan Keluarga (TV)', 'شاشة العائلة')}
          sub={L('Buka paparan ambien untuk TV', 'Open the ambient TV display', 'Buka tampilan TV', 'افتح شاشة التلفاز')} />
        <Row emoji="⚙️" testId="profile-display-setup" onClick={() => (window.location.href = '/display/setup')}
          title={L('Tetapan Paparan TV', 'TV Display Setup', 'Pengaturan Tampilan TV', 'إعداد الشاشة')}
          sub={L('Foto, azan, lokasi solat', 'Photos, azan, prayer location', 'Foto, azan, lokasi sholat', 'الصور والأذان والموقع')} />
      </div>

      <div className="bg-white rounded-3xl shadow-eq-card overflow-hidden flex-shrink-0">
        <Row emoji={<LogOut className="w-4 h-4 text-red-500" />} testId="profile-logout" onClick={onLogout} danger
          title={L('Log Keluar', 'Sign Out', 'Keluar', 'تسجيل الخروج')} />
      </div>
      <div className="h-2" />
    </div>
  )
}

/** Profile → "Install the app": shows Installed ✓, one-tap install, or the guided steps (iPhone). */
function InstallAppRow({ lang }) {
  const L = pick(lang)
  const { mode, platform } = useInstallState()
  const [guide, setGuide] = useState(false)
  const installed = mode === 'installed'
  const onClick = async () => {
    if (installed) return
    if (mode === 'native') { const r = await promptInstall(); if (r === 'unavailable') setGuide(true); return }
    setGuide(true)
  }
  const sub = installed
    ? L('Sudah dipasang di peranti ini ✓', 'Installed on this device ✓', 'Sudah terpasang ✓', 'مثبّت على هذا الجهاز ✓')
    : mode === 'native'
      ? L('Pasang dengan satu tekan', 'Install with one tap', 'Pasang dengan satu ketuk', 'ثبّت بنقرة واحدة')
      : L('Tambah ke skrin utama — kami tunjukkan caranya', 'Add to your home screen — we’ll show you how', 'Tambahkan ke layar utama', 'أضفه إلى الشاشة الرئيسية')
  return (
    <>
      <button onClick={onClick} data-testid="profile-install-app" data-mode={mode} disabled={installed}
        className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-eq-cream/40 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-eq-cream/60">📲</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-eq-ink">{L('Pasang App EQrel', 'Install the EQrel app', 'Pasang Aplikasi EQrel', 'ثبّت تطبيق EQrel')}</div>
          <div className={`text-[11px] leading-tight truncate ${installed ? 'text-emerald-700 font-bold' : 'text-eq-ink/55'}`}>{sub}</div>
        </div>
        {!installed && <ChevronRight className="w-4 h-4 text-eq-ink/35 flex-shrink-0" />}
      </button>
      <InstallGuide open={guide} mode={mode === 'none' ? 'manual' : mode} platform={platform} onClose={() => setGuide(false)} />
    </>
  )
}
