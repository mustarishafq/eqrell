'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Share2 } from 'lucide-react'
import { drawProfileCard } from '@/lib/shareProfileCard'
import { STAGES, tx } from '@/lib/diagnosis'

const pick = (lang) => (ms, en, id, ar) => (lang === 'en' ? en : lang === 'id' ? id : lang === 'ar' ? ar : ms)

/** Button that opens a preview of the shareable Profil Iman card. */
export function ShareProfileButton({ child, diagnosis, previous, lang = 'en', className = '', label, testId = 'share-profile-btn' }) {
  const [open, setOpen] = useState(false)
  const L = pick(lang)
  if (!diagnosis) return null
  return (
    <>
      <button onClick={() => setOpen(true)} data-testid={testId}
        className={className || 'w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-extrabold text-sm bg-[#25D366] text-white shadow-lg shadow-green-600/20 active:scale-[0.99]'}>
        <Share2 className="w-4 h-4" /> {label || L('Kongsi Profil ke WhatsApp', 'Share Profile to WhatsApp', 'Bagikan Profil ke WhatsApp', 'شارك الملف عبر واتساب')}
      </button>
      <ShareProfileModal open={open} onClose={() => setOpen(false)} child={child} diagnosis={diagnosis} previous={previous} lang={lang} />
    </>
  )
}

export function ShareProfileModal({ open, onClose, child, diagnosis, previous, lang = 'en' }) {
  const L = pick(lang)
  const [blob, setBlob] = useState(null)
  const [url, setUrl] = useState(null)
  const [note, setNote] = useState(null)

  useEffect(() => {
    if (!open || !diagnosis) return
    let alive = true, made = null
    setBlob(null); setUrl(null); setNote(null)
    drawProfileCard({ child, diagnosis, previous, lang }).then(b => {
      if (!alive || !b) return
      made = URL.createObjectURL(b)
      setBlob(b); setUrl(made)
    }).catch(() => setNote(L('Gagal menjana kad.', 'Could not create the card.', 'Gagal membuat kartu.', 'تعذّر إنشاء البطاقة.')))
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, diagnosis, previous, lang, child?.nickname, child?.avatarId])

  const stage = STAGES.find(s => s.id === diagnosis?.stage) || STAGES[0]
  const fileName = `Profil-Iman-${(child?.nickname || 'anak').replace(/[^\w-]+/g, '_')}.png`
  const shareText = L(
    `${stage.icon} Profil Iman & Habit ${child?.nickname}: ${tx(stage, lang)} (${diagnosis?.overall}/100). Alhamdulillah, kami sedang membina habit baik bersama EQrel!`,
    `${stage.icon} ${child?.nickname}'s Iman & Habit Profile: ${tx(stage, lang)} (${diagnosis?.overall}/100). Alhamdulillah, we're building good habits with EQrel!`,
    `${stage.icon} Profil Iman & Kebiasaan ${child?.nickname}: ${tx(stage, lang)} (${diagnosis?.overall}/100). Alhamdulillah, kami membangun kebiasaan baik bersama EQrel!`,
    `${stage.icon} ملف الإيمان والعادات لـ ${child?.nickname}: ${tx(stage, lang)} (${diagnosis?.overall}/100). الحمد لله، نبني عادات حسنة مع EQrel!`,
  )
  const download = () => {
    if (!url) return
    const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove()
  }
  const share = async () => {
    if (!blob) return
    const file = new File([blob], fileName, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText, title: 'EQrel' })
        return
      }
    } catch (e) { if (e?.name === 'AbortError') return }
    // Fallback (desktop): save image + open WhatsApp with the message
    download()
    setNote(L('Imej telah dimuat turun — lampirkan imej itu dalam WhatsApp.', 'Image downloaded — attach it in WhatsApp.', 'Gambar sudah diunduh — lampirkan di WhatsApp.', 'تم تنزيل الصورة — أرفقها في واتساب.'))
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="share-modal">
          <motion.div onClick={e => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-4 max-h-[94dvh] overflow-y-auto"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-emerald-950">{L('Kongsi Profil Iman', 'Share Iman Profile', 'Bagikan Profil Iman', 'شارك ملف الإيمان')}</h3>
              <button onClick={onClose} aria-label="close-share" data-testid="share-close" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-emerald-50 aspect-[4/5] flex items-center justify-center">
              {url
                ? <img src={url} alt="profile card" className="w-full h-full object-contain" data-testid="share-preview" />
                : <div className="w-9 h-9 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />}
            </div>
            {note && <p className="text-[11px] text-emerald-800 text-center mt-2 font-semibold" data-testid="share-note">{note}</p>}
            <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
              <button onClick={share} disabled={!blob} data-testid="share-whatsapp"
                className="flex items-center justify-center gap-2 rounded-2xl py-3 font-extrabold text-sm bg-[#25D366] text-white disabled:opacity-40 active:scale-[0.99]">
                <Share2 className="w-4 h-4" /> {L('Kongsi ke WhatsApp', 'Share to WhatsApp', 'Bagikan ke WhatsApp', 'شارك عبر واتساب')}
              </button>
              <button onClick={download} disabled={!url} aria-label="download" data-testid="share-download"
                className="px-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 disabled:opacity-40 active:scale-95">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
