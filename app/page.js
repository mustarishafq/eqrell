'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, ChevronRight, Sparkles } from 'lucide-react'
import { strings } from '@/lib/i18n/strings'
import { mockParent, mockChildren, mockFamily } from '@/lib/mock/parent-data'

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

const ChildAvatar = ({ type = 'boy-kopiah', size = 68 }) => {
  const emoji = type === 'girl-hijab' ? '👧🏻' : '👦🏻'
  const bg = type === 'girl-hijab'
    ? 'from-purple-100 to-purple-200'
    : 'from-green-100 to-green-200'
  return (
    <div style={{ width: size, height: size }} className={`relative rounded-full overflow-hidden bg-gradient-to-br ${bg} flex items-center justify-center`}>
      <span style={{ fontSize: size * 0.5 }}>{emoji}</span>
    </div>
  )
}

const ChildProgressRing = ({ child, ringColor = '#00B894' }) => {
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
        <div className="absolute inset-0 flex items-center justify-center">
          <ChildAvatar type={child.avatarType} size={68} />
        </div>
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white shadow-eq-soft rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
          style={{ color: ringColor }}
        >
          {child.todayCompleted}/{child.todayTotal}
        </div>
      </div>
      <div className="text-eq-ink font-semibold text-xs pt-1">{child.nickname}</div>
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
    <nav className="flex-shrink-0 bg-white border-t border-eq-cream/50 safe-bottom">
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(item => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onChange?.(item.id)}
              className="flex flex-col items-center justify-center py-1.5 px-2 relative transition-transform active:scale-95"
              aria-label={item.label}
            >
              <div className={`w-8 h-8 flex items-center justify-center transition-all ${isActive ? 'scale-110' : 'scale-100 opacity-60'}`}>
                <img src={item.icon} alt="" className="w-8 h-8 object-contain" />
              </div>
              <span className={`text-[10px] font-semibold mt-0.5 transition-colors ${isActive ? 'text-eq-ink' : 'text-eq-ink/50'}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 h-1 w-6 rounded-full"
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

  useEffect(() => {
    const names = mockChildren.map(c => c.nickname)
    if (names.length === 1) setChildrenNames(names[0])
    else if (names.length === 2) setChildrenNames(names.join(' & '))
    else setChildrenNames(names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1])
  }, [])

  const childColors = ['#00B894', '#FF8A00', '#2D9CDB', '#FF5D6E']

  return (
    <div className="h-[100dvh] bg-eq-warm flex flex-col overflow-hidden relative">
      {/* HERO — full-bleed, extends behind status bar/dynamic island */}
      <div className="absolute inset-x-0 top-0 pointer-events-none z-0" style={{ height: '48dvh' }}>
        <img src={ASSETS.heroLandscape} alt="" className="w-full h-full object-cover" />
        {/* Fade to warm bg at bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-eq-warm/95" />
      </div>

      {/* TOP BAR — over hero, respects safe area */}
      <div className="relative z-20 flex items-start justify-between px-5 flex-shrink-0 pointer-events-auto" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="pt-2">
          <p className="text-eq-ink/70 text-sm font-semibold leading-tight">{t.salam},</p>
          <h1 className="text-eq-ink font-extrabold text-[34px] leading-tight mt-0.5 flex items-center gap-2">
            {mockParent.name} <span className="animate-gentle-pulse text-2xl">👋</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 pt-3">
          <button className="w-11 h-11 bg-white rounded-full shadow-eq-card flex items-center justify-center relative" aria-label="Notifications">
            <Bell className="w-5 h-5 text-eq-ink" strokeWidth={2.5} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-eq-coral rounded-full ring-2 ring-white" />
          </button>
          <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white shadow-eq-card">
            <img src={ASSETS.navProfile} alt="Profile" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* EQ MASCOT — large, half-body, sits over hero */}
      <div className="relative z-20 flex justify-center flex-shrink-0 pointer-events-none" style={{ height: '20dvh', minHeight: 160 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="animate-float absolute inset-x-0 flex justify-center overflow-hidden"
          style={{ top: '-10px', bottom: '10px' }}
        >
          <img
            src={ASSETS.eqMascot}
            alt="EQ"
            className="w-[220px] h-[220px] object-contain drop-shadow-2xl"
            style={{ objectPosition: 'top center' }}
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

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col px-3 mt-2 pb-2 max-w-md mx-auto w-full gap-2 min-h-0 relative z-10">

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

          <div className="flex justify-center gap-5 mt-3">
            {mockChildren.map((child, idx) => (
              <ChildProgressRing
                key={child.id}
                child={child}
                ringColor={childColors[idx % childColors.length]}
              />
            ))}
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
    </div>
  )
}

function App() {
  return <ParentDashboard />
}

export default App
