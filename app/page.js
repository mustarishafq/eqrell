'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, ChevronRight, Sparkles, Plus } from 'lucide-react'
import { strings } from '@/lib/i18n/strings'
import { mockParent, mockChildren, mockFamily } from '@/lib/mock/parent-data'
import { InstallPrompt } from '@/components/eqrel/InstallPrompt'
import { ChildSheet, calculateAge, ageBandFromAge } from '@/components/eqrel/ChildSheet'
import { AVATAR_BY_ID, DEFAULT_BOY_ID, DEFAULT_GIRL_ID } from '@/lib/avatars'

const ASSETS = {
  heroLandscape: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/zfnechrx_hero-landscape.webp',
  eqMascot: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/33belexr_eq-greeting-companion.png',
  momentumStar: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/2dtbjg7r_momentum-star-icon.png',
  fireStreak: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/bkmw85fs_family-streak-fire-icon.png',
  verifyClip: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/qm0jqqfr_verify-clipboard-icon.png',
  navHome: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/8tzw8pkj_nav-home-icon.png',
  navTasks: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/p8yfhim2_nav-tasks-icon.png',
  navReport: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/8suijnby_nav-report-icon.png',
  navProfile: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/fdu0on3o_nav-profile-avatar.png',
}

const FAV_COLOR_MAP = {
  green: '#00B894', yellow: '#FFB703', orange: '#FF8A00', coral: '#FF5D6E',
  blue: '#2D9CDB', purple: '#9C7BD9', pink: '#EC4899', fresh: '#4CAF50',
}

// Resolve avatar src, with backward-compat for older child records
const resolveAvatarSrc = (child) => {
  const id = child.avatarId || (child.gender === 'female' ? DEFAULT_GIRL_ID : DEFAULT_BOY_ID)
  return AVATAR_BY_ID[id]?.src || AVATAR_BY_ID[DEFAULT_BOY_ID].src
}

const ChildProgressRing = ({ child }) => {
  const ringColor = FAV_COLOR_MAP[child.favColor] || '#00B894'
  const pct = child.todayTotal > 0 ? (child.todayCompleted / child.todayTotal) : 0
  const radius = 42
  const stroke = 5
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: 96, height: 96 }}>
        <svg width="96" height="96" className="absolute inset-0 -rotate-90">
          <circle cx="48" cy="48" r={radius} stroke="#F0EAD6" strokeWidth={stroke} fill="none" />
          <motion.circle
            cx="48" cy="48" r={radius}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-50 to-white">
          <img
            src={resolveAvatarSrc(child)}
            alt={child.nickname}
            className="w-full h-full object-contain"
            style={{ objectPosition: 'center top' }}
          />
        </div>
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white shadow-eq-soft rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
          style={{ color: ringColor }}
        >
          {child.todayCompleted}/{child.todayTotal}
        </div>
      </div>
      <div className="font-semibold text-xs pt-1" style={{ color: ringColor }}>{child.nickname}</div>
    </div>
  )
}

const BottomNav = ({ active = 'home', onChange }) => {
  const t = strings.ms
  const items = [
    { id: 'home', label: t.nav_home, icon: ASSETS.navHome, color: '#00B894' },
    { id: 'tasks', label: t.nav_tasks, icon: ASSETS.navTasks, color: '#2D9CDB' },
    { id: 'reports', label: t.nav_reports, icon: ASSETS.navReport, color: '#FFB703' },
    { id: 'profile', label: t.nav_profile, icon: ASSETS.navProfile, color: '#B39DDB' },
  ]
  return (
    <nav className="flex-shrink-0 bg-white border-t border-eq-cream/50 safe-bottom shadow-[0_-2px_12px_rgba(15,46,37,0.05)]">
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(item => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onChange?.(item.id)}
              className="flex flex-col items-center justify-center py-2.5 relative transition-transform active:scale-95"
              aria-label={item.label}
            >
              <div className={`w-12 h-12 flex items-center justify-center transition-all ${isActive ? 'scale-110' : 'scale-100 opacity-55'}`}>
                <img src={item.icon} alt="" className="w-11 h-11 object-contain" />
              </div>
              <span className={`text-[11px] font-bold mt-0 transition-colors ${isActive ? 'text-eq-ink' : 'text-eq-ink/50'}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0.5 h-1 w-8 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

const ParentDashboard = () => {
  const t = strings.ms
  const [activeTab, setActiveTab] = useState('home')
  const [childrenNames, setChildrenNames] = useState('')
  const [children, setChildren] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingChild, setEditingChild] = useState(null)
  const [me, setMe] = useState(null)
  const [family, setFamily] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  // AUTH CHECK — redirect to /login if not authenticated
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!res.ok) {
          window.location.href = '/login'
          return
        }
        const data = await res.json()
        if (data.needsFamilySetup) {
          window.location.href = '/family/setup'
          return
        }
        setMe(data.user)
        setFamily(data.family)
        setAuthChecked(true)
      } catch (e) {
        window.location.href = '/login'
      }
    })()
  }, [])

  // LOAD CHILDREN from API once auth confirmed
  useEffect(() => {
    if (!authChecked) return
    (async () => {
      try {
        const res = await fetch('/api/children', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          // Auto-recompute age band from DOB
          const refreshed = (data.children || []).map(c => {
            if (c.dob) {
              const age = calculateAge(c.dob)
              return { ...c, ageBand: ageBandFromAge(age) }
            }
            return c
          })
          setChildren(refreshed)
        }
      } catch (e) {}
    })()
  }, [authChecked])

  useEffect(() => {
    // Format names for greeting
    const names = children.map(c => c.nickname)
    if (names.length === 0) setChildrenNames('keluarga anda')
    else if (names.length === 1) setChildrenNames(names[0])
    else if (names.length === 2) setChildrenNames(names.join(' & '))
    else setChildrenNames(names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1])
  }, [children])

  const childColors = ['#00B894', '#FF8A00', '#2D9CDB', '#FF5D6E', '#B39DDB', '#4CAF50']

  const openAddSheet = () => { setEditingChild(null); setSheetOpen(true) }
  const openEditSheet = (child) => { setEditingChild(child); setSheetOpen(true) }

  const handleSaveChild = async (child) => {
    const isEdit = children.some(c => c.id === child.id)
    try {
      if (isEdit) {
        const res = await fetch(`/api/children/${child.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(child),
        })
        if (res.ok) {
          const data = await res.json()
          setChildren(prev => prev.map(c => c.id === child.id ? data.child : c))
        }
      } else {
        const res = await fetch('/api/children', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(child),
        })
        if (res.ok) {
          const data = await res.json()
          setChildren(prev => [...prev, data.child])
        }
      }
    } catch (e) {
      console.error('Save child error', e)
    }
  }

  const handleDeleteChild = async (id) => {
    try {
      const res = await fetch(`/api/children/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) setChildren(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      console.error('Delete child error', e)
    }
  }

  // Loading gate — don't render dashboard until auth confirmed
  if (!authChecked) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-emerald-50 to-amber-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[100dvh] bg-eq-warm flex flex-col overflow-hidden relative">
      {/* HERO — full-bleed, extends behind status bar/dynamic island */}
      <div className="absolute inset-x-0 top-0 pointer-events-none z-0" style={{ height: '48dvh' }}>
        <img
          src={ASSETS.heroLandscape}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 30%' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-eq-warm/95" />
      </div>

      {/* TOP BAR — over hero, respects safe area */}
      <div className="relative z-20 flex items-start justify-between px-5 flex-shrink-0 pointer-events-auto" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="pt-2">
          <p className="text-eq-ink/70 text-sm font-semibold leading-tight">{t.salam},</p>
          <h1 className="text-eq-ink font-extrabold text-[34px] leading-tight mt-0.5 flex items-center gap-2">
            {(me?.name || 'Mama').split(' ')[0]} <span className="animate-gentle-pulse text-2xl">👋</span>
          </h1>
          {family?.code && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(family.code)
                alert(`Kod keluarga disalin: ${family.code}`)
              }}
              className="mt-1 inline-flex items-center gap-1 bg-white/70 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-800 shadow-sm border border-emerald-200/60 hover:bg-white"
              title="Klik untuk salin kod (kongsi dengan pasangan)"
            >
              👨‍👩‍👧 {family.code}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 pt-3">
          <button className="w-11 h-11 bg-white rounded-full shadow-eq-card flex items-center justify-center relative" aria-label="Notifications">
            <Bell className="w-5 h-5 text-eq-ink" strokeWidth={2.5} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-eq-coral rounded-full ring-2 ring-white" />
          </button>
          <button
            onClick={async () => {
              if (confirm('Log keluar dari EQrel?')) {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
                window.location.href = '/login'
              }
            }}
            className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white shadow-eq-card bg-emerald-100 flex items-center justify-center"
            title="Log keluar"
          >
            {me?.picture ? (
              <img src={me.picture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-emerald-700 font-bold text-lg">
                {(me?.name || 'U')[0].toUpperCase()}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* EQ MASCOT — full body, feet overlap card. Scaled down on smaller phones. */}
      <div className="relative z-20 flex justify-center flex-shrink-0 pointer-events-none" style={{ height: 'clamp(140px, 20dvh, 220px)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="animate-float absolute inset-x-0 flex justify-center"
          style={{ top: '-10px', bottom: '-20px' }}
        >
          <img
            src={ASSETS.eqMascot}
            alt="EQ"
            className="object-contain drop-shadow-2xl"
            style={{ width: 'clamp(160px, 40vw, 220px)', height: '100%' }}
          />
        </motion.div>
      </div>

      {/* MOMENTUM BADGE — floating between hero and card */}
      <div className="relative z-30 flex justify-center flex-shrink-0 -mt-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="bg-white shadow-eq-card rounded-full px-4 py-1.5 flex items-center gap-1.5 border border-eq-cream/60"
        >
          <img src={ASSETS.momentumStar} alt="" className="w-4 h-4 object-contain" />
          <span className="text-eq-ink font-bold text-[10px] tracking-wider">{t.momentum_week}</span>
          <Sparkles className="w-3 h-3 text-eq-yellow" fill="#FFB703" />
        </motion.div>
      </div>

      {/* MAIN CONTENT — scrollable when content taller than viewport, so BottomNav always stays visible */}
      <div className="flex-1 flex flex-col px-3 mt-2 pb-2 max-w-md mx-auto w-full gap-2 min-h-0 relative z-10 overflow-y-auto overscroll-contain">

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-white rounded-3xl p-4 shadow-eq-card flex-shrink-0"
        >
          <h2 className="text-eq-ink font-extrabold text-xl leading-tight">
            {t.alhamdulillah},
          </h2>
          <p className="text-eq-ink font-extrabold text-lg leading-snug mt-0.5">
            perjalanan {childrenNames} semakin bercahaya <span className="inline-block">💛</span>
          </p>
          <p className="text-eq-ink/60 text-xs mt-2 leading-relaxed">
            {t.dashboard_sub}
          </p>

          <div className="flex justify-center gap-3 mt-3 flex-wrap">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => openEditSheet(child)}
                className="active:scale-95 transition-transform"
                aria-label={`Edit ${child.nickname}`}
              >
                <ChildProgressRing child={child} />
              </button>
            ))}
            {children.length < 20 && (
              <button
                onClick={openAddSheet}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                aria-label="Tambah anak"
              >
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-eq-green/40 bg-eq-green/5 flex items-center justify-center hover:bg-eq-green/10 transition-colors">
                  <Plus className="w-8 h-8 text-eq-green" strokeWidth={2.5} />
                </div>
                <div className="text-eq-green font-semibold text-xs pt-1">Tambah</div>
              </button>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl px-3 py-2 flex items-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <img src={ASSETS.fireStreak} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
            <div className="flex-1 text-eq-ink text-xs leading-tight">
              <span className="font-extrabold">{mockFamily.streakDays} hari</span>
              <span className="text-eq-ink/70"> sepanjang perjalanan keluarga</span>
            </div>
            <ChevronRight className="w-4 h-4 text-eq-ink/40 flex-shrink-0" />
          </motion.div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="w-full bg-eq-blue/10 border-2 border-eq-blue/20 rounded-2xl px-3 py-2.5 flex items-center gap-2.5 hover:bg-eq-blue/15 transition-all active:scale-[0.99] flex-shrink-0"
        >
          <img src={ASSETS.verifyClip} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
          <div className="flex-1 text-left">
            <div className="font-bold text-eq-ink text-sm">
              {mockFamily.pendingVerifications} tugasan sedia disemak
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-eq-blue flex-shrink-0" strokeWidth={2.5} />
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="relative rounded-2xl overflow-hidden shadow-eq-card flex-shrink-0"
          style={{ minHeight: 90 }}
        >
          {/* Full hero landscape background */}
          <div className="absolute inset-0">
            <img
              src={ASSETS.heroLandscape}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 40%' }}
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 to-white/30" />
          </div>

          <div className="relative p-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-base">🚩</span>
              <h3 className="text-eq-ink font-extrabold text-base drop-shadow-sm">{t.family_quest_title}</h3>
            </div>
            <p className="text-eq-ink/80 text-[11px] mb-2 leading-tight font-medium">
              Akan tiba tidak lama lagi ✨
            </p>
            <button className="bg-eq-yellow text-eq-ink font-bold text-xs px-3 py-1.5 rounded-full shadow-eq-soft active:scale-95 flex items-center gap-0.5">
              {t.family_quest_cta}
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
            </button>
          </div>
        </motion.div>

      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />

      {/* PWA Install Prompt (smart: iOS tutorial / Android native) */}
      <InstallPrompt />

      {/* Add/Edit Child bottom sheet */}
      <ChildSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={editingChild}
        onSave={handleSaveChild}
        onDelete={handleDeleteChild}
      />
    </div>
  )
}

function App() {
  return <ParentDashboard />
}

export default App
