/**
 * Villager v2 — cleaner cartoon Muslim characters.
 *
 * Improvements vs v1:
 *   - Visible feet at container Y=0 (feet touch the ground, not floating)
 *   - Directional facing: when walking north/west (away from camera), the face
 *     is hidden and a "back of head" tone is shown — much more natural
 *   - Idle vs walking state — most villagers stand still, only some walk
 *   - Clean silhouette: smaller & tighter proportions, no arm rectangles
 *     jutting out (arms are drawn as small sway blobs inside the body outline)
 *
 * Kinds: adult_male, adult_female, boy, girl, elder_male, elder_female
 * All Syariah-compliant: females covered with hijab + long dress, males with kopiah/thawb.
 */

const SKIN_TONES = [0xf3d1b0, 0xe6b58a, 0xc79671, 0xa07350]

const HIJAB_COLORS = [
  0x2e7d5b, 0x0d5b4e, 0x8b6f47, 0xa0525a, 0x5b6ba0, 0x6a4f7a, 0xf0e8d8,
]
const ROBE_MALE = [0xf5f0e6, 0xd4c9a8, 0xc9a86a, 0x8b6f47, 0xffffff]
const ROBE_FEMALE = [0x2e7d5b, 0x0d5b4e, 0x5b6ba0, 0x6a4f7a, 0x8b3a4a, 0x3d5a4a, 0x2a2a2a]
const KOPIAH = [0xffffff, 0x0d5b4e, 0x1a2a4a, 0x8b1a1a, 0x2e2e2e]

const pick = (arr, seed) => arr[Math.abs(Math.floor(seed)) % arr.length]

const darken = (hex, amt) => {
  const r = ((hex >> 16) & 0xff) * (1 - amt)
  const g = ((hex >> 8) & 0xff) * (1 - amt)
  const b = (hex & 0xff) * (1 - amt)
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b)
}

/**
 * Create a villager sprite container.
 * Feet sit at container Y=0. Total height ~40px for adults, ~30px for kids.
 *
 * FUTURE: To swap procedural sprites for custom PNG artwork, provide
 *   opts.spriteKey = 'villager_male_front' (a Phaser image key preloaded in
 *   scene.preload()). The container will use `scene.add.image(...)` instead
 *   of the procedural graphics. Everything else (walk animation, facing,
 *   collision) continues to work unchanged.
 */
export function createVillager(scene, x, y, opts = {}) {
  const { kind = 'adult_male', seed = Math.random() * 1000, spriteKey = null } = opts

  const container = scene.add.container(x, y)
  container.kind = kind
  container.seed = seed

  const isKid = kind === 'boy' || kind === 'girl'
  const isFemale = kind === 'adult_female' || kind === 'girl' || kind === 'elder_female'
  const isElder = kind === 'elder_male' || kind === 'elder_female'

  // ─── PNG asset path (future) ────────────────────────────
  // If a spriteKey is provided and the texture is loaded, use it instead of
  // procedural drawing. Assumes the PNG is designed with feet at the bottom.
  if (spriteKey && scene.textures.exists(spriteKey)) {
    const img = scene.add.image(0, -12, spriteKey).setOrigin(0.5, 1)
    container.add(img)
    // Simple face/back toggle uses whole-image opacity/flip for MVP
    container.parts = {
      face: img, headFront: img,
      backHead: img, leftArm: img, rightArm: img, shadow: img, feet: img,
    }
    container.isKid = isKid
    container.isFemale = isFemale
    container._facingBack = false
    container.setDepth(9000 + Math.floor(y))
    return container
  }

  // ─── Procedural draw (default) ──────────────────────────
  const s = isKid ? 0.7 : 1.0

  // Dimensions relative to Y=0 (feet). Everything drawn ABOVE ground.
  const FOOT_H = 3
  const BODY_H = 20 * s
  const BODY_W_TOP = 12 * s
  const BODY_W_BOT = (isFemale ? 16 : 13) * s
  const HEAD_R = 5.5 * s

  // Y positions (all negative because we go UP from feet at 0)
  const feetY = 0
  const bodyBottom = -FOOT_H
  const bodyTop = bodyBottom - BODY_H
  const neckY = bodyTop
  const headCY = neckY - HEAD_R + 1

  // Colours
  const skin = pick(SKIN_TONES, seed)
  const skinShade = darken(skin, 0.18)
  const robeColor = isFemale ? pick(ROBE_FEMALE, seed + 3) : pick(ROBE_MALE, seed + 5)
  const robeShade = darken(robeColor, 0.2)
  const hijabColor = pick(HIJAB_COLORS, seed + 7)
  const hijabShade = darken(hijabColor, 0.2)
  const kopiahColor = isElder ? 0xffffff : pick(KOPIAH, seed + 9)

  // ─── Ground shadow (elliptical, below feet) ──────────────
  // Shadow drifts to the bottom-LEFT of the villager to match the world's
  // top-right sun (see LIGHT_SOURCE convention in WorldScene.js).
  const shadow = scene.add.graphics()
  shadow.fillStyle(0x000000, 0.32)
  shadow.fillEllipse(-6 * s, 2 * s, 18 * s, 5 * s)
  container.add(shadow)

  // ─── Feet (two small dark shoes at ground) ───────────────
  const feet = scene.add.graphics()
  feet.fillStyle(0x2a1e14, 1)
  feet.fillEllipse(-2.5 * s, feetY - 1, 3.5 * s, 2.5 * s)
  feet.fillEllipse(2.5 * s, feetY - 1, 3.5 * s, 2.5 * s)
  container.add(feet)

  // ─── Body: A-line robe (trapezoid) ───────────────────────
  const body = scene.add.graphics()
  // Left half (darker)
  body.fillStyle(robeShade, 1)
  body.beginPath()
  body.moveTo(-BODY_W_TOP / 2, bodyTop)
  body.lineTo(-BODY_W_BOT / 2, bodyBottom)
  body.lineTo(0, bodyBottom)
  body.lineTo(0, bodyTop)
  body.closePath(); body.fillPath()
  // Right half (lighter)
  body.fillStyle(robeColor, 1)
  body.beginPath()
  body.moveTo(0, bodyTop)
  body.lineTo(BODY_W_TOP / 2, bodyTop)
  body.lineTo(BODY_W_BOT / 2, bodyBottom)
  body.lineTo(0, bodyBottom)
  body.closePath(); body.fillPath()
  // Waist belt (males only) — subtle line
  if (!isFemale) {
    body.lineStyle(1 * s, darken(robeColor, 0.35), 0.55)
    body.beginPath()
    body.moveTo(-BODY_W_TOP / 2 * 0.85, bodyTop + BODY_H * 0.5)
    body.lineTo(BODY_W_TOP / 2 * 0.85, bodyTop + BODY_H * 0.5)
    body.strokePath()
  }
  container.add(body)

  // ─── Arms — small circles at shoulders, sway via tween ───
  const armY = bodyTop + 3 * s
  const leftArm = scene.add.graphics()
  leftArm.fillStyle(robeShade, 1)
  leftArm.fillCircle(0, 0, 2.2 * s)
  leftArm.x = -BODY_W_TOP / 2 - 0.5 * s
  leftArm.y = armY
  container.add(leftArm)
  const rightArm = scene.add.graphics()
  rightArm.fillStyle(robeColor, 1)
  rightArm.fillCircle(0, 0, 2.2 * s)
  rightArm.x = BODY_W_TOP / 2 + 0.5 * s
  rightArm.y = armY
  container.add(rightArm)

  // ─── Hijab drape over shoulders (female, drawn BEHIND head) ──
  if (isFemale) {
    const drape = scene.add.graphics()
    drape.fillStyle(hijabShade, 1)
    // Wide fabric across shoulders
    drape.fillEllipse(0, bodyTop + 1, (BODY_W_TOP + 6) * s, 5 * s)
    container.add(drape)
  }

  // ─── Head (skin) — this is the FRONT face base ───────────
  const headFront = scene.add.graphics()
  headFront.fillStyle(skin, 1)
  headFront.fillCircle(0, headCY, HEAD_R)
  // Small neck bit
  headFront.fillStyle(skinShade, 0.8)
  headFront.fillRect(-1.5 * s, headCY + HEAD_R - 1, 3 * s, 2)
  container.add(headFront)

  // ─── Face features (eyes + smile) — hidden when back-facing ──
  const face = scene.add.graphics()
  face.fillStyle(0x1a1a1a, 1)
  face.fillCircle(-1.7 * s, headCY - 0.4, 0.9 * s)
  face.fillCircle(1.7 * s, headCY - 0.4, 0.9 * s)
  face.lineStyle(0.9 * s, 0x1a1a1a, 0.85)
  face.beginPath()
  face.arc(0, headCY + 1.6 * s, 1.4 * s, 0.2 * Math.PI, 0.8 * Math.PI)
  face.strokePath()
  container.add(face)

  // Beard for elder male / occasional adult
  if (kind === 'elder_male' || (kind === 'adult_male' && Math.floor(seed) % 3 === 0)) {
    const beard = scene.add.graphics()
    beard.fillStyle(isElder ? 0xdadada : 0x3a2818, 0.9)
    beard.fillEllipse(0, headCY + HEAD_R * 0.5, HEAD_R * 1.4, HEAD_R * 0.9)
    container.add(beard)
  }

  // ─── Head covering ──
  if (isFemale) {
    // Hijab crown — covers head above face, drawn AFTER head-front so it
    // sits on top; then a "face oval" cut is drawn on top of hijab so face
    // remains visible.
    const hijab = scene.add.graphics()
    hijab.fillStyle(hijabColor, 1)
    hijab.fillCircle(0, headCY - 0.6, HEAD_R * 1.25)
    // Face oval (skin) — smaller than hijab to leave a hijab frame
    hijab.fillStyle(skin, 1)
    hijab.fillEllipse(0, headCY + 0.5, HEAD_R * 1.15, HEAD_R * 1.4)
    container.add(hijab)
    // Bring face features back to top (redraw face)
    container.bringToTop(face)
  } else {
    // Male: kopiah / songkok — small dome on top of head
    const cap = scene.add.graphics()
    cap.fillStyle(kopiahColor, 1)
    cap.fillEllipse(0, headCY - HEAD_R + 1, HEAD_R * 1.9, HEAD_R * 1.05)
    cap.fillStyle(darken(kopiahColor, 0.2), 1)
    cap.fillRect(-HEAD_R * 0.95, headCY - HEAD_R + 1.3, HEAD_R * 1.9, 1)
    container.add(cap)
  }

  // ─── Back-of-head sprite (initially hidden) ──────────────
  // Shown when the villager walks north/west (away from camera).
  const backHead = scene.add.graphics()
  if (isFemale) {
    // Hijab back — just the coloured circle without face
    backHead.fillStyle(hijabColor, 1)
    backHead.fillCircle(0, headCY - 0.3, HEAD_R * 1.28)
    backHead.fillStyle(hijabShade, 1)
    backHead.fillEllipse(0, headCY + 1, HEAD_R * 0.9, HEAD_R * 1.0)
  } else {
    // Male back-of-head — skin + kopiah, no face features
    backHead.fillStyle(skin, 1)
    backHead.fillCircle(0, headCY, HEAD_R)
    backHead.fillStyle(kopiahColor, 1)
    backHead.fillEllipse(0, headCY - HEAD_R + 1, HEAD_R * 1.9, HEAD_R * 1.05)
    if (kind === 'elder_male' || Math.floor(seed) % 3 === 0) {
      // Small tuft of hair/nape shadow
      backHead.fillStyle(0x3a2818, 0.6)
      backHead.fillRect(-HEAD_R * 0.6, headCY + HEAD_R * 0.4, HEAD_R * 1.2, 1.2)
    }
  }
  backHead.setVisible(false)
  container.add(backHead)

  // Refs for animation + direction switching
  container.parts = { face, headFront, backHead, leftArm, rightArm, shadow, feet }
  container.isKid = isKid
  container.isFemale = isFemale
  container._facingBack = false

  // Depth so villagers occlude in front of things behind them
  container.setDepth(9000 + Math.floor(y))

  return container
}

/**
 * Set the villager's facing (front or back) — swaps face visibility.
 * @param {'front'|'back'} dir
 */
export function setFacing(villager, dir) {
  if (!villager?.parts) return
  const isBack = dir === 'back'
  if (villager._facingBack === isBack) return
  villager._facingBack = isBack
  villager.parts.face.setVisible(!isBack)
  villager.parts.headFront.setVisible(!isBack)
  villager.parts.backHead.setVisible(isBack)
}

/**
 * Attach a gentle walking bob + arm sway. Idempotent.
 */
export function attachWalkAnimation(scene, villager) {
  if (!villager || villager._walkTween) return
  villager._walkTween = scene.tweens.add({
    targets: villager,
    scaleY: { from: 1.0, to: 0.94 },
    duration: 260,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
  if (villager.parts?.leftArm) {
    villager._armTweenL = scene.tweens.add({
      targets: villager.parts.leftArm,
      y: { from: villager.parts.leftArm.y, to: villager.parts.leftArm.y + 1.5 },
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    villager._armTweenR = scene.tweens.add({
      targets: villager.parts.rightArm,
      y: { from: villager.parts.rightArm.y + 1.5, to: villager.parts.rightArm.y },
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }
}

export function stopWalkAnimation(villager) {
  villager?._walkTween?.stop?.()
  villager?._armTweenL?.stop?.()
  villager?._armTweenR?.stop?.()
  villager._walkTween = null
  villager._armTweenL = null
  villager._armTweenR = null
  if (villager) villager.scaleY = 1
}

// Villager kind pool — mixed family, weighted toward adults & kids
export const VILLAGER_KIND_POOL = [
  'adult_male', 'adult_female',
  'boy', 'girl',
  'adult_male', 'adult_female',
  'elder_male', 'elder_female',
]
