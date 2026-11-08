'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Share2 } from 'lucide-react'
import { drawWeeklyCard } from '@/lib/shareWeeklyCard'

const pick = (lang) => (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)

/** "Share to WhatsApp" for the weekly AI note → pretty image card + short message. */
export function ShareWeeklyButton({ ai, digest, lang = 'en' }) {
  const [open, setOpen] = useState(false)
  const L = pick(lang)
  if (!ai?.text || !digest) return null
  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="weekly-ai-share"
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 font-extrabold text-sm active:scale-[0.99]"
        style={{ backgroundColor: '#FFB703', color: '#0F2E25' }}>
        <Share2 className="w-4 h-4" /> {L('Kongsi ke pasangan / grup keluarga', 'Share with spouse / family group', 'Bagikan ke pasangan / grup keluarga', 'شارك مع الزوج / مجموعة العائلة')}
      </button>
      <ShareWeeklyModal open={open} onClose={() => setOpen(false)} ai={ai} digest={digest} lang={lang} />
    </>
  )
}

function ShareWeeklyModal({ open, onClose, ai, digest, lang }) {
  const L = pick(lang)
  const [blob, setBlob] = useState(null)
  const [url, setUrl] = useState(null)
  const [note, setNote] = useState(null)

  useEffect(() => {
    if (!open) return
    let alive = true, made = null
    setBlob(null); setUrl(null); setNote(null)
    ;(async () => {
      let familyName = ''
      try { const r = await fetch('/api/auth/me', { credentials: 'include' }); const d = await r.json(); familyName = d?.family?.familyName || '' } catch { /* ignore */ }
      const b = await drawWeeklyCard({ text: ai.text, kids: digest.kids, from: digest.from, to: digest.to, familyName, lang, host: window.location.host })
      if (!alive || !b) return
      made = URL.createObjectURL(b); setBlob(b); setUrl(made)
    })().catch(() => setNote(L('Gagal menjana kad.', 'Could not create the card.', 'Gagal membuat kartu.', 'تعذّر إنشاء البطاقة.')))
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ai?.text, lang])

  const fileName = `EQrel-weekly-${digest.to}.png`
  // The image is visual-first; the full note travels as the WhatsApp caption.
  const shareText = `✨ ${L('Nota mingguan keluarga kita dari EQrel', 'Our family weekly note from EQrel', 'Catatan mingguan keluarga kita dari EQrel', 'ملاحظة عائلتنا الأسبوعية من EQrel')}\n\n${String(ai.text || '').trim()}\n\n${typeof window !== 'undefined' ? window.location.host : 'eqrel.app'}`
  const download = () => {
    if (!url) return
    const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove()
  }
  const share = async () => {
    if (!blob) return
    const file = new File([blob], fileName, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: shareText, title: 'EQrel' }); return }
    } catch (e) { if (e?.name === 'AbortError') return }
    download()
    setNote(L('Imej dimuat turun — lampirkan dalam WhatsApp.', 'Image downloaded — attach it in WhatsApp.', 'Gambar diunduh — lampirkan di WhatsApp.', 'تم تنزيل الصورة — أرفقها في واتساب.'))
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="weekly-share-modal">
          <motion.div onClick={e => e.stopPropagation()} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-4 max-h-[94dvh] overflow-y-auto"
            style={{ backgroundColor: '#FFF8E7', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold" style={{ color: '#0F2E25' }}>{L('Kongsi Nota Mingguan', 'Share Weekly Note', 'Bagikan Catatan Mingguan', 'مشاركة الملاحظة الأسبوعية')}</h3>
              <button onClick={onClose} aria-label="close" data-testid="weekly-share-close" className="w-8 h-8 rounded-full bg-white flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-white aspect-[4/5] flex items-center justify-center">
              {url ? <img src={url} alt="weekly note card" className="w-full h-full object-contain" data-testid="weekly-share-preview" />
                : <div className="w-9 h-9 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />}
            </div>
            {note && <p className="text-[11px] text-center mt-2 font-semibold" style={{ color: '#0F2E25' }} data-testid="weekly-share-note">{note}</p>}
            {!note && url && <p className="text-[11px] text-center mt-2 font-semibold opacity-60" style={{ color: '#0F2E25' }}>{L('Nota penuh dihantar sebagai teks mesej.', 'The full note is sent as the message text.', 'Catatan lengkap dikirim sebagai teks pesan.', 'تُرسل الملاحظة كاملة كنص الرسالة.')}</p>}
            <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
              <button onClick={share} disabled={!blob} data-testid="weekly-share-whatsapp"
                className="flex items-center justify-center gap-2 rounded-2xl py-3 font-extrabold text-sm bg-[#25D366] text-white disabled:opacity-40 active:scale-[0.99]">
                <Share2 className="w-4 h-4" /> {L('Kongsi ke WhatsApp', 'Share to WhatsApp', 'Bagikan ke WhatsApp', 'شارك عبر واتساب')}
              </button>
              <button onClick={download} disabled={!url} aria-label="download" data-testid="weekly-share-download"
                className="px-4 rounded-2xl bg-white border-2 border-emerald-200 text-emerald-800 disabled:opacity-40 active:scale-95">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
