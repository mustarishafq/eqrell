/**
 * Villager — procedural cartoon Muslim character sprite factory.
 *
 * Draws Syariah-compliant villagers using Phaser Graphics API only (no assets).
 * Cartoon-general style, aligned with EQrel CI (emerald/amber/warm neutrals).
 *
 * Kinds:
 *   'adult_male'   — thawb (long white robe) + kopiah/songkok
 *   'adult_female' — abaya + hijab covering hair + neck
 *   'boy'          — short thawb + kopiah, smaller scale
 *   'girl'         — dress + mini hijab, smaller scale
 *   'elder_male'   — white robe + white cap + grey beard
 *   'elder_female' — grey/dark abaya + grey hijab
 *
 * Each returns a Phaser.Container centred on ground (feet at y=0 of container).
 * Container carries a `walk()` helper for gentle bobbing animation.
 */

// EQrel-aligned palette — soft, cartoon-friendly
const SKIN_TONES = [0xf3d1b0, 0xe6b58a, 0xc79671, 0xa07350]
const HIJAB_COLORS = [
  0x2e7d5b, // eqrel emerald
  0x0d5b4e, // deep teal
  0x8b6f47, // warm sand
  0xa0525a, // rose
  0x5b6ba0, // dusk blue
  0x6a4f7a, // aubergine
  0xffffff, // pearl white
]
const ROBE_COLORS_MALE = [
  0xffffff, // white thawb
  0xf5f0e6, // ivory
  0xd4c9a8, // sand
  0xc9a86a, // amber-tan
  0x8b6f47, // warm brown
]
const ROBE_COLORS_FEMALE = [
  0x2e7d5b, 0x0d5b4e, 0x5b6ba0, 0x6a4f7a, 0x8b3a4a, 0x3d5a4a, 0x2a2a2a,
]
const KOPIAH_COLORS = [0xffffff, 0x0d5b4e, 0x1a2a4a, 0x8b1a1a] // white, green, navy, maroon

// Deterministic pick helper — uses a seed so villagers stay visually stable across re-renders
const pickFrom = (arr, seed) => arr[Math.abs(Math.floor(seed)) % arr.length]

/**
 * Create a villager sprite container.
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y - ground y position (feet)
 * @param {object} opts - { kind, seed }
 * @returns {Phaser.GameObjects.Container}
 */
export function createVillager(scene, x, y, opts = {}) {
  const { kind = 'adult_male', seed = Math.random() * 1000 } = opts

  const container = scene.add.container(x, y)
  container.kind = kind
  container.seed = seed

  // Scale factor per kind
  const isKid = kind === 'boy' || kind === 'girl'
  const scale = isKid ? 0.72 : 1.0
  const isFemale = kind === 'adult_female' || kind === 'girl' || kind === 'elder_female'
  const isElder = kind === 'elder_male' || kind === 'elder_female'

  // Base dimensions (unscaled)
  const H_HEAD = 12
  const W_HEAD = 12
  const H_BODY = 22
  const W_BODY = 18
  const shoulderY = -H_BODY                 // top of body
  const headCenterY = shoulderY - H_HEAD / 2 - 1

  // Colors
  const skin = pickFrom(SKIN_TONES, seed)
  const skinShade = darkenColor(skin, 0.12)
  const robeColor = isFemale
    ? pickFrom(ROBE_COLORS_FEMALE, seed + 3)
    : pickFrom(ROBE_COLORS_MALE, seed + 5)
  const robeShade = darkenColor(robeColor, 0.15)
  const hijabColor = pickFrom(HIJAB_COLORS, seed + 7)
  const hijabShade = darkenColor(hijabColor, 0.15)
  const kopiahColor = isElder ? 0xffffff : pickFrom(KOPIAH_COLORS, seed + 9)

  // ─── Shadow (elliptical ground shadow) ─────────────────
  const shadow = scene.add.graphics()
  shadow.fillStyle(0x000000, 0.28)
  shadow.fillEllipse(0, 0, 22 * scale, 7 * scale)
  container.add(shadow)

  // ─── Body / robe ───────────────────────────────────────
  const body = scene.add.graphics()
  // Robe body: trapezoid wider at bottom (like an A-line dress/thawb)
  const bodyTopW = W_BODY * scale
  const bodyBotW = (isFemale ? W_BODY + 8 : W_BODY + 3) * scale
  const bodyH = H_BODY * scale
  const bodyTop = shoulderY * scale
  const bodyBot = 0
  // Left side gradient (darker for depth)
  body.fillStyle(robeShade, 1)
  body.beginPath()
  body.moveTo(-bodyTopW / 2, bodyTop)
  body.lineTo(-bodyBotW / 2, bodyBot)
  body.lineTo(0, bodyBot)
  body.lineTo(0, bodyTop)
  body.closePath()
  body.fillPath()
  // Right side (lighter)
  body.fillStyle(robeColor, 1)
  body.beginPath()
  body.moveTo(0, bodyTop)
  body.lineTo(bodyTopW / 2, bodyTop)
  body.lineTo(bodyBotW / 2, bodyBot)
  body.lineTo(0, bodyBot)
  body.closePath()
  body.fillPath()

  // Belt line for males (thawb waistband)
  if (!isFemale) {
    body.lineStyle(1.5 * scale, darkenColor(robeColor, 0.35), 0.6)
    body.beginPath()
    body.moveTo(-bodyTopW / 2 * 0.9, bodyTop + bodyH * 0.55)
    body.lineTo(bodyTopW / 2 * 0.9, bodyTop + bodyH * 0.55)
    body.strokePath()
  }
  container.add(body)

  // ─── Arms (small sway-able rectangles, saved as refs for walk anim) ──
  const leftArm = scene.add.graphics()
  leftArm.fillStyle(robeShade, 1)
  leftArm.fillRoundedRect(-bodyTopW / 2 - 3 * scale, bodyTop + 1, 5 * scale, bodyH * 0.6, 2)
  container.add(leftArm)

  const rightArm = scene.add.graphics()
  rightArm.fillStyle(robeColor, 1)
  rightArm.fillRoundedRect(bodyTopW / 2 - 2 * scale, bodyTop + 1, 5 * scale, bodyH * 0.6, 2)
  container.add(rightArm)

  // ─── Female: hijab drape over shoulders (behind head) ──
  if (isFemale) {
    const drape = scene.add.graphics()
    drape.fillStyle(hijabShade, 1)
    // Wide drape covering neck + upper shoulders — soft rounded shape
    drape.fillEllipse(0, bodyTop + 2, (W_HEAD + 12) * scale, (H_HEAD + 4) * scale)
    // Front drape rectangle
    drape.fillStyle(hijabColor, 1)
    drape.fillRoundedRect(-(W_HEAD + 8) * scale / 2, bodyTop - 2, (W_HEAD + 8) * scale, 8 * scale, 3)
    container.add(drape)
  }

  // ─── Head ──────────────────────────────────────────────
  const head = scene.add.graphics()
  head.fillStyle(skin, 1)
  const headR = (W_HEAD / 2) * scale
  head.fillCircle(0, headCenterY * scale, headR)
  // Neck shading tiny arc
  head.fillStyle(skinShade, 0.7)
  head.fillRect(-3 * scale, (headCenterY + headR * 0.65) * scale, 6 * scale, 3 * scale)
  container.add(head)

  // ─── Face (simple: two eye dots + smile) ───────────────
  const face = scene.add.graphics()
  const eyeY = (headCenterY - 0.5) * scale
  const eyeSpacing = 3 * scale
  const eyeR = 1.2 * scale
  face.fillStyle(0x1a1a1a, 1)
  face.fillCircle(-eyeSpacing, eyeY, eyeR)
  face.fillCircle(eyeSpacing, eyeY, eyeR)
  // Smile arc — small line
  face.lineStyle(1 * scale, 0x1a1a1a, 0.9)
  face.beginPath()
  face.arc(0, eyeY + 3 * scale, 2 * scale, 0.2 * Math.PI, 0.8 * Math.PI)
  face.strokePath()
  container.add(face)

  // ─── Beard for elder/adult male (subtle) ───────────────
  if (kind === 'elder_male' || (kind === 'adult_male' && seed % 3 < 1)) {
    const beard = scene.add.graphics()
    const beardColor = isElder ? 0xd8d8d8 : 0x3a2a1a
    beard.fillStyle(beardColor, 0.9)
    // Rounded chin beard
    beard.fillEllipse(0, (headCenterY + headR * 0.4) * scale, headR * 1.6, headR * 1.1)
    container.add(beard)
  }

  // ─── Headwear ──────────────────────────────────────────
  if (kind === 'adult_male' || kind === 'boy' || kind === 'elder_male') {
    // Kopiah / songkok — small dome
    const cap = scene.add.graphics()
    cap.fillStyle(kopiahColor, 1)
    // Dome sits on top of head
    const capY = (headCenterY - headR + 1) * scale
    cap.fillEllipse(0, capY, headR * 1.9, headR * 1.1)
    // Flat brim for songkok look
    cap.fillStyle(darkenColor(kopiahColor, 0.15), 1)
    cap.fillRect(-headR * 0.9, capY + 1, headR * 1.8, 1.5 * scale)
    container.add(cap)
  } else if (isFemale) {
    // Hijab — covers head from crown down to chin sides, leaves face visible
    const hijab = scene.add.graphics()
    hijab.fillStyle(hijabColor, 1)
    // Main crown arc — larger than head, framing the face
    const hR = headR * 1.35
    hijab.fillCircle(0, headCenterY * scale, hR)
    // Cut out face oval (draw skin oval OVER the hijab in face area)
    const faceCut = scene.add.graphics()
    faceCut.fillStyle(skin, 1)
    faceCut.fillEllipse(0, (headCenterY + 1) * scale, headR * 1.35, headR * 1.55)
    // Order: hijab -> faceCut -> head-face already added. We add hijab BELOW head layer.
    // To achieve that, we need to add hijab BEFORE head, but at this point head is already there.
    // Workaround: move hijab and drape to bottom of face group.
    container.addAt(hijab, container.list.indexOf(head))
    container.addAt(faceCut, container.list.indexOf(head))
    // Fringe accent (subtle darker edge on side)
    const fringe = scene.add.graphics()
    fringe.fillStyle(hijabShade, 1)
    fringe.fillEllipse(headR * 0.7, headCenterY * scale, headR * 0.7, headR * 1.1)
    container.addAt(fringe, container.list.indexOf(hijab) + 1)
  }

  // Refs for animation
  container.parts = { body, head, face, leftArm, rightArm, shadow }
  container.walkPhase = Math.random() * Math.PI * 2

  return container
}

// Darken a hex color by amount (0-1)
function darkenColor(hex, amount) {
  const r = ((hex >> 16) & 0xff) * (1 - amount)
  const g = ((hex >> 8) & 0xff) * (1 - amount)
  const b = (hex & 0xff) * (1 - amount)
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b)
}

/**
 * Attach a walking bob tween to a villager container.
 * Call whenever the villager starts moving. Stops when tween completes.
 */
export function attachWalkAnimation(scene, villager) {
  if (!villager || villager._walkTween) return
  // Vertical bob — small hop every step
  villager._walkTween = scene.tweens.add({
    targets: villager,
    scaleY: { from: 1.0, to: 0.94 },
    duration: 300,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })
  // Arm sway (opposite phase)
  if (villager.parts?.leftArm && villager.parts?.rightArm) {
    villager._armTweenL = scene.tweens.add({
      targets: villager.parts.leftArm,
      rotation: { from: -0.2, to: 0.2 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    villager._armTweenR = scene.tweens.add({
      targets: villager.parts.rightArm,
      rotation: { from: 0.2, to: -0.2 },
      duration: 300,
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
  villager.scaleY = 1
  if (villager.parts?.leftArm) villager.parts.leftArm.rotation = 0
  if (villager.parts?.rightArm) villager.parts.rightArm.rotation = 0
}

// Convenience: pick a kind based on family composition
export const VILLAGER_KIND_POOL = [
  'adult_male', 'adult_female',
  'boy', 'girl',
  'adult_male', 'adult_female',
  'elder_male', 'elder_female',
  'boy', 'girl',
]
