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
import { X, Check, Info } from 'lucide-react'
import { AVATAR_BY_ID } from '@/lib/avatars'
import { useLang } from '@/lib/i18n/LangProvider'

const STORAGE_KEY = 'eqrel-device-role'

export function DeviceSettingsSheet({ open, onClose, kids = [] }) {
  const { t } = useLang()
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

              {/* PWA Homescreen tip */}
              <div className="mt-3 rounded-2xl bg-sky-50 border border-sky-200 p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-sky-900 leading-snug">
                    <div className="font-extrabold mb-1">{t.device_pwa_tip_title}</div>
                    <p>{t.device_pwa_tip_body}</p>
                    {kids.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {kids.map(c => (
                          <div key={c.id} className="font-mono text-[10px] bg-white/60 rounded px-2 py-1 break-all">
                            /kid?childId={c.id}
                          </div>
                        ))}
                        <div className="font-mono text-[10px] bg-white/60 rounded px-2 py-1">
                          /kid  <span className="text-sky-700">→ {t.device_role_any}</span>
                        </div>
                      </div>
                    )}
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
