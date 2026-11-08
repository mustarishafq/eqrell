'use client'

// Parent: link a child's own phone/tablet (no email needed) + manage linked devices.
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Smartphone, Copy, Check, QrCode, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { AVATAR_BY_ID } from '@/lib/avatars'

const CI = { green: '#00B894', yellow: '#FFB703', coral: '#FF5D6E', ink: '#0F2E25', cream: '#FFF8E7' }
const pick = (lang) => (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)
const fmt = (c) => (c ? `${c.slice(0, 3)} ${c.slice(3)}` : '')
const ago = (d) => { if (!d) return '—'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 2 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d` }

export default function KidDevicesSheet({ open, onClose, lang = 'en', kids = [], onOpenGuide }) {
  const L = pick(lang)
  const [host, setHost] = useState('')
  const [copied, setCopied] = useState(false)
  const [scanCode, setScanCode] = useState('')
  const [target, setTarget] = useState(undefined)   // childId | null (all) | undefined (not chosen)
  const [gen, setGen] = useState(null)              // { code, expiresAt }
  const [left, setLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [devices, setDevices] = useState(null)
  const [err, setErr] = useState('')

  const loadDevices = useCallback(async () => {
    try { const r = await fetch('/api/family/kid-devices', { credentials: 'include', cache: 'no-store' }); const d = await r.json(); setDevices(d.devices || []) } catch { setDevices([]) }
  }, [])
  useEffect(() => { if (!open) return; setHost(window.location.host); loadDevices(); setGen(null); setScanCode(''); setErr('') }, [open, loadDevices])
  useEffect(() => {
    if (!gen) return
    const t = setInterval(() => { const s = Math.max(0, Math.round((new Date(gen.expiresAt) - Date.now()) / 1000)); setLeft(s); if (s === 0) setGen(null) }, 1000)
    // a redeemed code shows up as a new device → refresh the list
    const p = setInterval(loadDevices, 4000)
    return () => { clearInterval(t); clearInterval(p) }
  }, [gen, loadDevices])

  const copy = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/kid`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }
  const generate = async () => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/family/kid-codes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ childId: target }) })
      const d = await r.json()
      if (r.ok) setGen(d); else setErr(d.error || 'Error')
    } catch { setErr('Network error') }
    setBusy(false)
  }
  const revoke = async (id) => {
    if (!window.confirm(L('Putuskan peranti ini? Anak perlu disambung semula.', 'Disconnect this device? It will need to be linked again.', 'Putuskan perangkat ini?', 'فصل هذا الجهاز؟'))) return
    await fetch(`/api/family/kid-devices/${id}/revoke`, { method: 'POST', credentials: 'include' })
    loadDevices()
  }
  const kidName = (id) => kids.find(k => k.id === id)?.nickname
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  const chip = (active) => (active ? { backgroundColor: CI.green, color: '#fff', borderColor: CI.green } : { backgroundColor: '#fff', color: CI.ink, borderColor: `${CI.ink}22` })

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="kid-devices-sheet">
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto p-4 space-y-3" style={{ backgroundColor: CI.cream, paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${CI.green}22` }}><Smartphone className="w-5 h-5" style={{ color: CI.green }} /></div>
              <div className="flex-1">
                <h2 className="font-extrabold text-lg leading-tight" style={{ color: CI.ink }}>{L('Peranti Anak', "Child's Own Device", 'Perangkat Anak', 'جهاز الطفل')}</h2>
                <p className="text-[11px]" style={{ color: `${CI.ink}99` }}>{L('Tanpa email. Anak hanya nampak Kid Mode & World mereka.', 'No email needed. Your child only sees their Kid Mode & World.', 'Tanpa email. Anak hanya melihat Kid Mode & World.', 'بدون بريد. يرى الطفل وضع الطفل وعالمه فقط.')}</p>
              </div>
              <button onClick={onClose} aria-label="close" data-testid="kid-devices-close" className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            {onOpenGuide && (
              <button onClick={onOpenGuide} data-testid="kid-devices-open-guide"
                className="w-full rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 text-start" style={{ backgroundColor: CI.ink }}>
                <span className="text-xl">📖</span>
                <span className="flex-1 text-[12.5px] font-extrabold" style={{ color: CI.cream }}>{L('Panduan: sediakan, kunci & selesaikan masalah', 'Guide: set up, lock the device & fix problems', 'Panduan: siapkan, kunci & atasi masalah', 'الدليل: الإعداد والقفل وحل المشكلات')}</span>
                <span className="font-black" style={{ color: CI.yellow }}>→</span>
              </button>
            )}

            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-3.5 shadow-eq-card">
              <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: CI.green }}>{L('Langkah 1', 'Step 1', 'Langkah 1', 'الخطوة ١')}</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: CI.ink }}>{L('Di peranti anak, buka', "On your child's device, open", 'Di perangkat anak, buka', 'على جهاز طفلك افتح')}</div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-xl px-3 py-2.5 font-black text-lg" style={{ backgroundColor: CI.cream, color: CI.ink }} dir="ltr" data-testid="kid-devices-url">{host}/kid</div>
                <button onClick={copy} data-testid="kid-devices-copy" className="rounded-xl px-3 py-2.5 text-xs font-extrabold inline-flex items-center gap-1" style={{ backgroundColor: CI.ink, color: CI.cream }}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Way A — scan */}
            <div className="bg-white rounded-2xl p-3.5 shadow-eq-card" data-testid="kid-devices-scan">
              <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: CI.green }}>{L('Langkah 2 · Cara A', 'Step 2 · Way A', 'Langkah 2 · Cara A', 'الخطوة ٢ · أ')}</div>
              <div className="text-sm font-bold mt-0.5 flex items-center gap-1.5" style={{ color: CI.ink }}><QrCode className="w-4 h-4" /> {L('Imbas QR di skrin anak dengan kamera telefon', "Scan the QR on your child's screen with your phone camera", 'Pindai QR di layar anak dengan kamera HP', 'امسح رمز QR على شاشة طفلك')}</div>
              <div className="text-[11px] mt-1" style={{ color: `${CI.ink}88` }}>{L('Atau taip kod 6 nombor yang dipaparkan:', 'Or type the 6-number code it shows:', 'Atau ketik kode 6 angka yang tampil:', 'أو اكتب الرمز الظاهر:')}</div>
              <div className="mt-2 flex gap-2">
                <input value={scanCode} onChange={e => setScanCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="123456" dir="ltr" data-testid="kid-devices-scan-input"
                  className="flex-1 min-w-0 rounded-xl border-2 px-3 py-2 text-xl font-black tracking-[0.25em] text-center outline-none" style={{ borderColor: `${CI.green}55`, color: CI.ink }} />
                <button disabled={scanCode.length !== 6} onClick={() => (window.location.href = `/link?k=${scanCode}`)} data-testid="kid-devices-scan-go"
                  className="rounded-xl px-4 font-extrabold text-sm disabled:opacity-40" style={{ backgroundColor: CI.yellow, color: CI.ink }}>OK</button>
              </div>
            </div>

            {/* Way B — give a code */}
            <div className="bg-white rounded-2xl p-3.5 shadow-eq-card" data-testid="kid-devices-give">
              <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: CI.green }}>{L('Langkah 2 · Cara B', 'Step 2 · Way B', 'Langkah 2 · Cara B', 'الخطوة ٢ · ب')}</div>
              <div className="text-sm font-bold mt-0.5 flex items-center gap-1.5" style={{ color: CI.ink }}><KeyRound className="w-4 h-4" /> {L('Beri kod untuk anak taip', 'Give a code for your child to type', 'Beri kode untuk diketik anak', 'أعطِ رمزًا ليكتبه طفلك')}</div>
              <div className="text-[11px] mt-1" style={{ color: `${CI.ink}88` }}>{L('Peranti ini untuk siapa?', 'Who will use this device?', 'Perangkat ini untuk siapa?', 'من سيستخدم هذا الجهاز؟')}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {kids.map(k => (
                  <button key={k.id} onClick={() => { setTarget(k.id); setGen(null) }} data-testid={`kid-devices-target-${k.id}`}
                    className="rounded-full border-2 pl-1 pr-3 py-1 text-xs font-extrabold inline-flex items-center gap-1.5" style={chip(target === k.id)}>
                    {AVATAR_BY_ID[k.avatarId]?.src ? <img src={AVATAR_BY_ID[k.avatarId].src} alt="" className="w-6 h-6 rounded-full bg-white" /> : <span>🧒</span>} {k.nickname}
                  </button>
                ))}
                {kids.length > 1 && (
                  <button onClick={() => { setTarget(null); setGen(null) }} data-testid="kid-devices-target-all"
                    className="rounded-full border-2 px-3 py-1 text-xs font-extrabold" style={chip(target === null)}>
                    👨‍👩‍👧 {L('Semua anak (tablet kongsi)', 'All children (shared tablet)', 'Semua anak (tablet bersama)', 'كل الأطفال (جهاز مشترك)')}
                  </button>
                )}
              </div>
              {gen ? (
                <div className="mt-3 rounded-2xl p-4 text-center" style={{ backgroundColor: CI.ink }} data-testid="kid-devices-code-box">
                  <div className="text-[11px] font-bold" style={{ color: `${CI.cream}BB` }}>{L('Di peranti anak tekan “Saya ada kod” dan taip:', 'On the child\'s device tap “I have a code” and type:', 'Di perangkat anak ketuk “Saya punya kode” lalu ketik:', 'على جهاز الطفل اضغط «لدي رمز» واكتب:')}</div>
                  <div className="text-5xl font-black tabular-nums tracking-[0.12em] mt-1" style={{ color: CI.yellow }} dir="ltr" data-testid="kid-devices-code">{fmt(gen.code)}</div>
                  <div className="text-[11px] mt-1" style={{ color: `${CI.cream}99` }}>{L('Tamat dalam', 'Expires in', 'Kedaluwarsa dalam', 'ينتهي خلال')} {mm} · {L('sekali guna', 'single use', 'sekali pakai', 'استخدام واحد')}</div>
                </div>
              ) : (
                <button onClick={generate} disabled={busy || target === undefined} data-testid="kid-devices-generate"
                  className="mt-3 w-full rounded-2xl py-3 font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40" style={{ backgroundColor: CI.yellow, color: CI.ink }}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} {L('Jana kod', 'Create code', 'Buat kode', 'إنشاء رمز')}
                </button>
              )}
              {err && <div className="mt-2 text-[12px] font-bold" style={{ color: CI.coral }}>{err}</div>}
            </div>

            {/* Linked devices */}
            <div className="bg-white rounded-2xl p-3.5 shadow-eq-card" data-testid="kid-devices-list">
              <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: `${CI.ink}88` }}>{L('Peranti bersambung', 'Linked devices', 'Perangkat terhubung', 'الأجهزة المرتبطة')}</div>
              {devices === null ? <div className="h-12 mt-2 rounded-xl animate-pulse" style={{ backgroundColor: CI.cream }} />
                : devices.length === 0 ? <div className="text-xs mt-2" style={{ color: `${CI.ink}77` }}>{L('Belum ada peranti anak.', 'No child devices yet.', 'Belum ada perangkat anak.', 'لا توجد أجهزة بعد.')}</div>
                  : devices.map(d => (
                    <div key={d.id} className="flex items-center gap-3 mt-2.5" data-testid={`kid-device-${d.id}`}>
                      <span className="text-xl">{/iPad|tablet/i.test(d.label) ? '📲' : '📱'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-extrabold truncate" style={{ color: CI.ink }}>{d.name}</div>
                        <div className="text-[11px]" style={{ color: `${CI.ink}88` }}>{d.label} · {d.childId ? (kidName(d.childId) || '—') : L('Semua anak', 'All children', 'Semua anak', 'كل الأطفال')} · {L('aktif', 'active', 'aktif', 'نشط')} {ago(d.lastSeenAt)}</div>
                      </div>
                      <button onClick={() => revoke(d.id)} data-testid={`kid-device-revoke-${d.id}`} className="rounded-full px-3 py-1.5 text-[11px] font-extrabold inline-flex items-center gap-1" style={{ backgroundColor: `${CI.coral}1F`, color: CI.coral }}>
                        <Trash2 className="w-3.5 h-3.5" /> {L('Putuskan', 'Disconnect', 'Putuskan', 'فصل')}
                      </button>
                    </div>
                  ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
