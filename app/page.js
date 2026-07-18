'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Bell, ChevronRight, Sparkles } from 'lucide-react'
import { strings } from '@/lib/i18n/strings'
import { mockParent, mockChildren, mockFamily } from '@/lib/mock/parent-data'

// Asset URLs (from user-uploaded Asset Factory)
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

// Child avatar SVG placeholders (until real assets)
const ChildAvatar = ({ type = 'boy-kopiah', size = 88 }) => {
  if (type === 'girl-hijab') {
    return (
      <div style={{ width: size, height: size }} className="relative rounded-full overflow-hidden bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
        <span className="text-4xl">👧🏻</span>
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size }} className="relative rounded-full overflow-hidden bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
      <span className="text-4xl">👦🏻</span>
    </div>
  )
}

// Progress ring around child avatar
const ChildProgressRing = ({ child, ringColor = '#00B894' }) => {
  const pct = child.todayTotal > 0 ? (child.todayCompleted / child.todayTotal) : 0
  const radius = 52
  const stroke = 6
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 120, height: 120 }}>
        <svg width="120" height="120" className="absolute inset-0 -rotate-90">
          <circle cx="60" cy="60" r={radius} stroke="#F0EAD6" strokeWidth={stroke} fill="none" />
          <motion.circle
            cx="60" cy="60" r={radius}
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
          <ChildAvatar type={child.avatarType} size={88} />
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white shadow-eq-soft rounded-full px-3 py-0.5 text-sm font-bold text-eq-ink whitespace-nowrap">
          {child.todayCompleted}/{child.todayTotal}
        </div>
      </div>
      <div className="text-eq-ink font-semibold text-sm pt-2">{child.nickname}</div>
    </div>
  )
}

// Bottom navigation
const BottomNav = ({ active = 'home', onChange }) => {
  const t = strings.ms
  const items = [
    { id: 'home', label: t.nav_home, icon: ASSETS.navHome, color: '#00B894' },
    { id: 'tasks', label: t.nav_tasks, icon: ASSETS.navTasks, color: '#2D9CDB' },
    { id: 'reports', label: t.nav_reports, icon: ASSETS.navReport, color: '#FFB703' },
    { id: 'profile', label: t.nav_profile, icon: ASSETS.navProfile, color: '#B39DDB' },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-eq-cream/50 z-40 safe-bottom">
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(item => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onChange?.(item.id)}
              className="flex flex-col items-center justify-center py-2.5 px-2 relative transition-transform active:scale-95"
              aria-label={item.label}
            >
              <div className={`w-10 h-10 flex items-center justify-center transition-all ${isActive ? 'scale-110' : 'scale-100 opacity-60'}`}>
                <img src={item.icon} alt="" className="w-9 h-9 object-contain" />
              </div>
              <span className={`text-[11px] font-semibold mt-0.5 transition-colors ${isActive ? 'text-eq-ink' : 'text-eq-ink/50'}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 h-1 w-8 rounded-full"
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

// Main Dashboard
const ParentDashboard = () => {
  const t = strings.ms
  const [activeTab, setActiveTab] = useState('home')
  const [childrenNames, setChildrenNames] = useState('')

  useEffect(() => {
    // Format children names: "Adam & Aisyah" atau "Adam, Aisyah & Yusuf"
    const names = mockChildren.map(c => c.nickname)
    if (names.length === 1) setChildrenNames(names[0])
    else if (names.length === 2) setChildrenNames(names.join(' & '))
    else setChildrenNames(names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1])
  }, [])

  const childColors = ['#00B894', '#FF8A00', '#2D9CDB', '#FF5D6E']

  return (
    <div className="min-h-screen bg-eq-warm pb-24 relative overflow-x-hidden">
      {/* ===== HERO SECTION ===== */}
      <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
        {/* Landscape backdrop */}
        <div className="absolute inset-0">
          <img
            src={ASSETS.heroLandscape}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/95" />
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-start justify-between px-5 pt-6">
          <div>
            <p className="text-eq-ink/70 text-[13px] font-medium leading-tight">{t.salam},</p>
            <h1 className="text-eq-ink font-extrabold text-3xl leading-tight mt-0.5 flex items-center gap-2">
              {mockParent.name} <span className="animate-gentle-pulse">👋</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-11 h-11 bg-white rounded-full shadow-eq-soft flex items-center justify-center relative" aria-label="Notifications">
              <Bell className="w-5 h-5 text-eq-ink" strokeWidth={2.5} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-eq-coral rounded-full ring-2 ring-white" />
            </button>
            <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white shadow-eq-soft">
              <img src={ASSETS.navProfile} alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* EQ Mascot */}
        <div className="relative z-10 flex justify-center mt-2 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="animate-float"
          >
            <img src={ASSETS.eqMascot} alt="EQ mascot" className="w-52 h-52 object-contain drop-shadow-2xl" />
          </motion.div>
        </div>
      </div>

      {/* ===== MOMENTUM BADGE (floating) ===== */}
      <div className="relative z-20 flex justify-center -mt-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-white shadow-eq-card rounded-full px-5 py-2.5 flex items-center gap-2 border border-eq-cream/60"
        >
          <img src={ASSETS.momentumStar} alt="" className="w-6 h-6 object-contain" />
          <span className="text-eq-ink font-bold text-[11px] tracking-wider">{t.momentum_week}</span>
          <Sparkles className="w-4 h-4 text-eq-yellow" fill="#FFB703" />
        </motion.div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="px-4 mt-6 space-y-4 max-w-md mx-auto">

        {/* HEADLINE CARD */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white rounded-3xl p-5 shadow-eq-card"
        >
          <h2 className="text-eq-ink font-extrabold text-2xl leading-tight">
            {t.alhamdulillah},
          </h2>
          <p className="text-eq-ink font-extrabold text-2xl leading-tight mt-1">
            perjalanan {childrenNames}
            <br />
            semakin bercahaya <span className="inline-block">💛</span>
          </p>
          <p className="text-eq-ink/60 text-sm mt-3 leading-relaxed">
            {t.dashboard_sub}
          </p>

          {/* Progress rings */}
          <div className="flex justify-center gap-6 mt-6 pt-2">
            {mockChildren.map((child, idx) => (
              <ChildProgressRing
                key={child.id}
                child={child}
                ringColor={childColors[idx % childColors.length]}
              />
            ))}
          </div>

          {/* Family streak bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:shadow-eq-soft transition-shadow"
          >
            <img src={ASSETS.fireStreak} alt="" className="w-9 h-9 object-contain" />
            <div className="flex-1 text-eq-ink text-sm">
              <span className="font-extrabold text-eq-ink">{mockFamily.streakDays} hari</span>
              <span className="text-eq-ink/70"> sepanjang perjalanan keluarga</span>
            </div>
            <ChevronRight className="w-5 h-5 text-eq-ink/40" />
          </motion.div>
        </motion.div>

        {/* VERIFY QUEUE CTA */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="w-full bg-eq-blue/10 border-2 border-eq-blue/20 rounded-2xl px-4 py-4 flex items-center gap-3 hover:bg-eq-blue/15 transition-all active:scale-[0.99]"
        >
          <img src={ASSETS.verifyClip} alt="" className="w-11 h-11 object-contain" />
          <div className="flex-1 text-left">
            <div className="font-bold text-eq-ink text-base">
              {mockFamily.pendingVerifications} tugasan sedia disemak
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-eq-blue" strokeWidth={2.5} />
        </motion.button>

        {/* FAMILY QUEST CARD */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="relative rounded-3xl overflow-hidden shadow-eq-card bg-gradient-to-br from-sky-100 to-blue-50"
        >
          {/* Island illustration mini */}
          <div className="absolute right-0 top-0 bottom-0 w-32 opacity-90 pointer-events-none">
            <img
              src={ASSETS.heroLandscape}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: 'right center' }}
            />
          </div>

          <div className="relative p-5 pr-32">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-white rounded-lg shadow-eq-soft flex items-center justify-center">
                <span className="text-lg">🚩</span>
              </div>
              <h3 className="text-eq-ink font-extrabold text-xl">{t.family_quest_title}</h3>
            </div>
            <p className="text-eq-ink/70 text-sm mt-1 mb-4 leading-snug">
              {t.family_quest_sub}
            </p>
            <button className="bg-eq-yellow text-eq-ink font-bold text-sm px-4 py-2 rounded-full shadow-eq-soft hover:shadow-eq-glow transition-all active:scale-95 flex items-center gap-1">
              {t.family_quest_cta}
              <ChevronRight className="w-4 h-4" strokeWidth={3} />
            </button>
          </div>
        </motion.div>

        {/* Placeholder for future sections */}
        <div className="h-4" />
      </div>

      {/* Bottom navigation */}
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}

function App() {
  return <ParentDashboard />
}

export default App
