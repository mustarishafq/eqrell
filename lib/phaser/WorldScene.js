/**
 * WorldScene — main Phaser 3 scene for the EQrel World Engine.
 * Renders an isometric grid, buildings (procedural placeholder art),
 * villagers, and handles React-driven placement events.
 *
 * Exported as a factory so we can bind the Phaser namespace at runtime
 * (must be dynamic-imported client-side only).
 */
import { WORLD_SIZE, MUSALLA_ANCHOR, BUILDING_TEMPLATES } from '@/lib/worldEngine'
import { TILE_W, TILE_H, gridToScreen } from '@/components/eqrel/WorldCanvas'
import { createVillager, setFacing, attachWalkAnimation, stopWalkAnimation, VILLAGER_KIND_POOL } from '@/lib/phaser/Villager'
import { showBubble, GREETINGS, GREETING_REPLIES, DHIKR_POOL, ARRIVAL_DHIKR, ADHAN_BUBBLE, pickBubbleByLang } from '@/lib/phaser/Bubble'
import { renderNature } from '@/lib/phaser/Nature'

// Color palette derived from EQrel brand
const GRASS_LIGHT = 0x88c99a
const GRASS_DARK  = 0x6db07f
const GRID_LINE   = 0x000000

export function buildWorldScene(Phaser) {
  return class WorldScene extends Phaser.Scene {
    constructor() { super({ key: 'WorldScene' }) }

    // ─── Scene lifecycle ─────────────────────────────────────────
    create() {
      this.recomputeOrigin()

      // Layer containers — order matters (bottom→top)
      this.groundLayer   = this.add.container(0, 0)
      this.tileLayer     = this.add.container(0, 0)
      this.natureLayer   = this.add.container(0, 0)
      this.buildingLayer = this.add.container(0, 0)
      this.villagerLayer = this.add.container(0, 0)
      this.overlayLayer  = this.add.container(0, 0) // ghosts, hover indicators
      // Allow events on multiple stacked interactive objects — so cell zones
      // underneath buildings still fire cell-tap when the building itself is
      // tapped. Buildings additionally get their own dragstart/tap handlers.
      this.input.topOnly = false

      this.drawGround()
      this.drawGrid()
      this.syncStateFromRegistry()
      this.setupCameraControls()

      // React-driven build event (see startBuild in page.js)
      const emitter = this.game.registry.events
      emitter.on('changedata-pendingBuild', (_p, val) => this.handlePendingBuild(val))

      this.scale.on('resize', () => this.handleResize())
    }

    // ─── Camera pan (drag empty grass) + zoom (wheel/pinch) ───────
    setupCameraControls() {
      const camera = this.cameras.main
      // World extents — pad so users can look at edges comfortably
      const worldW = WORLD_SIZE * TILE_W + 400
      const worldH = WORLD_SIZE * TILE_H + 400
      camera.setBounds(
        this.originX - worldW / 2,
        this.originY - 200,
        worldW,
        worldH
      )
      // Start centered on Musalla anchor so the world feels grounded
      const musallaPos = gridToScreen(MUSALLA_ANCHOR.x, MUSALLA_ANCHOR.y, this.originX, this.originY)
      camera.centerOn(musallaPos.x, musallaPos.y)
      camera.setZoom(1.0)

      // Track building drag state so pan doesn't fight with building drag
      this.input.on('dragstart', () => { this._buildingDragging = true })
      this.input.on('dragend',   () => { this._buildingDragging = false })

      // Pan state
      let panStart = null
      this.input.on('pointerdown', (pointer, targets) => {
        if (this._buildingDragging) return
        // If any interactive object was hit (except zones = tiles), let it handle
        const hitBuilding = targets.some(t => t && t.type === 'Container' && t.buildingData)
        if (hitBuilding) return
        panStart = {
          px: pointer.x, py: pointer.y,
          sx: camera.scrollX, sy: camera.scrollY,
        }
      })
      this.input.on('pointermove', (pointer) => {
        if (!panStart || this._buildingDragging) return
        // Convert screen delta to world delta (account for zoom)
        camera.scrollX = panStart.sx - (pointer.x - panStart.px) / camera.zoom
        camera.scrollY = panStart.sy - (pointer.y - panStart.py) / camera.zoom
      })
      this.input.on('pointerup', () => { panStart = null })
      this.input.on('pointerupoutside', () => { panStart = null })

      // Wheel zoom (desktop)
      this.input.on('wheel', (_pointer, _objs, _dx, dy) => {
        const factor = dy > 0 ? 0.9 : 1.1
        const next = Phaser.Math.Clamp(camera.zoom * factor, 0.6, 1.8)
        camera.setZoom(next)
      })

      // Pinch zoom (mobile) — 2-finger distance ratio
      this._pinchInitialDist = null
      this._pinchInitialZoom = null
      this.input.on('pointermove', () => {
        const p1 = this.input.pointer1
        const p2 = this.input.pointer2
        if (!p1?.isDown || !p2?.isDown) {
          this._pinchInitialDist = null
          return
        }
        // Cancel pan while pinching
        panStart = null
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y)
        if (this._pinchInitialDist == null) {
          this._pinchInitialDist = dist
          this._pinchInitialZoom = camera.zoom
          return
        }
        const ratio = dist / this._pinchInitialDist
        const next = Phaser.Math.Clamp(this._pinchInitialZoom * ratio, 0.6, 1.8)
        camera.setZoom(next)
      })
    }

    // Rebuild origin so grid center sits in the viewport
    recomputeOrigin() {
      const cx = this.scale.width / 2
      const cy = this.scale.height / 2 - (WORLD_SIZE * TILE_H) / 4
      // Origin = screen (0,0) for grid cell (0,0). Offset so grid centers on cx.
      this.originX = cx
      this.originY = cy
    }

    handleResize() {
      this.recomputeOrigin()
      this.drawGround()
      this.drawGrid()
      this.syncStateFromRegistry()
      // Rebind camera bounds after resize since origin changed
      if (this.cameras?.main) {
        const worldW = WORLD_SIZE * TILE_W + 400
        const worldH = WORLD_SIZE * TILE_H + 400
        this.cameras.main.setBounds(
          this.originX - worldW / 2,
          this.originY - 200,
          worldW,
          worldH
        )
      }
    }

    // ─── Ground & grid ───────────────────────────────────────────
    drawGround() {
      this.groundLayer.removeAll(true)
      // Draw diamond tiles (2:1 iso). Alternate two greens for subtle texture.
      for (let row = 0; row < WORLD_SIZE; row++) {
        for (let col = 0; col < WORLD_SIZE; col++) {
          const { x, y } = gridToScreen(col, row, this.originX, this.originY)
          const tile = this.add.graphics()
          const fill = (row + col) % 2 === 0 ? GRASS_LIGHT : GRASS_DARK
          tile.fillStyle(fill, 1)
          tile.beginPath()
          tile.moveTo(x, y - TILE_H / 2)          // top
          tile.lineTo(x + TILE_W / 2, y)           // right
          tile.lineTo(x, y + TILE_H / 2)           // bottom
          tile.lineTo(x - TILE_W / 2, y)           // left
          tile.closePath()
          tile.fillPath()
          this.groundLayer.add(tile)
        }
      }
    }

    drawGrid() {
      this.tileLayer.removeAll(true)
      // Interactive hit zones per tile — used for tap/drag
      this.cellSprites = []
      for (let row = 0; row < WORLD_SIZE; row++) {
        for (let col = 0; col < WORLD_SIZE; col++) {
          const { x, y } = gridToScreen(col, row, this.originX, this.originY)
          // Diamond hit polygon for accurate tap targeting
          const poly = new Phaser.Geom.Polygon([
            0, -TILE_H / 2,   TILE_W / 2, 0,   0, TILE_H / 2,   -TILE_W / 2, 0,
          ])
          const zone = this.add.zone(x, y, TILE_W, TILE_H).setInteractive(poly, Phaser.Geom.Polygon.Contains)
          zone.setData({ col, row })
          zone.on('pointerover', () => this.onCellHover(col, row, true))
          zone.on('pointerout',  () => this.onCellHover(col, row, false))
          zone.on('pointerdown', () => this.onCellTap(col, row))
          this.cellSprites.push(zone)
          this.tileLayer.add(zone)
        }
      }
      // Subtle grid line overlay
      const g = this.add.graphics()
      g.lineStyle(1, GRID_LINE, 0.06)
      for (let row = 0; row <= WORLD_SIZE; row++) {
        const a = gridToScreen(0, row, this.originX, this.originY)
        const b = gridToScreen(WORLD_SIZE, row, this.originX, this.originY)
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath()
      }
      for (let col = 0; col <= WORLD_SIZE; col++) {
        const a = gridToScreen(col, 0, this.originX, this.originY)
        const b = gridToScreen(col, WORLD_SIZE, this.originX, this.originY)
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath()
      }
      this.tileLayer.add(g)
    }

    // ─── Sync from React registry ───────────────────────────────
    syncStateFromRegistry() {
      const state = this.game.registry.get('worldState')
      if (!state) return
      this.renderBuildings(state.buildings || [])
      this.renderNatureFlora(state.buildings || [], state.demeritCount || 0)
      this.spawnVillagers(state.buildings || [])
    }

    // Wrapper that plugs Nature.js into the current coord system
    renderNatureFlora(buildings, demeritCount) {
      renderNature(this, buildings, demeritCount, {
        originX: this.originX,
        originY: this.originY,
        TILE_W, TILE_H, WORLD_SIZE,
        gridToScreen,
        BUILDING_TEMPLATES,
        natureLayer: this.natureLayer,
      })
    }

    // ─── Building rendering (procedural placeholder art) ─────────
    renderBuildings(buildings) {
      this.buildingLayer.removeAll(true)
      // Sort by depth (row + col ascending — draw back tiles first)
      const sorted = [...buildings].sort((a, b) => (a.y + a.x) - (b.y + b.x))
      for (const b of sorted) {
        const t = BUILDING_TEMPLATES[b.templateId]
        if (!t) continue
        const { x, y } = gridToScreen(b.x, b.y, this.originX, this.originY)
        const container = this.add.container(x, y)
        container.setDepth(b.y + b.x)
        // Keep building metadata so drag handlers can find/update it later
        container.buildingData = { id: b.id, templateId: b.templateId, x: b.x, y: b.y, level: b.level }

        // Shadow (elliptical, ground level)
        const shadow = this.add.graphics()
        shadow.fillStyle(0x000000, 0.28)
        shadow.fillEllipse(0, TILE_H / 4, TILE_W * 0.7, TILE_H * 0.55)
        container.add(shadow)

        // Base "body" of building (isometric box)
        this.drawBuildingSprite(container, t, b.level || 1)

        // Level pip badge (top-right corner)
        if ((b.level || 1) > 1) {
          const badge = this.add.text(TILE_W / 3, -TILE_H, `L${b.level}`, {
            fontFamily: 'monospace', fontSize: '12px', color: '#FFB703',
            fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
          }).setOrigin(0.5)
          container.add(badge)
        }

        // Sacred glow for musalla
        if (t.isSacred) {
          const glow = this.add.graphics()
          glow.fillStyle(0xFFB703, 0.18)
          glow.fillCircle(0, -TILE_H / 4, TILE_W * 0.9)
          container.addAt(glow, 1) // just above shadow
          this.tweens.add({
            targets: glow, alpha: { from: 0.10, to: 0.28 },
            duration: 1800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
          })
        }

        this.buildingLayer.add(container)

        // ─── Drag & drop — enabled by default for non-musalla buildings ──
        // The Musalla is the anchor of the village; it stays put.
        if (!t.isSacred && b.id) {
          this.enableBuildingDrag(container, t)
        }
      }
    }

    // Enable drag-and-drop on a building container. On drop, snaps to the
    // nearest grid cell, validates via /api/world/:childId/move, and reverts
    // on failure. Emits 'moved' event to React on success.
    enableBuildingDrag(container, template) {
      const sz = template.tileSize || { w: 1, h: 1 }
      // Rectangular hit area over the building sprite
      const hitW = TILE_W * (sz.w + 0.4)
      const hitH = TILE_H * 2.2
      const hitArea = new Phaser.Geom.Rectangle(-hitW / 2, -hitH * 0.8, hitW, hitH)
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, {
        draggable: true,
      })
      this.input.setDraggable(container)

      // Visual affordance — subtle scale-up on hover to signal draggable
      container.on('pointerover', () => {
        if (this.game.registry.get('interactionLocked')) return
        container.setScale(1.06)
      })
      container.on('pointerout', () => {
        if (!container._dragging) container.setScale(1.0)
      })

      // Track pointerdown to distinguish tap vs drag. Phaser only fires
      // dragstart when the pointer moves ≥ its drag threshold; a pure click
      // never triggers dragstart. So we implement tap detection ourselves.
      container.on('pointerdown', (pointer) => {
        if (this.game.registry.get('interactionLocked')) return
        container._downTime = Date.now()
        container._downPX = pointer.x
        container._downPY = pointer.y
        container._tapCandidate = true
      })
      container.on('pointerup', (pointer) => {
        if (!container._tapCandidate) return
        container._tapCandidate = false
        // If dragging already handled it, skip
        if (container._dragging || container._dragMoved) return
        const moved = Math.hypot(pointer.x - container._downPX, pointer.y - container._downPY)
        const dt = Date.now() - (container._downTime || 0)
        // A tap = short duration + minimal movement
        if (moved < 8 && dt < 500) {
          const onEvent = this.game.registry.get('onEvent')
          onEvent?.('cell-tap', {
            col: container.buildingData.x,
            row: container.buildingData.y,
          })
        }
      })

      container.on('dragstart', (pointer) => {
        if (this.game.registry.get('interactionLocked')) return
        container._dragging = true
        container._dragMoved = false  // track if actual drag happened vs pure tap
        container._downX = container.x
        container._downY = container.y
        container._origX = container.x
        container._origY = container.y
        container._origGridX = container.buildingData.x
        container._origGridY = container.buildingData.y
        container.setDepth(30000)
        container.setAlpha(0.85)
        // Draw a ghost outline at the current cell so user sees "target"
        this._dragGhost = this.add.graphics()
        this._dragGhost.setDepth(29999)
        this.buildingLayer.add(this._dragGhost)
      })

      container.on('drag', (pointer, dragX, dragY) => {
        if (!container._dragging) return
        // Only count as an actual drag if the pointer moved >8px from start
        const moved = Math.hypot(dragX - container._downX, dragY - container._downY)
        if (moved > 8) container._dragMoved = true
        container.x = dragX
        container.y = dragY
        // Snap ghost to nearest valid grid cell
        const { col, row } = this.screenToGrid(dragX, dragY)
        const clampedCol = Math.max(0, Math.min(WORLD_SIZE - sz.w, col))
        const clampedRow = Math.max(0, Math.min(WORLD_SIZE - sz.h, row))
        const valid = this.isCellPlacementValid(clampedCol, clampedRow, sz, container.buildingData.id)
        container._pendingCell = { x: clampedCol, y: clampedRow, valid }
        this._drawDragGhost(clampedCol, clampedRow, sz, valid)
      })

      container.on('dragend', async () => {
        container._dragging = false
        container.setScale(1.0)
        container.setAlpha(1.0)
        if (this._dragGhost) { this._dragGhost.destroy(); this._dragGhost = null }
        // If pointer barely moved → treat as tap → open info card in React
        if (!container._dragMoved) {
          container.setDepth(container._origGridY + container._origGridX)
          const onEvent = this.game.registry.get('onEvent')
          onEvent?.('cell-tap', {
            col: container.buildingData.x,
            row: container.buildingData.y,
          })
          return
        }
        const pending = container._pendingCell
        const snapBack = () => {
          this.tweens.add({
            targets: container, x: container._origX, y: container._origY,
            duration: 260, ease: 'Back.easeOut',
          })
          container.setDepth(container._origGridY + container._origGridX)
        }
        if (!pending || !pending.valid) { snapBack(); return }
        if (pending.x === container._origGridX && pending.y === container._origGridY) {
          snapBack(); return
        }
        const target = gridToScreen(pending.x, pending.y, this.originX, this.originY)
        this.tweens.add({
          targets: container, x: target.x, y: target.y,
          duration: 260, ease: 'Back.easeOut',
        })
        container.setDepth(pending.y + pending.x)
        const onEvent = this.game.registry.get('onEvent')
        onEvent?.('building-moved', {
          buildingId: container.buildingData.id,
          x: pending.x, y: pending.y,
          origX: container._origGridX, origY: container._origGridY,
        })
      })
    }

    // Convert screen coords back to grid coordinates (inverse of gridToScreen)
    screenToGrid(sx, sy) {
      const dx = sx - this.originX
      const dy = sy - this.originY
      const col = Math.round((dx / (TILE_W / 2) + dy / (TILE_H / 2)) / 2)
      const row = Math.round((dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2)
      return { col, row }
    }

    // Check if a rectangular footprint at (col,row) with size can be placed,
    // excluding the building with `excludeId` (the one being dragged).
    isCellPlacementValid(col, row, size, excludeId) {
      const state = this.game.registry.get('worldState')
      const buildings = state?.buildings || []
      const TS = { musalla: { w: 2, h: 2 }, rumah: { w: 1, h: 1 }, kebun: { w: 1, h: 1 } }
      if (col < 0 || row < 0 || col + size.w > WORLD_SIZE || row + size.h > WORLD_SIZE) return false
      for (const b of buildings) {
        if (b.id === excludeId) continue
        const s = TS[b.templateId] || { w: 1, h: 1 }
        for (let dx = 0; dx < size.w; dx++) {
          for (let dy = 0; dy < size.h; dy++) {
            const tx = col + dx, ty = row + dy
            if (tx >= b.x && tx < b.x + s.w && ty >= b.y && ty < b.y + s.h) return false
          }
        }
      }
      return true
    }

    // Draw a green/red ghost diamond outline at target cell
    _drawDragGhost(col, row, size, valid) {
      if (!this._dragGhost) return
      this._dragGhost.clear()
      const color = valid ? 0x2e7d5b : 0xdc2626
      const alpha = valid ? 0.55 : 0.55
      // For 1x1 footprint, single diamond; for 2x2, union of 4
      for (let dx = 0; dx < size.w; dx++) {
        for (let dy = 0; dy < size.h; dy++) {
          const { x, y } = gridToScreen(col + dx, row + dy, this.originX, this.originY)
          this._dragGhost.lineStyle(3, color, alpha + 0.2)
          this._dragGhost.fillStyle(color, alpha * 0.4)
          this._dragGhost.beginPath()
          this._dragGhost.moveTo(x, y - TILE_H / 2)
          this._dragGhost.lineTo(x + TILE_W / 2, y)
          this._dragGhost.lineTo(x, y + TILE_H / 2)
          this._dragGhost.lineTo(x - TILE_W / 2, y)
          this._dragGhost.closePath()
          this._dragGhost.fillPath()
          this._dragGhost.strokePath()
        }
      }
    }

    // Procedural building drawing — a simple isometric box + roof/dome per type.
    drawBuildingSprite(container, template, level) {
      const g = this.add.graphics()
      const baseColor = Phaser.Display.Color.HexStringToColor(template.color).color
      const accent = Phaser.Display.Color.HexStringToColor(template.accentColor).color
      const w = TILE_W * 0.85
      const h = TILE_H * 0.85
      const bodyH = 44 + (level - 1) * 12   // taller with level

      // Isometric box body (3 visible faces)
      // Top face (diamond)
      g.fillStyle(baseColor, 1)
      g.beginPath()
      g.moveTo(0, -bodyH - h / 2)
      g.lineTo(w / 2, -bodyH)
      g.lineTo(0, -bodyH + h / 2)
      g.lineTo(-w / 2, -bodyH)
      g.closePath(); g.fillPath()
      // Right face
      g.fillStyle(Phaser.Display.Color.IntegerToColor(baseColor).darken(20).color, 1)
      g.beginPath()
      g.moveTo(w / 2, -bodyH)
      g.lineTo(w / 2, 0)
      g.lineTo(0, h / 2)
      g.lineTo(0, -bodyH + h / 2)
      g.closePath(); g.fillPath()
      // Left face (lighter)
      g.fillStyle(Phaser.Display.Color.IntegerToColor(baseColor).darken(10).color, 1)
      g.beginPath()
      g.moveTo(-w / 2, -bodyH)
      g.lineTo(-w / 2, 0)
      g.lineTo(0, h / 2)
      g.lineTo(0, -bodyH + h / 2)
      g.closePath(); g.fillPath()
      container.add(g)

      // Icon topper (emoji-based visual identity)
      const iconMap = {
        musalla: level >= 2 ? '🕌' : '🕌',
        rumah: '🏠',
        kebun: '🌴',
      }
      const icon = this.add.text(0, -bodyH - h / 4, iconMap[template.id] || template.icon, {
        fontSize: level >= 2 ? '38px' : '32px',
      }).setOrigin(0.5)
      container.add(icon)

      // Dome (musalla only) — golden semicircle above roof
      if (template.id === 'musalla') {
        const dome = this.add.graphics()
        dome.fillStyle(accent, 1)
        dome.fillEllipse(0, -bodyH - h / 2 - 8, 26 + (level - 1) * 8, 20 + (level - 1) * 6)
        container.add(dome)
        // Crescent moon on top
        const moon = this.add.text(0, -bodyH - h / 2 - 22 - (level - 1) * 6, '☾', {
          fontSize: '18px', color: '#FFB703', fontStyle: 'bold',
        }).setOrigin(0.5)
        container.add(moon)
      }
    }

    // ─── Villagers ──────────────────────────────────────────────
    // Villagers have GOALS: visit Musalla / house / orchard / chat with a
    // neighbour / rest. They walk slowly (2.4x slower than before), pause at
    // destinations to reflect/pray, and exchange Islamic greetings when they
    // pass close to each other. Idle dhikr bubbles keep the world alive.
    // Bubble language follows the user's global language toggle (ms/en/id/ar)
    // via `game.registry.get('lang')`, updated live by WorldCanvas.
    spawnVillagers(buildings) {
      // Helper to read current language from React (live-synced by WorldCanvas)
      const getLang = () => this.game.registry.get('lang') || 'ms'
      // Clean up existing
      if (this.villagerTweens) this.villagerTweens.forEach(t => t?.stop?.())
      this.villagerTweens = []
      if (this.villagers) this.villagers.forEach(v => stopWalkAnimation(v))
      this.villagerLayer.removeAll(true)
      if (this.gatherTimer) { this.gatherTimer.remove(); this.gatherTimer = null }
      if (this.idleShuffleTimer) { this.idleShuffleTimer.remove(); this.idleShuffleTimer = null }
      if (this.dhikrTimer) { this.dhikrTimer.remove(); this.dhikrTimer = null }
      if (this.socialCheckTimer) { this.socialCheckTimer.remove(); this.socialCheckTimer = null }

      const musalla = buildings.find(b => b.templateId === 'musalla')
      if (!musalla) return

      // Compute total villager capacity, cap at 6 for a calm village feel
      let capacity = 0
      for (const b of buildings) {
        const t = BUILDING_TEMPLATES[b.templateId]
        if (t) capacity += (t.villagerSpawn || 0)
      }
      const count = Math.min(capacity, 6)

      // Build the "occupied cells" set so villagers never walk on buildings
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
      this._occupiedCells = occupied

      // Precompute POI (points of interest) grid positions for goal system
      const houses = buildings.filter(b => b.templateId === 'rumah')
      const orchards = buildings.filter(b => b.templateId === 'kebun')

      const anchor = gridToScreen(musalla.x + 0.5, musalla.y + 1.5, this.originX, this.originY)

      // Spawn villagers
      const villagers = []
      for (let i = 0; i < count; i++) {
        const kind = VILLAGER_KIND_POOL[i % VILLAGER_KIND_POOL.length]
        const startCell = this.pickFreeCellNearMusalla(musalla, 2, 4) ||
                          this.pickFreeCellNearMusalla(musalla, 1, 5)
        const startPos = startCell
          ? gridToScreen(startCell.x + 0.5, startCell.y + 0.5, this.originX, this.originY)
          : { x: anchor.x + (Math.random() - 0.5) * 100, y: anchor.y + (Math.random() - 0.5) * 60 }
        const v = createVillager(this, startPos.x, startPos.y, {
          kind,
          seed: i * 137 + Math.floor(Math.random() * 100),
        })
        v.setDepth(9000 + Math.floor(startPos.y))
        v.gatherMode = false
        v.isWalking = false
        v.currentGoal = null       // 'musalla' | 'house' | 'orchard' | 'chat' | 'rest'
        v.lastGreetedAt = new Map()  // otherVillager.id -> timestamp (dedupes greetings)
        v.id = 'v' + i
        this.villagerLayer.add(v)
        villagers.push(v)
      }
      this.villagers = villagers

      // ─── Goal picker ──────────────────────────────────────
      const pickGoal = (v) => {
        // Weighted random goal — musalla is popular, houses/orchards moderate
        const options = []
        options.push({ type: 'musalla', weight: 3, target: musalla })
        for (const h of houses) options.push({ type: 'house', weight: 2, target: h })
        for (const o of orchards) options.push({ type: 'orchard', weight: 2, target: o })
        options.push({ type: 'rest', weight: 1, target: null })
        const total = options.reduce((s, o) => s + o.weight, 0)
        let r = Math.random() * total
        for (const o of options) { r -= o.weight; if (r <= 0) return o }
        return options[0]
      }

      // Compute a wander cell adjacent to a target building
      const targetCellNear = (targetBuilding) => {
        // Pick a cell adjacent to (but not on) the building footprint
        const t = BUILDING_TEMPLATES[targetBuilding.templateId]
        const sz = t?.tileSize || { w: 1, h: 1 }
        const bx = targetBuilding.x, by = targetBuilding.y
        const candidates = []
        for (let dx = -1; dx <= sz.w; dx++) {
          for (let dy = -1; dy <= sz.h; dy++) {
            // Only cells on the perimeter
            if (dx >= 0 && dx < sz.w && dy >= 0 && dy < sz.h) continue
            const cx = bx + dx, cy = by + dy
            if (cx < 0 || cx >= WORLD_SIZE || cy < 0 || cy >= WORLD_SIZE) continue
            if (occupied.has(`${cx},${cy}`)) continue
            candidates.push({ x: cx, y: cy })
          }
        }
        if (!candidates.length) return null
        return candidates[Math.floor(Math.random() * candidates.length)]
      }

      const pickFacingFromDelta = (dx, dy) => (dy < -8 ? 'back' : 'front')

      // ─── Walk to goal, then pause + optional bubble ───────
      const goToGoal = (villager) => {
        if (!villager.active) return
        if (villager.gatherMode) return
        const goal = pickGoal(villager)
        villager.currentGoal = goal.type
        let targetCell = null
        if (goal.type === 'rest') {
          // Stay put for 3-6s
          this.time.delayedCall(3000 + Math.random() * 3000, () => goToGoal(villager))
          return
        } else {
          targetCell = goal.target ? targetCellNear(goal.target) : null
        }
        if (!targetCell) {
          this.time.delayedCall(1500, () => goToGoal(villager))
          return
        }
        const targetPos = gridToScreen(targetCell.x + 0.5, targetCell.y + 0.5, this.originX, this.originY)
        const dx = targetPos.x - villager.x
        const dy = targetPos.y - villager.y
        const dist = Math.hypot(dx, dy)
        if (dist < 12) {
          this.time.delayedCall(800 + Math.random() * 1200, () => goToGoal(villager))
          return
        }
        setFacing(villager, pickFacingFromDelta(dx, dy))
        villager.scaleX = dx < 0 ? -1 : 1
        villager.isWalking = true
        attachWalkAnimation(this, villager)

        // ~2.4× slower than before — feels purposeful, not frantic
        const dur = Math.min(8500, 2800 + dist * 14)
        this.villagerTweens.push(this.tweens.add({
          targets: villager,
          x: targetPos.x, y: targetPos.y,
          duration: dur, ease: 'Sine.easeInOut',
          onUpdate: () => { villager.setDepth(9000 + Math.floor(villager.y)) },
          onComplete: () => {
            stopWalkAnimation(villager)
            villager.isWalking = false
            setFacing(villager, 'front')
            // Show an "arrival" bubble reflecting what they came to do
            const pool = ARRIVAL_DHIKR[goal.type]
            if (pool) {
              showBubble(this, villager, pickBubbleByLang(pool, getLang()), {
                style: goal.type === 'musalla' ? 'dhikr' : 'chat',
                duration: 2400,
              })
            }
            // Pause 2-5s at destination ("praying" / "resting" / "harvesting")
            const pauseMs = goal.type === 'musalla'
              ? 4500 + Math.random() * 2500   // longer pause at musalla
              : 2200 + Math.random() * 2500
            this.time.delayedCall(pauseMs, () => goToGoal(villager))
          },
        }))
      }

      // Kick off staggered so they don't all start at once
      villagers.forEach((v, i) => {
        this.time.delayedCall(600 + i * 800, () => goToGoal(v))
      })

      // ─── Social greeting check ────────────────────────────
      // Every 700ms, look for villager pairs that are close (<50px) AND both
      // walking. If found and they haven't greeted recently (>10s), one greets
      // and the other replies after a beat.
      const now = () => Date.now()
      const trySocialInteraction = () => {
        const walkers = villagers.filter(v => v.active && v.isWalking && !v.gatherMode)
        for (let i = 0; i < walkers.length; i++) {
          for (let j = i + 1; j < walkers.length; j++) {
            const a = walkers[i], b = walkers[j]
            const dx = a.x - b.x, dy = a.y - b.y
            const d = Math.hypot(dx, dy)
            if (d < 55) {
              const lastA = a.lastGreetedAt.get(b.id) || 0
              if (now() - lastA < 15000) continue
              a.lastGreetedAt.set(b.id, now())
              b.lastGreetedAt.set(a.id, now())
              const lang = getLang()
              showBubble(this, a, pickBubbleByLang(GREETINGS, lang), { style: 'greeting', duration: 2200 })
              this.time.delayedCall(700, () => {
                if (b.active) showBubble(this, b, pickBubbleByLang(GREETING_REPLIES, lang), { style: 'reply', duration: 2200 })
              })
              return  // one interaction per tick
            }
          }
        }
      }
      this.socialCheckTimer = this.time.addEvent({
        delay: 900, callback: trySocialInteraction, loop: true, startAt: 500,
      })

      // ─── Random idle dhikr ─────────────────────────────────
      // Every ~9-15s, a random villager exclaims a dhikr while idle
      const randomDhikr = () => {
        const idle = villagers.filter(v => v.active && !v.isWalking && !v.gatherMode)
        if (!idle.length) return
        const v = idle[Math.floor(Math.random() * idle.length)]
        showBubble(this, v, pickBubbleByLang(DHIKR_POOL, getLang()), { style: 'dhikr', duration: 2600 })
      }
      this.dhikrTimer = this.time.addEvent({
        delay: 11_000, callback: randomDhikr, loop: true, startAt: 6000,
      })

      // ─── Prayer-time gather (every 90s, all rush to musalla for 15s) ──
      const gatherAtMusalla = () => {
        villagers.forEach((v, i) => {
          if (!v.active) return
          v.gatherMode = true
          const gAngle = (i / villagers.length) * Math.PI * 2
          const gR = 34 + (i % 3) * 10
          const gX = anchor.x + Math.cos(gAngle) * gR
          const gY = anchor.y + Math.sin(gAngle) * gR * 0.5
          const dx = gX - v.x, dy = gY - v.y
          setFacing(v, dy < -8 ? 'back' : 'front')
          v.scaleX = dx < 0 ? -1 : 1
          attachWalkAnimation(this, v)
          this.villagerTweens.push(this.tweens.add({
            targets: v, x: gX, y: gY, duration: 2400, ease: 'Sine.easeInOut',
            onUpdate: () => { v.setDepth(9000 + Math.floor(v.y)) },
            onComplete: () => {
              stopWalkAnimation(v)
              setFacing(v, 'front')
              // On arrival, show congregational bubble
              if (i === 0) {
                showBubble(this, v, ADHAN_BUBBLE[getLang()] || ADHAN_BUBBLE.ms, { style: 'dhikr', duration: 3000 })
              }
            },
          }))
        })
        this.time.delayedCall(15000, () => {
          villagers.forEach(v => {
            if (v.active) { v.gatherMode = false; goToGoal(v) }
          })
        })
      }
      this.gatherTimer = this.time.addEvent({
        delay: 90_000, callback: gatherAtMusalla, loop: true, startAt: 45_000,
      })
    }

    // Helper: pick a random un-occupied cell within ring [minR, maxR] from musalla
    pickFreeCellNearMusalla(musalla, minR, maxR) {
      const occupied = this._occupiedCells || new Set()
      const ax = musalla.x, ay = musalla.y
      const candidates = []
      for (let r = minR; r <= maxR; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
            const x = ax + dx, y = ay + dy
            if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) continue
            if (occupied.has(`${x},${y}`)) continue
            candidates.push({ x, y })
          }
        }
      }
      if (!candidates.length) return null
      return candidates[Math.floor(Math.random() * candidates.length)]
    }

    // ─── Interaction ────────────────────────────────────────────
    onCellHover(col, row, entering) {
      // For future: highlight during drag mode
      const pending = this.game.registry.get('pendingBuild')
      if (!pending || !pending.dragMode) return
      // TODO: valid/invalid highlight overlay
    }

    onCellTap(col, row) {
      // Belt-and-suspenders: if React has any modal/overlay open, ignore taps
      // to prevent phantom cell events firing when clicking overlay buttons that
      // happen to sit above the isometric grid.
      if (this.game.registry.get('interactionLocked')) return
      const pending = this.game.registry.get('pendingBuild')
      if (!pending) {
        // Regular tap on cell — surface it to React for upgrade dialog
        const onEvent = this.game.registry.get('onEvent')
        onEvent?.('cell-tap', { col, row })
        return
      }
      if (pending.awaitingPlacement) {
        // React handled the Bismillah confirm; user picked a cell
        const onEvent = this.game.registry.get('onEvent')
        onEvent?.('cell-selected', { col, row, templateId: pending.templateId })
      }
    }

    handlePendingBuild(pending) {
      // For future: show ghost sprite following pointer when drag mode active
      // For MVP tap-to-place, React will show a fullscreen prompt and call cell-selected
    }

    // ─── Red-Alert-style construction animation ─────────────────
    // Shows a scaffolding fence + rising building + dust bursts.
    // Total duration ~1800ms. Calls onComplete when done.
    playConstruction(gridX, gridY, templateId, level, onComplete) {
      const t = BUILDING_TEMPLATES[templateId]
      if (!t) { onComplete?.(); return }
      const isMusalla = templateId === 'musalla'
      const sz = t.tileSize || { w: 1, h: 1 }
      // For 2x2 buildings, centre the anchor between the 4 cells
      const cx = gridX + (sz.w - 1) / 2
      const cy = gridY + (sz.h - 1) / 2
      const { x, y } = gridToScreen(cx + 0.5, cy + 0.5, this.originX, this.originY)

      const scene = this
      const constructionLayer = scene.add.container(0, 0)
      constructionLayer.setDepth(gridY + gridX + 10)
      scene.buildingLayer.add(constructionLayer)

      // ─── Scaffolding fence (wooden posts + rope) ─────────
      const fence = scene.add.graphics()
      fence.setPosition(x, y)
      const fenceW = TILE_W * (sz.w * 0.9)
      const fenceH = TILE_H * (sz.h * 0.9)
      // Diamond outline of scaffolding (4 corners + posts)
      fence.lineStyle(2, 0xc9a86a, 1)
      fence.beginPath()
      fence.moveTo(0, -fenceH / 2)          // top
      fence.lineTo(fenceW / 2, 0)            // right
      fence.lineTo(0, fenceH / 2)            // bottom
      fence.lineTo(-fenceW / 2, 0)           // left
      fence.closePath()
      fence.strokePath()
      // Posts at each corner
      fence.fillStyle(0x8b6f47, 1)
      const posts = [
        { px: 0, py: -fenceH / 2 - 6 },
        { px: fenceW / 2, py: -6 },
        { px: 0, py: fenceH / 2 - 6 },
        { px: -fenceW / 2, py: -6 },
      ]
      posts.forEach(p => fence.fillRect(p.px - 1.5, p.py, 3, 14))
      // Yellow warning flags on top posts
      fence.fillStyle(0xfacc15, 1)
      fence.fillTriangle(0, -fenceH / 2 - 6, 8, -fenceH / 2 - 2, 0, -fenceH / 2 + 2)
      constructionLayer.add(fence)

      // ─── Initial dust burst ──────────────────────────────
      const dustPuffs = []
      for (let i = 0; i < 8; i++) {
        const p = scene.add.graphics()
        p.fillStyle(0xdcc8a4, 0.75)
        p.fillCircle(0, 0, 4 + Math.random() * 3)
        p.x = x + (Math.random() - 0.5) * fenceW * 0.8
        p.y = y + (Math.random() - 0.5) * fenceH * 0.4 + 4
        constructionLayer.add(p)
        dustPuffs.push(p)
        scene.tweens.add({
          targets: p,
          y: p.y - 25 - Math.random() * 15,
          alpha: 0,
          scale: 2,
          duration: 800 + Math.random() * 400,
          onComplete: () => p.destroy(),
        })
      }

      // ─── Building sprite — rises from tiny to full over the phases ──
      const bContainer = scene.add.container(x, y)
      this.drawBuildingSprite(bContainer, t, level || 1)
      bContainer.setScale(0.15)
      bContainer.alpha = 0.5
      constructionLayer.add(bContainer)

      // ─── Little worker sprites (2 tiny hammering figures) ──
      // Only for non-musalla builds — musalla is sacred, no workers
      const workers = []
      if (!isMusalla) {
        for (let i = 0; i < 2; i++) {
          const w = scene.add.graphics()
          const wx = x + (i === 0 ? -fenceW / 3 : fenceW / 3)
          const wy = y + fenceH / 4
          // Body (green shirt) + head
          w.fillStyle(0x2e7d5b, 1)
          w.fillRect(-3, -6, 6, 7)
          w.fillStyle(0xe6b58a, 1)
          w.fillCircle(0, -8, 3)
          // Hard hat
          w.fillStyle(0xfacc15, 1)
          w.fillEllipse(0, -10, 6, 3)
          // Hammer (small line)
          w.lineStyle(1.2, 0x3a2818, 1)
          w.beginPath()
          w.moveTo(2, -4); w.lineTo(6, -6)
          w.strokePath()
          w.fillStyle(0x6b6b6b, 1)
          w.fillRect(5, -7, 2, 2)
          w.setPosition(wx, wy)
          constructionLayer.add(w)
          workers.push(w)
          // Hammer swing animation
          scene.tweens.add({
            targets: w, angle: { from: -8, to: 8 },
            duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          })
        }
      }

      // ─── Sacred glow ring for musalla during construction ──
      let sacredGlow = null
      if (isMusalla) {
        sacredGlow = scene.add.graphics()
        sacredGlow.setPosition(x, y)
        sacredGlow.fillStyle(0xffb703, 0.25)
        sacredGlow.fillCircle(0, -20, 40)
        constructionLayer.add(sacredGlow)
        scene.tweens.add({
          targets: sacredGlow, alpha: { from: 0.15, to: 0.4 },
          duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }

      // ─── Phased build-up ────────────────────────────────
      // Phase 1 (0-600ms): dust settles, building at 20% scale
      // Phase 2 (600-1200ms): scaling up to 70%
      // Phase 3 (1200-1600ms): final pop to 100%
      // Phase 4 (1600-1800ms): fence & workers fade + sparkle
      scene.tweens.chain({
        targets: bContainer,
        tweens: [
          { scale: 0.4, alpha: 0.7, duration: 600, ease: 'Sine.easeOut' },
          { scale: 0.85, alpha: 0.95, duration: 600, ease: 'Sine.easeInOut' },
          { scale: 1.1, alpha: 1.0, duration: 300, ease: 'Back.easeOut' },
          { scale: 1.0, duration: 200, ease: 'Sine.easeIn' },
        ],
        onComplete: () => {
          // Fade fence + workers
          scene.tweens.add({
            targets: [fence, ...workers, ...(sacredGlow ? [sacredGlow] : [])],
            alpha: 0,
            duration: 350,
            onComplete: () => {
              // Final sparkle burst
              for (let i = 0; i < 8; i++) {
                const sp = scene.add.graphics()
                sp.fillStyle(0xffb703, 1)
                const angle = (i / 8) * Math.PI * 2
                const startR = 6
                sp.fillCircle(0, 0, 2)
                sp.x = x + Math.cos(angle) * startR
                sp.y = y - 12 + Math.sin(angle) * startR * 0.6
                constructionLayer.add(sp)
                scene.tweens.add({
                  targets: sp,
                  x: x + Math.cos(angle) * 30,
                  y: y - 12 + Math.sin(angle) * 30 * 0.6,
                  alpha: 0,
                  duration: 500,
                  onComplete: () => sp.destroy(),
                })
              }
              // Destroy the temp construction layer after all animations settle
              scene.time.delayedCall(600, () => {
                try { constructionLayer.destroy() } catch { /* teardown */ }
                onComplete?.()
              })
            },
          })
        },
      })
    }

    // Kept for backward compat — routes to playConstruction
    playConstructionAnimation(building, onComplete) {
      this.playConstruction(building.x, building.y, building.templateId, building.level || 1, onComplete)
    }
  }
}
