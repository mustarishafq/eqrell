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
      // ── 8 curated variants — equal weight (user: "gunakan semua assets").
      const idx = (Math.floor(seed * 8) % 8) + 1
      const key = `grass_${String(idx).padStart(2, '0')}`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)
        img.setScale(0.55)                    // ground layer — smaller than props
        if (seed > 0.5) img.setFlipX(true)
        if (withered) img.setTint(0xa08a70)
        container.add(img)
        break
      }
      // Fallback: procedural grass tuft
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
      // ── 8 curated variants (user: "gunakan semua assets"). Equal weight
      // per variant — 12.5% each. Standard: bottom-center anchor, scale
      // 0.65 (matches subtle premium accent scale locked earlier).
      const idx = (Math.floor(seed * 8) % 8) + 1
      const key = `flower_patch_${String(idx).padStart(2, '0')}`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)
        img.setScale(0.65)
        if (seed > 0.5) img.setFlipX(true)
        if (withered) img.setTint(0xa08a70)
        container.add(img)
        break
      }
      // Fallback (procedural flower)
      g.fillStyle(P.stem, 1)
      g.fillRect(-0.6 * S, -6 * S, 1.2 * S, 6 * S)
      break
    }
    case 'bush': {
      // ── 8 curated variants — equal weight (user: "gunakan semua assets").
      const idx = (Math.floor(seed * 8) % 8) + 1
      const key = `bush_${String(idx).padStart(2, '0')}`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)
        img.setScale(0.65)
        if (seed > 0.5) img.setFlipX(true)
        if (withered) img.setTint(0xa08a70)
        container.add(img)
        break
      }
      // Fallback: procedural bush
      g.fillStyle(P.bushShade, 1)
      g.fillEllipse(-2 * S, -3 * S, 7 * S, 5 * S)
      g.fillStyle(P.bushGreen, 1)
      g.fillEllipse(0, -5 * S, 8 * S, 6 * S)
      break
    }
    case 'sapling': {
      // ── 10 curated tree variants (real sprites — replaces procedural
      // young tree). Equal weight per variant (user: "gunakan semua
      // assets"). Standard: bottom-center anchor, scale 0.85 (trees are
      // meant to be prominent — dominant flora above bushes/rocks).
      const idx = (Math.floor(seed * 10) % 10) + 1
      const key = `sapling_${String(idx).padStart(2, '0')}`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)
        img.setScale(0.85)                    // trees more prominent
        if (seed > 0.5) img.setFlipX(true)
        if (withered) img.setTint(0xa08a70)
        container.add(img)
        break
      }
      // Fallback: procedural sapling (trunk + circle canopy)
      g.fillStyle(P.saplingTrunk, 1)
      g.fillRect(-1 * S, -8 * S, 2 * S, 8 * S)
      g.fillStyle(P.saplingLeaf, 1)
      g.fillCircle(0, -10 * S, 5 * S)
      break
    }
    case 'rock': {
      // ── 8 curated variants — equal weight (user: "gunakan semua assets").
      const idx = (Math.floor(seed * 8) % 8) + 1
      const key = `rock_${String(idx).padStart(2, '0')}`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)
        img.setScale(0.55)
        if (seed > 0.5) img.setFlipX(true)
        container.add(img)
        break
      }
      // Fallback: procedural rock
      g.fillStyle(0x8a8a86, 1)
      g.fillEllipse(0, -3 * S, 6 * S, 4 * S)
      break
    }
    case 'sign': {
      // ── 8 curated variants — equal weight (user: "gunakan semua assets").
      const idx = (Math.floor(seed * 8) % 8) + 1
      const key = `sign_${String(idx).padStart(2, '0')}`
      if (scene.textures.exists(key)) {
        const img = scene.add.image(0, 0, key)
        img.setOrigin(0.5, 1.0)
        img.setScale(0.50)                    // subtle wayfinding
        if (seed > 0.5) img.setFlipX(true)
        if (withered) img.setTint(0xa08a70)
        container.add(img)
        break
      }
      // Fallback: procedural post
      g.fillStyle(0x6b4c2a, 1)
      g.fillRect(-0.6 * S, -8 * S, 1.2 * S, 8 * S)
      break
    }
    default:
      break
  }
  container.add(g)

  // NOTE: Ground shadow ellipse REMOVED (user: "buang code shadow di setiap
  // back sebab nampak seolah2 pack floating"). Our sprite packs (flower,
  // bush, grass, rock, sign) already bake their own grass/dirt base into
  // the asset — an extra procedural shadow underneath made the packs look
  // detached and floating. Removing it grounds the sprites naturally.
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
      const startX = frontCellX - (vFoot.w - 1)
      const startY = frontCellY - (vFoot.h - 1)
      // Core visual footprint cells
      for (let dx = 0; dx < vFoot.w; dx++) {
        for (let dy = 0; dy < vFoot.h; dy++) {
          cells.push([startX + dx, startY + dy])
        }
      }
      // ── FRONT OVERFLOW (user: "tambah sikit dust path bahagian depan,
      // maksudnya bahagian bagi overflow sikit, tapi bukan sampai penuh
      // keseluruhan pad"). Extend dust 1 cell in front of the mosque along
      // its two front-facing edges (right + bottom in screen space, i.e.
      // +x and +y in grid coords — that's where the mosque entrance faces
      // in an isometric projection). Forms an "L" strip: subtle apron in
      // front of the mosque, not a full extended pad.
      const overflowRightX = frontCellX + 1
      const overflowBottomY = frontCellY + 1
      // Front-right column: cells one step past the mosque's right edge
      for (let dy = 0; dy < vFoot.h; dy++) {
        cells.push([overflowRightX, startY + dy])
      }
      // Front-bottom row: cells one step past the mosque's bottom edge
      for (let dx = 0; dx < vFoot.w; dx++) {
        cells.push([startX + dx, overflowBottomY])
      }
      // Front-corner (the shared corner of the two overflow strips) —
      // fills the small notch so the L reads as connected.
      cells.push([overflowRightX, overflowBottomY])
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
    // ── 12 dust variants (smart-sliced from user-uploaded Dust_pack v2).
    // Semantic sub-groups by visual character so lanes still read as
    // organic rather than random:
    //   • JUNCTION-flavor: prominent grass tufts + rock rims — busy corners
    //   • END-flavor:      clear edge markers (grass on one side + rocks)
    //   • STRAIGHT-flavor: flat/elongated with subtle detail — thoroughfares
    // For under-building pads we cycle ALL 12 for maximum non-repetitive coverage.
    const DUST_ALL = [
      'path_dust_01', 'path_dust_02', 'path_dust_03', 'path_dust_04',
      'path_dust_05', 'path_dust_06', 'path_dust_07', 'path_dust_08',
      'path_dust_09', 'path_dust_10', 'path_dust_11', 'path_dust_12',
    ]
    // Curated subsets (indices 1-based per the collage on /tmp/dust_new_collage.png):
    //   Row 1 (#01–04): plump patches w/ grass sprouts on top + rock rims
    //   Row 2 (#05–08): mixed — long stroke (#06), heavy front-grass (#07)
    //   Row 3 (#09–12): flatter, spread out, mostly rocks (#11 = long streak)
    const DUST_JUNCTION = ['path_dust_01','path_dust_03','path_dust_05','path_dust_07','path_dust_08','path_dust_12']
    const DUST_END      = ['path_dust_01','path_dust_04','path_dust_05','path_dust_08','path_dust_12','path_dust_02']
    const DUST_STRAIGHT = ['path_dust_02','path_dust_06','path_dust_09','path_dust_10','path_dust_11','path_dust_04']

    if (underBuilding) {
      // Full-coverage pad — cycle through ALL 12 variants using ox/oy hash
      // so the 4 stamps per cell each pull a different look (user: "pelbagaikan
      // dust path asset yang kita ada untuk nampakan tak repeatative").
      const idxSeed = cellHash(col + Math.round(ox * 10), row + Math.round(oy * 10), 11)
      variantKey = DUST_ALL[Math.floor(idxSeed * DUST_ALL.length) % DUST_ALL.length]
    } else {
      // Pathway cells (Bresenham lane) — user: "gunakan multiple variant
      // ikut kesesuaian". Weighted picks bias by context so lanes stay organic:
      //   • junction cells (traffic ≥ 2): junction subset dominant + occasional straight
      //   • end cells (building-adjacent): end subset dominant + occasional straight
      //   • plain straight cells: straight subset dominant + occasional accent
      let laneVariants
      if (count >= 2) {
        // 5× junction + 1× straight accent
        laneVariants = [
          ...DUST_JUNCTION, ...DUST_JUNCTION,
          DUST_STRAIGHT[0], DUST_STRAIGHT[1],
        ]
      } else if (count === 1 && buildingClosestCell.get(sourceCellKey)) {
        // 5× end + 1× straight accent
        laneVariants = [
          ...DUST_END, ...DUST_END,
          DUST_STRAIGHT[0], DUST_STRAIGHT[1],
        ]
      } else {
        // straight-dominant with occasional junction/end accents
        laneVariants = [
          ...DUST_STRAIGHT, ...DUST_STRAIGHT,
          DUST_JUNCTION[0], DUST_JUNCTION[2],
          DUST_END[1],
        ]
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
    if (underBuilding) {
      // Under-building pad: constant scale so multiple stamps overlap = solid pad
      img.setScale(1.0)
    } else {
      // Pathway cells: BASE scale 0.85, then deterministic per-cell size
      // variation biased DOWNWARDS (0.55–1.0× of base). Never larger than
      // current base. User: "ada yang maintain same size dan ada yang lebih
      // kecil secara random, tiada dust path yang lebih besar dari sekarang".
      // Uses a separate hash channel (14) so the variety doesn't correlate
      // with variant/jitter picks (which use channels 8, 9, 13).
      const scaleSeed = cellHash(col + Math.round(ox * 10), row + Math.round(oy * 10), 14)
      // Weighted: ~30% stay near full (0.90–1.00), ~50% mid (0.72–0.90),
      // ~20% small (0.55–0.72) — creates organic scatter without any outliers
      // bigger than 1.0.
      let scaleMul
      if (scaleSeed < 0.30) scaleMul = 0.90 + scaleSeed * (0.10 / 0.30)          // → 0.90–1.00
      else if (scaleSeed < 0.80) scaleMul = 0.72 + (scaleSeed - 0.30) * (0.18 / 0.50) // → 0.72–0.90
      else scaleMul = 0.55 + (scaleSeed - 0.80) * (0.17 / 0.20)                  // → 0.55–0.72
      img.setScale(0.85 * scaleMul)
    }
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
  // Distribution weighting: 24 slots (rebalanced after user cut sign density).
  // - grass:   8/24 (~33%) — dominant ground cover
  // - sapling: 7/24 (~29%) — young trees, common
  // - bush:    4/24 (~17%) — filler
  // - flower:  2/24 (~8%)  — rare premium accent
  // - rock:    2/24 (~8%)  — rare textural accent
  // - sign:    1/24 (~4%)  — rare wayfinding decoration (user: kurangkan)
  const kinds = [
    'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass',
    'sapling', 'sapling', 'sapling', 'sapling', 'sapling', 'sapling', 'sapling',
    'bush', 'bush', 'bush', 'bush',
    'flower', 'flower',
    'rock', 'rock',
    'sign',
  ]
  // Build "front-cells" set — cells immediately in FRONT of any building
  // (isometric +x and/or +y direction from footprint). Saplings placed here
  // would block the building's visual, so we downgrade the pick to a
  // low-profile ground kind (grass/flower) in these cells only. Back/side
  // adjacent cells still allow trees (user: "belakang binaan ok, tepi
  // binaan ok, tak boleh depan binaan").
  const frontCells = new Set()
  for (const b of buildings) {
    if (b.templateId === 'musalla') continue
    const t = BUILDING_TEMPLATES[b.templateId]
    const sz = t?.tileSize || { w: 1, h: 1 }
    // Right edge (front-right in iso)
    for (let dy = 0; dy < sz.h; dy++) frontCells.add(`${b.x + sz.w},${b.y + dy}`)
    // Bottom edge (front-bottom in iso)
    for (let dx = 0; dx < sz.w; dx++) frontCells.add(`${b.x + dx},${b.y + sz.h}`)
    // Front corner
    frontCells.add(`${b.x + sz.w},${b.y + sz.h}`)
  }

  const sprites = []
  for (const key of adjacentCells) {
    const [col, row] = key.split(',').map(Number)
    // Skip: cell should render nature ONLY if hash < density
    const roll = cellHash(col, row, 1)
    if (roll > densityChance) continue

    const withered = cellHash(col, row, 2) < witheredChance
    const kindIdx = Math.floor(cellHash(col, row, 3) * kinds.length)
    let kind = kinds[kindIdx]
    // Downgrade sapling → grass in front-of-building cells so the tree
    // canopy never blocks the building sprite from the camera view.
    if (kind === 'sapling' && frontCells.has(`${col},${row}`)) {
      kind = 'grass'
    }

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


/**
 * renderWilderness — populate the OUTER ring (unexplored area) beyond the
 * playable radius with sparse wilderness flora + atmospheric haze/clouds.
 *
 * Uses ONLY existing assets (grass_01..08, bush_01..08, rock_01..08,
 * sapling_01..10, flower_patch_01..08) plus 3 new atmospheric sprites
 * (atm_haze_wide, atm_haze_small, atm_cloud_soft). All placement is
 * deterministic via cellHash so re-render (e.g. on world expansion) is
 * stable — no jittering.
 *
 * @param {object} coords same shape as renderNature — { scene, originX,
 *   originY, TILE_W, TILE_H, gridToScreen, natureLayer, bounds }.
 */
export function renderWilderness(coords) {
  const { scene, originX, originY, TILE_W, TILE_H, gridToScreen, natureLayer, bounds } = coords
  if (!bounds || !bounds.center || bounds.radius == null) return
  if (typeof bounds.center.x !== 'number' || typeof bounds.center.y !== 'number') {
    console.warn('[renderWilderness] bounds.center missing numeric x/y — aborting', bounds.center)
    return
  }

  // Outer ring — must match WILDERNESS_MARGIN in WorldScene.drawGround
  const WILDERNESS_MARGIN = 12
  const cCol = bounds.center.x
  const cRow = bounds.center.y
  const R    = bounds.radius
  const Rw   = R + WILDERNESS_MARGIN

  // ═══ PHASE 2 — DENSE FOREST CLUSTERS ═══════════════════════════
  // Instead of uniform sparse scatter, place N cluster "hotspots" around
  // the outer ring and grow forest patches at each. This produces the
  // organic hutan look the user requested (dense clumps + open glades)
  // rather than a thin evenly-spaced ring.
  //
  // Each cluster picks a deterministic angle + radial distance in the
  // wilderness ring, then spawns 6-12 flora sprites within a small
  // radius around that center. Bush + sapling weighted heavily for
  // "forest" visual; grass/flowers fill gaps.
  const NUM_CLUSTERS = 22
  const POOL = { grass: 8, flower_patch: 8, bush: 8, sapling: 10, rock: 8 }
  const pickKind = (h) => {
    // Forest-biased weighting — trees/bushes dominant, flowers/rocks accent
    const r = (h * 1000) % 100
    if (r < 42) return 'bush'
    if (r < 72) return 'sapling'
    if (r < 84) return 'grass'
    if (r < 95) return 'flower_patch'
    return 'rock'
  }

  const placeFlora = (col, row, hashSalt) => {
    // Skip if too close to playable edge (keep the boundary clean)
    const dx = col - cCol + 0.5
    const dy = row - cRow + 0.5
    const d  = Math.sqrt(dx * dx + dy * dy)
    if (d < R + 0.8) return
    if (d > Rw + 0.5) return

    const kind = pickKind(cellHash(col, row, 100 + hashSalt))
    const poolSize = POOL[kind]
    const idx = Math.floor(cellHash(col, row, 200 + hashSalt) * poolSize) + 1
    const key = kind === 'flower_patch'
      ? `flower_patch_${String(idx).padStart(2, '0')}`
      : `${kind}_${String(idx).padStart(2, '0')}`
    if (!scene.textures.exists(key)) return

    const jx = (cellHash(col, row, 300 + hashSalt) - 0.5) * (TILE_W * 0.55)
    const jy = (cellHash(col, row, 400 + hashSalt) - 0.5) * (TILE_H * 0.55)
    const { x, y } = gridToScreen(col + 0.5, row + 0.5, originX, originY)
    const img = scene.add.image(x + jx, y + jy, key)
    // Bigger for forest feel; bush/sapling slightly larger than grass/flower
    const baseScale = (kind === 'bush' || kind === 'sapling') ? 0.42 : 0.32
    const scale = baseScale + cellHash(col, row, 500 + hashSalt) * 0.16
    img.setScale(scale)
    if (cellHash(col, row, 600 + hashSalt) > 0.5) img.setFlipX(true)
    // Desaturate visually via alpha + darker tint feel — grass tint layer
    // already darkens the ground beneath, so keep flora alpha 0.85-1.0 so
    // trees remain identifiable as canopy.
    img.setAlpha(0.85 + cellHash(col, row, 700 + hashSalt) * 0.14)
    img.setDepth(row + col - 0.3)
    natureLayer.add(img)
  }

  for (let i = 0; i < NUM_CLUSTERS; i++) {
    // Deterministic cluster center in polar coords around wilderness ring
    const angleSeed = cellHash(i * 11 + 1000, 0, 3)
    const radSeed   = cellHash(0, i * 13 + 1000, 5)
    const angle = (i / NUM_CLUSTERS) * Math.PI * 2 + (angleSeed - 0.5) * 0.55
    // Radial distance from playable edge — bias toward middle-far of ring
    const rMul  = 0.30 + radSeed * 0.60      // 0.30..0.90 of wilderness margin
    const rDist = R + 1.2 + rMul * (WILDERNESS_MARGIN - 2)
    const clusterCol = Math.round(cCol + Math.cos(angle) * rDist)
    const clusterRow = Math.round(cRow + Math.sin(angle) * rDist)

    // Spawn 6-12 flora sprites within ~3-tile radius of cluster center.
    // Random walk over local cells with density concentrated at center.
    const count = 8 + Math.floor(cellHash(i * 17 + 2000, 0, 7) * 5)   // 8-12
    for (let k = 0; k < count; k++) {
      // Sample offset within cluster (Gaussian-ish via 3-die sum)
      const s1 = cellHash(i * 19 + k * 23, 0, 11)
      const s2 = cellHash(i * 29 + k * 31, 0, 13)
      const s3 = cellHash(i * 37 + k * 41, 0, 17)
      const rOff = ((s1 + s2 + s3) / 3 - 0.5) * 6           // -3..+3 tiles
      const aOff = cellHash(i * 43 + k * 47, 0, 19) * Math.PI * 2
      const col  = clusterCol + Math.round(Math.cos(aOff) * Math.abs(rOff))
      const row  = clusterRow + Math.round(Math.sin(aOff) * Math.abs(rOff))
      placeFlora(col, row, i * 100 + k)
    }
  }

  // Add sparser filler scatter between clusters so gaps feel natural,
  // not empty. Density ~15% of cells in the ring (much lower than cluster
  // hot-spots but higher than pure background).
  for (let row = Math.floor(cRow - Rw - 1); row <= Math.ceil(cRow + Rw + 1); row++) {
    for (let col = Math.floor(cCol - Rw - 1); col <= Math.ceil(cCol + Rw + 1); col++) {
      const dx = col - cCol + 0.5
      const dy = row - cRow + 0.5
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < R + 1.0) continue
      if (d > Rw + 0.5) continue
      const gate = cellHash(col, row, 999)
      if (gate > 0.15) continue                              // 15% filler density
      placeFlora(col, row, 9999)
    }
  }

  // ═══ PHASE 3 — CLUSTER-BASED CLOUD BANKS ═══════════════════════
  // 4 cloud "banks" placed in cardinal quadrants (NW, NE, SW, SE) with
  // multiple haze/cloud sprites clustered nearby. Alpha values are much
  // higher than the previous ring-scatter attempt so they actually read
  // as visible atmospheric depth. Slow drift on cloud_soft gives life.
  const centerScreen = gridToScreen(cCol - 0.5, cRow - 0.5, originX, originY)
  const cxPx = centerScreen.x
  const cyPx = centerScreen.y

  // In screen space the wilderness ring is roughly this radius wide:
  const ringRadiusPx = Rw * TILE_W * 0.72

  const spawnCluster = (baseAngle, sprites) => {
    for (const s of sprites) {
      if (!scene.textures.exists(s.key)) continue
      // Position: base angle + jitter, distance mid-outer ring
      const jitAngle = baseAngle + (s.angleJit || 0)
      const rr = ringRadiusPx * (s.rMul || 1.0)
      // Isometric squash — vertical distance appears ~55% of horizontal
      const px = cxPx + Math.cos(jitAngle) * rr
      const py = cyPx + Math.sin(jitAngle) * rr * 0.58
      const img = scene.add.image(px, py, s.key)
      img.setScale(s.scale || 1.0)
      img.setAlpha(s.alpha || 0.4)
      if (s.flipX) img.setFlipX(true)
      if (s.rotation) img.setRotation(s.rotation)
      img.setDepth(s.depth || 9999)
      natureLayer.add(img)

      if (s.drift) {
        const dur = 60000 + cellHash(Math.round(px), Math.round(py), 71) * 40000
        const dxA = (cellHash(Math.round(px), Math.round(py), 73) - 0.5) * 80
        const dyA = (cellHash(Math.round(px), Math.round(py), 79) - 0.5) * 40
        scene.tweens.add({
          targets: img,
          x: px + dxA, y: py + dyA,
          duration: dur, ease: 'Sine.easeInOut',
          yoyo: true, repeat: -1,
        })
      }
    }
  }

  // Four cardinal cloud banks — each with mix of wide haze + small haze + soft cloud
  const BANKS = [
    { angle: -Math.PI * 0.75 },  // NW
    { angle: -Math.PI * 0.25 },  // NE
    { angle:  Math.PI * 0.25 },  // SE
    { angle:  Math.PI * 0.75 },  // SW
  ]
  BANKS.forEach((bank, i) => {
    // Per-bank deterministic seed
    const seed = i * 100
    const j1 = cellHash(seed + 1, 0, 3)
    const j2 = cellHash(seed + 2, 0, 5)
    const j3 = cellHash(seed + 3, 0, 7)
    const j4 = cellHash(seed + 4, 0, 11)
    const j5 = cellHash(seed + 5, 0, 13)
    spawnCluster(bank.angle, [
      // BIG haze centerpiece (dominant fog blob)
      { key: 'atm_haze_wide',  angleJit: (j1 - 0.5) * 0.10, rMul: 0.98, scale: 1.35 + j1 * 0.35, alpha: 0.42, depth: 9998, flipX: j1 > 0.5 },
      // Two flanking wide haze
      { key: 'atm_haze_wide',  angleJit: (j2 - 0.5) * 0.20 - 0.28, rMul: 1.08, scale: 0.95 + j2 * 0.30, alpha: 0.32, depth: 9998 },
      { key: 'atm_haze_wide',  angleJit: (j3 - 0.5) * 0.20 + 0.28, rMul: 0.86, scale: 1.05 + j3 * 0.30, alpha: 0.36, depth: 9998, flipX: j3 > 0.5 },
      // Small haze wisps (add texture to bank edges)
      { key: 'atm_haze_small', angleJit: (j4 - 0.5) * 0.35 - 0.15, rMul: 1.18, scale: 0.70 + j4 * 0.40, alpha: 0.28, rotation: (j4 - 0.5) * 0.6, depth: 9998 },
      { key: 'atm_haze_small', angleJit: (j5 - 0.5) * 0.35 + 0.10, rMul: 0.78, scale: 0.85 + j5 * 0.35, alpha: 0.30, rotation: (j5 - 0.5) * 0.6, depth: 9998 },
      // Soft cloud (drifts) ABOVE the wilderness
      { key: 'atm_cloud_soft', angleJit: (j1 - 0.5) * 0.25, rMul: 1.28, scale: 0.85 + j1 * 0.40, alpha: 0.45, depth: 10001, drift: true },
    ])
  })

  // Additional CENTER-DRIFT clouds — 3 clouds float slowly over the
  // wilderness from various angles to break up the four-bank symmetry.
  for (let k = 0; k < 3; k++) {
    if (!scene.textures.exists('atm_cloud_soft')) break
    const sa = cellHash(k * 53, 0, 21)
    const angle = sa * Math.PI * 2
    const rr = ringRadiusPx * (0.65 + cellHash(k * 59, 0, 23) * 0.55)
    const px = cxPx + Math.cos(angle) * rr
    const py = cyPx + Math.sin(angle) * rr * 0.58
    const img = scene.add.image(px, py, 'atm_cloud_soft')
    const sc = 0.90 + cellHash(k * 61, 0, 27) * 0.60
    img.setScale(sc)
    img.setAlpha(0.35 + cellHash(k * 67, 0, 29) * 0.15)
    if (cellHash(k * 71, 0, 31) > 0.5) img.setFlipX(true)
    img.setDepth(10002)
    natureLayer.add(img)
    scene.tweens.add({
      targets: img,
      x: px + (cellHash(k * 73, 0, 33) - 0.5) * 140,
      y: py + (cellHash(k * 79, 0, 37) - 0.5) * 60,
      duration: 80000 + cellHash(k * 83, 0, 39) * 40000,
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    })
  }
}
