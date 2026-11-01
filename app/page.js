'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ChevronRight, Sparkles, Plus, X } from 'lucide-react'
import { mockParent, mockChildren, mockFamily } from '@/lib/mock/parent-data'
import { InstallPrompt } from '@/components/eqrel/InstallPrompt'
import { ChildSheet, calculateAge, ageBandFromAge } from '@/components/eqrel/ChildSheet'
import { HabitsSheet } from '@/components/eqrel/HabitsSheet'
import { VerifySheet } from '@/components/eqrel/VerifySheet'
import { PinModal } from '@/components/eqrel/PinModal'
import { RewardShopSheet } from '@/components/eqrel/RewardShopSheet'
import { DeviceSettingsSheet } from '@/components/eqrel/DeviceSettingsSheet'
import { AVATAR_BY_ID, DEFAULT_BOY_ID, DEFAULT_GIRL_ID } from '@/lib/avatars'
import { LangPicker } from '@/components/eqrel/LangPicker'
import { useLang } from '@/lib/i18n/LangProvider'
import { BRAND } from '@/lib/brand'
import ZikirTasbih from '@/components/eqrel/ZikirTasbih'
import TasksTab from '@/components/eqrel/tabs/TasksTab'
import ReportsTab from '@/components/eqrel/tabs/ReportsTab'
import ProfileTab from '@/components/eqrel/tabs/ProfileTab'
import { QuickVerifySheet } from '@/components/eqrel/QuickVerifySheet'
import { NotifySettingsSheet } from '@/components/eqrel/NotifySettingsSheet'
import { DigestCard } from '@/components/eqrel/DigestCard'
import { CoParentSheet } from '@/components/eqrel/CoParentSheet'
import { HandoverGuide } from '@/components/eqrel/HandoverGuide'
import { PushPrompt } from '@/components/eqrel/PushPrompt'

const ASSETS = {
  heroLandscape: 'https://customer-assets-4nw71qhi.emergentagent.net/job_pwa-trial-cohort/artifacts/zfnechrx_hero-landscape.webp',
  eqMascot: BRAND.mascot.default,
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

const ChildProgressRing = ({ child, habitCount }) => {
  const ringColor = FAV_COLOR_MAP[child.favColor] || '#00B894'
  const total = habitCount?.total ?? 0
  const done = habitCount?.done ?? 0
  const pct = total > 0 ? (done / total) : 0
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
          {done}/{total}
        </div>
      </div>
      <div className="font-semibold text-xs pt-1" style={{ color: ringColor }}>{child.nickname}</div>
    </div>
  )
}

const BottomNav = ({ active = 'home', onChange, t }) => {
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
  const { t, lang } = useLang()
  const [activeTab, setActiveTab] = useState('home')
  const [childrenNames, setChildrenNames] = useState('')
  const [children, setChildren] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingChild, setEditingChild] = useState(null)
  const [me, setMe] = useState(null)
  const [family, setFamily] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [habitsSheetChild, setHabitsSheetChild] = useState(null)  // when set, opens HabitsSheet
  const [habitCounts, setHabitCounts] = useState({})  // {childId: {total, done}}
  const [pendingVerifyCount, setPendingVerifyCount] = useState(0)
  const [verifySheetOpen, setVerifySheetOpen] = useState(false)
  const [quickVerifyOpen, setQuickVerifyOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [coParentOpen, setCoParentOpen] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [guideHasPin, setGuideHasPin] = useState(false)
  // Upacara Serahan Pertama — opened once after the diagnosis (?handover=1)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('handover') !== '1') return
    fetch('/api/family/pin', { credentials: 'include' }).then(r => r.json()).then(d => setGuideHasPin(!!d.hasPin)).catch(() => {})
    setHandoverOpen(true)
    sp.delete('handover')
    window.history.replaceState(null, '', `${window.location.pathname}${sp.toString() ? `?${sp}` : ''}`)
  }, [])
  // Deep links from push notifications: ?quick=1 opens Quick Verify, ?tab=reports opens Reports
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('quick') === '1') setQuickVerifyOpen(true)
    const tab = sp.get('tab')
    if (['tasks', 'reports', 'profile'].includes(tab)) setActiveTab(tab)
  }, [])
  // Register the service worker early so push keeps working after reloads
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {}) }, [])
  const [zikirOpen, setZikirOpen] = useState(false)
  const [kidModeChild, setKidModeChild] = useState(null)   // child pending Kid Mode entry (PIN gate)
  const [pinModalMode, setPinModalMode] = useState(null)   // 'enter' | 'set' | null
  const [rewardShopOpen, setRewardShopOpen] = useState(false)
  const [pendingRewardCount, setPendingRewardCount] = useState(0)
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false)
  const [demeritChild, setDemeritChild] = useState(null)   // child pending demerit modal
  const [streak, setStreak] = useState({ streak: 0, longestStreak: 0, todayDone: false, days: [] })
  const [dataVersion, setDataVersion] = useState(0)   // bump to refresh Tasks/Reports tabs
  const [pinChangeMode, setPinChangeMode] = useState(null)   // null | 'set' | 'change'
  const mainScrollRef = useRef(null)
  useEffect(() => { mainScrollRef.current?.scrollTo?.({ top: 0 }) }, [activeTab])
  const doLogout = async () => {
    if (confirm(t.logout_confirm)) {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      window.location.href = '/login'
    }
  }

  // Fetch family streak
  const fetchStreak = useCallback(async () => {
    try {
      const r = await fetch('/api/family/streak', { credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        setStreak(d)
      }
    } catch (e) { /* ignore */ }
  }, [])
  useEffect(() => { fetchStreak() }, [fetchStreak])

  // ── Device Role auto-redirect ──
  // On first load, if this device is configured as a "kid device", auto-navigate.
  // Skipped when URL has ?parent=1 (returning from Kid Mode via PIN exit).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const isReturningFromKid = params.has('parent')
    if (isReturningFromKid) {
      // Clean the URL so refresh works normally
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    let role = null
    try { role = localStorage.getItem('eqrel-device-role') } catch (e) { /* ignore */ }
    if (!role || role === 'parent') return
    if (role === 'kid:any') {
      window.location.replace('/kid')
      return
    }
    if (role.startsWith('kid:')) {
      const cid = role.slice(4)
      window.location.replace(`/kid?childId=${encodeURIComponent(cid)}`)
    }
  }, [])

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

  // LOAD CHILDREN + their habit counts
  useEffect(() => {
    if (!authChecked) return
    (async () => {
      try {
        const res = await fetch('/api/children', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        // First-time parent (no children yet, onboarding not done/skipped) → diagnosis quiz
        const ob = family?.onboarding
        if ((data.children || []).length === 0 && !ob?.completedAt && !ob?.skippedAt) {
          window.location.replace('/diagnosis')
          return
        }
        const refreshed = (data.children || []).map(c => {
          if (c.dob) {
            const age = calculateAge(c.dob)
            return { ...c, ageBand: ageBandFromAge(age) }
          }
          return c
        })
        setChildren(refreshed)

        // Fetch habit counts + today status per child in parallel
        const counts = {}
        await Promise.all(refreshed.map(async (c) => {
          try {
            const r = await fetch(`/api/children/${c.id}/habits`, { credentials: 'include' })
            if (r.ok) {
              const d = await r.json()
              const total = d.habits?.length || 0
              const done  = d.habits?.filter(h => h.todayStatus === 'claimed' || h.todayStatus === 'verified').length || 0
              counts[c.id] = { total, done }
            }
          } catch (e) {}
        }))
        setHabitCounts(counts)

        // Fetch verify queue count (pending claims)
        try {
          const vq = await fetch('/api/verify-queue', { credentials: 'include' })
          if (vq.ok) {
            const vqd = await vq.json()
            setPendingVerifyCount(vqd.claims?.length || 0)
          }
        } catch (e) {}

        // Fetch pending reward requests count
        try {
          const rr = await fetch('/api/rewards/requests?status=pending', { credentials: 'include' })
          if (rr.ok) {
            const rrd = await rr.json()
            setPendingRewardCount(rrd.requests?.length || 0)
          }
        } catch (e) {}
      } catch (e) {}
    })()
  }, [authChecked])

  // Refresh habit count for one child (called after HabitsSheet updates) — memoized
  const refreshChildHabits = useCallback(async (childId) => {
    try {
      const r = await fetch(`/api/children/${childId}/habits`, { credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        const total = d.habits?.length || 0
        const done  = d.habits?.filter(h => h.todayStatus === 'claimed' || h.todayStatus === 'verified').length || 0
        setHabitCounts(prev => ({ ...prev, [childId]: { total, done } }))
      }
    } catch (e) {}
  }, [])

  // Stable callback for HabitsSheet so it doesn't cause re-renders
  const handleHabitCountChange = useCallback(() => {
    if (habitsSheetChild) refreshChildHabits(habitsSheetChild.id)
  }, [habitsSheetChild, refreshChildHabits])

  useEffect(() => {
    // Format names for greeting
    const names = children.map(c => c.nickname)
    if (names.length === 0) setChildrenNames(t.dashboard_family_fallback)
    else if (names.length === 1) setChildrenNames(names[0])
    else if (names.length === 2) setChildrenNames(names.join(' & '))
    else setChildrenNames(names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1])
  }, [children, t])

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
            <div className="mt-1 inline-flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(family.code)
                  alert(`${t.setup_family_code_label}: ${family.code}`)
                }}
                className="inline-flex items-center gap-1 bg-white/70 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-800 shadow-sm border border-emerald-200/60 hover:bg-white"
                title={t.dashboard_copy_code_hint}
              >
                👨‍👩‍👧 {family.code}
              </button>
              <LangPicker variant="compact" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pt-3">
          <button onClick={() => setQuickVerifyOpen(true)} data-testid="header-bell" className="w-11 h-11 bg-white rounded-full shadow-eq-card flex items-center justify-center relative" aria-label={t.nav_notifications}>
            <Bell className="w-5 h-5 text-eq-ink" strokeWidth={2.5} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-eq-coral rounded-full ring-2 ring-white" />
          </button>
          <button
            onClick={async () => {
              if (confirm(t.logout_confirm)) {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
                window.location.href = '/login'
              }
            }}
            className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white shadow-eq-card bg-emerald-100 flex items-center justify-center"
            title={t.dashboard_logout_title}
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
      {activeTab === 'home' && (<>
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
      </>)}

      {/* MAIN CONTENT — scrollable when content taller than viewport, so BottomNav always stays visible */}
      <div ref={mainScrollRef} className="flex-1 flex flex-col px-3 mt-2 pb-2 max-w-md mx-auto w-full gap-2 min-h-0 relative z-10 overflow-y-auto overscroll-contain">
        {activeTab === 'tasks' && (
          <TasksTab kids={children} lang={lang} icon={ASSETS.navTasks} avatarSrc={resolveAvatarSrc}
            pendingVerifyCount={pendingVerifyCount} refreshKey={dataVersion}
            onOpenVerify={() => setQuickVerifyOpen(true)}
            onOpenHabits={(c) => setHabitsSheetChild(c)}
            onAddChild={openAddSheet} />
        )}
        {activeTab === 'reports' && (
          <ReportsTab lang={lang} icon={ASSETS.navReport} avatarSrc={resolveAvatarSrc} streak={streak} refreshKey={dataVersion} />
        )}
        {activeTab === 'profile' && (
          <ProfileTab lang={lang} icon={ASSETS.navProfile} me={me} family={family} kids={children} avatarSrc={resolveAvatarSrc}
            onEditChild={openEditSheet} onAddChild={openAddSheet}
            onChangePin={async () => {
              try {
                const r = await fetch('/api/family/pin', { credentials: 'include' })
                const d = await r.json().catch(() => ({}))
                setPinChangeMode(d.hasPin ? 'change' : 'set')
              } catch { setPinChangeMode('set') }
            }}
            onDeviceSettings={() => setDeviceSettingsOpen(true)}
            onDiagnosis={() => (window.location.href = '/diagnosis')}
            onNotifications={() => setNotifyOpen(true)}
            onCoParent={() => setCoParentOpen(true)}
            onRewardShop={() => setRewardShopOpen(true)}
            onLogout={doLogout} />
        )}
        {activeTab === 'home' && (<>
        <DigestCard lang={lang} refreshKey={dataVersion} onQuickVerify={() => setQuickVerifyOpen(true)} onSettings={() => setNotifyOpen(true)} />
        <PushPrompt lang={lang} variant="card" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-white rounded-3xl p-4 shadow-eq-card flex-shrink-0"
        >
          <h2 className="text-eq-ink font-extrabold text-xl leading-tight">
            {t.dashboard_headline}
          </h2>
          <p className="text-eq-ink font-extrabold text-lg leading-snug mt-0.5">
            {t.dashboard_headline_2(childrenNames)}
          </p>
          <p className="text-eq-ink/60 text-xs mt-2 leading-relaxed">
            {t.dashboard_sub}
          </p>

          <div className="flex justify-center gap-3 mt-3 flex-wrap">
            {children.map((child) => {
              let pressTimer = null
              const handleDown = () => {
                pressTimer = setTimeout(() => {
                  openEditSheet(child)
                  pressTimer = null
                }, 550)
              }
              const handleUp = () => {
                if (pressTimer) {
                  clearTimeout(pressTimer)
                  pressTimer = null
                  setHabitsSheetChild(child)
                }
              }
              const handleCancel = () => {
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
              }
              const enterKidMode = async (e) => {
                e.stopPropagation()
                try {
                  const res = await fetch('/api/family/pin', { credentials: 'include' })
                  const data = await res.json().catch(() => ({}))
                  setKidModeChild(child)
                  setPinModalMode(data.hasPin ? 'enter' : 'set')
                } catch {
                  setKidModeChild(child)
                  setPinModalMode('set')
                }
              }
              return (
                <div key={child.id} className="flex flex-col items-center gap-1">
                  <button
                    onMouseDown={handleDown} onMouseUp={handleUp} onMouseLeave={handleCancel}
                    onTouchStart={handleDown} onTouchEnd={handleUp} onTouchCancel={handleCancel}
                    className="active:scale-95 transition-transform"
                    aria-label={`Habits ${child.nickname}`}
                  >
                    <ChildProgressRing child={child} habitCount={habitCounts[child.id]} />
                  </button>
                  <button
                    onClick={enterKidMode}
                    className="mt-1 px-2 py-0.5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800 text-[10px] font-extrabold uppercase tracking-wider border border-purple-300 active:scale-95 flex items-center gap-1"
                    style={{ borderColor: `${child.favColor || '#7C3AED'}44` }}
                    aria-label={`Kid Mode ${child.nickname}`}
                  >
                    🧒 {t.kid_mode_btn}
                  </button>
                  {/* ═══ RED DEMERIT BUTTON — parent flags bad behavior ═══
                      Tap opens DemeritModal (pick 1-5 clouds). Backend adds
                      demeritCount → black clouds appear in the child's world.
                      Child clears clouds via Istighfar (10× Astaghfirullah). */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDemeritChild(child) }}
                    className="mt-1 px-2 py-0.5 rounded-full bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-extrabold uppercase tracking-wider border border-red-300 active:scale-95 flex items-center gap-1"
                    aria-label={`Demerit ${child.nickname}`}
                  >
                    ⛈️ {(t.demerit_btn) || 'Perilaku Buruk'}
                  </button>
                </div>
              )
            })}
            {children.length < 20 && (
              <button
                onClick={openAddSheet}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                aria-label={t.add_child_aria}
              >
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-eq-green/40 bg-eq-green/5 flex items-center justify-center hover:bg-eq-green/10 transition-colors">
                  <Plus className="w-8 h-8 text-eq-green" strokeWidth={2.5} />
                </div>
                <div className="text-eq-green font-semibold text-xs pt-1">{t.add_child}</div>
              </button>
            )}
          </div>

          {/* Hint */}
          {children.length > 0 && (
            <p className="text-center text-[11px] text-eq-ink/50 mt-2 leading-tight">
              {t.dashboard_hint}
            </p>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl px-3 py-2.5 flex items-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <img src={ASSETS.fireStreak} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-eq-ink text-xs leading-tight">
                <span className="font-extrabold">{t.family_streak_days(streak.streak || 0)}</span>
                <span className="text-eq-ink/70">{t.family_streak_suffix}</span>
              </div>
              {/* Last 14 days visual bar */}
              {streak.days && streak.days.length > 0 && (
                <div className="mt-1.5 flex gap-0.5">
                  {streak.days.map((d, i) => (
                    <div
                      key={d.date}
                      className={`h-2 flex-1 rounded-sm ${d.done ? 'bg-orange-400' : 'bg-orange-100'}`}
                      style={{ opacity: d.done ? (0.55 + (i / streak.days.length) * 0.45) : 0.4 }}
                      title={`${d.date}: ${d.done ? '✓' : '—'}`}
                    />
                  ))}
                </div>
              )}
              {streak.longestStreak > streak.streak && streak.longestStreak > 0 && (
                <div className="text-[10px] text-orange-800/70 mt-1 font-bold">
                  {t.streak_best_prefix} {streak.longestStreak}
                </div>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-eq-ink/40 flex-shrink-0" />
          </motion.div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          onClick={() => setQuickVerifyOpen(true)}
          className="w-full bg-eq-blue/10 border-2 border-eq-blue/20 rounded-2xl px-3 py-2.5 flex items-center gap-2.5 hover:bg-eq-blue/15 transition-all active:scale-[0.99] flex-shrink-0"
        >
          <img src={ASSETS.verifyClip} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
          <div className="flex-1 text-left">
            <div className="font-bold text-eq-ink text-sm">
              {pendingVerifyCount > 0 ? t.verify_pending(pendingVerifyCount) : t.verify_none}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-eq-blue flex-shrink-0" strokeWidth={2.5} />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          onClick={() => setRewardShopOpen(true)}
          className="w-full bg-amber-100/60 border-2 border-amber-200 rounded-2xl px-3 py-2.5 flex items-center gap-2.5 hover:bg-amber-100 transition-all active:scale-[0.99] flex-shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg flex-shrink-0">🎁</div>
          <div className="flex-1 text-left">
            <div className="font-bold text-eq-ink text-sm">{t.reward_shop_title}</div>
            <div className="text-[11px] text-amber-800/70 leading-tight">{t.reward_pending_count(pendingRewardCount)}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-700 flex-shrink-0" strokeWidth={2.5} />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.53, duration: 0.4 }}
          onClick={() => setZikirOpen(true)}
          className="w-full rounded-2xl px-3 py-2.5 flex items-center gap-2.5 hover:brightness-105 transition-all active:scale-[0.99] flex-shrink-0 shadow-sm border-2"
          style={{ background: 'linear-gradient(135deg, rgba(0,184,148,0.12), rgba(0,184,148,0.05))', borderColor: 'rgba(0,184,148,0.35)' }}
        >
          <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg flex-shrink-0">📿</div>
          <div className="flex-1 text-left">
            <div className="font-bold text-eq-ink text-sm">{t.zikir_tile_title || 'Zikir Keluarga'}</div>
            <div className="text-[11px] text-emerald-800/70 leading-tight">{t.zikir_tile_sub || 'Kaunter dikongsi keluarga'}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-emerald-700 flex-shrink-0" strokeWidth={2.5} />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          onClick={() => setDeviceSettingsOpen(true)}
          className="w-full bg-white/70 backdrop-blur border-2 border-eq-cream rounded-2xl px-3 py-2 flex items-center gap-2.5 hover:bg-white active:scale-[0.99] flex-shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">📱</div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-bold text-eq-ink text-sm">{t.device_settings_title}</div>
            <div className="text-[11px] text-emerald-800/70 leading-tight truncate">
              {t.device_settings_sub}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-emerald-700 flex-shrink-0" strokeWidth={2.5} />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          onClick={() => (window.location.href = '/display')}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl px-3 py-2 flex items-center gap-2.5 hover:brightness-110 active:scale-[0.99] flex-shrink-0 shadow-md"
        >
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-lg flex-shrink-0">🌙</div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-bold text-sm">{t.display_tile_title}</div>
            <div className="text-[11px] text-white/80 leading-tight truncate">{t.display_tile_sub}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-white flex-shrink-0" strokeWidth={2.5} />
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
              {t.family_quest_sub}
            </p>
            <button className="bg-eq-yellow text-eq-ink font-bold text-xs px-3 py-1.5 rounded-full shadow-eq-soft active:scale-95 flex items-center gap-0.5">
              {t.family_quest_cta}
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
            </button>
          </div>
        </motion.div>
        </>)}

      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} t={t} />

      {/* PWA Install Prompt (smart: iOS tutorial / Android native) */}
      <InstallPrompt />

      {/* Add/Edit Child bottom sheet */}
      <ChildSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={editingChild}
        onSave={handleSaveChild}
        onDelete={handleDeleteChild}
        onEnterKidMode={async (child) => {
          // Close child sheet, check PIN status
          setSheetOpen(false)
          try {
            const res = await fetch('/api/family/pin', { credentials: 'include' })
            const data = await res.json().catch(() => ({}))
            setKidModeChild(child)
            setPinModalMode(data.hasPin ? 'enter' : 'set')
          } catch {
            setKidModeChild(child)
            setPinModalMode('set')
          }
        }}
      />

      {/* Habits sheet — opens when a child ring is tapped */}
      <HabitsSheet
        open={!!habitsSheetChild}
        onClose={() => {
          if (habitsSheetChild) refreshChildHabits(habitsSheetChild.id)
          setHabitsSheetChild(null)
          setDataVersion(v => v + 1)
        }}
        child={habitsSheetChild}
        onCountChange={handleHabitCountChange}
      />

      {/* Sahkan Pantas — one-tap bulk verify (default entry point) */}
      <QuickVerifySheet
        open={quickVerifyOpen}
        lang={lang}
        onClose={() => {
          setQuickVerifyOpen(false)
          children.forEach(c => refreshChildHabits(c.id))
          setDataVersion(v => v + 1)
          fetchStreak()
        }}
        onDone={() => setPendingVerifyCount(c => Math.max(0, c - 1))}
        onOpenDetailed={() => { setQuickVerifyOpen(false); setVerifySheetOpen(true) }}
      />
      <NotifySettingsSheet open={notifyOpen} onClose={() => setNotifyOpen(false)} lang={lang} />
      <HandoverGuide open={handoverOpen} onClose={() => setHandoverOpen(false)} lang={lang} kids={children}
        hasPin={guideHasPin} onSetPin={() => setPinChangeMode('set')} />
      <CoParentSheet open={coParentOpen} onClose={() => { setCoParentOpen(false); setDataVersion(v => v + 1) }} lang={lang} />

      {/* Verify Queue sheet — parent 3-level rubric */}
      <VerifySheet
        open={verifySheetOpen}
        onClose={() => {
          setVerifySheetOpen(false)
          // refresh habit counts (verified/removed claims affect done count) for all children
          children.forEach(c => refreshChildHabits(c.id))
          setDataVersion(v => v + 1)
          fetchStreak()
        }}
        onCountChange={setPendingVerifyCount}
      />

      {/* PIN gate for Kid Mode entry */}
      <PinModal
        open={!!pinModalMode && !!kidModeChild}
        mode={pinModalMode || 'enter'}
        onClose={() => { setPinModalMode(null); setKidModeChild(null) }}
        onSuccess={() => {
          const c = kidModeChild
          setPinModalMode(null)
          setKidModeChild(null)
          if (c) window.location.href = `/kid?childId=${encodeURIComponent(c.id)}`
        }}
      />

      {/* Change parent PIN — opened from Profile tab */}
      <PinModal
        open={!!pinChangeMode}
        mode={pinChangeMode || 'change'}
        onClose={() => setPinChangeMode(null)}
        onSuccess={() => { setPinChangeMode(null); setGuideHasPin(true) }}
      />

      {/* Reward Shop — parent view (catalog + requests) */}
      <RewardShopSheet
        open={rewardShopOpen}
        onClose={async () => {
          setRewardShopOpen(false)
          // Refresh pending reward count after actions
          try {
            const rr = await fetch('/api/rewards/requests?status=pending', { credentials: 'include' })
            if (rr.ok) {
              const d = await rr.json()
              setPendingRewardCount(d.requests?.length || 0)
            }
            // Also refresh children (mataReward may have changed)
            const cr = await fetch('/api/children', { credentials: 'include' })
            if (cr.ok) {
              const cd = await cr.json()
              setChildren(cd.children || [])
            }
          } catch (e) {}
        }}
        kids={children}
      />

      {/* Device Settings — pick how this device behaves at startup */}
      <DeviceSettingsSheet
        open={deviceSettingsOpen}
        onClose={() => setDeviceSettingsOpen(false)}
        kids={children}
      />

      {/* Zikir bottom sheet */}
      <AnimatePresence>
        {zikirOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setZikirOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-eq-cream rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-eq-cream/95 backdrop-blur px-4 py-3 border-b border-emerald-100 flex items-center justify-between rounded-t-3xl">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📿</span>
                  <div>
                    <div className="text-sm font-black text-eq-ink leading-tight">{t.zikir_tile_title || 'Zikir Keluarga'}</div>
                    <div className="text-[10px] text-emerald-800/60">{t.zikir_tile_sub || 'Kaunter dikongsi keluarga'}</div>
                  </div>
                </div>
                <button onClick={() => setZikirOpen(false)}
                  className="w-9 h-9 rounded-full bg-white border border-emerald-200 flex items-center justify-center active:scale-95">
                  <X className="w-4 h-4 text-emerald-800" />
                </button>
              </div>
              <div className="p-4">
                <ZikirTasbih />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ DEMERIT MODAL — parent flags bad behavior, adds N clouds ═══ */}
      <AnimatePresence>
        {demeritChild && (
          <DemeritModal
            child={demeritChild}
            lang={lang}
            onClose={() => setDemeritChild(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DemeritModal — parent's tool to flag bad behavior. Picks a quantity of
// black clouds (1-5) to add to the child's world. Backend increments
// demeritCount by delta. Child clears clouds via Istighfar loop (10× per
// cloud). All copy passes through inline i18n so toggle bahasa flips live.
// ═══════════════════════════════════════════════════════════════════════════
const DemeritModal = ({ child, lang, onClose }) => {
  const [qty, setQty] = useState(1)
  const [mataDeduct, setMataDeduct] = useState(10)   // parent picks total mata to deduct
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const isRTL = lang === 'ar'
  // Dropdown options for reward-point deduction. Kept low & educational so
  // parents don't wipe out a week's earnings for one incident.
  const MATA_OPTIONS = [5, 10, 20, 50, 100]
  const L = {
    title: {
      ms: 'Perilaku Buruk', en: 'Bad Behavior', id: 'Perilaku Buruk', ar: 'سلوك سيء',
    },
    sub: {
      ms: (name) => `Berapa awan hitam untuk ${name}?`,
      en: (name) => `How many dark clouds for ${name}?`,
      id: (name) => `Berapa awan hitam untuk ${name}?`,
      ar: (name) => `كم عدد السحب السوداء لـ ${name}؟`,
    },
    hint: {
      ms: 'Mata Bina tidak dikurangkan. Anak boleh hilangkan awan dengan istighfar 10 kali per awan.',
      en: 'Build Points untouched. Child clears clouds by saying Astaghfirullah 10× each.',
      id: 'Poin Bangun tidak dikurangi. Anak menghilangkan awan dengan istighfar 10 kali per awan.',
      ar: 'نقاط البناء لا تُمس. يزيل الطفل كل سحابة بالاستغفار عشر مرات.',
    },
    qtyLabel: { ms: 'Bilangan Awan', en: 'Cloud Count', id: 'Jumlah Awan', ar: 'عدد السحب' },
    mataLabel: {
      ms: 'Mata Reward untuk ditolak',
      en: 'Reward Points to deduct',
      id: 'Poin Hadiah yang dikurangi',
      ar: 'نقاط المكافأة المخصومة',
    },
    confirm: { ms: 'Sahkan', en: 'Confirm', id: 'Sahkan', ar: 'تأكيد' },
    cancel: { ms: 'Batal', en: 'Cancel', id: 'Batal', ar: 'إلغاء' },
    done: {
      ms: 'Sudah ditambah. Ajak anak beristighfar bersama.',
      en: 'Added. Encourage your child to seek forgiveness together.',
      id: 'Sudah ditambahkan. Ajak anak beristighfar bersama.',
      ar: 'تمت الإضافة. شجّع طفلك على الاستغفار.',
    },
  }
  const tr = (k) => {
    const v = L[k][lang] || L[k].ms
    return typeof v === 'function' ? v(child.nickname) : v
  }
  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await fetch(`/api/world/${child.id}/demerit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ delta: qty, mataDeduct }),
      })
      setDone(true)
      setTimeout(onClose, 1800)
    } catch (e) { onClose() }
  }
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        dir={isRTL ? 'rtl' : 'ltr'}
        className="fixed inset-0 z-[91] flex items-center justify-center p-6 pointer-events-none"
      >
        <div className="max-w-sm w-full bg-white rounded-3xl p-6 shadow-2xl pointer-events-auto">
          {!done ? (
            <>
              <div className="text-center mb-4">
                <div className="text-5xl mb-2">⛈️</div>
                <div className="text-xs uppercase tracking-widest font-black text-red-600 mb-1">
                  {tr('title')}
                </div>
                <div className="text-sm text-eq-ink/80 leading-snug">{tr('sub')}</div>
              </div>

              {/* Cloud quantity stepper */}
              <div className="mb-1 text-xs font-bold text-eq-ink/70">{tr('qtyLabel')}</div>
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-11 h-11 rounded-full bg-red-100 hover:bg-red-200 text-red-800 text-xl font-black active:scale-95"
                >−</button>
                <div className="min-w-16 text-center">
                  <div className="text-3xl font-black text-red-800">{qty}</div>
                  <div className="text-[10px] text-red-800/70">
                    {'🌩️'.repeat(Math.min(qty, 5))}
                  </div>
                </div>
                <button
                  onClick={() => setQty(Math.min(5, qty + 1))}
                  className="w-11 h-11 rounded-full bg-red-100 hover:bg-red-200 text-red-800 text-xl font-black active:scale-95"
                >+</button>
              </div>

              {/* Mata reward deduction dropdown — parent decides magnitude.
                  Kept as a native <select> for accessibility + max-child-safety
                  (no fancy custom picker on parent-only screens). */}
              <div className="mb-1 text-xs font-bold text-eq-ink/70 flex items-center gap-1">
                <span>💰</span> {tr('mataLabel')}
              </div>
              <div className="mb-4">
                <select
                  value={mataDeduct}
                  onChange={(e) => setMataDeduct(Number(e.target.value))}
                  className="w-full rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-lg font-black text-red-800 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  {MATA_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>−{opt} Mata Reward</option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-eq-ink/60 mb-4 text-center leading-tight">
                🤲 {tr('hint')}
              </p>

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black py-3 active:scale-95 disabled:opacity-60 mb-2"
              >
                {submitting ? '...' : tr('confirm')}
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-2xl bg-transparent text-eq-ink/70 font-bold py-2 text-sm"
              >
                {tr('cancel')}
              </button>
            </>
          ) : (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-4"
            >
              <div className="text-5xl mb-3">🤲</div>
              <div className="text-sm text-eq-ink/80 leading-relaxed">
                {tr('done')}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  )
}

function App() {
  return <ParentDashboard />
}

export default App
