/**
 * Nature — procedural flora sprites that auto-fill grid cells adjacent to
 * buildings. Density and health depend on the child's demeritCount (light
 * level), per PRD §Cahaya:
 *   0 clouds → lush (all adjacent cells get flora, vibrant greens)
 *   1-2      → normal (~70% cells, healthy)
 *   3-4      → sparse (~40%, some brown patches)
 *   5+       → barren (~20%, mostly dried/withered)
 *
 * Kinds: 'grass' | 'flower' | 'bush' | 'sapling' | 'rock' (real sprites)
 *
 * PATH SYSTEM (added later):
 * Dust path decals are placed via a SEPARATE spline-driven system, not the
 * random-scatter used for flora. Straight line from each building to the
 * Musalla is Bresenham-rasterised → every cell on any such line receives
 * a dust decal. Cells with heavier "traffic" (multiple building→musalla
 * lines crossing) get denser/junction variants — organic lane emergence.
 */

/**
 * Bresenham's line algorithm — returns every grid cell touched by the line
 * from (x0,y0) to (x1,y1). Used to rasterise walking paths through the
 * grid so we can stamp dust decals on each cell in the lane.
 */
function bresenhamLine(x0, y0, x1, y1) {
  const points = []
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let safety = 0
  while (safety++ < 512) {
    points.push([x0, y0])
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
  return points
}

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
      // ── Rock case handled BEFORE sapling to short-circuit early. Same
      // category pattern: 4 curated variants (small pebble, medium cluster,
      // large cluster, boulder). Weighted so smaller rocks are common,
      // boulders rare.
      // NOTE: This block intentionally handles 'sapling' — 'rock' has its
      // own case below.
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
    case 'rock': {
      // ── Category-based rendering. 4 curated rock variants — REBALANCED
      // per user feedback ("small over-common, boulder rare"):
      //   small:   2/10 (20%) — was dominant, reduced for variety
      //   medium:  3/10 (30%) — common cluster
      //   large:   3/10 (30%) — bigger cluster, promoted
      //   boulder: 2/10 (20%) — landmark, more visible than before
      // Standard: bottom-center anchor, scale 0.55 (user: kecilkan).
      const variants = [
        'small', 'small',
        'medium', 'medium', 'medium',
        'large', 'large', 'large',
        'boulder', 'boulder',
      ]
      const v = variants[Math.floor(seed * variants.length) % variants.length]
      const key = `rock_${v}_01`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)             // feet on ground
        img.setScale(0.55)                  // user: kecilkan
        if (seed > 0.5) img.setFlipX(true)  // organic variety
        // Rocks don't wither — skip tint even when nature is dying
        container.add(img)
        break
      }
      // Fallback: procedural rock (small grey ellipse)
      g.fillStyle(0x8a8a86, 1)
      g.fillEllipse(0, -3 * S, 6 * S, 4 * S)
      g.fillStyle(0x6f6f6b, 1)
      g.fillEllipse(-1.5 * S, -2 * S, 3 * S, 2 * S)
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
 * PATH stamping — rasterise Bresenham lines from every non-Musalla building
 * to the Musalla center, stamping dust decals on each cell. Cells crossed
 * by multiple lines get "junction" variants (busy lanes), edge cells get
 * "end" variants (near buildings), middle cells get "straight". Returns
 * the set of path-occupied cells so the caller can exclude them from the
 * flora scatter (dust already occupies the cell — no grass on top).
 *
 * @returns {{ sprites: Array, pathCells: Set<string> }}
 */
export function renderPaths(scene, buildings, coords) {
  const { originX, originY, TILE_W, TILE_H, gridToScreen, BUILDING_TEMPLATES, natureLayer, bounds } = coords
  const sprites = []
  const pathCells = new Set()

  const musalla = buildings.find(b => b.templateId === 'musalla')
  if (!musalla) return { sprites, pathCells }

  // Musalla center (8×8 reserved zone → middle at +4,+4)
  const mCx = musalla.x + 4
  const mCy = musalla.y + 4

  // Occupied set (buildings block dust placement)
  const MUSALLA_RESERVED = { w: 8, h: 8 }
  const occupied = new Set()
  for (const bld of buildings) {
    const t = BUILDING_TEMPLATES[bld.templateId]
    const sz = bld.templateId === 'musalla' ? MUSALLA_RESERVED : (t?.tileSize || { w: 1, h: 1 })
    for (let dx = 0; dx < sz.w; dx++) {
      for (let dy = 0; dy < sz.h; dy++) {
        occupied.add(`${bld.x + dx},${bld.y + dy}`)
      }
    }
  }

  // Traffic map: cell → count of lines passing through
  const traffic = new Map()
  const buildingClosestCell = new Map()
  const placements = []
  // Cells that belong to a building's footprint — these get dust UNDER
  // the building sprite (rendered at very low depth so the building
  // sprite overlays on top). Kept separate from occupied so we can still
  // block Bresenham lines from passing through interiors.
  const footprintCells = new Set()

  // ── PASS A: Dust "pad" UNDER every building footprint.
  //
  // For NON-MUSALLA buildings: fill every cell of tileSize (full footprint).
  //
  // For MUSALLA / MASJID / JAMI' MASJID: only fill cells within the
  // building's VISUAL footprint (`tileSizeByLevel`), NOT the entire 8×8
  // reserved buffer zone. The 8×8 zone is a padding gazette so villagers
  // and future buildings can't crowd the mosque — but visually the mosque
  // sprite only occupies a small centred diamond (2×2 to 4×4). Stamping
  // dust across all 64 cells produced a giant sandy square that dwarfed
  // the mosque (user: "hanya pada negative space asset sahaja, bukan
  // keseluruhan pad — mark betul2 negative space asset untuk musalla").
  //
  // Visual footprint centering follows the same anchor logic as the
  // building renderer: the mosque anchor sits at the FRONT-TIP of the
  // 8×8 zone (b.x + reserveSize - 2.5, same for y) so the visual cells
  // extend BACKWARD from that tip.
  for (const bld of buildings) {
    const t = BUILDING_TEMPLATES[bld.templateId]
    let cells = []
    if (bld.templateId === 'musalla') {
      // Visual footprint by level (L1: 2×2, L2: 3×3, L3: 4×4)
      const level = bld.level || 1
      const vFoot = t?.tileSizeByLevel?.[level] || t?.tileSize || { w: 2, h: 2 }
      // Front-tip in world coords: b.x + (reserveSize - 2.5) = b.x + 5.5
      // Nearest integer cell (front-tip cell) = b.x + 5, b.y + 5
      const frontCellX = bld.x + (t.reserveSize?.w || 8) - 3  // = b.x + 5
      const frontCellY = bld.y + (t.reserveSize?.h || 8) - 3  // = b.y + 5
      // Visual cells extend backward from the front tip
      for (let dx = 0; dx < vFoot.w; dx++) {
        for (let dy = 0; dy < vFoot.h; dy++) {
          cells.push([frontCellX - (vFoot.w - 1) + dx, frontCellY - (vFoot.h - 1) + dy])
        }
      }
    } else {
      const sz = t?.tileSize || { w: 1, h: 1 }
      for (let dx = 0; dx < sz.w; dx++) {
        for (let dy = 0; dy < sz.h; dy++) {
          cells.push([bld.x + dx, bld.y + dy])
        }
      }
    }

    for (const [cx, cy] of cells) {
      const k = `${cx},${cy}`
      if (bounds?.center && bounds?.radius != null) {
        const rdx = cx - bounds.center.x + 0.5
        const rdy = cy - bounds.center.y + 0.5
        if ((rdx * rdx + rdy * rdy) > (bounds.radius + 0.5) * (bounds.radius + 0.5)) continue
      }
      footprintCells.add(k)
      traffic.set(k, (traffic.get(k) || 0) + 1)
      // 4 overlapping decals per cell for full coverage without gaps
      placements.push({ col: cx, row: cy, ox:  0.0, oy:  0.0, sourceCellKey: k, underBuilding: true })
      placements.push({ col: cx, row: cy, ox: -0.25, oy:  0.0, sourceCellKey: k, underBuilding: true })
      placements.push({ col: cx, row: cy, ox:  0.25, oy:  0.0, sourceCellKey: k, underBuilding: true })
      placements.push({ col: cx, row: cy, ox:  0.0, oy: -0.20, sourceCellKey: k, underBuilding: true })
    }
  }

  // ── PASS B: Connective lines from EACH building to Musalla.
  // User feedback QB=B: "kurangkan" — reduce lane visibility. We drop the
  // midpoint interpolation (halves the stamp density) so lanes still hint
  // at connectivity without dominating the sandy village core.
  for (const bld of buildings) {
    if (bld.templateId === 'musalla') continue
    const t = BUILDING_TEMPLATES[bld.templateId]
    const sz = t?.tileSize || { w: 1, h: 1 }
    const bCx = bld.x + Math.floor(sz.w / 2)
    const bCy = bld.y + Math.floor(sz.h / 2)

    const line = bresenhamLine(bCx, bCy, mCx, mCy)
    let firstNonOccupied = true
    for (const [cx, cy] of line) {
      const k = `${cx},${cy}`
      if (occupied.has(k)) continue
      if (bounds?.center && bounds?.radius != null) {
        const rdx = cx - bounds.center.x + 0.5
        const rdy = cy - bounds.center.y + 0.5
        if ((rdx * rdx + rdy * rdy) > (bounds.radius + 0.5) * (bounds.radius + 0.5)) continue
      }
      traffic.set(k, (traffic.get(k) || 0) + 1)
      if (firstNonOccupied) {
        buildingClosestCell.set(k, true)
        firstNonOccupied = false
      }
      placements.push({ col: cx, row: cy, ox: 0, oy: 0, sourceCellKey: k, underBuilding: false })
      // NOTE: midpoint interpolation intentionally removed — user asked
      // for reduced lane density so the sandy village core stays hero.
    }
  }

  // Render dust decal per placement
  for (const p of placements) {
    const { col, row, ox, oy, sourceCellKey, underBuilding } = p
    // Only track pathCells for cells that AREN'T under a building — those
    // remain visible ground where flora should NOT spawn. Under-building
    // dust is hidden by the sprite so flora exclusion is meaningless.
    if (!underBuilding) pathCells.add(sourceCellKey)
    const seedBase = cellHash(col, row, 7) + (Math.abs(ox) + Math.abs(oy)) * 0.37
    const seed = seedBase - Math.floor(seedBase)
    const count = traffic.get(sourceCellKey) || 1

    let variantKey
    if (underBuilding) {
      // Full-coverage pad — cycle through ALL 4 variants (user: "pelbagaikan
      // dust path asset yang kita ada untuk nampakan tak repeatative").
      // Different sub-cell offsets get different variants so the 4 stamps
      // per cell each contribute a different look. Uses ox/oy in the hash
      // so the pattern is deterministic yet varied.
      const variants = ['path_straight_01', 'path_straight_02', 'path_junction_01', 'path_end_01']
      const idxSeed = cellHash(col + Math.round(ox * 10), row + Math.round(oy * 10), 11)
      variantKey = variants[Math.floor(idxSeed * 4) % 4]
    } else {
      // ── Pathway cells (Bresenham lane) — user: "gunakan multiple variant
      // ikut kesesuaian". Weighted distribution across ALL 4 variants
      // biased by context so lanes read as organic, not stamped:
      //   • junction cells (traffic ≥ 2): junction_01 dominant + straights
      //     for texture breaks
      //   • end cells (building-adjacent): end_01 dominant + straights
      //   • plain straight cells: straights dominant + occasional rock/end
      //     accent
      let laneVariants
      if (count >= 2) {
        laneVariants = [
          'path_junction_01', 'path_junction_01', 'path_junction_01',
          'path_straight_01',
          'path_straight_02',
        ] // 60% junction, 20/20% straights
      } else if (count === 1 && buildingClosestCell.get(sourceCellKey)) {
        laneVariants = [
          'path_end_01', 'path_end_01', 'path_end_01',
          'path_straight_01',
          'path_straight_02',
        ] // 60% end, 20/20% straights
      } else {
        laneVariants = [
          'path_straight_01', 'path_straight_01', 'path_straight_01',
          'path_straight_02', 'path_straight_02', 'path_straight_02',
          'path_junction_01', // occasional rock accent
          'path_end_01',      // occasional grass tuft
        ] // 37.5/37.5/12.5/12.5%
      }
      const idxSeed = cellHash(col, row, 13)
      variantKey = laneVariants[Math.floor(idxSeed * laneVariants.length) % laneVariants.length]
    }

    if (!scene.textures.exists(variantKey)) continue

    const { x, y } = gridToScreen(col + 0.5 + ox, row + 0.5 + oy, originX, originY)
    const jx = (cellHash(col + Math.round(ox * 10), row + Math.round(oy * 10), 8) - 0.5) * (TILE_W * 0.10)
    const jy = (cellHash(col + Math.round(ox * 10), row + Math.round(oy * 10), 9) - 0.5) * (TILE_H * 0.10)

    const img = scene.add.image(x + jx, y + jy, variantKey)
    img.setOrigin(0.5, 0.6)
    // Under-building dust slightly larger so multiple overlap = solid pad
    img.setScale(underBuilding ? 1.0 : 0.85)
    if (seed > 0.5) img.setFlipX(true)
    // Depth strategy:
    //   underBuilding=true → very low depth (-10000) so building sprite,
    //     flora, and even ground-level shadows draw ON TOP
    //   underBuilding=false → same tier as the row+col cell but slightly
    //     below (−2.5) so it sits under any prop on the same cell
    img.setDepth(underBuilding ? -10000 + (row + col) * 0.001 : row + col - 2.5)
    natureLayer.add(img)
    sprites.push(img)
  }

  return { sprites, pathCells }
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
  // Wipe previous nature (paths + flora share this layer)
  natureLayer.removeAll(true)

  // ── PASS 1: Path dust decals (Bresenham lines building→Musalla).
  // Fires FIRST so path cells can be excluded from the flora scatter.
  const { pathCells } = renderPaths(scene, buildings, coords)

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
        // Skip cells that already have a path dust decal (avoids double-
        // decorating a busy lane and lets the dust breathe visually).
        if (pathCells.has(`${cx},${cy}`)) continue
        adjacentCells.add(`${cx},${cy}`)
      }
    }
  }

  // Draw flora deterministically per cell.
  // Distribution weighting: expanded to 11 slots so ratios finer-grained.
  // - grass:   4/11 (~36%) — dominant ground cover
  // - sapling: 3/11 (~27%) — young trees, common
  // - bush:    2/11 (~18%) — filler
  // - flower:  1/11 (~9%)  — rare premium accent
  // - rock:    1/11 (~9%)  — rare textural accent (small pebble common,
  //                          boulder rare via internal variant weights)
  const kinds = [
    'grass', 'grass', 'grass', 'grass',
    'sapling', 'sapling', 'sapling',
    'bush', 'bush',
    'flower',
    'rock',
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
