/**
 * Draws a shareable "Profil Iman & Habit" card (1080×1350 PNG) on a canvas.
 * Pure client-side; all images are same-origin so the canvas stays untainted.
 */
import { DIMENSIONS, STAGES, SCHOOL_OPTIONS, tx, stageDesc } from '@/lib/diagnosis'
import { AVATAR_BY_ID } from '@/lib/avatars'

const W = 1080, H = 1350
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'

const LBL = {
  title:    { ms: 'PROFIL IMAN & HABIT', en: 'IMAN & HABIT PROFILE', id: 'PROFIL IMAN & KEBIASAAN', ar: 'ملف الإيمان والعادات' },
  years:    { ms: 'tahun', en: 'years', id: 'tahun', ar: 'سنوات' },
  strength: { ms: '💪 Kekuatan', en: '💪 Strengths', id: '💪 Kekuatan', ar: '💪 نقاط القوة' },
  focus:    { ms: '🎯 Fokus Utama', en: '🎯 Main Focus', id: '🎯 Fokus Utama', ar: '🎯 التركيز الأساسي' },
  since:    { ms: 'sejak', en: 'since', id: 'sejak', ar: 'منذ' },
  building: { ms: 'Sedang dibina', en: 'Being built', id: 'Sedang dibangun', ar: 'قيد البناء' },
  keep:     { ms: 'Kekalkan semua', en: 'Maintain all', id: 'Pertahankan semua', ar: 'حافظ على الكل' },
  hadith:   { ms: '“Sebaik-baik amalan ialah yang berterusan walaupun sedikit.”', en: '“The most beloved deeds are those done consistently, even if small.”', id: '“Amalan yang paling dicintai Allah adalah yang terus-menerus walaupun sedikit.”', ar: '«أحبُّ الأعمال إلى الله أدومها وإن قلّ»' },
  footer:   { ms: 'Dibina bersama EQrel', en: 'Built with EQrel', id: 'Dibangun bersama EQrel', ar: 'بُني مع EQrel' },
}
export const lbl = (k, lang) => LBL[k]?.[lang] || LBL[k]?.ms || ''

const loadImg = (src) => new Promise((res) => {
  if (!src) return res(null)
  const im = new Image()
  im.onload = () => res(im)
  im.onerror = () => res(null)
  im.src = src
})

const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

const wrap = (ctx, text, x, y, maxW, lh, maxLines = 3) => {
  const words = String(text || '').split(' ')
  let line = '', lines = 0
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i]
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; lines++; line = words[i]
      if (lines >= maxLines - 1) { const rest = words.slice(i).join(' '); line = rest.length > 60 ? rest.slice(0, 57) + '…' : rest; break }
    } else line = test
  }
  if (line) ctx.fillText(line, x, y)
}

const monthLabel = (d, lang) => {
  try { return new Date(d).toLocaleDateString(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : lang === 'id' ? 'id-ID' : 'ms-MY', { month: 'short', year: 'numeric' }) } catch { return '' }
}

/**
 * @param {{ child:{nickname,avatarId,age}, diagnosis:{dims,overall,stage,strengths,focus,school,createdAt}, previous?:object, lang:string }} p
 * @returns {Promise<Blob>}
 */
export async function drawProfileCard({ child, diagnosis, previous, lang = 'ms' }) {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const BODY = (typeof window !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'sans-serif'
  // Arabic: use Arabic-capable system fonts first so letters join correctly on canvas
  const FONT = lang === 'ar' ? `"Noto Sans Arabic","Noto Naskh Arabic","Geeza Pro","Segoe UI",Tahoma,"Arial",${BODY}` : BODY
  if (lang === 'ar') { try { ctx.direction = 'rtl' } catch { /* older browsers */ } }
  const f = (wt, px) => `${wt} ${px}px ${FONT}`

  const [avatar, logo] = await Promise.all([
    loadImg(AVATAR_BY_ID[child?.avatarId]?.src || '/avatars/boys/B01.png'),
    loadImg('/assets/brand/eqrel_logo.webp'),
  ])
  const stage = STAGES.find(s => s.id === diagnosis?.stage) || STAGES[0]

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#E3FBF1'); bg.addColorStop(0.55, '#FFF8E6'); bg.addColorStop(1, '#FFE9D6')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 0.35
  ctx.fillStyle = '#9BE7C9'; ctx.beginPath(); ctx.arc(80, 60, 260, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#FFD58A'; ctx.beginPath(); ctx.arc(W - 40, H - 60, 300, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1

  // Logo
  if (logo) { const lh = 92, lw = logo.width * (lh / logo.height); ctx.drawImage(logo, (W - lw) / 2, 48, lw, lh) }
  else { ctx.fillStyle = '#065F46'; ctx.font = f(900, 64); ctx.textAlign = 'center'; ctx.fillText('EQrel', W / 2, 115) }

  // Card
  const cx = 56, cy = 176, cw = W - 112, ch = 1062
  ctx.save(); ctx.shadowColor = 'rgba(6,95,70,0.18)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18
  rr(ctx, cx, cy, cw, ch, 52); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore()

  // Header: avatar + name + ring
  ctx.save(); ctx.beginPath(); ctx.arc(cx + 150, cy + 150, 104, 0, Math.PI * 2); ctx.fillStyle = '#FFF4DA'; ctx.fill(); ctx.clip()
  if (avatar) { const s = 196; ctx.drawImage(avatar, cx + 150 - s / 2, cy + 150 - s / 2 + 6, s, s * (avatar.height / avatar.width)) }
  ctx.restore()
  ctx.textAlign = 'left'
  ctx.fillStyle = '#059669'; ctx.font = f(900, 28); ctx.fillText(lbl('title', lang), cx + 285, cy + 105)
  ctx.fillStyle = '#052E2B'; ctx.font = f(900, 68)
  const name = String(child?.nickname || '').slice(0, 14); ctx.fillText(name, cx + 285, cy + 180)
  ctx.fillStyle = 'rgba(5,46,43,0.6)'; ctx.font = f(700, 32)
  ctx.fillText(`${diagnosis?.age ?? child?.age ?? ''} ${lbl('years', lang)} · ${tx(SCHOOL_OPTIONS.find(s => s.id === diagnosis?.school), lang)}`, cx + 285, cy + 230)

  // Score ring
  const rx = cx + cw - 130, ry = cy + 150, R = 82
  ctx.lineWidth = 22; ctx.lineCap = 'round'
  ctx.strokeStyle = '#E6F7F1'; ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#00B894'; ctx.beginPath(); ctx.arc(rx, ry, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (diagnosis?.overall || 0)) / 100); ctx.stroke()
  ctx.fillStyle = '#065F46'; ctx.font = f(900, 60); ctx.textAlign = 'center'; ctx.fillText(String(diagnosis?.overall ?? 0), rx, ry + 21)
  if (previous) {
    const d = (diagnosis?.overall || 0) - (previous.overall || 0)
    ctx.font = f(900, 24); ctx.fillStyle = d >= 0 ? '#059669' : '#DC2626'
    ctx.fillText(`${d >= 0 ? '▲ +' : '▼ '}${d} ${lbl('since', lang)} ${monthLabel(previous.createdAt, lang)}`, rx - 20, ry + R + 44)
  }

  // Stage banner
  const sy = cy + 300
  const sg = ctx.createLinearGradient(cx + 40, 0, cx + cw - 40, 0)
  sg.addColorStop(0, '#E9FBF3'); sg.addColorStop(1, '#FFF3DA')
  rr(ctx, cx + 40, sy, cw - 80, 165, 36); ctx.fillStyle = sg; ctx.fill()
  ctx.textAlign = 'center'; ctx.font = `96px ${EMOJI}`; ctx.fillText(stage.icon, cx + 130, sy + 116)
  ctx.textAlign = 'left'; ctx.fillStyle = '#065F46'; ctx.font = f(900, 46); ctx.fillText(tx(stage, lang), cx + 230, sy + 64)
  ctx.fillStyle = 'rgba(5,46,43,0.7)'; ctx.font = f(600, 28); wrap(ctx, stageDesc(stage, lang), cx + 230, sy + 106, cw - 320, 34, 2)

  // Dimension bars
  let by = sy + 200
  Object.entries(DIMENSIONS).forEach(([k, d]) => {
    const v = diagnosis?.dims?.[k] ?? 0
    ctx.textAlign = 'left'; ctx.fillStyle = '#052E2B'; ctx.font = `32px ${EMOJI}`; ctx.fillText(d.icon, cx + 50, by + 28)
    ctx.font = f(800, 31); ctx.fillText(tx(d, lang), cx + 100, by + 28)
    ctx.textAlign = 'right'; ctx.fillStyle = d.color; ctx.font = f(900, 32)
    let label = `${v}%`
    if (previous?.dims && Number.isFinite(previous.dims[k])) { const dd = v - previous.dims[k]; if (dd !== 0) label = `${dd > 0 ? '▲' : '▼'}${Math.abs(dd)}  ${v}%` }
    ctx.fillText(label, cx + cw - 50, by + 28)
    rr(ctx, cx + 50, by + 42, cw - 100, 20, 10); ctx.fillStyle = '#F1F5F4'; ctx.fill()
    rr(ctx, cx + 50, by + 42, Math.max(20, ((cw - 100) * v) / 100), 20, 10); ctx.fillStyle = d.color; ctx.fill()
    by += 80
  })

  // Strengths / Focus
  const bx = cx + 40, bw = (cw - 100) / 2, bh = 132, boxY = by + 12
  const box = (x, color, bgc, title, text) => {
    rr(ctx, x, boxY, bw, bh, 30); ctx.fillStyle = bgc; ctx.fill()
    ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.font = `800 27px ${FONT}, ${EMOJI}`; ctx.fillText(title, x + 26, boxY + 46)
    ctx.fillStyle = '#052E2B'; ctx.font = f(800, 28); wrap(ctx, text, x + 26, boxY + 86, bw - 52, 32, 2)
  }
  const names = (arr) => (arr || []).map(k => tx(DIMENSIONS[k], lang)).join(', ')
  box(bx, '#047857', '#ECFDF5', lbl('strength', lang), names(diagnosis?.strengths) || lbl('building', lang))
  box(bx + bw + 20, '#B45309', '#FFFBEB', lbl('focus', lang), names(diagnosis?.focus) || lbl('keep', lang))

  // Footer
  ctx.textAlign = 'center'; ctx.fillStyle = '#065F46'; ctx.font = f(700, 26)
  wrap(ctx, lbl('hadith', lang), W / 2, cy + ch + 42, W - 160, 30, 2)
  ctx.fillStyle = 'rgba(6,95,70,0.55)'; ctx.font = f(700, 24); ctx.fillText(lbl('footer', lang), W / 2, H - 22)

  return await new Promise(res => canvas.toBlob(b => res(b), 'image/png'))
}
