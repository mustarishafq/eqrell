'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Check, XCircle, PackageCheck, Trash2, Plus, ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/i18n/LangProvider'
import { AVATAR_BY_ID } from '@/lib/avatars'
import {
  REWARD_TEMPLATES, REWARD_CATEGORIES,
  getRewardTitle, getRewardDesc, getRewardCategoryLabel,
} from '@/lib/rewardTemplates'

const REWARD_EMOJIS = ['🎁','📺','🍪','🍦','📖','🍜','🌳','📚','👥','🧸','🎬','📕','🕌','🎨','🍽️','🛏️','⚽','🎮','🚴','🎈','🍫','🧁','🎪','🏊']

/**
 * RewardShopSheet — Parent view.
 * 3 tabs:
 *   - Requests   : approve / reject / fulfill kid's purchase requests
 *   - Proposals  : kids' proposed new rewards → parent may modify cost + approve
 *   - Catalog    : templates + family-custom rewards (add / delete)
 */
export function RewardShopSheet({ open, onClose, children }) {
  const { t, lang } = useLang()
  const [tab, setTab] = useState('requests')
  const [requests, setRequests] = useState([])
  const [proposals, setProposals] = useState([])
  const [custom, setCustom] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [reviewProp, setReviewProp] = useState(null) // proposal being reviewed with editable cost

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rReq, rProp, rCat] = await Promise.all([
        fetch('/api/rewards/requests', { credentials: 'include' }),
        fetch('/api/rewards/proposals', { credentials: 'include' }),
        fetch('/api/rewards/catalog', { credentials: 'include' }),
      ])
      const [dReq, dProp, dCat] = await Promise.all([rReq.json(), rProp.json(), rCat.json()])
      setRequests(dReq.requests || [])
      setProposals(dProp.proposals || [])
      setCustom(dCat.custom || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (open) fetchAll() }, [open, fetchAll])

  const childMap = Object.fromEntries((children || []).map(c => [c.id, c]))
  const pending = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending')
  const pendingProps = proposals.filter(p => p.status === 'pending')
  const decidedProps = proposals.filter(p => p.status !== 'pending')

  const decide = async (id, decision) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/rewards/requests/${id}/decide`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (r.ok) await fetchAll()
    } finally { setBusyId(null) }
  }
  const fulfill = async (id) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/rewards/requests/${id}/fulfill`, {
        method: 'POST', credentials: 'include',
      })
      if (r.ok) await fetchAll()
    } finally { setBusyId(null) }
  }

  const decideProposal = async (prop, decision, overrides = {}) => {
    setBusyId(prop.id)
    try {
      const r = await fetch(`/api/rewards/proposals/${prop.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, ...overrides }),
      })
      if (r.ok) {
        setReviewProp(null)
        await fetchAll()
      }
    } finally { setBusyId(null) }
  }

  const deleteCustom = async (id) => {
    if (!confirm(t.reward_custom_delete_confirm)) return
    setBusyId(id)
    try {
      const r = await fetch(`/api/rewards/catalog/${id}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (r.ok) await fetchAll()
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
                { id: 'requests',  label: t.reward_tab_requests,  badge: pending.length },
                { id: 'proposals', label: t.reward_tab_proposals, badge: pendingProps.length },
                { id: 'catalog',   label: t.reward_tab_catalog,   badge: 0 },
              ].map(tb => (
                <button key={tb.id}
                  onClick={() => setTab(tb.id)}
                  className={`flex-1 rounded-full px-2 py-1.5 text-xs font-extrabold transition-all flex items-center justify-center gap-1 ${
                    tab === tb.id ? 'bg-emerald-500 text-white shadow' : 'bg-eq-cream/60 text-eq-ink/70'
                  }`}
                >
                  <span>{tb.label}</span>
                  {tb.badge > 0 && (
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      tab === tb.id ? 'bg-white text-emerald-700' : 'bg-amber-400 text-amber-900'
                    }`}>{tb.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {tab === 'requests' && (
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
              {tab === 'proposals' && (
                <ProposalsList
                  loading={loading}
                  pending={pendingProps}
                  decided={decidedProps}
                  childMap={childMap}
                  onReview={setReviewProp}
                  onReject={(p) => decideProposal(p, 'rejected')}
                  busyId={busyId}
                  t={t}
                />
              )}
              {tab === 'catalog' && (
                <CatalogList
                  lang={lang} t={t}
                  custom={custom}
                  onAdd={() => setAddOpen(true)}
                  onDelete={deleteCustom}
                  busyId={busyId}
                />
              )}
            </div>

            <div className="border-t border-eq-cream/60 bg-white/95 backdrop-blur px-5 py-2 text-[11px] text-emerald-800/60 leading-snug">
              {t.reward_ihsan_note}
            </div>
          </motion.div>

          {/* Add custom reward modal */}
          <AddCustomModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onSaved={async () => { setAddOpen(false); await fetchAll() }}
            t={t}
          />

          {/* Review proposal modal (parent can edit cost/title before approving) */}
          <ReviewProposalModal
            open={!!reviewProp}
            proposal={reviewProp}
            childMap={childMap}
            onClose={() => setReviewProp(null)}
            onApprove={(overrides) => decideProposal(reviewProp, 'approved', overrides)}
            onReject={() => decideProposal(reviewProp, 'rejected')}
            busy={busyId === reviewProp?.id}
            t={t}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────
// CATALOG (templates + custom)

const CatalogList = ({ lang, t, custom, onAdd, onDelete, busyId }) => {
  return (
    <div>
      <button
        onClick={onAdd}
        className="w-full rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 py-3 px-4 mb-3 flex items-center justify-center gap-2 font-extrabold text-sm text-emerald-800 active:scale-[0.99]"
      >
        <Plus className="w-4 h-4" /> {t.reward_custom_add_title}
      </button>

      {/* Custom rewards first (with delete) */}
      {custom.length > 0 && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-wider text-eq-ink/50 mb-1.5">
            {t.reward_custom_badge}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {custom.map(r => {
              const cat = REWARD_CATEGORIES[r.category] || REWARD_CATEGORIES.activity
              const catLabel = getRewardCategoryLabel(r.category, t)
              return (
                <div key={r.id} className="rounded-2xl border-2 border-emerald-200 bg-white p-3 relative">
                  <button
                    onClick={() => onDelete(r.id)}
                    disabled={busyId === r.id}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center disabled:opacity-40"
                    aria-label="delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="flex items-start justify-between pr-6">
                    <div className="text-3xl">{r.icon}</div>
                    <div className="text-[10px] font-extrabold text-amber-700 flex items-center gap-0.5">
                      {r.cost}<Sparkles className="w-3 h-3" fill="#FFB703" />
                    </div>
                  </div>
                  <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.color }}>
                    {catLabel}
                  </div>
                  <div className="font-extrabold text-sm text-eq-ink leading-tight mt-0.5">
                    {r.title}
                  </div>
                  {r.desc && (
                    <div className="text-[11px] text-eq-ink/60 mt-1 leading-snug line-clamp-2">{r.desc}</div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Templates */}
      <div className="text-[10px] font-bold uppercase tracking-wider text-eq-ink/50 mb-1.5">
        Template
      </div>
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// REQUESTS

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

// ─────────────────────────────────────────────────────────────────
// PROPOSALS from kids

const ProposalsList = ({ loading, pending, decided, childMap, onReview, onReject, busyId, t }) => {
  if (loading) return <div className="py-12 text-center text-eq-ink/50">{t.loading}</div>
  if (pending.length === 0 && decided.length === 0) {
    return (
      <div className="py-14 text-center">
        <div className="text-5xl mb-2">💡</div>
        <p className="text-emerald-800/70 text-sm">{t.reward_proposals_empty}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {pending.map(p => (
        <ProposalCard key={p.id} prop={p} child={childMap[p.childId]} onReview={onReview} onReject={onReject} busy={busyId === p.id} t={t} />
      ))}
      {decided.length > 0 && (
        <div className="pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-eq-ink/50 mb-1.5">History</div>
          <div className="space-y-2">
            {decided.map(p => (
              <ProposalCard key={p.id} prop={p} child={childMap[p.childId]} onReview={onReview} onReject={onReject} busy={busyId === p.id} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ProposalCard = ({ prop, child, onReview, onReject, busy, t }) => {
  const avatarSrc = child?.avatarId ? AVATAR_BY_ID[child.avatarId]?.src : null
  const statusBadge =
    prop.status === 'pending'  ? { text: t.reward_proposal_status_pending, bg: 'bg-amber-100 text-amber-800' } :
    prop.status === 'approved' ? { text: t.reward_proposal_status_approved, bg: 'bg-emerald-100 text-emerald-800' } :
    prop.status === 'rejected' ? { text: t.reward_proposal_status_rejected, bg: 'bg-red-100 text-red-800' } : null

  return (
    <div className={`rounded-2xl border-2 p-3 ${
      prop.status === 'pending' ? 'bg-white border-purple-200' : 'bg-eq-cream/40 border-transparent'
    }`}>
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-full ring-2 overflow-hidden bg-eq-cream flex-shrink-0"
             style={{ borderColor: child?.favColor || '#00B894' }}>
          {avatarSrc ? <img src={avatarSrc} alt="" className="w-full h-full object-cover" /> :
                       <div className="w-full h-full flex items-center justify-center text-sm">🧒</div>}
        </div>
        <div className="text-2xl flex-shrink-0">{prop.icon || '🎁'}</div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-eq-ink text-sm leading-tight truncate">{prop.title}</div>
          <div className="text-[11px] text-eq-ink/60 mt-0.5 flex items-center gap-1 flex-wrap">
            <span className="font-bold">{t.reward_proposal_from(child?.nickname || '—')}</span>
            <span>·</span>
            <span className="text-amber-700 font-extrabold flex items-center gap-0.5">{prop.cost} <Sparkles className="w-3 h-3" fill="#FFB703" /></span>
            {statusBadge && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusBadge.bg}`}>
                {statusBadge.text}
              </span>
            )}
          </div>
          {prop.desc && (
            <p className="text-[11px] text-eq-ink/70 mt-1 leading-snug italic">“{prop.desc}”</p>
          )}
        </div>
      </div>

      {prop.status === 'pending' && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button onClick={() => onReject(prop)} disabled={busy}
            className="rounded-xl border-2 border-red-200 bg-red-50 py-2 text-red-700 font-extrabold text-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1">
            <XCircle className="w-4 h-4" /> {t.reward_proposal_reject}
          </button>
          <button onClick={() => onReview(prop)} disabled={busy}
            className="rounded-xl border-2 border-emerald-300 bg-emerald-100 py-2 text-emerald-800 font-extrabold text-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1">
            <Check className="w-4 h-4" /> {t.reward_proposal_approve}
          </button>
        </div>
      )}
      {prop.status === 'approved' && prop.finalCost != null && prop.finalCost !== prop.cost && (
        <div className="mt-2 text-[11px] text-emerald-700 font-semibold">
          {t.reward_proposal_edit_cost}: <span className="text-amber-700 font-extrabold">{prop.finalCost}</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ADD CUSTOM REWARD modal

const AddCustomModal = ({ open, onClose, onSaved, t }) => {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [cost, setCost] = useState(20)
  const [icon, setIcon] = useState('🎁')
  const [category, setCategory] = useState('activity')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setTitle(''); setDesc(''); setCost(20); setIcon('🎁'); setCategory('activity') }
  }, [open])

  const canSave = title.trim() && Number.isInteger(cost) && cost >= 1 && cost <= 999

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      const r = await fetch('/api/rewards/catalog', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), desc: desc.trim(), cost, icon, category }),
      })
      if (r.ok) onSaved()
    } finally { setBusy(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 pt-4 pb-2 flex items-center gap-2">
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-eq-cream/60 flex items-center justify-center">
                <ArrowLeft className="w-4 h-4 text-eq-ink/70" />
              </button>
              <h3 className="text-base font-extrabold text-emerald-900">{t.reward_custom_add_title}</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <Field label={t.reward_custom_title_label}>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
                  placeholder={t.reward_custom_title_ph}
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm" />
              </Field>
              <Field label={t.reward_custom_desc_label}>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} rows={2}
                  placeholder={t.reward_custom_desc_ph}
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm resize-none" />
              </Field>
              <Field label={t.reward_custom_cost_label}>
                <input type="number" min={1} max={999} value={cost}
                  onChange={e => setCost(parseInt(e.target.value || '0', 10))}
                  className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm" />
              </Field>
              <Field label={t.reward_custom_icon_label}>
                <EmojiPicker value={icon} onChange={setIcon} />
              </Field>
              <Field label={t.reward_custom_category_label}>
                <CategoryPicker value={category} onChange={setCategory} t={t} />
              </Field>
            </div>
            <div className="border-t border-eq-cream/60 px-5 py-3">
              <button onClick={save} disabled={!canSave || busy}
                className="w-full rounded-2xl bg-emerald-500 text-white font-extrabold py-3 text-sm active:scale-[0.99] disabled:opacity-40">
                {busy ? t.reward_propose_submitting : t.reward_custom_create}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────
// REVIEW PROPOSAL modal (parent modifies cost/title on approve)

const ReviewProposalModal = ({ open, proposal, childMap, onClose, onApprove, onReject, busy, t }) => {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [cost, setCost] = useState(20)
  const [icon, setIcon] = useState('🎁')
  const [category, setCategory] = useState('activity')

  useEffect(() => {
    if (proposal) {
      setTitle(proposal.title || '')
      setDesc(proposal.desc || '')
      setCost(Number(proposal.cost) || 20)
      setIcon(proposal.icon || '🎁')
      setCategory(proposal.category || 'activity')
    }
  }, [proposal])

  if (!open || !proposal) return null
  const child = childMap[proposal.childId]
  const canSave = title.trim() && Number.isInteger(cost) && cost >= 1 && cost <= 999

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-eq-cream/60 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 text-eq-ink/70" />
            </button>
            <h3 className="text-base font-extrabold text-emerald-900">
              {t.reward_proposal_from(child?.nickname || '—')}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
            {proposal.desc && (
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-3 text-xs text-purple-900 italic">
                “{proposal.desc}”
              </div>
            )}
            <Field label={t.reward_custom_title_label}>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
                className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm" />
            </Field>
            <Field label={t.reward_custom_desc_label}>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} rows={2}
                className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm resize-none" />
            </Field>
            <Field label={t.reward_proposal_edit_cost}>
              <input type="number" min={1} max={999} value={cost}
                onChange={e => setCost(parseInt(e.target.value || '0', 10))}
                className="w-full rounded-xl border-2 border-eq-cream focus:border-emerald-300 outline-none px-3 py-2 text-sm" />
            </Field>
            <Field label={t.reward_custom_icon_label}>
              <EmojiPicker value={icon} onChange={setIcon} />
            </Field>
            <Field label={t.reward_custom_category_label}>
              <CategoryPicker value={category} onChange={setCategory} t={t} />
            </Field>
          </div>
          <div className="border-t border-eq-cream/60 px-5 py-3 grid grid-cols-2 gap-2">
            <button onClick={onReject} disabled={busy}
              className="rounded-2xl border-2 border-red-200 bg-red-50 py-3 text-red-700 font-extrabold text-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1">
              <XCircle className="w-4 h-4" /> {t.reward_proposal_reject}
            </button>
            <button onClick={() => canSave && onApprove({ title: title.trim(), desc: desc.trim(), cost, icon, category })}
              disabled={!canSave || busy}
              className="rounded-2xl bg-emerald-500 text-white font-extrabold py-3 text-sm active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-1">
              <Check className="w-4 h-4" /> {t.reward_proposal_approve}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────
// Small subcomponents

const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900/70 mb-1">{label}</div>
    {children}
  </label>
)

const EmojiPicker = ({ value, onChange }) => (
  <div className="grid grid-cols-8 gap-1.5">
    {REWARD_EMOJIS.map(e => (
      <button key={e} type="button" onClick={() => onChange(e)}
        className={`aspect-square rounded-lg border-2 flex items-center justify-center text-lg transition-all ${
          value === e ? 'border-emerald-400 bg-emerald-50 scale-105' : 'border-eq-cream bg-white'
        }`}>{e}</button>
    ))}
  </div>
)

const CategoryPicker = ({ value, onChange, t }) => {
  const ids = ['screen', 'food', 'learning', 'outing', 'activity', 'spiritual']
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {ids.map(id => {
        const cat = REWARD_CATEGORIES[id]
        return (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`rounded-lg border-2 py-1.5 px-2 text-[11px] font-extrabold transition-all flex flex-col items-center gap-0.5 ${
              value === id ? 'border-emerald-400 bg-emerald-50' : 'border-eq-cream bg-white'
            }`}
            style={value === id ? { color: cat.color } : undefined}>
            <span className="text-base">{cat.icon}</span>
            <span>{getRewardCategoryLabel(id, t)}</span>
          </button>
        )
      })}
    </div>
  )
}

export default RewardShopSheet
