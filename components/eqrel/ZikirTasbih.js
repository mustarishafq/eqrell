'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '@/lib/i18n/LangProvider'

/**
 * ZikirTasbih — interactive family-shared zikir counter widget.
 *
 * Renders 6 zikir choice buttons + a large tap area that:
 * - Increments personal session counter (client-side)
 * - Fires POST /api/family/zikir/tap (family-shared count)
 * - Haptic vibration + satisfying animation
 * - Shows family today's count in real-time (refreshed on tap + interval)
 */

const ZIKIR_OPTIONS = [
  {
    id: 'subhanallah',
    ar: 'سُبْحَانَ اللَّه',
    translit: { ms: 'SubhanAllah', en: 'SubhanAllah', id: 'SubhanAllah', ar: 'سبحان الله' },
    meaning: { ms: 'Maha Suci Allah', en: 'Glory to Allah', id: 'Maha Suci Allah', ar: 'تنزيه لله' },
    color: '#00B894',
  },
  {
    id: 'alhamdulillah',
    ar: 'الْحَمْدُ لِلَّه',
    translit: { ms: 'Alhamdulillah', en: 'Alhamdulillah', id: 'Alhamdulillah', ar: 'الحمد لله' },
    meaning: { ms: 'Segala puji bagi Allah', en: 'All praise to Allah', id: 'Segala puji bagi Allah', ar: 'الشكر لله' },
    color: '#FFB703',
  },
  {
    id: 'allahuakbar',
    ar: 'اللَّهُ أَكْبَر',
    translit: { ms: 'Allahu Akbar', en: 'Allahu Akbar', id: 'Allahu Akbar', ar: 'الله أكبر' },
    meaning: { ms: 'Allah Maha Besar', en: 'Allah is the Greatest', id: 'Allah Maha Besar', ar: 'تكبير' },
    color: '#8B5CF6',
  },
  {
    id: 'lailahaillallah',
    ar: 'لَا إِلٰهَ إِلَّا اللَّه',
    translit: { ms: 'La ilaha illa Allah', en: 'La ilaha illa Allah', id: 'La ilaha illa Allah', ar: 'التوحيد' },
    meaning: { ms: 'Tiada Tuhan selain Allah', en: 'No god but Allah', id: 'Tiada Tuhan selain Allah', ar: 'كلمة التوحيد' },
    color: '#3B82F6',
  },
  {
    id: 'astaghfirullah',
    ar: 'أَسْتَغْفِرُ اللَّه',
    translit: { ms: 'Astaghfirullah', en: 'Astaghfirullah', id: 'Astaghfirullah', ar: 'أستغفر الله' },
    meaning: { ms: 'Aku memohon ampun Allah', en: 'I seek forgiveness from Allah', id: 'Aku memohon ampun kepada Allah', ar: 'استغفار' },
    color: '#EC4899',
  },
  {
    id: 'salawat',
    ar: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّد',
    translit: { ms: 'Salawat', en: 'Salawat', id: 'Sholawat', ar: 'صلوات' },
    meaning: { ms: 'Selawat ke atas Nabi ﷺ', en: 'Blessings upon the Prophet ﷺ', id: 'Sholawat kepada Nabi ﷺ', ar: 'الصلاة على النبي ﷺ' },
    color: '#10B981',
  },
]

export default function ZikirTasbih({ compact = false }) {
  const { lang, t } = useLang()
  const [selected, setSelected] = useState(ZIKIR_OPTIONS[0])
  const [personalCount, setPersonalCount] = useState(0)
  const [familyToday, setFamilyToday] = useState(0)
  const [familyTotal, setFamilyTotal] = useState(0)
  const [bump, setBump] = useState(0)
  const [floatEmoji, setFloatEmoji] = useState([])
  const pendingRef = useRef(0)
  const debounceRef = useRef(null)

  // Load family count on mount + poll every 10s
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const r = await fetch('/api/family/display-data', { credentials: 'include' })
        if (!r.ok) return
        const d = await r.json()
        if (mounted && d?.zikir) {
          setFamilyToday(d.zikir.today || 0)
          setFamilyTotal(d.zikir.total || 0)
        }
      } catch (e) { /* ignore */ }
    }
    load()
    const iv = setInterval(load, 10_000)
    return () => { mounted = false; clearInterval(iv) }
  }, [])

  // Debounced batch-send to backend (avoid hitting API on every tap)
  const flushTaps = async () => {
    const n = pendingRef.current
    if (n === 0) return
    pendingRef.current = 0
    try {
      // Send N taps sequentially (server increments by 1 each)
      for (let i = 0; i < n; i++) {
        const r = await fetch('/api/family/zikir/tap', { method: 'POST', credentials: 'include' })
        if (r.ok) {
          const d = await r.json()
          setFamilyToday(d.today || 0)
          setFamilyTotal(d.total || 0)
        }
      }
    } catch (e) { /* ignore */ }
  }

  const tap = () => {
    setPersonalCount(c => c + 1)
    setFamilyToday(c => c + 1) // optimistic
    setBump(b => b + 1)
    // Floating emoji
    const emojiId = Date.now() + Math.random()
    setFloatEmoji(arr => [...arr, { id: emojiId, x: Math.random() * 40 - 20 }])
    setTimeout(() => setFloatEmoji(arr => arr.filter(e => e.id !== emojiId)), 1500)
    // Haptic
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30)
    // Queue backend increment (batch send after 500ms of inactivity)
    pendingRef.current += 1
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(flushTaps, 500)
  }

  const resetPersonal = () => setPersonalCount(0)

  const label = selected.translit[lang] || selected.translit.ms
  const meaning = selected.meaning[lang] || selected.meaning.ms

  return (
    <div className={`w-full ${compact ? '' : 'space-y-3'}`}>
      {/* Family count strip */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-4 py-2.5 flex items-center gap-3 shadow-lg">
        <div className="text-2xl">📿</div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-widest font-black text-emerald-100 leading-none">
            {lang === 'ar' ? 'ذكر العائلة اليوم' : lang === 'en' ? 'Family Zikir Today' : lang === 'id' ? 'Zikir Keluarga Hari ini' : 'Zikir Keluarga Hari Ini'}
          </div>
          <div className="text-2xl font-black tabular-nums leading-tight">{familyToday.toLocaleString(lang === 'ar' ? 'ar-EG' : lang)}</div>
        </div>
        {familyTotal > familyToday && (
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-emerald-100/70 font-bold leading-none">
              {lang === 'ar' ? 'الإجمالي' : lang === 'en' ? 'Total' : 'Total'}
            </div>
            <div className="text-sm font-black tabular-nums leading-tight">{familyTotal.toLocaleString(lang === 'ar' ? 'ar-EG' : lang)}</div>
          </div>
        )}
      </div>

      {/* Zikir chooser */}
      <div className="grid grid-cols-3 gap-1.5">
        {ZIKIR_OPTIONS.map(z => (
          <button key={z.id} onClick={() => setSelected(z)}
            className={`rounded-xl px-2 py-1.5 text-[10px] font-black transition-all border-2 ${selected.id === z.id ? 'text-white scale-105' : 'bg-white text-emerald-900 border-eq-cream'}`}
            style={selected.id === z.id ? { backgroundColor: z.color, borderColor: z.color } : {}}>
            {z.translit[lang] || z.translit.ms}
          </button>
        ))}
      </div>

      {/* Big tap button */}
      <div className="relative">
        <motion.button
          onClick={tap}
          whileTap={{ scale: 0.92 }}
          className="w-full rounded-3xl shadow-2xl overflow-hidden py-6 px-4 border-4 relative active:scale-95 transition-transform"
          style={{ backgroundColor: selected.color, borderColor: selected.color }}
        >
          <div className="text-white space-y-1">
            <motion.div
              key={bump}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.3 }}
              className="text-3xl md:text-4xl font-black leading-tight" dir="rtl">
              {selected.ar}
            </motion.div>
            <div className="text-sm font-bold opacity-90">{label}</div>
            <div className="text-[10px] italic opacity-70">{meaning}</div>

            {personalCount > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 bg-white/25 backdrop-blur rounded-full px-3 py-0.5">
                <span className="text-[9px] uppercase tracking-widest font-black">
                  {lang === 'ar' ? 'أنت اليوم' : lang === 'en' ? 'You today' : 'Anda hari ini'}
                </span>
                <span className="text-sm font-black tabular-nums">{personalCount}</span>
              </div>
            )}
          </div>

          {/* Floating emojis on tap */}
          <AnimatePresence>
            {floatEmoji.map(f => (
              <motion.div key={f.id}
                initial={{ opacity: 1, y: 0, scale: 0.8, x: f.x }}
                animate={{ opacity: 0, y: -80, scale: 1.4, x: f.x }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 pointer-events-none text-2xl">
                ✨
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.button>

        {personalCount > 0 && (
          <button onClick={resetPersonal}
            className="absolute top-2 right-2 text-[10px] text-white/80 hover:text-white font-bold bg-black/20 rounded-full px-2 py-0.5">
            {lang === 'ar' ? 'إعادة' : lang === 'en' ? 'Reset' : 'Reset'}
          </button>
        )}
      </div>

      {/* Hint */}
      <div className="text-[10px] text-emerald-800/60 text-center italic">
        {lang === 'ar' ? 'اضغط الزر لكل تسبيحة — العدّ مشترك مع العائلة' :
          lang === 'en' ? 'Tap the button for each zikir — counter is shared with your family' :
          lang === 'id' ? 'Tap tombol untuk tiap zikir — hitungan dibagi dengan keluarga' :
          'Tap butang untuk setiap zikir — kaunter dikongsi dengan keluarga'}
      </div>
    </div>
  )
}
