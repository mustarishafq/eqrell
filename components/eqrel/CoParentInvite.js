'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { pick } from '@/components/eqrel/tabs/tabUtils'

const SNOOZE_KEY = 'eqrel-invite-snoozed'
const SENT_KEY = 'eqrel-invite-sent'

/**
 * Jemput Pasangan Awal — invite the spouse right after the first plan is built
 * (variant 'hero' on the diagnosis done screen) and on Home while only one parent has joined.
 */
export function CoParentInvite({ lang = 'en', variant = 'card', childName, stageName }) {
  const L = pick(lang)
  const [info, setInfo] = useState(null)
  const [hidden, setHidden] = useState(true)
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    try {
      setSent(!!localStorage.getItem(SENT_KEY))
      if (variant === 'card') {
        const ts = Number(localStorage.getItem(SNOOZE_KEY) || 0)
        if (ts && Date.now() - ts < 5 * 86400000) return
      }
    } catch { /* ignore */ }
    fetch('/api/family/parents', { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!alive || !d) return
      setInfo(d)
      setHidden((d.parents || []).length >= 2 || !d.code)
    }).catch(() => {})
    return () => { alive = false }
  }, [variant])

  if (hidden || !info) return null
  if (variant === 'card' && sent) return null   // already invited — don't nag on Home

  const url = typeof window !== 'undefined' ? window.location.origin : ''
  const code = info.code
  const kid = childName ? L(`pelan Iman & Habit ${childName}`, `${childName}'s Iman & Habit plan`, `rencana Iman & Kebiasaan ${childName}`, `خطة الإيمان والعادات لـ ${childName}`) : L('pelan Iman & Habit anak-anak kita', "our kids' Iman & Habit plan", 'rencana Iman & Kebiasaan anak kita', 'خطة أطفالنا')
  const stage = stageName ? ` (${stageName})` : ''
  const text = L(
    `Assalamualaikum 🤍 Saya dah sediakan ${kid}${stage} di EQrel 🌱 Jom sama-sama — kita boleh bergilir sahkan habit anak & terima laporan malam bersama. Daftar di ${url} dan masukkan kod keluarga: ${code}`,
    `Assalamualaikum 🤍 I've set up ${kid}${stage} on EQrel 🌱 Join me — we can take turns verifying their habits and get the night report together. Sign up at ${url} and enter family code: ${code}`,
    `Assalamualaikum 🤍 Saya sudah menyiapkan ${kid}${stage} di EQrel 🌱 Ayo bersama — kita bisa bergiliran memverifikasi. Daftar di ${url} dan masukkan kode keluarga: ${code}`,
    `السلام عليكم 🤍 أعددت ${kid}${stage} على EQrel 🌱 انضم إليّ لنتناوب على المتابعة. سجّل في ${url} وأدخل رمز العائلة: ${code}`)

  const markSent = () => { try { localStorage.setItem(SENT_KEY, String(Date.now())) } catch { /* ignore */ } setSent(true) }
  const invite = async () => {
    try { if (navigator.share) { await navigator.share({ text }); markSent(); return } } catch (e) { if (e?.name === 'AbortError') return }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    markSent()
  }
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ } }
  const later = () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now())) } catch { /* ignore */ } setHidden(true) }

  const hero = variant === 'hero'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid={`coparent-invite-${variant}`}
      className={`rounded-3xl p-4 flex-shrink-0 text-left ${hero ? 'bg-white shadow-lg border-2 border-indigo-100' : 'bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 shadow-eq-card'}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">🤝</span>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-indigo-950 text-[15px] leading-tight">
            {sent ? L('Jemputan dihantar ✓', 'Invite sent ✓', 'Undangan terkirim ✓', 'تم إرسال الدعوة ✓')
              : L('Didik bersama pasangan dari hari pertama', 'Raise them together from day one', 'Mendidik bersama sejak hari pertama', 'ربّياهم معاً من اليوم الأول')}
          </div>
          <div className="text-[12px] text-indigo-900/70 mt-1 leading-snug">
            {sent
              ? L('Bila pasangan sertai dengan kod ini, tetapkan giliran di Profil → Kongsi Pasangan.', 'Once your spouse joins with this code, set turns in Profile → Co-Parenting.', 'Setelah pasangan bergabung, atur giliran di Profil.', 'بعد انضمام شريكك، حدّد الأدوار من الملف.')
              : L('Beban separuh, kegembiraan berganda. Bergilir sahkan tugasan & terima Laporan Malam bersama.', 'Half the load, double the joy. Take turns verifying and share the Night Report.', 'Beban setengah, kebahagiaan berlipat. Bergiliran memverifikasi.', 'نصف العبء وضعف الفرح. تناوبا على المتابعة.')}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={invite} data-testid="coparent-invite-send"
          className="flex-1 rounded-2xl py-3 bg-[#25D366] text-white font-extrabold text-sm shadow active:scale-[0.99]">
          {sent ? L('Hantar semula', 'Send again', 'Kirim lagi', 'أرسل مجدداً') : L('Jemput via WhatsApp', 'Invite via WhatsApp', 'Undang via WhatsApp', 'ادعُ عبر واتساب')}
        </button>
        <button onClick={copy} data-testid="coparent-invite-copy"
          className="px-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-800 font-black text-xs tracking-wider active:scale-95">
          {copied ? '✓' : code}
        </button>
      </div>
      {!sent && (
        <button onClick={later} data-testid="coparent-invite-later" className="mt-1.5 w-full text-[11px] font-bold text-indigo-900/45 py-1">
          {hero ? L('Saya ibu/bapa tunggal / nanti', "I'm a single parent / later", 'Saya orang tua tunggal / nanti', 'أنا والد وحيد / لاحقاً') : L('Nanti dahulu', 'Maybe later', 'Nanti saja', 'لاحقاً')}
        </button>
      )}
    </motion.div>
  )
}
