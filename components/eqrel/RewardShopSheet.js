'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Check, XCircle, PackageCheck, Trash2 } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'
import { AVATAR_BY_ID } from '@/lib/avatars'
import {
  REWARD_TEMPLATES, REWARD_CATEGORIES,
  getRewardTitle, getRewardDesc, getRewardCategoryLabel,
} from '@/lib/rewardTemplates'

/**
 * RewardShopSheet — Parent view of Reward Shop.
 * Two tabs:
 *   - "Katalog" : browse 15 built-in + family custom, read-only for parent (child requests)
 *   - "Permintaan" : approve / reject / fulfill pending & processed requests
 */
export function RewardShopSheet({ open, onClose, children }) {
  const { t, lang } = useLang()
  const [tab, setTab] = useState('requests')  // 'catalog' | 'requests'
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/rewards/requests', { credentials: 'include' })
      const d = await r.json()
      setRequests(d.requests || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (open) fetchRequests()
  }, [open, fetchRequests])

  const childMap = Object.fromEntries((children || []).map(c => [c.id, c]))
  const pending = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending')

  const decide = async (id, decision) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/rewards/requests/${id}/decide`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (r.ok) await fetchRequests()
    } finally { setBusyId(null) }
  }
  const fulfill = async (id) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/rewards/requests/${id}/fulfill`, {
        method: 'POST', credentials: 'include',
      })
      if (r.ok) await fetchRequests()
    } finally { setBusyId(null) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
        >
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="pt-2 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-eq-ink/15 rounded-full" />
            </div>

            <div className="px-5 pb-2 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl">🎁</span>
                  <h2 className="text-lg font-extrabold text-emerald-900">{t.reward_shop_title}</h2>
                </div>
                <p className="text-xs text-emerald-800/60 mt-0.5">
                  {t.reward_pending_count(pending.length)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-eq-cream/60 hover:bg-eq-cream flex items-center justify-center"
                aria-label={t.cancel}
              >
                <X className="w-5 h-5 text-eq-ink/60" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-5 pb-2 flex gap-1.5">
              {[
                { id: 'requests', label: `${t.reward_tab_requests}${pending.length ? ' · ' + pending.length : ''}` },
                { id: 'catalog',  label: t.reward_tab_catalog },
              ].map(tb => (
                <button key={tb.id}
                  onClick={() => setTab(tb.id)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition-all ${
                    tab === tb.id ? 'bg-emerald-500 text-white shadow' : 'bg-eq-cream/60 text-eq-ink/70'
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {tab === 'catalog' ? (
                <CatalogList lang={lang} t={t} />
              ) : (
                <RequestsList
                  loading={loading}
                  pending={pending}
                  decided={decided}
                  childMap={childMap}
                  onDecide={decide}
                  onFulfill={fulfill}
                  busyId={busyId}
                  t={t}
                />
              )}
            </div>

            <div className="border-t border-eq-cream/60 bg-white/95 backdrop-blur px-5 py-2 text-[11px] text-emerald-800/60 leading-snug">
              {t.reward_ihsan_note}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────

const CatalogList = ({ lang, t }) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {REWARD_TEMPLATES.map(r => {
        const cat = REWARD_CATEGORIES[r.category] || REWARD_CATEGORIES.activity
        const catLabel = getRewardCategoryLabel(r.category, t)
        return (
          <div key={r.id} className="rounded-2xl border-2 border-eq-cream bg-white p-3">
            <div className="flex items-start justify-between">
              <div className="text-3xl">{r.icon}</div>
              <div className="text-[10px] font-extrabold text-amber-700 flex items-center gap-0.5">
                {r.cost}<Sparkles className="w-3 h-3" fill="#FFB703" />
              </div>
            </div>
            <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>
              {catLabel}
            </div>
            <div className="font-extrabold text-sm text-eq-ink leading-tight mt-0.5">
              {getRewardTitle(r, lang)}
            </div>
            <div className="text-[11px] text-eq-ink/60 mt-1 leading-snug line-clamp-2">
              {getRewardDesc(r, lang)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const RequestsList = ({ loading, pending, decided, childMap, onDecide, onFulfill, busyId, t }) => {
  if (loading) return <div className="py-12 text-center text-eq-ink/50">{t.loading}</div>
  if (pending.length === 0 && decided.length === 0) {
    return (
      <div className="py-14 text-center">
        <div className="text-5xl mb-2">🎁</div>
        <p className="text-emerald-800/70 text-sm">{t.reward_empty_requests}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {pending.map(r => (
        <RequestCard key={r.id} rec={r} child={childMap[r.childId]} onDecide={onDecide} onFulfill={onFulfill} busy={busyId === r.id} t={t} />
      ))}
      {decided.length > 0 && (
        <div className="pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-eq-ink/50 mb-1.5">History</div>
          <div className="space-y-2">
            {decided.map(r => (
              <RequestCard key={r.id} rec={r} child={childMap[r.childId]} onDecide={onDecide} onFulfill={onFulfill} busy={busyId === r.id} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const RequestCard = ({ rec, child, onDecide, onFulfill, busy, t }) => {
  const s = rec.snapshot || {}
  const avatarSrc = child?.avatarId ? AVATAR_BY_ID[child.avatarId]?.src : null
  const statusBadge =
    rec.status === 'pending'   ? { text: t.reward_requested, bg: 'bg-amber-100 text-amber-800' } :
    rec.status === 'approved'  ? { text: t.reward_approved,  bg: 'bg-emerald-100 text-emerald-800' } :
    rec.status === 'rejected'  ? { text: t.reward_rejected,  bg: 'bg-red-100 text-red-800' } :
    rec.status === 'fulfilled' ? { text: t.reward_fulfilled, bg: 'bg-purple-100 text-purple-800' } : null

  return (
    <div className={`rounded-2xl border-2 p-3 ${
      rec.status === 'pending' ? 'bg-white border-amber-200' : 'bg-eq-cream/40 border-transparent'
    }`}>
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-full ring-2 overflow-hidden bg-eq-cream flex-shrink-0"
             style={{ borderColor: child?.favColor || '#00B894' }}>
          {avatarSrc ? <img src={avatarSrc} alt="" className="w-full h-full object-cover" /> :
                       <div className="w-full h-full flex items-center justify-center text-sm">🧒</div>}
        </div>
        <div className="text-2xl flex-shrink-0">{s.icon || '🎁'}</div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-eq-ink text-sm leading-tight truncate">{s.title}</div>
          <div className="text-[11px] text-eq-ink/60 mt-0.5 flex items-center gap-1 flex-wrap">
            <span className="font-bold">{child?.nickname || '—'}</span>
            <span>·</span>
            <span className="text-amber-700 font-extrabold flex items-center gap-0.5">{s.cost} <Sparkles className="w-3 h-3" fill="#FFB703" /></span>
            {statusBadge && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusBadge.bg}`}>
                {statusBadge.text}
              </span>
            )}
          </div>
        </div>
      </div>

      {rec.status === 'pending' && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button onClick={() => onDecide(rec.id, 'rejected')} disabled={busy}
            className="rounded-xl border-2 border-red-200 bg-red-50 py-2 text-red-700 font-extrabold text-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1">
            <XCircle className="w-4 h-4" /> {t.reward_action_reject}
          </button>
          <button onClick={() => onDecide(rec.id, 'approved')} disabled={busy}
            className="rounded-xl border-2 border-emerald-300 bg-emerald-100 py-2 text-emerald-800 font-extrabold text-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1">
            <Check className="w-4 h-4" /> {t.reward_action_approve}
          </button>
        </div>
      )}
      {rec.status === 'approved' && (
        <button onClick={() => onFulfill(rec.id)} disabled={busy}
          className="mt-2 w-full rounded-xl border-2 border-purple-300 bg-purple-50 py-2 text-purple-700 font-extrabold text-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1">
          <PackageCheck className="w-4 h-4" /> {t.reward_action_fulfill}
        </button>
      )}
    </div>
  )
}

export default RewardShopSheet
