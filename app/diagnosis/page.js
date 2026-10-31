'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, Sparkles, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/eqrel/BrandLogo'
import { LangPicker } from '@/components/eqrel/LangPicker'
import { useLang } from '@/lib/i18n/LangProvider'
import { BRAND } from '@/lib/brand'
import { BOY_AVATARS, GIRL_AVATARS, AVATAR_BY_ID } from '@/lib/avatars'
import { TEMPLATE_BY_ID, HABIT_CATEGORIES, getTemplateTitle } from '@/lib/habitTemplates'
import {
  DIMENSIONS, GOALS, ROUTINE_QUESTIONS, PRACTICE_QUESTIONS, LEVELS, SCHOOL_OPTIONS, STAGES,
  scoreDiagnosis, buildPlan, tx,
} from '@/lib/diagnosis'

const COLORS = [
  { id: 'green', hex: '#00B894' }, { id: 'yellow', hex: '#FFB703' }, { id: 'orange', hex: '#FF8A00' },
  { id: 'coral', hex: '#FF5D6E' }, { id: 'blue', hex: '#2D9CDB' }, { id: 'purple', hex: '#9C7BD9' },
  { id: 'pink', hex: '#EC4899' }, { id: 'fresh', hex: '#4CAF50' },
]
const BAND_AGE = { '3-4': 4, '5-6': 6, '7-9': 8, '10-12': 11 }
const ageOfChild = (c) => {
  if (Number.isFinite(c?.age)) return c.age
  if (c?.dob) {
    const b = new Date(c.dob); const n = new Date()
    let a = n.getFullYear() - b.getFullYear()
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
    if (Number.isFinite(a)) return Math.max(3, Math.min(12, a))
  }
  return BAND_AGE[c?.ageBand] || 6
}

const Primary = ({ children, className = '', ...p }) => (
  <button {...p} className={`w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl py-3.5 font-extrabold text-[15px] shadow-lg shadow-emerald-600/20 disabled:opacity-40 active:scale-[0.99] transition ${className}`}>
    {children}
  </button>
)

const OptionCard = ({ active, onClick, icon, label, sub, testId }) => (
  <button onClick={onClick} data-testid={testId}
    className={`w-full flex items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-all active:scale-[0.99] ${active ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
    <span className="text-2xl leading-none w-8 text-center">{icon}</span>
    <span className="flex-1 min-w-0">
      <span className={`block font-extrabold text-sm ${active ? 'text-emerald-800' : 'text-gray-800'}`}>{label}</span>
      {sub && <span className="block text-[11px] text-gray-500 leading-snug">{sub}</span>}
    </span>
    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
      {active && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
    </span>
  </button>
)

function DiagnosisInner() {
  const { lang } = useLang()
  const L = (ms, en) => (lang === 'en' || lang === 'ar' ? en : ms)
  const search = useSearchParams()
  const presetChildId = search.get('childId')

  const [ready, setReady] = useState(false)
  const [me, setMe] = useState(null)
  const [family, setFamily] = useState(null)
  const [existingKids, setExistingKids] = useState([])
  const [doneKids, setDoneKids] = useState([])   // [{ nickname, avatarId, habitsCreated, stage }]

  const [step, setStep] = useState('intro')
  const [goals, setGoals] = useState([])
  const [routine, setRoutine] = useState({})
  const [routineIdx, setRoutineIdx] = useState(0)

  // current child
  const blankChild = { id: null, nickname: '', gender: 'male', age: 6, avatarId: 'B01', favColor: 'green' }
  const [child, setChild] = useState(blankChild)
  const [school, setSchool] = useState('none')
  const [practice, setPractice] = useState({})
  const [qIdx, setQIdx] = useState(0)
  const [plan, setPlan] = useState([])
  const [picked, setPicked] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { credentials: 'include' })
        if (!r.ok) { window.location.href = '/login'; return }
        const d = await r.json()
        if (d.needsFamilySetup) { window.location.href = '/family/setup'; return }
        setMe(d.user); setFamily(d.family)
        if (d.family?.onboarding?.goals?.length) setGoals(d.family.onboarding.goals)
        if (d.family?.onboarding?.routine) setRoutine(d.family.onboarding.routine)
        const cr = await fetch('/api/children', { credentials: 'include' })
        const kids = cr.ok ? ((await cr.json()).children || []) : []
        setExistingKids(kids)
        if (presetChildId) {
          const c = kids.find(k => k.id === presetChildId)
          if (c) setChild({ id: c.id, nickname: c.nickname, gender: c.gender || 'male', age: ageOfChild(c), avatarId: c.avatarId || 'B01', favColor: c.favColor || 'green' })
        }
        setReady(true)
      } catch { window.location.href = '/login' }
    })()
  }, [presetChildId])

  const hasFamilyAnswers = !!family?.onboarding?.goals?.length
  const n = child.nickname?.trim() || L('anak', 'your child')

  // ── step helpers ──
  const startChildFlow = (c) => {
    setChild(c || blankChild); setSchool(c?.age >= 7 ? 'morning' : 'none'); setPractice({}); setQIdx(0); setError(null)
    setStep(c?.id ? 'c_school' : 'c_profile')
  }
  const saveFamily = async () => {
    try {
      await fetch('/api/onboarding/family', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ goals, routine }),
      })
    } catch { /* non-blocking */ }
  }
  const skipAll = async () => {
    try { await fetch('/api/onboarding/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ skipped: true }) }) } catch { /* ignore */ }
    window.location.href = '/?parent=1'
  }
  const finishAll = async () => {
    try { await fetch('/api/onboarding/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({}) }) } catch { /* ignore */ }
    window.location.href = '/?parent=1'
  }
  const applyPlan = async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/onboarding/child', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          childId: child.id || undefined,
          profile: { nickname: child.nickname, gender: child.gender, avatarId: child.avatarId, favColor: child.favColor },
          age: child.age, school, practice, lang,
          templateIds: plan.filter(x => picked[x.templateId]).map(x => x.templateId),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || L('Gagal menyimpan. Cuba lagi.', 'Could not save. Please try again.'))
      const res2 = { nickname: d.child?.nickname || child.nickname, avatarId: d.child?.avatarId || child.avatarId, habitsCreated: d.habitsCreated, stage: d.diagnosis?.stage, id: d.child?.id }
      setLastResult(res2)
      setDoneKids(prev => [...prev, res2])
      setExistingKids(prev => prev.some(k => k.id === d.child?.id) ? prev.map(k => k.id === d.child.id ? d.child : k) : [...prev, d.child])
      setStep('c_done')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const scores = useMemo(() => scoreDiagnosis(practice), [practice])
  const stage = STAGES.find(s => s.id === scores.stage) || STAGES[0]

  // Progress bar (rough)
  const progress = {
    intro: 0, goals: 10, routine: 20, c_profile: 30, c_school: 38,
    c_practice: 40 + Math.round((qIdx / PRACTICE_QUESTIONS.length) * 40),
    c_analyzing: 88, c_result: 95, c_done: 100,
  }[step] ?? 0
  const back = {
    goals: 'intro', routine: 'goals', c_pick: hasFamilyAnswers ? 'intro' : 'routine',
    c_profile: doneKids.length ? 'c_done' : existingKids.some(k => !k.diagnosis) ? 'c_pick' : (hasFamilyAnswers ? 'intro' : 'routine'),
    c_school: child.id ? (doneKids.length ? 'c_done' : existingKids.some(k => !k.diagnosis) ? 'c_pick' : 'intro') : 'c_profile',
  }[step]
  const onBack = () => {
    if (step === 'c_practice') { if (qIdx > 0) setQIdx(qIdx - 1); else setStep('c_school'); return }
    if (step === 'routine' && routineIdx > 0) { setRoutineIdx(routineIdx - 1); return }
    if (back) setStep(back)
  }

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  const avatarPool = child.gender === 'female' ? GIRL_AVATARS : BOY_AVATARS
  const avatarSrc = (id) => AVATAR_BY_ID[id]?.src || '/avatars/boys/B01.png'
  const pq = PRACTICE_QUESTIONS[qIdx]
  const undiagnosedKids = existingKids.filter(k => !k.diagnosis && !doneKids.some(d => d.id === k.id))

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50 relative overflow-x-clip"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)', paddingBottom: 'max(env(safe-area-inset-bottom), 18px)' }}
      data-testid="diagnosis-page">
      <div className="pointer-events-none absolute top-0 left-0 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-72 h-72 bg-amber-200/40 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative z-10 max-w-md mx-auto px-4 flex flex-col min-h-[calc(100dvh-32px)]">
        {/* Header */}
        <div className="flex items-center gap-2 h-11">
          {step !== 'intro' && step !== 'c_analyzing' && step !== 'c_done' && step !== 'c_result' ? (
            <button onClick={onBack} aria-label="back" data-testid="diag-back"
              className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center active:scale-95">
              <ArrowLeft className="w-4 h-4 text-emerald-800" />
            </button>
          ) : <div className="w-9" />}
          <div className="flex-1 flex justify-center"><BrandLogo size="sm" /></div>
          <LangPicker variant="compact" />
        </div>
        {step !== 'intro' && (
          <div className="mt-2 h-1.5 rounded-full bg-white/80 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={step + (step === 'c_practice' ? qIdx : '') + (step === 'routine' ? routineIdx : '')}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col pt-4">

            {/* ── INTRO ── */}
            {step === 'intro' && (
              <div className="flex-1 flex flex-col" data-testid="diag-intro">
                <div className="flex justify-center mt-2">
                  <motion.img src={BRAND.mascot.default} alt="EQ" className="w-32 h-32 object-contain drop-shadow-xl"
                    animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }} />
                </div>
                <div className="bg-white rounded-3xl shadow-xl p-5 border-2 border-emerald-100 mt-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" /> {L('Diagnosis Iman & Habit', 'Iman & Habit Diagnosis')}
                  </div>
                  <h1 className="text-[22px] font-extrabold text-emerald-950 leading-tight mt-2">
                    {L(`Assalamualaikum${me?.name ? ', ' + me.name.split(' ')[0] : ''}! Mari kenali setiap anak anda.`, `Assalamualaikum${me?.name ? ', ' + me.name.split(' ')[0] : ''}! Let's get to know each child.`)}
                  </h1>
                  <p className="text-sm text-emerald-900/70 mt-2 leading-relaxed">
                    {L('Jawab beberapa soalan ringkas tentang amalan harian setiap anak. EQrel akan menganalisis jawapan anda dan membina Pelan Habit khas — sesuai dengan umur, kekuatan dan keperluan mereka.',
                      "Answer a few quick questions about each child's daily practice. EQrel analyses your answers and builds a personal Habit Plan matched to their age, strengths and needs.")}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[
                      ['🩺', L('Diagnosis setiap anak', 'Diagnose each child')],
                      ['📊', L('Profil Iman & Habit', 'Iman & Habit profile')],
                      ['🎯', L('Pelan habit khas', 'Personal habit plan')],
                    ].map(([i, t]) => (
                      <div key={t} className="rounded-2xl bg-emerald-50/70 p-2.5 text-center">
                        <div className="text-2xl">{i}</div>
                        <div className="text-[10px] font-bold text-emerald-900 leading-tight mt-1">{t}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-[11px] text-emerald-900/60">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    {L('± 2 minit setiap anak · Jawapan hanya dilihat oleh keluarga anda', '± 2 minutes per child · Answers are private to your family')}
                  </div>
                </div>
                <div className="mt-auto pt-5 space-y-2">
                  <Primary data-testid="diag-start" onClick={() => {
                    if (presetChildId && child.id) { hasFamilyAnswers ? startChildFlow(child) : setStep('goals'); return }
                    if (!hasFamilyAnswers) { setStep('goals'); return }
                    if (undiagnosedKids.length) setStep('c_pick'); else startChildFlow(null)
                  }}>
                    {L('Mulakan Diagnosis', 'Start Diagnosis')} →
                  </Primary>
                  <button onClick={skipAll} data-testid="diag-skip" className="w-full text-emerald-800/60 text-xs font-semibold py-2">
                    {L('Langkau buat masa ini', 'Skip for now')}
                  </button>
                </div>
              </div>
            )}

            {/* ── FAMILY GOALS ── */}
            {step === 'goals' && (
              <div className="flex-1 flex flex-col" data-testid="diag-goals">
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{L('Bahagian 1 · Keluarga', 'Part 1 · Family')}</div>
                <h2 className="text-xl font-extrabold text-emerald-950 leading-tight mt-1">{L('Apakah matlamat utama anda untuk anak-anak?', 'What are your main goals for your children?')}</h2>
                <p className="text-xs text-emerald-900/60 mt-1">{L('Pilih sehingga 3.', 'Choose up to 3.')}</p>
                <div className="mt-4 space-y-2">
                  {GOALS.map(g => {
                    const on = goals.includes(g.id)
                    return (
                      <OptionCard key={g.id} active={on} icon={g.icon} label={tx(g, lang)} testId={`diag-goal-${g.id}`}
                        onClick={() => setGoals(prev => on ? prev.filter(x => x !== g.id) : prev.length >= 3 ? prev : [...prev, g.id])} />
                    )
                  })}
                </div>
                <div className="mt-auto pt-5">
                  <Primary data-testid="diag-next" disabled={goals.length === 0} onClick={() => { setRoutineIdx(0); setStep('routine') }}>
                    {L('Seterusnya', 'Next')} →
                  </Primary>
                </div>
              </div>
            )}

            {/* ── FAMILY ROUTINE ── */}
            {step === 'routine' && (() => {
              const rq = ROUTINE_QUESTIONS[routineIdx]
              return (
                <div className="flex-1 flex flex-col" data-testid="diag-routine">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                    {L('Bahagian 1 · Rutin Keluarga', 'Part 1 · Family Routine')} ({routineIdx + 1}/{ROUTINE_QUESTIONS.length})
                  </div>
                  <h2 className="text-xl font-extrabold text-emerald-950 leading-tight mt-1">{tx(rq, lang)}</h2>
                  <div className="mt-4 space-y-2">
                    {rq.options.map(o => (
                      <OptionCard key={o.id} active={routine[rq.id] === o.id} icon={o.icon} label={tx(o, lang)} testId={`diag-routine-${rq.id}-${o.id}`}
                        onClick={async () => {
                          const next = { ...routine, [rq.id]: o.id }
                          setRoutine(next)
                          setTimeout(async () => {
                            if (routineIdx < ROUTINE_QUESTIONS.length - 1) setRoutineIdx(routineIdx + 1)
                            else {
                              await fetch('/api/onboarding/family', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ goals, routine: next }) }).catch(() => {})
                              setFamily(f => ({ ...(f || {}), onboarding: { ...(f?.onboarding || {}), goals, routine: next } }))
                              if (presetChildId && child.id) startChildFlow(child)
                              else if (undiagnosedKids.length) setStep('c_pick')
                              else startChildFlow(null)
                            }
                          }, 250)
                        }} />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* ── PICK CHILD (existing undiagnosed kids) ── */}
            {step === 'c_pick' && (
              <div className="flex-1 flex flex-col" data-testid="diag-pick">
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{L('Bahagian 2 · Anak', 'Part 2 · Child')}</div>
                <h2 className="text-xl font-extrabold text-emerald-950 leading-tight mt-1">{L('Anak mana yang hendak didiagnosis?', 'Which child shall we diagnose?')}</h2>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {undiagnosedKids.map(k => (
                    <button key={k.id} data-testid={`diag-pick-${k.id}`}
                      onClick={() => startChildFlow({ id: k.id, nickname: k.nickname, gender: k.gender || 'male', age: ageOfChild(k), avatarId: k.avatarId || 'B01', favColor: k.favColor || 'green' })}
                      className="bg-white rounded-2xl p-2.5 shadow flex flex-col items-center gap-1 active:scale-95">
                      <img src={avatarSrc(k.avatarId)} alt="" className="w-16 h-16 object-contain" />
                      <span className="text-xs font-extrabold text-emerald-950 truncate max-w-full">{k.nickname}</span>
                    </button>
                  ))}
                  <button onClick={() => startChildFlow(null)} data-testid="diag-pick-new"
                    className="rounded-2xl p-2.5 border-2 border-dashed border-emerald-400 bg-emerald-50/60 flex flex-col items-center justify-center gap-1 active:scale-95">
                    <span className="text-3xl">➕</span>
                    <span className="text-xs font-extrabold text-emerald-800">{L('Anak baharu', 'New child')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── CHILD PROFILE ── */}
            {step === 'c_profile' && (
              <div className="flex-1 flex flex-col" data-testid="diag-profile">
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  {L('Bahagian 2 · Profil Anak', 'Part 2 · Child Profile')}{doneKids.length ? ` #${doneKids.length + 1}` : ''}
                </div>
                <h2 className="text-xl font-extrabold text-emerald-950 leading-tight mt-1">{L('Ceritakan tentang anak anda', 'Tell us about your child')}</h2>
                <div className="bg-white rounded-3xl shadow p-4 mt-3 space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">{L('Nama panggilan', 'Nickname')}</label>
                    <input value={child.nickname} maxLength={30} data-testid="diag-name"
                      onChange={e => setChild(c => ({ ...c, nickname: e.target.value }))}
                      placeholder={L('cth. Adam', 'e.g. Adam')}
                      className="mt-1 w-full bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:bg-white outline-none rounded-2xl px-4 py-2.5 text-base font-bold text-emerald-950" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[['male', '👦', L('Lelaki', 'Boy')], ['female', '👧', L('Perempuan', 'Girl')]].map(([g, e, l]) => (
                      <button key={g} data-testid={`diag-gender-${g}`}
                        onClick={() => setChild(c => ({ ...c, gender: g, avatarId: g === 'female' ? 'G01' : 'B01' }))}
                        className={`rounded-2xl py-2 border-2 font-extrabold text-sm ${child.gender === g ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}>
                        <span className="mr-1">{e}</span>{l}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">{L('Umur', 'Age')}: <span className="text-emerald-600">{child.age} {L('tahun', 'years')}</span></label>
                    <div className="mt-1.5 grid grid-cols-10 gap-1">
                      {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(a => (
                        <button key={a} data-testid={`diag-age-${a}`} onClick={() => setChild(c => ({ ...c, age: a }))}
                          className={`h-9 rounded-xl text-sm font-black ${child.age === a ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{a}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">{L('Pilih watak', 'Pick a character')}</label>
                    <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                      {avatarPool.map(av => (
                        <button key={av.id} onClick={() => setChild(c => ({ ...c, avatarId: av.id }))}
                          className={`w-16 h-16 flex-shrink-0 rounded-2xl border-2 bg-amber-50 ${child.avatarId === av.id ? 'border-emerald-500 scale-105' : 'border-transparent'}`}>
                          <img src={av.src} alt="" className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">{L('Warna kegemaran', 'Favourite colour')}</label>
                    <div className="mt-1.5 flex gap-2 flex-wrap">
                      {COLORS.map(c => (
                        <button key={c.id} aria-label={c.id} onClick={() => setChild(ch => ({ ...ch, favColor: c.id }))}
                          className={`w-8 h-8 rounded-full ${child.favColor === c.id ? 'ring-4 ring-offset-2 ring-emerald-300' : ''}`} style={{ backgroundColor: c.hex }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-auto pt-5">
                  <Primary data-testid="diag-next" disabled={!child.nickname.trim()} onClick={() => { setSchool(child.age >= 7 ? 'morning' : 'none'); setStep('c_school') }}>
                    {L('Seterusnya', 'Next')} →
                  </Primary>
                </div>
              </div>
            )}

            {/* ── CHILD SCHOOL ── */}
            {step === 'c_school' && (
              <div className="flex-1 flex flex-col" data-testid="diag-school">
                <ChildChip child={child} src={avatarSrc(child.avatarId)} />
                <h2 className="text-xl font-extrabold text-emerald-950 leading-tight mt-3">{L(`Bagaimana rutin sekolah ${n}?`, `What is ${n}'s school routine?`)}</h2>
                <div className="mt-4 space-y-2">
                  {SCHOOL_OPTIONS.map(o => (
                    <OptionCard key={o.id} active={school === o.id} icon={o.icon} label={tx(o, lang)} testId={`diag-school-${o.id}`}
                      onClick={() => { setSchool(o.id); setTimeout(() => { setQIdx(0); setStep('c_practice') }, 250) }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── CHILD PRACTICE QUESTIONS ── */}
            {step === 'c_practice' && pq && (
              <div className="flex-1 flex flex-col" data-testid="diag-practice">
                <ChildChip child={child} src={avatarSrc(child.avatarId)} />
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700 mt-3">
                  {DIMENSIONS[pq.dim].icon} {tx(DIMENSIONS[pq.dim], lang)} · {qIdx + 1}/{PRACTICE_QUESTIONS.length}
                </div>
                <div className="bg-white rounded-3xl shadow p-5 mt-2 text-center">
                  <div className="text-5xl">{pq.icon}</div>
                  <h2 className="text-lg font-extrabold text-emerald-950 leading-snug mt-2">
                    {(lang === 'en' || lang === 'ar' ? pq.en : pq.ms)(n, child.age)}
                  </h2>
                </div>
                <div className="mt-4 space-y-2">
                  {LEVELS.map(lv => (
                    <OptionCard key={lv.v} active={practice[pq.id] === lv.v} icon={lv.icon} label={tx(lv, lang)} testId={`diag-level-${lv.v}`}
                      onClick={() => {
                        const next = { ...practice, [pq.id]: lv.v }
                        setPractice(next)
                        setTimeout(() => {
                          if (qIdx < PRACTICE_QUESTIONS.length - 1) setQIdx(qIdx + 1)
                          else {
                            const p = buildPlan({ age: child.age, practice: next, goals, routine, school })
                            setPlan(p); setPicked(Object.fromEntries(p.map(x => [x.templateId, true])))
                            setStep('c_analyzing'); setTimeout(() => setStep('c_result'), 3600)
                          }
                        }, 250)
                      }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── ANALYZING ── */}
            {step === 'c_analyzing' && <Analyzing n={n} L={L} src={avatarSrc(child.avatarId)} />}

            {/* ── RESULT ── */}
            {step === 'c_result' && (
              <div className="flex-1 flex flex-col pb-2" data-testid="diag-result">
                <div className="bg-white rounded-3xl shadow-xl p-4 border-2 border-emerald-100">
                  <div className="flex items-center gap-3">
                    <img src={avatarSrc(child.avatarId)} alt="" className="w-16 h-16 object-contain rounded-2xl bg-amber-50" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{L('Profil Iman & Habit', 'Iman & Habit Profile')}</div>
                      <div className="text-xl font-extrabold text-emerald-950 truncate">{n}</div>
                      <div className="text-[11px] text-emerald-900/60">{child.age} {L('tahun', 'years')} · {tx(SCHOOL_OPTIONS.find(s => s.id === school), lang)}</div>
                    </div>
                    <ScoreRing value={scores.overall} />
                  </div>
                  <div className="mt-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 p-3 flex gap-3 items-center" data-testid="diag-stage">
                    <div className="text-4xl">{stage.icon}</div>
                    <div>
                      <div className="font-extrabold text-emerald-900">{tx(stage, lang)}</div>
                      <div className="text-[11px] text-emerald-900/70 leading-snug">{lang === 'en' || lang === 'ar' ? stage.descEn : stage.descMs}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {Object.entries(DIMENSIONS).map(([k, d]) => (
                      <div key={k}>
                        <div className="flex justify-between text-[11px] font-bold text-emerald-950">
                          <span>{d.icon} {tx(d, lang)}</span><span style={{ color: d.color }}>{scores.dims[k]}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-0.5">
                          <motion.div className="h-full rounded-full" style={{ backgroundColor: d.color }} initial={{ width: 0 }} animate={{ width: `${Math.max(4, scores.dims[k])}%` }} transition={{ duration: 0.9 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-emerald-50 p-2.5">
                      <div className="text-[10px] font-black uppercase text-emerald-700">💪 {L('Kekuatan', 'Strengths')}</div>
                      <div className="text-xs font-bold text-emerald-950 mt-1">{scores.strengths.length ? scores.strengths.map(k => tx(DIMENSIONS[k], lang)).join(', ') : L('Sedang dibina', 'Being built')}</div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-2.5">
                      <div className="text-[10px] font-black uppercase text-amber-700">🎯 {L('Fokus Utama', 'Main Focus')}</div>
                      <div className="text-xs font-bold text-emerald-950 mt-1">{scores.focus.length ? scores.focus.map(k => tx(DIMENSIONS[k], lang)).join(', ') : L('Kekalkan semua', 'Maintain all')}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{L('Pelan Habit Khas', 'Personal Habit Plan')}</div>
                      <h3 className="text-lg font-extrabold text-emerald-950 leading-tight">{L(`Disusun khas untuk ${n}`, `Built just for ${n}`)}</h3>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700">{plan.filter(x => picked[x.templateId]).length}/{plan.length}</span>
                  </div>
                  <div className="mt-2 space-y-2" data-testid="diag-plan">
                    {plan.map(item => {
                      const tpl = TEMPLATE_BY_ID[item.templateId]
                      const on = !!picked[item.templateId]
                      return (
                        <button key={item.templateId} data-testid={`diag-plan-${item.templateId}`}
                          onClick={() => setPicked(p => ({ ...p, [item.templateId]: !on }))}
                          className={`w-full text-left rounded-2xl border-2 p-3 flex gap-3 items-start transition ${on ? 'border-emerald-400 bg-white' : 'border-gray-200 bg-white/60 opacity-60'}`}>
                          <span className="text-2xl leading-none mt-0.5">{HABIT_CATEGORIES[tpl.category]?.icon}</span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-emerald-950">{getTemplateTitle(tpl, lang)}</span>
                              <span className="text-[10px] font-black text-amber-600">+{tpl.points}</span>
                            </span>
                            <span className="block text-[11px] text-emerald-900/65 leading-snug mt-0.5">{tx(item.reason, lang)}</span>
                          </span>
                          <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                            {on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-emerald-900/55 text-center mt-2">{L('Tekan untuk buang atau tambah. Habit boleh diubah bila-bila masa di "Urus Habit".', 'Tap to remove or add. Habits can be changed anytime in "Manage Habits".')}</p>
                </div>
                {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-2.5 text-red-700 text-xs text-center font-semibold">{error}</div>}
                <div className="pt-4 space-y-2">
                  <Primary data-testid="diag-apply" disabled={saving || !plan.some(x => picked[x.templateId])} onClick={applyPlan}>
                    {saving ? L('Memasang pelan…', 'Setting up plan…') : `✨ ${L(`Aktifkan Pelan ${n}`, `Activate ${n}'s Plan`)}`}
                  </Primary>
                  <button onClick={() => { setQIdx(0); setStep('c_practice') }} className="w-full text-emerald-800/60 text-xs font-semibold py-1.5">
                    {L('Ubah jawapan', 'Change answers')}
                  </button>
                </div>
              </div>
            )}

            {/* ── DONE (per child) ── */}
            {step === 'c_done' && lastResult && (
              <div className="flex-1 flex flex-col" data-testid="diag-done">
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                    className="relative">
                    <img src={avatarSrc(lastResult.avatarId)} alt="" className="w-32 h-32 object-contain" />
                    <span className="absolute -bottom-1 -right-1 text-4xl">{STAGES.find(s => s.id === lastResult.stage)?.icon || '🌱'}</span>
                  </motion.div>
                  <h2 className="text-2xl font-extrabold text-emerald-950 mt-3">{L(`Pelan ${lastResult.nickname} sudah aktif!`, `${lastResult.nickname}'s plan is active!`)}</h2>
                  <p className="text-sm text-emerald-900/70 mt-1 max-w-xs">
                    {L(`${lastResult.habitsCreated} habit khas telah dipasang. Setiap habit yang disiapkan akan membina kampung Islamik ${lastResult.nickname}.`,
                      `${lastResult.habitsCreated} personal habits are set. Every habit completed builds ${lastResult.nickname}'s Islamic village.`)}
                  </p>
                  <p className="text-xs text-emerald-700 font-bold mt-3">{L('"Sebaik-baik amalan ialah yang berterusan walaupun sedikit." — HR Bukhari & Muslim', '"The most beloved deeds are those done consistently, even if small." — Bukhari & Muslim')}</p>
                  {doneKids.length > 1 && (
                    <div className="flex -space-x-3 mt-4">
                      {doneKids.map((k, i) => <img key={i} src={avatarSrc(k.avatarId)} alt="" className="w-11 h-11 rounded-full bg-white border-2 border-white object-contain" />)}
                    </div>
                  )}
                </div>
                <div className="pt-4 space-y-2">
                  <button data-testid="diag-next-child"
                    onClick={() => (undiagnosedKids.length ? setStep('c_pick') : startChildFlow(null))}
                    className="w-full bg-white border-2 border-emerald-500 text-emerald-700 rounded-2xl py-3 font-extrabold text-sm active:scale-[0.99]">
                    ➕ {L('Diagnosis anak seterusnya', 'Diagnose next child')}
                  </button>
                  <Primary data-testid="diag-finish" onClick={finishAll}>{L('Selesai — ke Papan Keluarga', 'Done — go to Family Dashboard')} →</Primary>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

const ChildChip = ({ child, src }) => (
  <div className="inline-flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 shadow self-start">
    <img src={src} alt="" className="w-8 h-8 rounded-full bg-amber-50 object-contain" />
    <span className="text-sm font-extrabold text-emerald-950">{child.nickname}</span>
    <span className="text-[11px] text-emerald-700 font-bold">· {child.age}</span>
  </div>
)

const ScoreRing = ({ value }) => {
  const r = 26, c = 2 * Math.PI * r
  return (
    <div className="relative w-16 h-16 flex-shrink-0" data-testid="diag-score">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="#E6F7F1" strokeWidth="7" fill="none" />
        <motion.circle cx="32" cy="32" r={r} stroke="#00B894" strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.1 }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-emerald-800">{value}</div>
    </div>
  )
}

function Analyzing({ n, L, src }) {
  const steps = [
    L('Menganalisis amalan ibadah…', 'Analysing worship practice…'),
    L('Menilai akhlak & adab…', 'Evaluating character & manners…'),
    L('Memadankan dengan tahap umur…', 'Matching to age level…'),
    L(`Menyusun pelan habit khas untuk ${n}…`, `Building ${n}'s personal plan…`),
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(x => Math.min(steps.length, x + 1)), 850)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center" data-testid="diag-analyzing">
      <div className="relative w-36 h-36">
        <motion.div className="absolute inset-0 rounded-full border-[6px] border-emerald-200 border-t-emerald-500"
          animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
        <img src={src} alt="" className="absolute inset-3 w-[120px] h-[120px] object-contain" />
      </div>
      <h2 className="text-lg font-extrabold text-emerald-950 mt-5">{L('EQrel sedang menganalisis…', 'EQrel is analysing…')}</h2>
      <div className="mt-4 space-y-2 w-full max-w-xs text-left">
        {steps.map((s, k) => (
          <motion.div key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: k <= i ? 1 : 0.25, y: 0 }} className="flex items-center gap-2 text-sm text-emerald-900">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${k < i ? 'bg-emerald-500' : 'bg-emerald-100'}`}>
              {k < i && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
            </span>
            {s}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function DiagnosisPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-emerald-50" />}>
      <DiagnosisInner />
    </Suspense>
  )
}
