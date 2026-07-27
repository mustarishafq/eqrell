/**
 * Nature — procedural flora sprites that auto-fill grid cells adjacent to
 * buildings. Density and health depend on the child's demeritCount (light
 * level), per PRD §Cahaya:
 *   0 clouds → lush (all adjacent cells get flora, vibrant greens)
 *   1-2      → normal (~70% cells, healthy)
 *   3-4      → sparse (~40%, some brown patches)
 *   5+       → barren (~20%, mostly dried/withered)
 *
 * Kinds: 'grass' | 'flower' | 'bush' | 'sapling'
 * All rendered via Phaser Graphics API — no external assets.
 */

// Palette for healthy vs withered variants
const HEALTHY = {
  grassLight: 0x7cc47a,
  grassDark: 0x4a7c3a,
  flowerPink: 0xf25a8b,
  flowerYellow: 0xfacc15,
  flowerLavender: 0x9370db,
  bushGreen: 0x5d9c56,
  bushShade: 0x3d6b3b,
  saplingLeaf: 0x4a8b3d,
  saplingTrunk: 0x6b4a2a,
  stem: 0x3d6b3b,
}
const WITHERED = {
  grassLight: 0xa8a082,
  grassDark: 0x7a6f52,
  flowerPink: 0xa8836b,
  flowerYellow: 0xb59a5e,
  flowerLavender: 0x8a7a80,
  bushGreen: 0x8a7a52,
  bushShade: 0x6a5a3a,
  saplingLeaf: 0x8a7a52,
  saplingTrunk: 0x4a3a1a,
  stem: 0x6a5a3a,
}

/**
 * Deterministic pseudo-random from a cell coordinate — same cell always looks
 * the same across renders, avoiding flicker on state updates.
 */
const cellHash = (col, row, salt = 0) => {
  const n = col * 73856093 ^ row * 19349663 ^ salt * 83492791
  return ((n & 0x7fffffff) / 0x7fffffff)  // 0..1
}

/**
 * Draw a small flora sprite into a container at (0, 0).
 * Sprites scaled up ~2.2× so they're readable at typical isometric zoom.
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Container} container
 * @param {'grass'|'flower'|'bush'|'sapling'} kind
 * @param {boolean} withered
 * @param {number} seed - variation seed
 */
function drawFlora(scene, container, kind, withered, seed) {
  const P = withered ? WITHERED : HEALTHY
  const g = scene.add.graphics()
  const S = 2.2  // uniform scale multiplier for on-screen visibility

  switch (kind) {
    case 'grass': {
      // ── Category-based rendering (real sprites). 4 curated tufts with
      // WEIGHTED distribution (user: "terlalu ramai wheat"):
      //   leafy:  4/10 (40%) — dominant basic ground tuft
      //   tall:   3/10 (30%) — mixed height, common
      //   clover: 2/10 (20%) — broad-leaf variation
      //   wheat:  1/10 (10%) — rare accent (has tall seed heads, was over-common)
      const variants = [
        'leafy', 'leafy', 'leafy', 'leafy',
        'tall', 'tall', 'tall',
        'clover', 'clover',
        'wheat',
      ]
      const v = variants[Math.floor(seed * variants.length) % variants.length]
      const key = `grass_${v}_01`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)             // feet on ground
        img.setScale(0.55)                  // slightly smaller — ground layer
        if (seed > 0.5) img.setFlipX(true)
        if (withered) img.setTint(0xa08a70)
        container.add(img)
        break
      }
      // Fallback: procedural grass tuft (3-5 spike blades)
      const count = 3 + Math.floor(seed * 3)
      for (let i = 0; i < count; i++) {
        const bx = ((i - count / 2) * 2.5 + (seed - 0.5) * 3) * S
        const h = (4 + (seed * 3 + i) % 3) * S
        g.fillStyle(i % 2 === 0 ? P.grassLight : P.grassDark, 1)
        g.beginPath()
        g.moveTo(bx - 0.8 * S, 0)
        g.lineTo(bx + 0.8 * S, 0)
        g.lineTo(bx, -h)
        g.closePath()
        g.fillPath()
      }
      break
    }
    case 'flower': {
      // ── VERIFICATION: use actual flower_patch sprites (category-based).
      // Standard anchor: bottom-center (setOrigin 0.5, 1.0). No metadata
      // needed — flat category rule handles everything: same scale, same
      // shadow, same layer. Seed selects one of 4 curated colors.
      // TODO: after user approves, fold this into a proper CATEGORY_RULES
      // dispatcher (Step 1 of refactor).
      const colors = ['white', 'pink', 'yellow', 'purple']
      const c = colors[Math.floor(seed * 4) % 4]
      const key = `flower_patch_${c}_01`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)               // bottom-center standard
        img.setScale(0.65)                    // user: kecilkan, lebih subtle
        // Random flip for organic variety (asset symmetric enough)
        if (seed > 0.5) img.setFlipX(true)
        // Withered tint (kept — same procedural feel)
        if (withered) img.setTint(0xa08a70)
        container.add(img)
        break                                 // skip procedural drawing
      }
      // Fallback (asset failed to load): existing procedural flower
      g.fillStyle(P.stem, 1)
      g.fillRect(-0.6 * S, -6 * S, 1.2 * S, 6 * S)
      const colorsProc = [P.flowerPink, P.flowerYellow, P.flowerLavender]
      const petalColor = colorsProc[Math.floor(seed * colorsProc.length) % colorsProc.length]
      const centerY = -7 * S
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        g.fillStyle(petalColor, 1)
        g.fillCircle(Math.cos(a) * 1.8 * S, centerY + Math.sin(a) * 1.8 * S, 1.4 * S)
      }
      g.fillStyle(P.flowerYellow, 1)
      g.fillCircle(0, centerY, 1.2 * S)
      break
    }
    case 'bush': {
      // ── Category-based rendering (same pattern as flower_patch).
      // 4 curated bush variants — seed picks one deterministically so
      // rendering is stable per cell. Standard: bottom-center anchor,
      // scale 0.65 (matches flower subtlety), flip for organic variety.
      const variants = ['leafy', 'conical', 'flowering', 'rocky']
      const v = variants[Math.floor(seed * 4) % 4]
      const key = `bush_${v}_01`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)                 // feet on ground standard
        img.setScale(0.65)                      // matches flower_patch scale
        if (seed > 0.5) img.setFlipX(true)      // organic variety
        if (withered) img.setTint(0xa08a70)
        container.add(img)
        break
      }
      // Fallback (asset failed to load): existing procedural bush
      g.fillStyle(P.bushShade, 1)
      g.fillEllipse(-2 * S, -3 * S, 7 * S, 5 * S)
      g.fillEllipse(2 * S, -3 * S, 7 * S, 5 * S)
      g.fillStyle(P.bushGreen, 1)
      g.fillEllipse(0, -5 * S, 8 * S, 6 * S)
      g.fillStyle(P.grassLight, 0.6)
      g.fillCircle(-1 * S, -6 * S, 1.5 * S)
      break
    }
    case 'sapling': {
      g.fillStyle(P.saplingTrunk, 1)
      g.fillRect(-1 * S, -8 * S, 2 * S, 8 * S)
      g.fillStyle(P.saplingLeaf, 1)
      g.fillCircle(0, -10 * S, 5 * S)
      g.fillStyle(P.bushShade, 1)
      g.fillCircle(-2 * S, -9 * S, 3 * S)
      g.fillCircle(2 * S, -11 * S, 3 * S)
      g.fillStyle(P.grassLight, 0.5)
      g.fillCircle(-1 * S, -12 * S, 1.5 * S)
      break
    }
    default:
      break
  }
  container.add(g)

  // Ground shadow (scaled)
  const sh = scene.add.graphics()
  sh.fillStyle(0x000000, 0.22)
  sh.fillEllipse(0, 1 * S, 10 * S, 3.5 * S)
  container.addAt(sh, 0)
}

/**
 * Populate nature sprites into the scene, adjacent to any building.
 *
 * @param {Phaser.Scene} scene
 * @param {Array} buildings - from worldState.buildings
 * @param {number} demeritCount - light level driver
 * @param {object} coords - { originX, originY, TILE_W, TILE_H, WORLD_SIZE, gridToScreen, BUILDING_TEMPLATES, natureLayer, bounds }
 * @returns {Phaser.GameObjects.Container[]} — sprites drawn, for cleanup on next render
 */
export function renderNature(scene, buildings, demeritCount, coords) {
  const { originX, originY, TILE_W, TILE_H, WORLD_SIZE, gridToScreen, BUILDING_TEMPLATES, natureLayer, bounds } = coords
  // If dynamic bounds are supplied, use them; otherwise fall back to [0, WORLD_SIZE)
  const b = bounds || { minX: 0, minY: 0, maxX: WORLD_SIZE, maxY: WORLD_SIZE }
  // Wipe previous nature
  natureLayer.removeAll(true)

  // Determine density & health based on demerit
  let densityChance = 1.0
  let witheredChance = 0.0
  if (demeritCount === 0) { densityChance = 0.95; witheredChance = 0 }
  else if (demeritCount <= 2) { densityChance = 0.7; witheredChance = 0.1 }
  else if (demeritCount <= 4) { densityChance = 0.4; witheredChance = 0.5 }
  else                        { densityChance = 0.25; witheredChance = 0.85 }

  // Compute occupied set — includes Musalla's RESERVED 8×8 sacred zone so
  // flora never sprouts inside the waqaf land. User: "ada pokok2 tumbuh
  // belakang musalla, saya rasa itu kod lama". Root cause was Nature.js
  // only knew about tileSize (2×2 for musalla) not the reserved zone.
  const MUSALLA_RESERVED = { w: 8, h: 8 }
  const occupied = new Set()
  for (const b of buildings) {
    const t = BUILDING_TEMPLATES[b.templateId]
    const sz = b.templateId === 'musalla' ? MUSALLA_RESERVED : (t?.tileSize || { w: 1, h: 1 })
    for (let dx = 0; dx < sz.w; dx++) {
      for (let dy = 0; dy < sz.h; dy++) {
        occupied.add(`${b.x + dx},${b.y + dy}`)
      }
    }
  }

  // Find adjacent-to-building cells (8-neighbourhood ring).
  // MUSALLA IS EXCLUDED from adjacency seeding — the sacred zone stays
  // clean (no flora growing behind or around the mosque). Trees & bushes
  // still sprout around houses, orchards, farms as before.
  const adjacentCells = new Set()
  for (const b of buildings) {
    if (b.templateId === 'musalla') continue
    const t = BUILDING_TEMPLATES[b.templateId]
    const sz = t?.tileSize || { w: 1, h: 1 }
    for (let dx = -1; dx <= sz.w; dx++) {
      for (let dy = -1; dy <= sz.h; dy++) {
        // Skip cells that are the building itself
        if (dx >= 0 && dx < sz.w && dy >= 0 && dy < sz.h) continue
        const cx = b.x + dx, cy = b.y + dy
        if (cx < bounds?.minX || cx >= bounds?.maxX || cy < bounds?.minY || cy >= bounds?.maxY) {
          // if bounds unspecified, fall back to 0..WORLD_SIZE check
          if (!bounds && (cx < 0 || cx >= WORLD_SIZE || cy < 0 || cy >= WORLD_SIZE)) continue
          else if (bounds) continue
        }
        // Circular island — skip nature cells outside the round world.
        if (bounds?.center && bounds?.radius != null) {
          const rdx = cx - bounds.center.x + 0.5
          const rdy = cy - bounds.center.y + 0.5
          if ((rdx * rdx + rdy * rdy) > (bounds.radius + 0.5) * (bounds.radius + 0.5)) continue
        }
        if (occupied.has(`${cx},${cy}`)) continue
        adjacentCells.add(`${cx},${cy}`)
      }
    }
  }

  // Draw flora deterministically per cell.
  // Distribution weighting: expanded to 10 slots so ratios finer-grained.
  // - grass:   4/10 (40%) — dominant ground cover
  // - sapling: 3/10 (30%) — young trees, common
  // - bush:    2/10 (20%) — filler
  // - flower:  1/10 (10%) — RARE / premium accent (user: "kurangkan, lebih premium")
  const kinds = [
    'grass', 'grass', 'grass', 'grass',
    'sapling', 'sapling', 'sapling',
    'bush', 'bush',
    'flower',
  ]
  const sprites = []
  for (const key of adjacentCells) {
    const [col, row] = key.split(',').map(Number)
    // Skip: cell should render nature ONLY if hash < density
    const roll = cellHash(col, row, 1)
    if (roll > densityChance) continue

    const withered = cellHash(col, row, 2) < witheredChance
    const kindIdx = Math.floor(cellHash(col, row, 3) * kinds.length)
    const kind = kinds[kindIdx]

    const { x, y } = gridToScreen(col + 0.5, row + 0.5, originX, originY)
    // Slight jitter within the cell for organic feel
    const jx = (cellHash(col, row, 4) - 0.5) * (TILE_W * 0.3)
    const jy = (cellHash(col, row, 5) - 0.5) * (TILE_H * 0.3)
    const container = scene.add.container(x + jx, y + jy)
    // Depth so flora sits above ground grid but below buildings/villagers at same row
    container.setDepth(row + col - 0.5)
    drawFlora(scene, container, kind, withered, cellHash(col, row, 6))
    natureLayer.add(container)
    sprites.push(container)
  }
  return sprites
}
