/**
 * Bubble — small floating dialog above a villager for Islamic greetings/dhikr.
 * Renders a rounded pill with text; auto-fades after `duration` ms.
 */

// Palette by category
const BUBBLE_STYLES = {
  greeting: { bg: 0xffffff, text: '#0d5b4e', border: 0x2e7d5b },
  dhikr:    { bg: 0xfff8e6, text: '#8b6f14', border: 0xfacc15 },
  reply:    { bg: 0xe8f5ee, text: '#0d5b4e', border: 0x6db07f },
  chat:     { bg: 0xf3ecff, text: '#4a3a7a', border: 0x8b7bb0 },
}

/**
 * Show a text bubble above a target Phaser Container (typically a villager).
 * Follows the target for its lifetime.
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Container} target
 * @param {string} text
 * @param {object} opts { style: 'greeting'|'dhikr'|'reply'|'chat', duration }
 */
export function showBubble(scene, target, text, opts = {}) {
  if (!target?.active) return
  const { style = 'dhikr', duration = 2400 } = opts
  const s = BUBBLE_STYLES[style] || BUBBLE_STYLES.dhikr

  // Text object — measure first so we can size the background
  const txt = scene.add.text(0, 0, text, {
    fontFamily: 'system-ui, "Segoe UI", sans-serif',
    fontSize: '11px',
    color: s.text,
    fontStyle: 'bold',
  }).setOrigin(0.5, 0.5)

  const padX = 7, padY = 4
  const bw = txt.width + padX * 2
  const bh = txt.height + padY * 2

  const bg = scene.add.graphics()
  bg.fillStyle(s.bg, 0.96)
  bg.lineStyle(1.2, s.border, 1)
  bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6)
  bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 6)
  // Tail (small triangle pointing down toward villager head)
  bg.fillStyle(s.bg, 0.96)
  bg.fillTriangle(-3, bh / 2 - 0.5, 3, bh / 2 - 0.5, 0, bh / 2 + 4)
  bg.lineStyle(1.2, s.border, 1)
  bg.beginPath()
  bg.moveTo(-3, bh / 2 - 0.5)
  bg.lineTo(0, bh / 2 + 4)
  bg.lineTo(3, bh / 2 - 0.5)
  bg.strokePath()

  const bubble = scene.add.container(target.x, target.y - 42, [bg, txt])
  bubble.setDepth(20000)  // always on top
  bubble.alpha = 0
  bubble.scaleX = 0.4; bubble.scaleY = 0.4

  // Follow target
  const follow = scene.time.addEvent({
    delay: 30, loop: true,
    callback: () => {
      if (!bubble.active || !target.active) { follow.remove(); return }
      bubble.x = target.x
      bubble.y = target.y - 42
    },
  })

  // Pop in
  scene.tweens.add({
    targets: bubble, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 220, ease: 'Back.easeOut',
  })

  // Pop out then destroy
  scene.time.delayedCall(duration, () => {
    if (!bubble.active) return
    scene.tweens.add({
      targets: bubble, alpha: 0, scaleY: 0.5, y: bubble.y - 6,
      duration: 300, ease: 'Sine.easeIn',
      onComplete: () => {
        follow?.remove?.()
        try { bubble.destroy() } catch { /* teardown */ }
      },
    })
  })

  return bubble
}

// ─── Bubble content pools (per language) ───────────────────────
// Pools are keyed by lang code (ms/en/id/ar). `pickBubbleByLang(pool, lang)`
// falls back to Malay ('ms') if a language is missing.

export const GREETINGS = {
  ms: ['Assalamualaikum 🤝', 'السلام عليكم', 'Salam kasih 🌙'],
  en: ['Peace be upon you 🤝', 'Assalamu alaikum', 'Salam brother 🌙'],
  id: ['Assalamualaikum 🤝', 'السلام عليكم', 'Salam 🌙'],
  ar: ['السلام عليكم', 'السلام عليكم ورحمة الله', '🌙 السلام عليكم'],
}

export const GREETING_REPLIES = {
  ms: ['Waalaikumsalam 🌸', 'وعليكم السلام', 'Waalaikumsalam wbt 🌷'],
  en: ['And peace upon you 🌸', 'Waalaikumsalam', 'Peace to you too 🌷'],
  id: ['Waalaikumsalam 🌸', 'وعليكم السلام', 'Salam kembali 🌷'],
  ar: ['وعليكم السلام', 'وعليكم السلام ورحمة الله وبركاته', '🌷 وعليكم السلام'],
}

export const DHIKR_POOL = {
  ms: ['MashaAllah ✨', 'Alhamdulillah 🌿', 'SubhanAllah 💚', 'Barakallah 🤲', 'Allahu Akbar 🌟', 'La ilaha illallah'],
  en: ['MashaAllah ✨', 'Alhamdulillah 🌿', 'SubhanAllah 💚', 'Barakallah 🤲', 'Allahu Akbar 🌟', 'Praise be to Allah 🌿'],
  id: ['MashaAllah ✨', 'Alhamdulillah 🌿', 'SubhanAllah 💚', 'Barakallah 🤲', 'Allahu Akbar 🌟', 'La ilaha illallah'],
  ar: ['ما شاء الله ✨', 'الحمد لله 🌿', 'سبحان الله 💚', 'بارك الله 🤲', 'الله أكبر 🌟', 'لا إله إلا الله'],
}

export const ARRIVAL_DHIKR = {
  musalla: {
    ms: ['🕌 Bismillah', 'Ke Musalla 🤲', 'Solat dulu 🕌', 'Zikir sikit 📿'],
    en: ['🕌 Bismillah', 'To the Musalla 🤲', 'Prayer time 🕌', 'A little dhikr 📿'],
    id: ['🕌 Bismillah', 'Ke Musalla 🤲', 'Sholat dulu 🕌', 'Zikir sebentar 📿'],
    ar: ['🕌 بسم الله', 'إلى المصلى 🤲', 'وقت الصلاة 🕌', 'ذكر قليل 📿'],
  },
  house: {
    ms: ['Balik rumah 🏠', 'Baiti Jannati 🏡', 'Bersama keluarga 👨‍👩‍👧', 'Rehat sekejap ☕'],
    en: ['Heading home 🏠', 'Baiti Jannati 🏡', 'With family 👨‍👩‍👧', 'Rest a while ☕'],
    id: ['Pulang rumah 🏠', 'Baiti Jannati 🏡', 'Bersama keluarga 👨‍👩‍👧', 'Istirahat sebentar ☕'],
    ar: ['إلى البيت 🏠', 'بيتي جنتي 🏡', 'مع العائلة 👨‍👩‍👧', 'استراحة قصيرة ☕'],
  },
  orchard: {
    ms: ['Tanam kurma 🌴', 'Kebun berkat 🍇', 'Ihsan pada tanah 🌱', 'Rezeki Allah 🌾'],
    en: ['Planting dates 🌴', 'Blessed grove 🍇', 'Care for the earth 🌱', 'Allah\'s bounty 🌾'],
    id: ['Menanam kurma 🌴', 'Kebun berkah 🍇', 'Ihsan pada tanah 🌱', 'Rezeki Allah 🌾'],
    ar: ['غرس النخيل 🌴', 'بستان مبارك 🍇', 'إحسان للأرض 🌱', 'رزق الله 🌾'],
  },
}

// Adhan announcement bubble at prayer-time gather
export const ADHAN_BUBBLE = {
  ms: 'Adhan 🕌',
  en: 'Adhan 🕌',
  id: 'Adzan 🕌',
  ar: 'الأذان 🕌',
}

// Pick a random string from an array
export const pickBubble = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Pick from a language-keyed pool with graceful fallback to Malay
export const pickBubbleByLang = (pool, lang = 'ms') => {
  const arr = pool?.[lang] || pool?.ms || Object.values(pool || {})[0] || []
  if (!arr.length) return ''
  return arr[Math.floor(Math.random() * arr.length)]
}
