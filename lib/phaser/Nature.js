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
      // 3-5 tufts of grass blades — small triangular spikes
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
      // Grass tuft base + one flower head
      g.fillStyle(P.stem, 1)
      g.fillRect(-0.6 * S, -6 * S, 1.2 * S, 6 * S)
      const colors = [P.flowerPink, P.flowerYellow, P.flowerLavender]
      const petalColor = colors[Math.floor(seed * colors.length) % colors.length]
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
 * @param {object} coords - { originX, originY, TILE_W, TILE_H, WORLD_SIZE, gridToScreen, BUILDING_TEMPLATES, natureLayer }
 * @returns {Phaser.GameObjects.Container[]} — sprites drawn, for cleanup on next render
 */
export function renderNature(scene, buildings, demeritCount, coords) {
  const { originX, originY, TILE_W, TILE_H, WORLD_SIZE, gridToScreen, BUILDING_TEMPLATES, natureLayer } = coords
  // Wipe previous nature
  natureLayer.removeAll(true)

  // Determine density & health based on demerit
  let densityChance = 1.0
  let witheredChance = 0.0
  if (demeritCount === 0) { densityChance = 0.95; witheredChance = 0 }
  else if (demeritCount <= 2) { densityChance = 0.7; witheredChance = 0.1 }
  else if (demeritCount <= 4) { densityChance = 0.4; witheredChance = 0.5 }
  else                        { densityChance = 0.25; witheredChance = 0.85 }

  // Compute occupied set
  const occupied = new Set()
  for (const b of buildings) {
    const t = BUILDING_TEMPLATES[b.templateId]
    const sz = t?.tileSize || { w: 1, h: 1 }
    for (let dx = 0; dx < sz.w; dx++) {
      for (let dy = 0; dy < sz.h; dy++) {
        occupied.add(`${b.x + dx},${b.y + dy}`)
      }
    }
  }

  // Find adjacent-to-building cells (8-neighbourhood ring)
  const adjacentCells = new Set()
  for (const b of buildings) {
    const t = BUILDING_TEMPLATES[b.templateId]
    const sz = t?.tileSize || { w: 1, h: 1 }
    for (let dx = -1; dx <= sz.w; dx++) {
      for (let dy = -1; dy <= sz.h; dy++) {
        // Skip cells that are the building itself
        if (dx >= 0 && dx < sz.w && dy >= 0 && dy < sz.h) continue
        const cx = b.x + dx, cy = b.y + dy
        if (cx < 0 || cx >= WORLD_SIZE || cy < 0 || cy >= WORLD_SIZE) continue
        if (occupied.has(`${cx},${cy}`)) continue
        adjacentCells.add(`${cx},${cy}`)
      }
    }
  }

  // Draw flora deterministically per cell
  const kinds = ['grass', 'grass', 'flower', 'bush', 'sapling'] // grass is more common
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
