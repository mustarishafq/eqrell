'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Crosshair } from 'lucide-react'

/**
 * PhotoEditor — Set focal point (what stays visible when cropped) + optional title.
 * Uses object-fit: cover + object-position: {focalX}% {focalY}%
 *
 * The frame preview shows the display's aspect ratio (~16:9) with the current focal point.
 * User clicks/drags on the source image to set focal point.
 */
const DISPLAY_ASPECT = 16 / 9  // Family photo area is ~16:9 landscape

export default function PhotoEditor({ open, photo, onClose, onSave, lang = 'en' }) {
  const [focalX, setFocalX] = useState(50)
  const [focalY, setFocalY] = useState(50)
  const [title, setTitle] = useState('')
  const imgRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (open && photo) {
      setFocalX(photo.focalX ?? 50)
      setFocalY(photo.focalY ?? 50)
      setTitle(photo.title || '')
    }
  }, [open, photo])

  if (!open || !photo) return null

  const l = (o) => o[lang] || o.ms
  const t = {
    title:   { ms: 'Edit Kedudukan Gambar', en: 'Edit Photo Position', id: 'Edit Posisi Foto', ar: 'تعديل موضع الصورة' },
    sub:     { ms: 'Ketuk / seret pada gambar untuk pilih bahagian penting', en: 'Tap / drag on photo to pick the important part', id: 'Ketuk / seret foto untuk memilih bagian penting', ar: 'اسحب لاختيار الجزء المهم' },
    caption: { ms: 'Tajuk (opsyenal)', en: 'Title (optional)', id: 'Judul (opsional)', ar: 'العنوان (اختياري)' },
    preview: { ms: 'Preview di TV', en: 'TV Preview', id: 'Preview TV', ar: 'معاينة التلفزيون' },
    reset:   { ms: '🎯 Kembali ke Tengah', en: '🎯 Reset to Center', id: '🎯 Reset ke Tengah', ar: '🎯 إعادة إلى الوسط' },
    save:    { ms: '💾 Simpan', en: '💾 Save', id: '💾 Simpan', ar: '💾 حفظ' },
    cancel:  { ms: 'Batal', en: 'Cancel', id: 'Batal', ar: 'إلغاء' },
  }

  const handlePointerMove = (e) => {
    if (!dragging && e.type !== 'click') return
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const cx = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left
    const cy = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top
    const x = Math.max(0, Math.min(100, (cx / rect.width) * 100))
    const y = Math.max(0, Math.min(100, (cy / rect.height) * 100))
    setFocalX(x); setFocalY(y)
  }

  const save = () => {
    onSave({ ...photo, focalX, focalY, title: title.trim() })
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
        <motion.div
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}>

          {/* Header */}
          <div className="sticky top-0 bg-white border-b-2 border-emerald-100 p-4 flex items-center gap-2 rounded-t-3xl">
            <Crosshair className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-black text-emerald-900 text-base leading-tight">{l(t.title)}</div>
              <div className="text-[11px] text-emerald-800/60 leading-tight">{l(t.sub)}</div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <X className="w-5 h-5 text-emerald-700" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Source image with focal point marker */}
            <div
              className="relative rounded-2xl overflow-hidden bg-slate-900 cursor-crosshair select-none"
              onClick={handlePointerMove}
              onMouseDown={() => setDragging(true)}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              onMouseMove={handlePointerMove}
              onTouchStart={(e) => { setDragging(true); handlePointerMove(e.touches[0]) }}
              onTouchMove={(e) => handlePointerMove(e.touches[0])}
              onTouchEnd={() => setDragging(false)}>
              <img
                ref={imgRef}
                src={photo.url}
                alt=""
                className="w-full h-auto max-h-[45vh] object-contain block pointer-events-none"
                draggable={false} />
              {/* Focal point marker */}
              <div
                className="absolute w-10 h-10 -ml-5 -mt-5 pointer-events-none transition-none"
                style={{ left: `${focalX}%`, top: `${focalY}%` }}>
                <div className="absolute inset-0 rounded-full border-4 border-white shadow-lg" style={{ boxShadow: '0 0 0 3px rgba(0,0,0,0.4)' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white" />
                <div className="absolute -inset-8 rounded-full border-2 border-dashed border-white/40 animate-pulse" />
              </div>
            </div>

            <button type="button" onClick={() => { setFocalX(50); setFocalY(50) }}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline">
              {l(t.reset)}
            </button>

            {/* TV Preview */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-emerald-800/70 mb-1 block">
                📺 {l(t.preview)}
              </label>
              <div
                className="relative rounded-2xl overflow-hidden bg-emerald-950 border-2 border-emerald-300"
                style={{ aspectRatio: DISPLAY_ASPECT }}>
                <img
                  src={photo.url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ objectPosition: `${focalX}% ${focalY}%` }} />
                {title && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-end">
                    <div className="rounded-xl bg-black/60 backdrop-blur-sm text-white font-black text-lg px-4 py-2 shadow-lg">
                      {title}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Title input */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70 mb-1 block">
                {l(t.caption)}
              </label>
              <input value={title} onChange={e => setTitle(e.target.value.slice(0, 60))}
                placeholder={lang === 'ar' ? 'مثال: عيد الفطر 2025' : lang === 'en' ? 'e.g. Family Trip 2025' : 'Contoh: Hari Raya 2025'}
                className="w-full rounded-xl border-2 border-eq-cream px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              <div className="text-[9px] text-emerald-800/50 mt-0.5 text-right">{title.length}/60</div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t-2 border-emerald-100 p-4 flex gap-2 rounded-b-3xl">
            <button onClick={onClose}
              className="flex-1 rounded-xl border-2 border-eq-cream text-emerald-800 font-bold text-sm py-2.5 hover:bg-eq-cream/30">
              {l(t.cancel)}
            </button>
            <button onClick={save}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-black text-sm py-2.5 shadow-lg">
              {l(t.save)}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
