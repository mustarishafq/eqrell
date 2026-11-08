'use client'
// Shareable image (1080×1350, WhatsApp-friendly) of the weekly note — VISUAL-FIRST (~70% image, ~30% text).
// Hero = the family's own village (real world sprites), kids = progress rings + 7-day dots, text = one highlight line.
import { AVATAR_BY_ID } from '@/lib/avatars'
import { BRAND } from '@/lib/brand'
import { BUILDING_TEMPLATES } from '@/lib/worldEngine'
import { HABIT_CATEGORIES } from '@/lib/habitTemplates'

const W = 1080, H = 1350
const CI = { green: '#00B894', greenDk: '#009A7C', greenDkr: '#007C64', yellow: '#FFB703', coral: '#FF5D6E', ink: '#0F2E25', cream: '#FFF8E7', sky: '#E3F6EF' }
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"'
const T = {
  label: { ms: 'NOTA MINGGUAN', en: 'WEEKLY NOTE', id: 'CATATAN MINGGUAN', ar: 'الملاحظة الأسبوعية' },
  village: { ms: 'Kampung Keluarga {n}', en: 'The {n} Family Village', id: 'Desa Keluarga {n}', ar: 'قرية عائلة {n}' },
  villageNoName: { ms: 'Kampung Keluarga Kami', en: 'Our Family Village', id: 'Desa Keluarga Kami', ar: 'قرية عائلتنا' },
  built: { ms: 'binaan', en: 'built', id: 'bangunan', ar: 'مبانٍ' },
  habits: { ms: 'habit', en: 'habits', id: 'kebiasaan', ar: 'عادات' },
  week: { ms: 'minggu ini', en: 'this week', id: 'minggu ini', ar: 'هذا الأسبوع' },
  footer: { ms: 'Bina habit. Suburkan iman.', en: 'Build habits. Grow Iman.', id: 'Bangun kebiasaan. Tumbuhkan iman.', ar: 'ابنِ العادات. نمِّ الإيمان.' },
}
const t = (k, lang) => T[k]?.[lang] || T[k].en

const imgCache = new Map()
const loadImg = (src) => {
  if (!src) return Promise.resolve(null)
  if (imgCache.has(src)) return imgCache.get(src)
  const p = new Promise((res) => {
    const im = new Image(); im.crossOrigin = 'anonymous'
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src
  })
  imgCache.set(src, p); return p
}
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
const dateLabel = (s, lang) => { try { return new Date(`${s}T00:00:00`).toLocaleDateString({ ms: 'ms-MY', en: 'en-GB', id: 'id-ID', ar: 'ar' }[lang] || 'en-GB', { day: 'numeric', month: 'short' }) } catch { return s } }

/** First 1–2 sentences of the AI note (short "headline" for the card). */
export const highlightOf = (text, max = 190) => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim()
  const sents = flat.split(/(?<=[.!?؟])\s+/)
  let out = sents[0] || ''
  if (sents[1] && (out + ' ' + sents[1]).length <= max) out += ' ' + sents[1]
  return out
}
/** Wrap to at most maxLines; ellipsis on overflow. */
const wrap = (ctx, text, maxW, maxLines) => {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []; let line = ''
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line); line = words[i]
      if (lines.length === maxLines) { line = ''; lines[maxLines - 1] = trimEllipsis(ctx, `${lines[maxLines - 1]} ${words.slice(i).join(' ')}`, maxW); return { lines, cut: true } }
    } else line = test
  }
  if (line) lines.push(line)
  return { lines, cut: false }
}
const trimEllipsis = (ctx, s, maxW) => {
  let x = s
  while (x.length > 1 && ctx.measureText(`${x}…`).width > maxW) x = x.slice(0, -1)
  return `${x.trimEnd()}…`
}

// ── Village composition ────────────────────────────────────────────────
const SIZE_BY_CAT = { rumah: 215, kebun: 185, ternakan: 230, taman: 240, awam: 250, pasar: 235, sumber_air: 165 }
// Slots on the island (dx,dy as fractions of the diamond half-width/half-height) — filled in this order
const SLOTS = [
  { dx: -0.6, dy: 0.06 }, { dx: 0.6, dy: 0.06 }, { dx: -0.3, dy: 0.5 }, { dx: 0.3, dy: 0.5 },
  { dx: -0.4, dy: -0.38 }, { dx: 0.4, dy: -0.38 },
]
const DECOR_SLOTS = [
  { dx: -0.84, dy: 0.0, w: 90 }, { dx: 0.84, dy: 0.0, w: 90 }, { dx: 0, dy: 0.84, w: 95 },
  { dx: -0.62, dy: 0.34, w: 80 }, { dx: 0.64, dy: 0.32, w: 80 }, { dx: 0, dy: -0.8, w: 85 },
]
const DECOR_FILL = ['/assets/world/kebun/palm_tree.webp', '/assets/world/kebun/olive_tree.webp', '/assets/world/kebun/fig_tree.webp',
  '/assets/world/kebun/pomegranate_tree.webp', '/assets/world/kebun/palm_tree.webp', '/assets/world/kebun/olive_tree.webp']
const BUSHES = ['/assets/world/bushes/bush_01.webp', '/assets/world/bushes/bush_03.webp', '/assets/world/bushes/bush_05.webp',
  '/assets/world/bushes/bush_02.webp', '/assets/world/bushes/bush_04.webp', '/assets/world/saplings/sapling_03.webp']

/** Merge kids' villages into one family village: interleave each kid's most recent builds, unique-first. */
function familyVillage(kids) {
  const lists = kids.map(k => k.village?.recent || [])
  const picked = [], seen = new Set()
  for (let pass = 0; pass < 2 && picked.length < SLOTS.length; pass++) {
    for (let i = 0; i < 12 && picked.length < SLOTS.length; i++) {
      for (const l of lists) {
        const id = l[i]; if (!id || !BUILDING_TEMPLATES[id]?.spriteAsset) continue
        if (pass === 0 && seen.has(id)) continue
        if (pass === 1 && picked.filter(x => x === id).length >= 2) continue
        if (pass === 1 && !seen.has(id)) continue
        picked.push(id); seen.add(id)
        if (picked.length >= SLOTS.length) break
      }
    }
  }
  const total = kids.reduce((a, k) => a + (k.village?.total || 0), 0)
  const fresh = kids.reduce((a, k) => a + (k.village?.newThisWeek || 0), 0)
  const level = Math.max(1, ...kids.map(k => k.village?.musallaLevel || 1))
  return { picked, total, fresh, level }
}
const musallaSrc = (lvl) => lvl >= 3 ? '/assets/world/masjid_l3.webp' : lvl === 2 ? '/assets/world/masjid_l2.webp' : '/assets/world/musalla.webp'

const star = (ctx, x, y, r, color) => {
  ctx.fillStyle = color; ctx.beginPath()
  for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i - Math.PI / 2, rad = i % 2 ? r * 0.32 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) }
  ctx.closePath(); ctx.fill()
}
const drawSprite = (ctx, im, x, yBottom, targetW, maxH) => {
  if (!im) return
  let w = targetW, h = im.height * (w / im.width)
  if (h > maxH) { h = maxH; w = im.width * (h / im.height) }
  ctx.drawImage(im, x - w / 2, yBottom - h, w, h)
}

export async function drawWeeklyCard({ text, kids = [], from, to, familyName = '', lang = 'en', host = 'eqrel.app' }) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const BODY = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const FONT = lang === 'ar' ? `"Noto Sans Arabic","Noto Naskh Arabic","Geeza Pro","Segoe UI",Tahoma,Arial,${BODY}` : BODY
  const rtl = lang === 'ar'
  const f = (wt, px) => `${wt} ${px}px ${FONT}, ${EMOJI}`
  const setDir = (d) => { try { ctx.direction = d } catch { /* ignore */ } }

  let shown = kids.filter(k => (k.doneThisWeek || 0) > 0 || k.firstWeek).slice(0, 4)
  if (!shown.length) shown = kids.slice(0, 4)
  const vil = familyVillage(kids)

  const [logo, mascot, cloud, mus, ...rest] = await Promise.all([
    loadImg('/assets/brand/eqrel_logo.webp'), loadImg(BRAND?.mascot?.default), loadImg('/assets/world/atmosphere/cloud_soft.webp'),
    loadImg(musallaSrc(vil.level)),
    ...vil.picked.map(id => loadImg(BUILDING_TEMPLATES[id].spriteAsset)),
    ...DECOR_FILL.map(loadImg), ...BUSHES.map(loadImg),
    ...shown.map(k => loadImg(AVATAR_BY_ID[k.avatarId]?.src)),
  ])
  const bImgs = rest.slice(0, vil.picked.length)
  const decorImgs = rest.slice(vil.picked.length, vil.picked.length + DECOR_FILL.length)
  const bushImgs = rest.slice(vil.picked.length + DECOR_FILL.length, vil.picked.length + DECOR_FILL.length + BUSHES.length)
  const avatars = rest.slice(vil.picked.length + DECOR_FILL.length + BUSHES.length)

  // ── Background
  ctx.fillStyle = CI.cream; ctx.fillRect(0, 0, W, H)

  // ── Header (logo + label/date)
  if (logo) { const lh = 70, lw = logo.width * (lh / logo.height); ctx.drawImage(logo, 56, 44, lw, lh) }
  else { ctx.fillStyle = CI.ink; ctx.font = f(900, 56); ctx.textAlign = 'left'; ctx.fillText('EQrel', 56, 104) }
  setDir(rtl ? 'rtl' : 'ltr'); ctx.textAlign = 'right'
  ctx.fillStyle = CI.green; ctx.font = f(900, 26); ctx.fillText(`✨ ${t('label', lang)}`, W - 56, 76)
  ctx.fillStyle = `${CI.ink}99`; ctx.font = f(800, 26); setDir(rtl ? 'rtl' : 'ltr'); ctx.fillText(`${dateLabel(from, lang)} – ${dateLabel(to, lang)}`, W - 56, 114)

  // ── HERO: family village (≈56% of the card)
  const HX = 40, HY = 140, HW = W - 80, HH = 760
  ctx.save(); rr(ctx, HX, HY, HW, HH, 48); ctx.clip()
  ctx.fillStyle = CI.sky; ctx.fillRect(HX, HY, HW, HH)
  // sun + soft circles
  ctx.fillStyle = `${CI.yellow}40`; ctx.beginPath(); ctx.arc(860, 300, 150, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = `${CI.yellow}AA`; ctx.beginPath(); ctx.arc(860, 300, 82, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = `${CI.green}14`; ctx.beginPath(); ctx.arc(120, 860, 260, 0, Math.PI * 2); ctx.fill()
  if (cloud) {
    ctx.globalAlpha = 0.95; drawSprite(ctx, cloud, 250, 360, 300, 160); drawSprite(ctx, cloud, 700, 300, 220, 120); ctx.globalAlpha = 1
  }
  // island (isometric diamond with side faces)
  const cx = 540, cy = 590, hw = 440, hh = 220, th = 58
  ctx.fillStyle = CI.greenDk
  ctx.beginPath(); ctx.moveTo(cx - hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx, cy + hh + th); ctx.lineTo(cx - hw, cy + th); ctx.closePath(); ctx.fill()
  ctx.fillStyle = CI.greenDkr
  ctx.beginPath(); ctx.moveTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx, cy + hh + th); ctx.lineTo(cx + hw, cy + th); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#6ED9AE'
  ctx.beginPath(); ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#86E2BD'
  const ih = 0.72
  ctx.beginPath(); ctx.moveTo(cx, cy - hh * ih); ctx.lineTo(cx + hw * ih, cy); ctx.lineTo(cx, cy + hh * ih); ctx.lineTo(cx - hw * ih, cy); ctx.closePath(); ctx.fill()
  // path from musalla to the front
  ctx.save()
  ctx.beginPath(); ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath(); ctx.clip()
  ctx.fillStyle = `${CI.cream}CC`
  ctx.beginPath(); ctx.moveTo(cx - 26, cy + 40); ctx.lineTo(cx + 26, cy + 40); ctx.lineTo(cx + 46, cy + hh); ctx.lineTo(cx - 46, cy + hh); ctx.closePath(); ctx.fill()
  ctx.restore()

  // depth-sorted drawables
  const P = (dx, dy) => ({ x: cx + dx * hw, y: cy + dy * hh })
  const items = []
  DECOR_SLOTS.forEach((s, i) => items.push({ ...P(s.dx, s.dy), im: bushImgs[i], w: s.w, maxH: 110 }))
  SLOTS.forEach((s, i) => {
    const depth = 1 + s.dy * 0.12
    if (i < vil.picked.length) {
      const tpl = BUILDING_TEMPLATES[vil.picked[i]]
      items.push({ ...P(s.dx, s.dy), im: bImgs[i], w: (SIZE_BY_CAT[tpl.category] || 205) * depth, maxH: 250 * depth })
    } else {
      items.push({ ...P(s.dx, s.dy), im: decorImgs[i], w: 150 * depth, maxH: 200 * depth })
    }
  })
  const mScale = vil.level >= 3 ? 400 : vil.level === 2 ? 360 : 320
  items.push({ ...P(0, 0.14), im: mus, w: mScale, maxH: 380 })
  items.sort((a, b) => a.y - b.y).forEach(it => drawSprite(ctx, it.im, it.x, it.y, it.w, it.maxH))

  // sparkles
  ;[[190, 470, 18], [930, 520, 22], [420, 300, 14], [640, 250, 16], [980, 700, 14]].forEach(([x, y, r]) => star(ctx, x, y, r, CI.yellow))

  // village title pill (top-left)
  const vTitle = familyName ? t('village', lang).replace('{n}', familyName) : t('villageNoName', lang)
  ctx.font = f(900, 36); setDir(rtl ? 'rtl' : 'ltr')
  const vtw = Math.min(ctx.measureText(`🕌 ${vTitle}`).width, HW - 120)
  ctx.fillStyle = '#FFFFFF'; rr(ctx, HX + 32, HY + 30, vtw + 56, 72, 36); ctx.fill()
  ctx.fillStyle = CI.ink; ctx.textAlign = rtl ? 'right' : 'left'
  ctx.fillText(`🕌 ${vTitle}`, rtl ? HX + 32 + vtw + 28 : HX + 60, HY + 79, HW - 120)

  // stat chips (bottom-left): total built, + new this week
  setDir('ltr'); ctx.textAlign = 'left'
  const chips = []
  if (vil.total > 0) chips.push({ big: `🏡 ${vil.total}`, small: t('built', lang), bg: '#FFFFFF', fg: CI.ink })
  if (vil.fresh > 0) chips.push({ big: `+${vil.fresh}`, small: t('week', lang), bg: CI.yellow, fg: CI.ink })
  let chipX = HX + 32
  chips.forEach(c => {
    ctx.font = f(900, 40); const bw1 = ctx.measureText(c.big).width
    ctx.font = f(800, 24); const bw2 = ctx.measureText(c.small).width
    const cw = bw1 + bw2 + 64
    ctx.fillStyle = c.bg; rr(ctx, chipX, HY + HH - 104, cw, 74, 37); ctx.fill()
    ctx.fillStyle = c.fg; ctx.font = f(900, 40); ctx.fillText(c.big, chipX + 26, HY + HH - 52)
    ctx.fillStyle = `${c.fg}AA`; ctx.font = f(800, 24); ctx.fillText(c.small, chipX + 38 + bw1, HY + HH - 54)
    chipX += cw + 14
  })
  // mascot (bottom-right)
  if (mascot) drawSprite(ctx, mascot, HX + HW - 120, HY + HH + 6, 220, 250)
  ctx.restore()

  // ── KIDS: progress ring + 7-day dots (≈17%)
  const KY = 925, KH = 225, X0 = 40, X1 = W - 40, gap = 16
  const n = Math.max(1, shown.length), bw = (X1 - X0 - gap * (n - 1)) / n
  const horizontal = bw >= 420
  shown.forEach((k, i) => {
    const bx = rtl ? X1 - (i + 1) * bw - i * gap : X0 + i * (bw + gap)
    ctx.fillStyle = '#FFFFFF'; rr(ctx, bx, KY, bw, KH, 36); ctx.fill()
    ctx.lineWidth = 3; ctx.strokeStyle = `${CI.green}40`; rr(ctx, bx, KY, bw, KH, 36); ctx.stroke()
    const R = horizontal ? 74 : 60
    const rx = horizontal ? bx + 30 + R : bx + bw / 2, ry = horizontal ? KY + KH / 2 : KY + 22 + R
    // ring
    ctx.lineWidth = 13; ctx.lineCap = 'round'
    ctx.strokeStyle = `${CI.green}22`; ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.stroke()
    const pct = Math.max(0, Math.min(100, Number(k.pct) || 0))
    if (pct > 0) { ctx.strokeStyle = CI.green; ctx.beginPath(); ctx.arc(rx, ry, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct) / 100); ctx.stroke() }
    ctx.lineCap = 'butt'
    const av = avatars[i], ar = R - 12
    ctx.save(); ctx.beginPath(); ctx.arc(rx, ry, ar, 0, Math.PI * 2); ctx.clip()
    ctx.fillStyle = CI.cream; ctx.fillRect(rx - ar, ry - ar, ar * 2, ar * 2)
    if (av) ctx.drawImage(av, rx - ar, ry - ar, ar * 2, ar * 2)
    else { ctx.fillStyle = CI.ink; ctx.font = f(900, ar); ctx.textAlign = 'center'; ctx.fillText(String(k.nickname || '?').slice(0, 1).toUpperCase(), rx, ry + ar * 0.35) }
    ctx.restore()
    // pct badge
    setDir('ltr'); ctx.textAlign = 'center'
    ctx.font = f(900, 26); const pw = ctx.measureText(`${pct}%`).width + 24
    ctx.fillStyle = CI.green; rr(ctx, rx - pw / 2, ry + R - 18, pw, 38, 19); ctx.fill()
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(`${pct}%`, rx, ry + R + 10)
    // delta / best-habit badges
    if (!k.firstWeek && k.delta > 0) {
      ctx.fillStyle = CI.yellow; ctx.beginPath(); ctx.arc(rx + R * 0.78, ry - R * 0.78, 24, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = CI.ink; ctx.font = f(900, 20); ctx.fillText(`▲${k.delta}`, rx + R * 0.78, ry - R * 0.78 + 7)
    }
    const bIcon = HABIT_CATEGORIES[k.bestHabit?.category]?.icon || (k.bestHabit ? '🌟' : null)
    if (bIcon) {
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(rx - R * 0.8, ry - R * 0.78, 24, 0, Math.PI * 2); ctx.fill()
      ctx.lineWidth = 3; ctx.strokeStyle = `${CI.green}55`; ctx.stroke()
      ctx.font = f(400, 26); ctx.fillText(bIcon, rx - R * 0.8, ry - R * 0.78 + 9)
    }
    // name + dots
    const name = String(k.nickname || '').slice(0, 14)
    const days = Array.isArray(k.days) && k.days.length === 7 ? k.days : Array(7).fill(0)
    const dotR = horizontal ? 13 : 9, dotGap = horizontal ? 36 : Math.min(27, (bw - 30) / 7)
    const drawDots = (sx, sy) => days.forEach((v, j) => {
      const dx = sx + j * dotGap
      ctx.fillStyle = v >= 1 ? CI.green : v > 0 ? CI.yellow : `${CI.ink}14`
      ctx.beginPath(); ctx.arc(dx, sy, dotR, 0, Math.PI * 2); ctx.fill()
    })
    if (horizontal) {
      const tx = rx + R + 36
      ctx.textAlign = 'left'; ctx.fillStyle = CI.ink; ctx.font = f(900, 44); setDir(rtl ? 'rtl' : 'ltr')
      ctx.textAlign = rtl ? 'right' : 'left'
      ctx.fillText(name, rtl ? bx + bw - 30 : tx, KY + 84, bx + bw - tx - 24)
      setDir('ltr'); drawDots(tx + dotR, KY + 140)
      if (k.bestHabit?.title) {
        ctx.textAlign = 'left'; ctx.fillStyle = `${CI.ink}99`; ctx.font = f(800, 24)
        ctx.fillText(trimIf(ctx, `🌟 ${k.bestHabit.title}`, bx + bw - tx - (bw >= 700 ? 240 : 24)), tx, KY + 194)
      }
      // very wide tile (single child): big "habits done" counter on the far side
      if (bw >= 700 && (k.doneThisWeek || 0) > 0) {
        const sx = bx + bw - 130
        ctx.fillStyle = `${CI.yellow}33`; ctx.beginPath(); ctx.arc(sx, KY + KH / 2, 88, 0, Math.PI * 2); ctx.fill()
        ctx.textAlign = 'center'; ctx.fillStyle = CI.ink; ctx.font = f(900, 72); ctx.fillText(String(k.doneThisWeek), sx, KY + KH / 2 + 14)
        ctx.font = f(800, 22); ctx.fillStyle = `${CI.ink}99`; ctx.fillText(`✅ ${t('habits', lang)}`, sx, KY + KH / 2 + 50)
      }
    } else {
      ctx.fillStyle = CI.ink; ctx.font = f(900, bw > 300 ? 34 : 28); setDir(rtl ? 'rtl' : 'ltr')
      ctx.fillText(name, rx, KY + 176, bw - 20)
      setDir('ltr'); drawDots(rx - dotGap * 3, KY + 204)
    }
  })

  // ── TEXT: one highlight line from the AI note (≈9%)
  const QY = 1170
  ctx.fillStyle = CI.green; ctx.font = f(900, 120); setDir('ltr'); ctx.textAlign = rtl ? 'right' : 'left'
  ctx.fillText(rtl ? '”' : '“', rtl ? W - 40 : 40, QY + 72)
  setDir(rtl ? 'rtl' : 'ltr')
  ctx.fillStyle = CI.ink; ctx.font = f(700, 34)
  const qX = rtl ? W - 110 : 110, qW = W - 110 - 56
  const { lines } = wrap(ctx, highlightOf(text), qW, 2)
  lines.forEach((l, i) => ctx.fillText(l, qX, QY + 32 + i * 46))

  // ── Footer
  setDir('ltr'); ctx.textAlign = 'center'
  ctx.fillStyle = `${CI.ink}1A`; ctx.fillRect(56, H - 78, W - 112, 2)
  ctx.font = f(900, 28); const hostW = ctx.measureText(host).width
  ctx.font = f(700, 24); const tagW = ctx.measureText(`  ·  ${t('footer', lang)}`).width
  const fx = W / 2 - (hostW + tagW) / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = CI.ink; ctx.font = f(900, 28); ctx.fillText(host, fx, H - 34)
  ctx.fillStyle = `${CI.ink}88`; ctx.font = f(700, 24); ctx.fillText(`  ·  ${t('footer', lang)}`, fx + hostW, H - 34)
  return await new Promise(res => canvas.toBlob(b => res(b), 'image/png'))
}
const trimIf = (ctx, s, maxW) => (ctx.measureText(s).width <= maxW ? s : trimEllipsis(ctx, s, maxW))
