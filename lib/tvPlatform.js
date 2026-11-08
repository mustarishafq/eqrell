'use client'
// Smart-TV platform detection for the "Save to TV" guide.
// Most TV browsers (Samsung Tizen, LG webOS, Hisense VIDAA, Fire TV Silk, most Android-TV browsers used on
// TCL / Xiaomi / Skyworth / Haier…) do NOT support one-tap web-app install, so we combine:
//   1. native install button when the browser offers it (Chrome/Edge on Android TV, some TV boxes)
//   2. per-platform "bookmark / Add to Home / set as homepage" steps
//   3. a short address (host/tv) that always reconnects this TV straight to the display

export function detectTvPlatform() {
  if (typeof navigator === 'undefined') return { os: 'other', brand: null }
  const ua = navigator.userAgent || ''
  const brand =
    /TCL/i.test(ua) ? 'TCL'
    : /MiTV|MIBOX|Xiaomi|Redmi/i.test(ua) ? 'Xiaomi'
    : /Hisense|VIDAA/i.test(ua) ? 'Hisense'
    : /Skyworth|Coocaa/i.test(ua) ? 'Skyworth'
    : /Haier/i.test(ua) ? 'Haier'
    : /BRAVIA|Sony/i.test(ua) ? 'Sony'
    : /Philips|TPVision/i.test(ua) ? 'Philips'
    : /Sharp|AQUOS/i.test(ua) ? 'Sharp'
    : /Toshiba/i.test(ua) ? 'Toshiba'
    : /Changhong/i.test(ua) ? 'Changhong'
    : /Konka/i.test(ua) ? 'Konka'
    : /Samsung|Tizen/i.test(ua) ? 'Samsung'
    : /LG|Web0S|webOS/i.test(ua) ? 'LG'
    : /AFT[A-Z0-9]|Silk\//.test(ua) ? 'Fire TV'
    : /HUAWEI|HarmonyOS/i.test(ua) ? 'Huawei'
    : null
  let os = 'other'
  if (/Tizen/i.test(ua)) os = 'samsung'
  else if (/Web0S|webOS|NetCast/i.test(ua)) os = 'lg'
  else if (/VIDAA/i.test(ua) || (/Hisense/i.test(ua) && !/Android/i.test(ua))) os = 'vidaa'
  else if (/AFT[A-Z0-9]|Silk\//.test(ua)) os = 'firetv'
  else if (/Android/i.test(ua) || /HarmonyOS/i.test(ua)) os = 'android'
  return { os, brand }
}

export const TV_SAVE_SEEN_KEY = 'eqrel-tv-save-v1'
export const tvSaveSeen = () => { try { return !!localStorage.getItem(TV_SAVE_SEEN_KEY) } catch { return true } }
export const markTvSaveSeen = (how = 'seen') => { try { localStorage.setItem(TV_SAVE_SEEN_KEY, JSON.stringify({ at: Date.now(), how })) } catch { /* ignore */ } }
