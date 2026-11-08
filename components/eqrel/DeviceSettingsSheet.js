'use client'

/**
 * DeviceSettingsSheet — parent picks how THIS device behaves at startup.
 * Options:
 *   - 'parent'      → normal dashboard on launch
 *   - 'kid:<id>'    → auto-open a specific child's Kid Home
 *   - 'kid:any'     → auto-open Kid Chooser (shared kid device with multiple kids)
 *
 * Also shows a bonus PWA homescreen shortcut tip (per-child bookmarks).
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from 'lucide-react'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { useLang } from '@/lib/i18n/LangProvider'

const STORAGE_KEY = 'eqrel-device-role'

export function DeviceSettingsSheet({ open, onClose, kids = [], onOpenKidDevices, onOpenGuide }) {
  const { t, lang } = useLang()
  const L = (ms, en, id, ar) => (lang === 'ar' ? ar : lang === 'ms' ? ms : lang === 'id' ? id : en)
  const [role, setRole] = useState('parent')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      try { setRole(localStorage.getItem(STORAGE_KEY) || 'parent') } catch { setRole('parent') }
      setSaved(false)
    }
  }, [open])

  const save = (next) => {
    setRole(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch (e) { /* ignore */ }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
            style={{ zIndex: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden pointer-events-auto"
            style={{ zIndex: 10 }}
          >
            <div className="pt-2 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-eq-ink/15 rounded-full" />
            </div>

            <div className="px-5 pb-2 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl">📱</span>
                  <h2 className="text-lg font-extrabold text-emerald-900">{t.device_settings_title}</h2>
                </div>
                <p className="text-xs text-emerald-800/60 mt-0.5">{t.device_settings_sub}</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-eq-cream/60 hover:bg-eq-cream flex items-center justify-center"
                aria-label={t.cancel}
              >
                <X className="w-5 h-5 text-eq-ink/60" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {/* Parent option */}
              <RoleRow
                selected={role === 'parent'}
                onClick={() => save('parent')}
                emoji="🧑‍💼"
                title={t.device_role_parent}
                desc={t.device_role_parent_desc}
              />

              {/* One-child options */}
              {kids.map(c => {
                const avatar = c.avatarId ? AVATAR_BY_ID[c.avatarId] : null
                const val = `kid:${c.id}`
                return (
                  <RoleRow
                    key={c.id}
                    selected={role === val}
                    onClick={() => save(val)}
                    avatar={avatar?.src}
                    accent={c.favColor}
                    title={t.device_role_kid(c.nickname)}
                    desc={t.device_role_kid_desc}
                  />
                )
              })}

              {/* Shared kid device (chooser) */}
              {kids.length > 1 && (
                <RoleRow
                  selected={role === 'kid:any'}
                  onClick={() => save('kid:any')}
                  emoji="👨‍👩‍👧"
                  title={t.device_role_any}
                  desc={t.device_role_any_desc}
                />
              )}

              {saved && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-center text-xs text-emerald-700 font-bold py-1"
                >
                  ✓ {t.device_saved}
                </motion.div>
              )}

              {/* This sheet = THIS device (signed in with the parent's account, Kid Mode exit needs PIN).
                  A child with their own phone/tablet should use Child's Own Device instead. */}
              <div className="mt-3 rounded-2xl p-3" style={{ backgroundColor: '#0F2E25' }} data-testid="device-settings-kid-banner">
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl leading-none">🧒</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-extrabold" style={{ color: '#FFF8E7' }}>{L('Anak ada telefon/tablet sendiri?', 'Does your child have their own phone or tablet?', 'Anak punya HP/tablet sendiri?', 'هل لطفلك جهاز خاص؟')}</div>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#FFF8E7B3' }}>{L('Tetapan di atas hanya untuk peranti INI yang log masuk dengan akaun anda. Untuk peranti anak, guna Peranti Anak — tanpa email, dan bahagian ibu bapa dikunci.', 'The options above are only for THIS device, signed in with your account. For your child\'s own device, use Child\'s Own Device — no email needed and parent features stay locked.', 'Pilihan di atas hanya untuk perangkat INI. Untuk perangkat anak, gunakan Perangkat Anak — tanpa email.', 'الخيارات أعلاه لهذا الجهاز فقط. لجهاز طفلك استخدم «جهاز الطفل».')}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {onOpenKidDevices && (
                        <button onClick={onOpenKidDevices} data-testid="device-settings-open-kid-devices" className="rounded-full px-3 py-1.5 text-[11px] font-black" style={{ backgroundColor: '#FFB703', color: '#0F2E25' }}>
                          {L('Buka Peranti Anak', "Open Child's Own Device", 'Buka Perangkat Anak', 'فتح جهاز الطفل')} →
                        </button>
                      )}
                      {onOpenGuide && (
                        <button onClick={onOpenGuide} data-testid="device-settings-open-guide" className="rounded-full px-3 py-1.5 text-[11px] font-black" style={{ backgroundColor: '#FFF8E71F', color: '#FFF8E7' }}>
                          📖 {L('Panduan', 'Guide', 'Panduan', 'الدليل')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-eq-cream/60 bg-white/95 backdrop-blur px-5 py-3">
              <div className="text-[11px] text-emerald-800/60 leading-snug mb-2">
                {t.device_change_note}
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-2xl bg-emerald-500 text-white font-extrabold py-2.5 text-sm active:scale-[0.99]"
              >
                {t.done}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const RoleRow = ({ selected, onClick, emoji, avatar, accent = '#00B894', title, desc }) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-2xl border-2 px-3 py-2.5 flex items-center gap-3 transition-all active:scale-[0.99] ${
      selected ? 'bg-emerald-50 border-emerald-400 shadow-sm' : 'bg-white border-eq-cream hover:border-emerald-200'
    }`}
  >
    <div
      className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 overflow-hidden"
      style={{ background: selected ? `${accent}22` : `${accent}18`, border: `2px solid ${accent}33` }}
    >
      {avatar ? (
        <img src={avatar} alt="" className="w-full h-full object-cover rounded-xl" />
      ) : (
        <span>{emoji}</span>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-extrabold text-eq-ink text-sm">{title}</div>
      <div className="text-[11px] text-eq-ink/60 mt-0.5 leading-tight">{desc}</div>
    </div>
    {selected && (
      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <Check className="w-4 h-4 text-white" strokeWidth={3} />
      </div>
    )}
  </button>
)

export default DeviceSettingsSheet
