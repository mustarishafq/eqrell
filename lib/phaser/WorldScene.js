/**
 * WorldScene — main Phaser 3 scene for the EQrel World Engine.
 * Renders an isometric grid, buildings (procedural placeholder art),
 * villagers, and handles React-driven placement events.
 *
 * Exported as a factory so we can bind the Phaser namespace at runtime
 * (must be dynamic-imported client-side only).
 */
import { WORLD_SIZE, MAX_WORLD_SIZE, MUSALLA_ANCHOR, BUILDING_TEMPLATES, getCurrentBounds } from '@/lib/worldEngine'
import { TILE_W, TILE_H, gridToScreen } from '@/components/eqrel/WorldCanvas'
import { createVillager, setFacing, attachWalkAnimation, stopWalkAnimation, VILLAGER_KIND_POOL } from '@/lib/phaser/Villager'
import { showBubble, GREETINGS, GREETING_REPLIES, DHIKR_POOL, ARRIVAL_DHIKR, ADHAN_BUBBLE, pickBubbleByLang } from '@/lib/phaser/Bubble'
import { renderNature } from '@/lib/phaser/Nature'

// Color palette derived from EQrel brand
// Uniform grass palette (no checkerboard) — subtle natural blobs are drawn
// separately so the ground doesn't look like a grid of alternating boxes.
// Tones are intentionally very close in luminance so the eye reads it as
// one meadow, not distinct patches.
const GRASS_BASE  = 0x7ec091   // single flat green baseline
const GRASS_BLOB  = 0x78bd8b   // very slightly darker patch color
const GRASS_LIGHT_BLOB = 0x86c797 // very slightly lighter patch color
const GRID_LINE   = 0x000000

// ─── Global light-source convention ───────────────────────────────
// The whole world assumes the sun sits at the TOP-RIGHT of the isometric
// canvas. Every asset (illustrated PNGs, procedural sprites, shadows) is
// tuned to this direction so nothing looks physically contradictory.
//   • Ground shadows drift toward the bottom-LEFT of each object.
//   • Right/east faces of procedural boxes receive light (brighter).
//   • Left/west faces sit in shade (darker).
// If we ever add a night mode we just flip these vectors + tint the scene.
const SHADOW_DX = -14   // px — shadow cast to the left of each building
const SHADOW_DY =  8    // px — shadow slightly forward (south) too
const SHADOW_ALPHA = 0.32

export function buildWorldScene(Phaser) {
  return class WorldScene extends Phaser.Scene {
    constructor() { super({ key: 'WorldScene' }) }

    // ─── Preload — external art assets ───────────────────────────
    // Central registry of illustrated PNG assets that replace procedural
    // sprites. To add a new asset: (1) drop the optimised PNG in
    // /public/assets/world/<category>/<id>.png; (2) add an entry here with a
    // sensible baseScale (0.35-0.4 for 1×1 tiles, 0.55 for 2×2, 0.75+ for 3×3);
    // (3) the drawBuildingSprite generic branch below picks it up automatically.
    // upgradeScale is an OPTIONAL multiplier applied per level for buildings
    // that have an upgrade path (e.g. Musalla → Masjid → Jami' Masjid).
    static ASSET_REGISTRY = {
      musalla: { path: '/assets/world/musalla.png',       baseScale: 0.55, yOffset: 6, upgradeScale: 0.28 },
      banglo:  { path: '/assets/world/rumah/banglo.png',  baseScale: 0.38, yOffset: 6 },
    }

    preload() {
      // Load every registered asset with a stable key 'bld_<id>'.
      const reg = WorldScene.ASSET_REGISTRY
      for (const [id, cfg] of Object.entries(reg)) {
        this.load.image(`bld_${id}`, cfg.path)
      }
    }

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
      // Only fire pointer events on the TOPMOST interactive object at the
      // pointer location. This is critical for our custom hold-to-drag: if
      // a building container is tapped, ONLY its handlers fire — the tile
      // zone beneath it does NOT also fire pointerdown (which used to open
      // the info-card instantly on touch, before the 2s hold could arm the
      // drag). Bug: user reported "hold 2s to relocate not working" — the
      // real cause was the underlying zone stealing the tap the moment the
      // finger touched a building.
      this.input.topOnly = true
      // Rollback per user request: use Phaser's built-in drag (setDraggable
      // per container). Custom 2s hold-to-drag was more strict but users
      // reported it "still not function" on their device. Working drag with
      // occasional accidental relocation is preferred over an unreliable one.
      // dragTimeThreshold=250ms + dragDistanceThreshold=10px keeps casual
      // taps from triggering drag (need a small delay AND some movement).
      this.input.dragTimeThreshold = 250
      this.input.dragDistanceThreshold = 10

      // Track current world bounds so we can detect progressive expansion
      // (buildingsCount thresholds) and re-draw the ground/grid + camera bounds
      // outward with a soft fade-in when it grows.
      this._currentBounds = this._computeBounds()
      this.drawGround()
      this.drawGrid()
      // Grid is hidden by default — natural land look. It appears only while
      // the child is dragging a new template from the sidebar (like RTS games).
      this.tileLayer.setVisible(false)
      this.syncStateFromRegistry()
      this.setupCameraControls()

      // Toggle grid visibility whenever React signals buildDrag is active
      this.game.registry.events.on('changedata-buildDragActive', (_p, val) => {
        this.tileLayer.setVisible(!!val)
      })

      // React-driven build event (see startBuild in page.js)
      const emitter = this.game.registry.events
      emitter.on('changedata-pendingBuild', (_p, val) => this.handlePendingBuild(val))

      this.scale.on('resize', () => this.handleResize())
    }

    // ─── Dynamic bounds helpers ──────────────────────────────────
    // Read the current world state from the registry and compute bounds
    // (minX, maxX, minY, maxY, size, musallaPos). Falls back to defaults.
    _computeBounds() {
      const state = this.game.registry.get('worldState')
      return getCurrentBounds(state)
    }

    // ─── Camera pan (drag empty grass) + zoom (wheel/pinch) ───────
    setupCameraControls() {
      const camera = this.cameras.main
      // Enable multitouch (2+ pointers) for pinch zoom on mobile
      this.input.addPointer(2)
      this._applyCameraBounds()
      // Start centered on Musalla anchor so the world feels grounded
      const b = this._currentBounds || this._computeBounds()
      const cx = (b.minX + b.maxX - 1) / 2
      const cy = (b.minY + b.maxY - 1) / 2
      const centerPos = gridToScreen(cx, cy, this.originX, this.originY)
      camera.centerOn(centerPos.x, centerPos.y)
      camera.setZoom(1.0)

      // Track building drag state so pan doesn't fight with building drag
      this.input.on('dragstart', () => { this._buildingDragging = true })
      this.input.on('dragend',   () => { this._buildingDragging = false })

      // Pan state
      let panStart = null
      this.input.on('pointerdown', (pointer, targets) => {
        if (this._buildingDragging) return
        // Skip pan setup if a building container was hit — its own dragstart
        // will fire when the child holds+moves.
        const hitBuilding = targets.some(t => t && t.type === 'Container' && t.buildingData)
        if (hitBuilding) return
        panStart = {
          px: pointer.x, py: pointer.y,
          sx: camera.scrollX, sy: camera.scrollY,
        }
      })
      this.input.on('pointermove', (pointer) => {
        if (!panStart || this._buildingDragging) return
        camera.scrollX = panStart.sx - (pointer.x - panStart.px) / camera.zoom
        camera.scrollY = panStart.sy - (pointer.y - panStart.py) / camera.zoom
      })
      this.input.on('pointerup',        () => { panStart = null })
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

    // Compute + apply camera bounds around the current world extent so the
    // player can only pan within a reasonable box (with 200-400px padding for
    // comfort). Called on init, resize, and world expansion.
    _applyCameraBounds() {
      const camera = this.cameras.main
      const b = this._currentBounds || this._computeBounds()
      // Convert grid corners to screen coords and take extents
      const c00 = gridToScreen(b.minX, b.minY, this.originX, this.originY)
      const c10 = gridToScreen(b.maxX - 1, b.minY, this.originX, this.originY)
      const c01 = gridToScreen(b.minX, b.maxY - 1, this.originX, this.originY)
      const c11 = gridToScreen(b.maxX - 1, b.maxY - 1, this.originX, this.originY)
      const xs = [c00.x, c10.x, c01.x, c11.x]
      const ys = [c00.y, c10.y, c01.y, c11.y]
      const minX = Math.min(...xs) - TILE_W - 120
      const maxX = Math.max(...xs) + TILE_W + 120
      const minY = Math.min(...ys) - TILE_H * 2 - 200
      const maxY = Math.max(...ys) + TILE_H * 2 + 200
      camera.setBounds(minX, minY, maxX - minX, maxY - minY)
    }

    // Rebuild origin so grid center sits in the viewport (centered on Musalla).
    recomputeOrigin() {
      const cx = this.scale.width / 2
      const cy = this.scale.height / 2
      // Adjust for the Musalla's screen position within the isometric projection
      // so it lands at the viewport center regardless of grid coordinates.
      const state = this.game?.registry?.get('worldState')
      const musalla = state?.buildings?.find(b => b.templateId === 'musalla')
      const mx = musalla ? musalla.x : MUSALLA_ANCHOR.x
      const my = musalla ? musalla.y : MUSALLA_ANCHOR.y
      // Inverse of gridToScreen: originX = cx - (mx-my)*TW/2, originY = cy - (mx+my)*TH/2
      this.originX = cx - (mx - my) * TILE_W / 2
      this.originY = cy - (mx + my) * TILE_H / 2 - (WORLD_SIZE * TILE_H) / 4
    }

    handleResize() {
      this.recomputeOrigin()
      this._currentBounds = this._computeBounds()
      this.drawGround()
      this.drawGrid()
      this.syncStateFromRegistry()
      // Rebind camera bounds after resize since origin changed
      if (this.cameras?.main) {
        this._applyCameraBounds()
      }
    }

    // ─── Ground & grid ───────────────────────────────────────────
    // Deterministic pseudo-random for organic (non-grid-aligned) tone variation.
    // Uses irregular blob boundaries (larger and offset per row) so patches
    // don't align to isometric axes — the grass looks like a real meadow with
    // gentle patches, not banded diagonals.
    _grassTone(col, row) {
      // Perturb the blob grid: each row shifts the column boundary by a
      // hash-based amount, so patches don't line up column-by-column and
      // they read as amorphous natural clumps rather than repeating strips.
      const rowShift = ((row * 2749) & 0x1f)
      const bx = Math.floor((col + rowShift) / 5)
      const by = Math.floor(row / 5)
      const h = (bx * 928371 + by * 123457 + bx * by * 31) & 0xffff
      const r = (h % 100) / 100
      if (r < 0.30) return GRASS_BLOB
      if (r > 0.70) return GRASS_LIGHT_BLOB
      return GRASS_BASE
    }

    drawGround() {
      // Snapshot previous bounds BEFORE removing tiles — this tells us which
      // grid cells are truly "new" (outside the prior bounds) so we can fade
      // JUST those in on world expansion, avoiding a whole-scene alpha flash.
      const prevBounds = this._prevGroundBounds
      this.groundLayer.removeAll(true)
      const b = this._currentBounds || this._computeBounds()
      for (let row = b.minY; row < b.maxY; row++) {
        for (let col = b.minX; col < b.maxX; col++) {
          const { x, y } = gridToScreen(col, row, this.originX, this.originY)
          const tile = this.add.graphics()
          const fill = this._grassTone(col, row)
          tile.fillStyle(fill, 1)
          tile.beginPath()
          tile.moveTo(x, y - TILE_H / 2)
          tile.lineTo(x + TILE_W / 2, y)
          tile.lineTo(x, y + TILE_H / 2)
          tile.lineTo(x - TILE_W / 2, y)
          tile.closePath()
          tile.fillPath()
          // Flag as new if outside prior bounds (or on first draw prevBounds
          // is null → all tiles counted as "new" but no fade tween will target
          // them since the expansion-detection sets tile.alpha only on grow).
          if (prevBounds &&
              (col < prevBounds.minX || col >= prevBounds.maxX ||
               row < prevBounds.minY || row >= prevBounds.maxY)) {
            tile._newTile = true
          }
          this.groundLayer.add(tile)
        }
      }
      // Cache for next call so we can compute the delta again if the world
      // expands multiple times in a session.
      this._prevGroundBounds = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }
    }

    drawGrid() {
      this.tileLayer.removeAll(true)
      const b = this._currentBounds || this._computeBounds()
      // Interactive hit zones per tile — used for tap/drag
      this.cellSprites = []
      for (let row = b.minY; row < b.maxY; row++) {
        for (let col = b.minX; col < b.maxX; col++) {
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
      // Subtle grid line overlay — only visible while dragging a new build
      // (tileLayer.setVisible toggles it), so we can use a slightly stronger
      // stroke for clear placement feedback without cluttering the natural look.
      const g = this.add.graphics()
      g.lineStyle(1, GRID_LINE, 0.22)
      for (let row = b.minY; row <= b.maxY; row++) {
        const a = gridToScreen(b.minX, row, this.originX, this.originY)
        const bb = gridToScreen(b.maxX, row, this.originX, this.originY)
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(bb.x, bb.y); g.strokePath()
      }
      for (let col = b.minX; col <= b.maxX; col++) {
        const a = gridToScreen(col, b.minY, this.originX, this.originY)
        const bb = gridToScreen(col, b.maxY, this.originX, this.originY)
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(bb.x, bb.y); g.strokePath()
      }
      this.tileLayer.add(g)
    }

    // Draw a subtle golden diamond outline covering the 4×4 SACRED RESERVED
    // zone around the Musalla — the pre-gazetted area for future Masjid
    // (3×3) and Jami' Masjid (4×4) upgrades. Parents & kids can see the
    // reserved holy ground so they don't wonder why houses can't be placed
    // there. Redraws on every sync so the outline follows the musalla.
    _drawSacredZone(buildings) {
      // Remove any previous zone outline
      if (this._sacredZone) { try { this._sacredZone.destroy() } catch { /* noop */ } this._sacredZone = null }
      if (this._sacredZoneTween) { try { this._sacredZoneTween.stop() } catch { /* noop */ } this._sacredZoneTween = null }
      const musalla = buildings.find(b => b.templateId === 'musalla')
      if (!musalla) return
      // Compute the four diamond corners of the 4×4 reserved area.
      // The zone spans cells (mx..mx+3, my..my+3) inclusive — 4×4 = 16 cells.
      // Vertices (in isometric projection):
      //   TOP    = top vertex of the top-most tile (mx, my)
      //   RIGHT  = right vertex of the right-most tile (mx+3, my)
      //   BOTTOM = bottom vertex of the bottom-most tile (mx+3, my+3)
      //   LEFT   = left vertex of the left-most tile (mx, my+3)
      const g = this.add.graphics()
      g.setDepth(musalla.y + musalla.x - 1)
      const topC   = gridToScreen(musalla.x,     musalla.y,     this.originX, this.originY)
      const rightC = gridToScreen(musalla.x + 3, musalla.y,     this.originX, this.originY)
      const botC   = gridToScreen(musalla.x + 3, musalla.y + 3, this.originX, this.originY)
      const leftC  = gridToScreen(musalla.x,     musalla.y + 3, this.originX, this.originY)
      const TOP    = { x: topC.x,               y: topC.y - TILE_H / 2 }
      const RIGHT  = { x: rightC.x + TILE_W / 2, y: rightC.y }
      const BOTTOM = { x: botC.x,               y: botC.y + TILE_H / 2 }
      const LEFT   = { x: leftC.x - TILE_W / 2,  y: leftC.y }
      // Fill (subtle amber wash so the Musalla and any villagers/flora within
      // remain clearly visible — the outline carries most of the meaning)
      g.fillStyle(0xffb703, 0.14)
      g.beginPath()
      g.moveTo(TOP.x, TOP.y)
      g.lineTo(RIGHT.x, RIGHT.y)
      g.lineTo(BOTTOM.x, BOTTOM.y)
      g.lineTo(LEFT.x, LEFT.y)
      g.closePath()
      g.fillPath()
      // Solid golden outline for clarity
      g.lineStyle(3, 0xffb703, 0.9)
      const drawEdge = (x1, y1, x2, y2) => {
        const dashLen = 8, gapLen = 6
        const dx = x2 - x1, dy = y2 - y1
        const len = Math.hypot(dx, dy)
        const ux = dx / len, uy = dy / len
        let travelled = 0
        while (travelled < len) {
          const s = travelled
          const e = Math.min(travelled + dashLen, len)
          g.beginPath()
          g.moveTo(x1 + ux * s, y1 + uy * s)
          g.lineTo(x1 + ux * e, y1 + uy * e)
          g.strokePath()
          travelled += dashLen + gapLen
        }
      }
      drawEdge(TOP.x, TOP.y,      RIGHT.x, RIGHT.y)
      drawEdge(RIGHT.x, RIGHT.y,  BOTTOM.x, BOTTOM.y)
      drawEdge(BOTTOM.x, BOTTOM.y, LEFT.x, LEFT.y)
      drawEdge(LEFT.x, LEFT.y,    TOP.x, TOP.y)
      g.setDepth(9999)
      // Soft pulse so the outline breathes without being distracting
      this._sacredZoneTween = this.tweens.add({
        targets: g, alpha: { from: 0.85, to: 1.0 },
        duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      this._sacredZone = g
    }

    // ─── Sync from React registry ───────────────────────────────
    // Smart diff: (a) if same set of IDs → tween positions in place. (b) if
    // new IDs added → append only those containers, keep existing untouched.
    // (c) if IDs removed → destroy only those. Prevents whole-scene flash.
    syncStateFromRegistry() {
      const state = this.game.registry.get('worldState')
      if (!state) return
      const buildings = state.buildings || []
      const demerit = state.demeritCount || 0

      // ── Detect world-size expansion (progressive reveal) ───────
      // When the buildings count crosses a threshold (5/10/15), the world
      // grows outward. Re-draw ground + grid at the new extent, update camera
      // bounds, and gently fade the new tiles in so it feels like territory
      // being opened up rather than a jarring redraw.
      const nextBounds = this._computeBounds()
      const prev = this._currentBounds
      if (
        !prev ||
        prev.minX !== nextBounds.minX || prev.maxX !== nextBounds.maxX ||
        prev.minY !== nextBounds.minY || prev.maxY !== nextBounds.maxY
      ) {
        const grew = !!prev && nextBounds.size > prev.size
        this._currentBounds = nextBounds
        // Preserve camera scroll across the redraw — Phaser's setBounds will
        // clamp if the camera happens to be outside the new area, but
        // otherwise the visual view should stay exactly where it was. This
        // fixes: "when zoom out, finish it flash and go to default position".
        const cam = this.cameras?.main
        const preserveScrollX = cam?.scrollX
        const preserveScrollY = cam?.scrollY
        const preserveZoom    = cam?.zoom
        this.drawGround()
        this.drawGrid()
        // Keep grid hidden unless a drag is currently active
        if (this.tileLayer && !this.game.registry.get('buildDragActive')) {
          this.tileLayer.setVisible(false)
        }
        if (cam) {
          this._applyCameraBounds()
          // Restore exactly what the user was viewing — no jerk to default.
          if (typeof preserveScrollX === 'number') cam.setScroll(preserveScrollX, preserveScrollY)
          if (typeof preserveZoom === 'number')    cam.setZoom(preserveZoom)
        }
        if (grew) {
          // Soft reveal only for the NEWLY added tiles (outside prev bounds).
          // We fade ONLY those tiles from 0 → 1, leaving already-drawn ground
          // untouched — no full-scene flash when zoomed out on a large map.
          const oldB = prev
          for (const tile of this.groundLayer.list) {
            // Recover grid coords by inverting gridToScreen — cheap because
            // we drew tiles with known positions. Use a hash instead: mark
            // freshly-created tiles by a data flag set during drawGround.
            if (tile._newTile) {
              tile.alpha = 0
              this.tweens.add({
                targets: tile, alpha: 1, duration: 700, ease: 'Sine.easeOut',
                delay: Math.random() * 250,
              })
            }
          }
          // Notify React so it can pop a celebratory toast ("Your world grew!")
          const onEvent = this.game.registry.get('onEvent')
          onEvent?.('world-expanded', { size: nextBounds.size, prevSize: prev.size, oldBounds: oldB })
        }
      }

      const existing = this.buildingLayer.list.filter(c => c?.buildingData?.id)
      const existingById = new Map(existing.map(c => [c.buildingData.id, c]))
      const newIds = new Set(buildings.map(b => b.id))
      const oldIds = new Set(existing.map(c => c.buildingData.id))

      // First mount / empty scene → do full render
      if (existing.length === 0) {
        this.renderBuildings(buildings)
        this._drawSacredZone(buildings)
        this.renderNatureFlora(buildings, demerit)
        this.spawnVillagers(buildings)
        return
      }

      // Diff: added / removed / persisted
      const added = buildings.filter(b => !oldIds.has(b.id))
      const removedIds = [...oldIds].filter(id => !newIds.has(id))

      // Remove destroyed buildings only
      for (const id of removedIds) {
        const c = existingById.get(id)
        if (c) { try { c.destroy() } catch { /* teardown */ } }
      }

      // Update positions/levels for persisted buildings via tween (no destroy)
      for (const b of buildings) {
        if (!oldIds.has(b.id)) continue
        const c = existingById.get(b.id)
        if (!c) continue
        const { x, y } = gridToScreen(b.x, b.y, this.originX, this.originY)
        const dx = x - c.x, dy = y - c.y
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          this.tweens.add({
            targets: c, x, y, duration: 200, ease: 'Sine.easeInOut',
            onUpdate: () => { c.setDepth(b.y + b.x + Math.floor(c.y / 100)) },
          })
        } else {
          c.setDepth(b.y + b.x)
        }
        c.buildingData.x = b.x
        c.buildingData.y = b.y
        c.buildingData.level = b.level
      }

      // Append newly-added buildings only (no flash to existing)
      for (const b of added) {
        // Before appending the real container, remove any TEMP construction
        // sprite left over from playConstruction so we don't stack two
        // sprites at the same coord (which would look like a doubled/flashed
        // building). See playConstruction's onComplete for how these get
        // tagged with _isTempConstruction.
        for (const c of [...this.buildingLayer.list]) {
          if (c?._isTempConstruction &&
              c._tempTemplateId === b.templateId &&
              c._tempGridX === b.x && c._tempGridY === b.y) {
            try { c.destroy() } catch { /* teardown */ }
          }
        }
        this.renderSingleBuilding(b)
      }

      // Draw the sacred 4×4 reserved zone around the musalla (subtle golden
      // outline) so parents & kids see the pre-gazetted area for future
      // Masjid/Jami' Masjid expansion. Redrawn on every sync so it moves if
      // the musalla is ever relocated (currently sacred → immovable).
      this._drawSacredZone(buildings)

      // Nature refresh (deterministic — no visual flicker)
      this.renderNatureFlora(buildings, demerit)

      // Villagers respawn only if capacity changed (added/removed changed pool)
      if (added.length > 0 || removedIds.length > 0) {
        this.spawnVillagers(buildings)
      }
    }

    // Compute the visual center of a building's footprint on the isometric grid.
    // For MUSALLA specifically: always position at the center of its 4×4 RESERVED
    // sacred zone (not its own footprint), regardless of upgrade level. This keeps
    // L1 (2×2), L2 (3×3), and L3 (4×4) all visually centered on the golden zone
    // — user reported "masa siap musalla jadi dibina di bucu golden gazet bukan
    // ditengah2" (Musalla appears at the corner of the golden zone, not center).
    // For rumah/kebun: normal footprint center.
    _footprintCenter(b, t) {
      const level = b.level || 1
      const foot = t.tileSizeByLevel?.[level] || t.tileSize || { w: 1, h: 1 }
      if (t.id === 'musalla' && t.reserveSize) {
        // Center musalla on the FIXED 4×4 reserved zone (anchor .. anchor+3)
        const rc = t.reserveSize
        const cx = b.x + (rc.w - 1) / 2
        const cy = b.y + (rc.h - 1) / 2
        return { cx, cy, foot }
      }
      const cx = b.x + (foot.w - 1) / 2
      const cy = b.y + (foot.h - 1) / 2
      return { cx, cy, foot }
    }

    // Render a single building container (used by incremental add above)
    renderSingleBuilding(b) {
      const t = BUILDING_TEMPLATES[b.templateId]
      if (!t) return
      const { cx, cy } = this._footprintCenter(b, t)
      const { x, y } = gridToScreen(cx, cy, this.originX, this.originY)
      const container = this.add.container(x, y)
      container.setDepth(b.y + b.x)
      container.buildingData = { id: b.id, templateId: b.templateId, x: b.x, y: b.y, level: b.level }

      const shadow = this.add.graphics()
      shadow.fillStyle(0x000000, SHADOW_ALPHA)
      // Shadow drifts to the bottom-left (opposite of the top-right sun).
      shadow.fillEllipse(SHADOW_DX, TILE_H / 4 + SHADOW_DY * 0.4, TILE_W * 0.7, TILE_H * 0.55)
      container.add(shadow)

      this.drawBuildingSprite(container, t, b.level || 1)

      if ((b.level || 1) > 1) {
        const badge = this.add.text(TILE_W / 3, -TILE_H, `L${b.level}`, {
          fontFamily: 'monospace', fontSize: '12px', color: '#FFB703',
          fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5)
        container.add(badge)
      }

      if (t.isSacred) {
        const glow = this.add.graphics()
        glow.fillStyle(0xFFB703, 0.18)
        glow.fillCircle(0, -TILE_H / 4, TILE_W * 0.9)
        container.addAt(glow, 1)
        this.tweens.add({
          targets: glow, alpha: { from: 0.10, to: 0.28 },
          duration: 1800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        })
      }

      this.buildingLayer.add(container)

      // Enable drag on non-sacred buildings
      if (!t.isSacred && b.id) {
        this.enableBuildingDrag(container, t)
      }
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
        bounds: this._currentBounds || this._computeBounds(),
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
        const { cx, cy } = this._footprintCenter(b, t)
        const { x, y } = gridToScreen(cx, cy, this.originX, this.originY)
        const container = this.add.container(x, y)
        container.setDepth(b.y + b.x)
        // Keep building metadata so drag handlers can find/update it later
        container.buildingData = { id: b.id, templateId: b.templateId, x: b.x, y: b.y, level: b.level }

        // Shadow (elliptical, ground level)
        const shadow = this.add.graphics()
        shadow.fillStyle(0x000000, SHADOW_ALPHA)
        // Shadow drifts to the bottom-left (opposite of the top-right sun).
        shadow.fillEllipse(SHADOW_DX, TILE_H / 4 + SHADOW_DY * 0.4, TILE_W * 0.7, TILE_H * 0.55)
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

    // Enable Phaser's built-in drag on a building container. Combined with
    // scene-level `input.dragTimeThreshold = 250` + `dragDistanceThreshold = 10`,
    // a small hold+move is required — casual taps stay taps. Not as strict as
    // a 2s long-press but reliably functional across devices (custom hold-to-
    // drag was flaky on some mobile browsers per user testing).
    enableBuildingDrag(container, template) {
      const level = container.buildingData?.level || 1
      const sz = template.tileSizeByLevel?.[level] || template.tileSize || { w: 1, h: 1 }
      const hitW = TILE_W * (sz.w + 0.4)
      const hitH = TILE_H * (Math.max(2.2, 1.4 * sz.h + 0.8))
      const hitArea = new Phaser.Geom.Rectangle(-hitW / 2, -hitH * 0.8, hitW, hitH)
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, {
        draggable: true,
      })
      this.input.setDraggable(container)

      // Hover affordance
      container.on('pointerover', () => {
        if (this.game.registry.get('interactionLocked')) return
        container.setScale(1.06)
      })
      container.on('pointerout', () => {
        if (!container._dragging) container.setScale(1.0)
      })

      // Tap detection — pointerdown records start pos, pointerup checks small
      // delta + short duration ⇒ tap (opens info card). Drag events don't
      // fire for pure taps because dragTimeThreshold + distance guard.
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
        if (container._dragging || container._dragMoved) return
        const moved = Math.hypot(pointer.x - container._downPX, pointer.y - container._downPY)
        const dt = Date.now() - (container._downTime || 0)
        if (moved < 15 && dt < 500) {
          const onEvent = this.game.registry.get('onEvent')
          const cam = this.cameras.main
          const rect = this.game.canvas.getBoundingClientRect()
          const screenX = (container.x - cam.scrollX) * cam.zoom + rect.left
          const screenY = (container.y - cam.scrollY) * cam.zoom + rect.top
          onEvent?.('cell-tap', {
            col: container.buildingData.x,
            row: container.buildingData.y,
            screenX, screenY,
          })
        }
      })

      // Drag lifecycle — Phaser fires dragstart when the drag threshold is
      // crossed. We track origin coords for snap-back / restructure targeting.
      container.on('dragstart', () => {
        if (this.game.registry.get('interactionLocked')) return
        container._dragging = true
        container._dragMoved = false
        container._origX = container.x
        container._origY = container.y
        container._origGridX = container.buildingData.x
        container._origGridY = container.buildingData.y
        container.setDepth(30000)
        container.setAlpha(0.9)
        this.tweens.add({ targets: container, scaleX: 1.1, scaleY: 1.1, duration: 180, ease: 'Back.easeOut' })
        try { this.game.registry.get('onEvent')?.('drag-armed', {}) } catch { /* noop */ }
        this._dragGhost = this.add.graphics()
        this._dragGhost.setDepth(29999)
        this.buildingLayer.add(this._dragGhost)
      })

      container.on('drag', (pointer, dragX, dragY) => {
        if (!container._dragging) return
        const moved = Math.hypot(dragX - container._origX, dragY - container._origY)
        if (moved > 8) container._dragMoved = true
        container.x = dragX
        container.y = dragY
        const { col, row } = this.screenToGrid(dragX, dragY)
        const b = this._currentBounds || this._computeBounds()
        const clampedCol = Math.max(b.minX, Math.min(b.maxX - sz.w, col))
        const clampedRow = Math.max(b.minY, Math.min(b.maxY - sz.h, row))
        const valid = this.isCellPlacementValid(clampedCol, clampedRow, sz, container.buildingData.id)
        container._pendingCell = { x: clampedCol, y: clampedRow, valid }
        this._drawDragGhost(clampedCol, clampedRow, sz, valid)
      })

      container.on('dragend', () => {
        container._dragging = false
        this.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 160, ease: 'Sine.easeOut' })
        container.setAlpha(1.0)
        if (this._dragGhost) { this._dragGhost.destroy(); this._dragGhost = null }
        const pending = container._pendingCell
        const snapBack = () => {
          this.tweens.add({
            targets: container, x: container._origX, y: container._origY,
            duration: 260, ease: 'Back.easeOut',
          })
          container.setDepth(container._origGridY + container._origGridX)
        }
        if (!container._dragMoved || !pending || !pending.valid) { snapBack(); return }
        if (pending.x === container._origGridX && pending.y === container._origGridY) {
          snapBack(); return
        }
        // ─── Confirmation gate ─────────────────────────────────────
        // Previously the drop committed the move immediately, which produced
        // accidental relocations (a jitter mid-pan could nudge a building).
        // Now we snap back to origin AND request explicit confirmation from
        // React. Only when React calls scene.confirmPendingMove(...) do we
        // play the 10s restructure at the destination + persist to server.
        this.tweens.add({
          targets: container, x: container._origX, y: container._origY,
          duration: 220, ease: 'Sine.easeOut',
        })
        // Compute where on-screen the destination cell sits, so the React
        // card can float next to it. gridToScreen returns world coords —
        // convert to canvas-relative screen coords via the main camera.
        const destWorld = gridToScreen(pending.x, pending.y, this.originX, this.originY)
        const cam = this.cameras.main
        const screenX = (destWorld.x - cam.scrollX) * cam.zoom
        const screenY = (destWorld.y - cam.scrollY) * cam.zoom
        this.game.registry.get('onEvent')?.('building-move-requested', {
          buildingId: container.buildingData.id,
          templateId: container.buildingData.templateId,
          x: pending.x, y: pending.y,
          origX: container._origGridX, origY: container._origGridY,
          screenX, screenY,
          restructureDuration: 10000,
        })
      })
    }

    // ─── Public: React → Phaser move confirmation bridge ────────
    // React calls these after the user taps the confirmation card. Kept as
    // scene methods (not registry events) so the call site can synchronously
    // grab the right container by buildingId and start the restructure.
    confirmPendingMove(buildingId, x, y) {
      const container = this.buildingLayer.list.find(c => c?.buildingData?.id === buildingId)
      if (!container) return false
      this.playRestructure(container, x, y)
      return true
    }
    cancelPendingMove(_buildingId) {
      // Building already snapped back on dragend → no visual work to do.
      // Method exists so the React side can dispatch consistently.
    }

    // ─── Removed: _armBuildingDrag / _cancelBuildingHold ─────────
    // Replaced by Phaser's built-in drag lifecycle. Kept the method stubs as
    // no-ops so any lingering call sites don't crash (there shouldn't be any).
    _armBuildingDrag() { /* noop — rollback to Phaser drag */ }
    _cancelBuildingHold() { /* noop — rollback to Phaser drag */ }


    // ─── Restructure animation (10s pedagogical) ───────────
    // Shows scaffolding + workers + dust + progress bar at destination while
    // the building "under construction" fades at origin. After 10s the
    // building moves to its new cell with a sparkle burst.
    playRestructure(container, toX, toY) {
      const t = BUILDING_TEMPLATES[container.buildingData.templateId]
      if (!t) return
      const level = container.buildingData.level || 1
      const foot = t.tileSizeByLevel?.[level] || t.tileSize || { w: 1, h: 1 }
      const sz = foot
      // Footprint center — matches renderSingleBuilding / playConstruction.
      // For MUSALLA specifically, always center on the 4×4 reserved zone.
      let cx, cy
      if (t.id === 'musalla' && t.reserveSize) {
        cx = toX + (t.reserveSize.w - 1) / 2
        cy = toY + (t.reserveSize.h - 1) / 2
      } else {
        cx = toX + (foot.w - 1) / 2
        cy = toY + (foot.h - 1) / 2
      }
      const target = gridToScreen(cx, cy, this.originX, this.originY)

      // Disable further drag until restructure completes
      container.disableInteractive()
      container._restructuring = true
      // Fade + slight sway at origin — "under construction, being deconstructed"
      this.tweens.add({ targets: container, alpha: 0.35, duration: 400 })
      const swayTween = this.tweens.add({
        targets: container, angle: { from: -1.5, to: 1.5 },
        duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })

      // Temporary construction layer at destination
      const layer = this.add.container(0, 0)
      layer.setDepth(toY + toX + 12)
      this.buildingLayer.add(layer)

      // Scaffolding diamond outline
      const fence = this.add.graphics()
      fence.setPosition(target.x, target.y)
      const fW = TILE_W * (sz.w * 0.9)
      const fH = TILE_H * (sz.h * 0.9)
      fence.lineStyle(2, 0xc9a86a, 1)
      fence.beginPath()
      fence.moveTo(0, -fH / 2); fence.lineTo(fW / 2, 0)
      fence.lineTo(0, fH / 2); fence.lineTo(-fW / 2, 0); fence.closePath()
      fence.strokePath()
      fence.fillStyle(0x8b6f47, 1)
      fence.fillRect(-1.5, -fH / 2 - 6, 3, 14)
      fence.fillRect(fW / 2 - 1.5, -6, 3, 14)
      fence.fillRect(-1.5, fH / 2 - 6, 3, 14)
      fence.fillRect(-fW / 2 - 1.5, -6, 3, 14)
      fence.fillStyle(0xfacc15, 1)
      fence.fillTriangle(0, -fH / 2 - 6, 8, -fH / 2 - 2, 0, -fH / 2 + 2)
      layer.add(fence)

      // 2 worker sprites hammering
      const workers = []
      for (let i = 0; i < 2; i++) {
        const w = this.add.graphics()
        w.fillStyle(0x2e7d5b, 1); w.fillRect(-3, -6, 6, 7)
        w.fillStyle(0xe6b58a, 1); w.fillCircle(0, -8, 3)
        w.fillStyle(0xfacc15, 1); w.fillEllipse(0, -10, 6, 3)
        w.lineStyle(1.2, 0x3a2818, 1)
        w.beginPath(); w.moveTo(2, -4); w.lineTo(6, -6); w.strokePath()
        w.fillStyle(0x6b6b6b, 1); w.fillRect(5, -7, 2, 2)
        w.setPosition(target.x + (i === 0 ? -fW / 3 : fW / 3), target.y + fH / 4)
        layer.add(w)
        workers.push(w)
        this.tweens.add({
          targets: w, angle: { from: -10, to: 10 },
          duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }

      // Progress bar above scaffolding
      const barW = 60, barH = 6
      const barBg = this.add.graphics()
      barBg.fillStyle(0x000000, 0.5)
      barBg.fillRoundedRect(-barW / 2 - 2, -barH / 2 - 2, barW + 4, barH + 4, 3)
      barBg.fillStyle(0xffffff, 0.9)
      barBg.fillRoundedRect(-barW / 2, -barH / 2, barW, barH, 3)
      barBg.setPosition(target.x, target.y - fH / 2 - 22)
      layer.add(barBg)

      const barFill = this.add.graphics()
      barFill.setPosition(target.x - barW / 2, target.y - barH / 2 - fH / 2 - 22)
      layer.add(barFill)
      const drawFill = (pct) => {
        barFill.clear()
        barFill.fillStyle(0x2e7d5b, 1)
        barFill.fillRoundedRect(0, 0, barW * pct, barH, 3)
      }
      drawFill(0)

      // Label "Membaiki…"
      const lang = this.game.registry.get('lang') || 'ms'
      const labelText = {
        ms: 'Menyusun semula…', en: 'Restructuring…',
        id: 'Menyusun ulang…', ar: 'إعادة البناء…',
      }[lang] || 'Menyusun semula…'
      const label = this.add.text(target.x, target.y - fH / 2 - 38, labelText, {
        fontFamily: 'system-ui', fontSize: '11px', color: '#0d5b4e',
        fontStyle: 'bold', backgroundColor: '#ffffff',
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5)
      layer.add(label)

      // Continuous dust puffs while restructuring
      const dustTimer = this.time.addEvent({
        delay: 500, loop: true,
        callback: () => this.spawnDustPuffs(target.x, target.y, 3),
      })

      // Progress bar tween over 10 seconds
      const totalMs = 10000
      const startTime = this.time.now
      const progressTicker = this.time.addEvent({
        delay: 100, loop: true,
        callback: () => {
          const pct = Math.min(1, (this.time.now - startTime) / totalMs)
          drawFill(pct)
        },
      })

      // After 10s: fade out origin, tween container to destination
      this.time.delayedCall(totalMs, () => {
        dustTimer.remove(); progressTicker.remove()
        swayTween.stop()
        container.angle = 0
        // Container hops from origin (still faded) to destination
        this.tweens.chain({
          targets: container,
          tweens: [
            { alpha: 0, duration: 300, ease: 'Sine.easeIn' },
            {
              // Snap position while invisible
              onStart: () => {
                container.x = target.x; container.y = target.y
                container.setDepth(toY + toX)
                container.buildingData.x = toX
                container.buildingData.y = toY
              },
              alpha: 1, duration: 400, ease: 'Sine.easeOut',
            },
          ],
          onComplete: () => {
            // Sparkle burst + big dust
            this.spawnDustPuffs(target.x, target.y, 12)
            // Fade + remove scaffolding
            this.tweens.add({
              targets: [fence, ...workers, barBg, barFill, label],
              alpha: 0, duration: 400,
              onComplete: () => { try { layer.destroy() } catch { /* teardown */ } },
            })
            // Re-enable drag
            container._restructuring = false
            container.setInteractive()
            // Tell React to now patch state (server was already updated at t=0)
            const onEvent = this.game.registry.get('onEvent')
            onEvent?.('restructure-done', {
              buildingId: container.buildingData.id,
              x: toX, y: toY,
            })
          },
        })
      })
    }

    // ─── Build preview (drag from sidebar) ─────────────────────
    // Called continuously while user drags a sidebar template onto the canvas.
    // Shows a ghost outline + building icon at the target cell (green/red).
    showBuildPreview(templateId, screenX, screenY) {
      const canvas = this.game.canvas
      const rect = canvas.getBoundingClientRect()
      // Screen (client) → canvas-local pixels, accounting for any CSS scaling
      // between the canvas' rendered CSS size and its internal resolution
      // (RESIZE mode usually keeps them 1:1 but on some HiDPI setups they can
      // differ; scaling here guarantees correctness).
      const scaleX = canvas.width  / rect.width  || 1
      const scaleY = canvas.height / rect.height || 1
      const cx = (screenX - rect.left) * scaleX
      const cy = (screenY - rect.top)  * scaleY
      // ⚠️  Phaser's camera zoom is applied around the camera's centerX/Y,
      // NOT around (0,0). So `cx / zoom + scrollX` is only correct at zoom=1.
      // Using camera.getWorldPoint() delegates to Phaser's proper inverse
      // transform which handles zoom + scroll + rotation correctly at any
      // zoom level. This fixes the "drag doesn't follow finger when zoomed
      // out" bug reported by users.
      const cam = this.cameras.main
      const world = cam.getWorldPoint(cx, cy)
      const { col, row } = this.screenToGrid(world.x, world.y)
      const t = BUILDING_TEMPLATES[templateId]
      if (!t) return
      const sz = t.tileSize || { w: 1, h: 1 }
      // Musalla always locked to anchor — override target
      let targetCol = col, targetRow = row
      if (templateId === 'musalla') {
        targetCol = MUSALLA_ANCHOR.x; targetRow = MUSALLA_ANCHOR.y
      }
      const b2 = this._currentBounds || this._computeBounds()
      const clampedCol = Math.max(b2.minX, Math.min(b2.maxX - sz.w, targetCol))
      const clampedRow = Math.max(b2.minY, Math.min(b2.maxY - sz.h, targetRow))
      const valid = this.isCellPlacementValid(clampedCol, clampedRow, sz, null)

      // Reuse or create the preview graphics
      if (!this._buildPreview) {
        this._buildPreview = this.add.graphics()
        this._buildPreview.setDepth(30000)
        this.overlayLayer.add(this._buildPreview)
      }
      this._drawBuildPreview(clampedCol, clampedRow, sz, valid, t)

      // Preview icon label — created once
      if (!this._buildPreviewLabel) {
        this._buildPreviewLabel = this.add.text(0, 0, t.icon, {
          fontSize: '32px',
        }).setOrigin(0.5).setDepth(30001)
        this.overlayLayer.add(this._buildPreviewLabel)
      } else {
        this._buildPreviewLabel.setText(t.icon)
      }
      const cx2 = clampedCol + (sz.w - 1) / 2
      const cy2 = clampedRow + (sz.h - 1) / 2
      const iconPos = gridToScreen(cx2 + 0.5, cy2 + 0.5, this.originX, this.originY)
      this._buildPreviewLabel.setPosition(iconPos.x, iconPos.y - 8)
      this._buildPreviewLabel.setAlpha(valid ? 0.95 : 0.55)

      // Expose drop target for React so it knows where to build on release
      this.game.registry.set('buildDropTarget', { col: clampedCol, row: clampedRow, valid, templateId })
    }

    hideBuildPreview() {
      if (this._buildPreview) { try { this._buildPreview.destroy() } catch { /* teardown */ } this._buildPreview = null }
      if (this._buildPreviewLabel) { try { this._buildPreviewLabel.destroy() } catch { /* teardown */ } this._buildPreviewLabel = null }
      this.game.registry.set('buildDropTarget', null)
    }

    _drawBuildPreview(col, row, size, valid, template) {
      const g = this._buildPreview
      if (!g) return
      g.clear()
      const color = valid ? 0x2e7d5b : 0xdc2626
      // Diamond outline for each tile of footprint
      for (let dx = 0; dx < size.w; dx++) {
        for (let dy = 0; dy < size.h; dy++) {
          const { x, y } = gridToScreen(col + dx, row + dy, this.originX, this.originY)
          g.lineStyle(3, color, 0.9)
          g.fillStyle(color, 0.28)
          g.beginPath()
          g.moveTo(x, y - TILE_H / 2)
          g.lineTo(x + TILE_W / 2, y)
          g.lineTo(x, y + TILE_H / 2)
          g.lineTo(x - TILE_W / 2, y)
          g.closePath()
          g.fillPath()
          g.strokePath()
        }
      }
      // Pulse animation via tween (once per re-render)
      if (!this._buildPreviewPulse) {
        this._buildPreviewPulse = this.tweens.add({
          targets: g, alpha: { from: 1, to: 0.55 },
          duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }
    }

    // Reusable dust puff burst — used on drop reposition + initial construction
    spawnDustPuffs(x, y, count = 6) {
      for (let i = 0; i < count; i++) {
        const p = this.add.graphics()
        p.fillStyle(0xdcc8a4, 0.75)
        p.fillCircle(0, 0, 3 + Math.random() * 2.5)
        p.x = x + (Math.random() - 0.5) * TILE_W * 0.5
        p.y = y + (Math.random() - 0.5) * TILE_H * 0.3 + 4
        p.setDepth(20000)
        this.buildingLayer.add(p)
        this.tweens.add({
          targets: p,
          y: p.y - 20 - Math.random() * 10,
          x: p.x + (Math.random() - 0.5) * 20,
          alpha: 0,
          scale: 2.4,
          duration: 700 + Math.random() * 300,
          ease: 'Cubic.easeOut',
          onComplete: () => { try { p.destroy() } catch { /* teardown */ } },
        })
      }
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
      // Regular tile-size table for basic overlap. Musalla additionally
      // occupies a RESERVED 4×4 sacred zone (for future upgrade to Masjid
      // 3×3 and Jami' Masjid 4×4) so no other building can encroach.
      const TS = { musalla: { w: 2, h: 2 }, rumah: { w: 1, h: 1 }, kebun: { w: 1, h: 1 } }
      const RESERVED = { musalla: { w: 4, h: 4 } }
      const b = this._currentBounds || this._computeBounds()
      if (col < b.minX || row < b.minY || col + size.w > b.maxX || row + size.h > b.maxY) return false
      for (const bd of buildings) {
        if (bd.id === excludeId) continue
        // Use RESERVED footprint if defined (musalla's sacred 4×4 zone),
        // else fall back to the visible tile size.
        const s = RESERVED[bd.templateId] || TS[bd.templateId] || { w: 1, h: 1 }
        for (let dx = 0; dx < size.w; dx++) {
          for (let dy = 0; dy < size.h; dy++) {
            const tx = col + dx, ty = row + dy
            if (tx >= bd.x && tx < bd.x + s.w && ty >= bd.y && ty < bd.y + s.h) return false
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
      // Livestock pens use a completely different shape: a low fenced enclosure
      // (grassy floor + wooden fence posts + rails) so the animals inside look
      // like they're grazing in a proper pen, not standing on a tall building.
      if (template.category === 'ternakan') {
        this._drawLivestockPen(container, template)
        this._spawnLivestockAnimals(container, template)
        return
      }
      // Water features (perigi/kolam) are sunken pools — never tall boxes.
      // Rendered as an iso-diamond pool with animated ripples so they read as
      // WATER at a glance, not another building.
      if (template.category === 'sumber_air') {
        this._drawWaterFeature(container, template)
        return
      }
      // ─── Illustrated asset registry ────────────────────────────────
      // If this template has a registered PNG, use it instead of procedural
      // shapes. Musalla keeps its upgrade path (dome scales + minarets); other
      // buildings just render the image at their base scale.
      const asset = WorldScene.ASSET_REGISTRY[template.id]
      if (asset) {
        const isMusalla = template.id === 'musalla'
        const bumpPerLevel = asset.upgradeScale || 0
        const scale = asset.baseScale + (level - 1) * bumpPerLevel
        const img = this.add.image(0, asset.yOffset || 6, `bld_${template.id}`)
          .setOrigin(0.5, 1.0)
          .setScale(scale)
        container.add(img)
        // Musalla-only: procedural minarets flanking the PNG on L2+.
        if (isMusalla && level >= 2) {
          const minaretsCount = level >= 3 ? 4 : 2
          const accent = Phaser.Display.Color.HexStringToColor(template.accentColor).color
          const halfW = 384 * scale * 0.45
          for (let i = 0; i < minaretsCount; i++) {
            const side = (i % 2 === 0) ? -1 : 1
            const offset = i < 2 ? halfW : halfW * 0.65
            const mx = side * offset
            const mHeight = 55 * (1 + (level - 1) * 0.15)
            const mn = this.add.graphics()
            mn.fillStyle(0xf5efe0, 1); mn.fillRect(mx - 4, -mHeight, 8, mHeight)
            mn.lineStyle(1, 0xb8a97c, 1); mn.strokeRect(mx - 4, -mHeight, 8, mHeight)
            mn.fillStyle(accent, 1); mn.fillCircle(mx, -mHeight, 6)
            mn.fillTriangle(mx - 2, -mHeight - 6, mx + 2, -mHeight - 6, mx, -mHeight - 12)
            container.add(mn)
          }
        }
        return
      }
      const g = this.add.graphics()
      const baseColor = Phaser.Display.Color.HexStringToColor(template.color).color
      const accent = Phaser.Display.Color.HexStringToColor(template.accentColor).color
      // Effective footprint may grow per level (musalla → masjid → jami' masjid).
      // Sprite dimensions scale linearly with the footprint width so the visual
      // size matches the reserved plan area on the ground. Level 1 uses base
      // tileSize; level 2/3 use tileSizeByLevel[level] if defined.
      const baseFoot = template.tileSize || { w: 1, h: 1 }
      const currFoot = template.tileSizeByLevel?.[level] || baseFoot
      let spriteScale = currFoot.w / baseFoot.w   // 1.0, 1.5, or 2.0 for musalla
      // Auto-landmarks size themselves by absolute footprint (compared to the
      // musalla level-1 baseline of 2×2) so Surau (2×2) matches a Musalla L1
      // and Masjid landmark (3×3) sits between L1 and L2 in mass.
      if (template.id === 'surau') spriteScale = 1.0
      if (template.id === 'masjid_landmark') spriteScale = 1.55
      const w = TILE_W * 0.85 * spriteScale
      const h = TILE_H * 0.85 * spriteScale
      // Taller with level AND with footprint growth — a Jami' Masjid should
      // feel physically imposing, not just wider.
      const bodyH = (44 + (level - 1) * 12) * (0.85 + 0.15 * spriteScale)

      // Isometric box body (3 visible faces)
      // Top face (diamond)
      g.fillStyle(baseColor, 1)
      g.beginPath()
      g.moveTo(0, -bodyH - h / 2)
      g.lineTo(w / 2, -bodyH)
      g.lineTo(0, -bodyH + h / 2)
      g.lineTo(-w / 2, -bodyH)
      g.closePath(); g.fillPath()
      // Right face — LIT (sun rises from top-right, so east-facing wall
      // catches the light). We only slightly darken from the top face so
      // it reads as the same material under highlight.
      g.fillStyle(Phaser.Display.Color.IntegerToColor(baseColor).darken(8).color, 1)
      g.beginPath()
      g.moveTo(w / 2, -bodyH)
      g.lineTo(w / 2, 0)
      g.lineTo(0, h / 2)
      g.lineTo(0, -bodyH + h / 2)
      g.closePath(); g.fillPath()
      // Left face — SHADOWED (west-facing wall sits opposite the sun).
      // Darkened more heavily so the whole building reads as 3D volume with
      // a consistent light direction across the whole scene.
      g.fillStyle(Phaser.Display.Color.IntegerToColor(baseColor).darken(32).color, 1)
      g.beginPath()
      g.moveTo(-w / 2, -bodyH)
      g.lineTo(-w / 2, 0)
      g.lineTo(0, h / 2)
      g.lineTo(0, -bodyH + h / 2)
      g.closePath(); g.fillPath()
      container.add(g)

      // Icon topper (emoji-based visual identity). Grows with footprint so a
      // Jami' Masjid dome/emoji feels grand, not lost on a big base.
      const iconMap = {
        musalla: '🕌',
        surau: '🕋',
        masjid_landmark: '🕌',
        rumah: '🏠',
        kebun: '🌴',
      }
      const iconSize = Math.round((level >= 2 ? 38 : 32) * spriteScale)
      const icon = this.add.text(0, -bodyH - h / 4, iconMap[template.id] || template.icon, {
        fontSize: `${iconSize}px`,
      }).setOrigin(0.5)
      container.add(icon)

      // Dome (mosque family) — golden semicircle above roof. Musalla widens
      // with each upgrade; Surau gets a small dome; Masjid landmark gets a
      // fixed BIG dome to signal "grand village mosque".
      const isMosque = template.id === 'musalla' || template.id === 'surau' || template.id === 'masjid_landmark'
      if (isMosque) {
        const isSurau = template.id === 'surau'
        const isBigMasjid = template.id === 'masjid_landmark'
        const dome = this.add.graphics()
        dome.fillStyle(accent, 1)
        const domeW = isSurau     ? 22 * spriteScale :
                      isBigMasjid ? 46 * spriteScale :
                                    (26 + (level - 1) * 8) * spriteScale
        const domeH = isSurau     ? 16 * spriteScale :
                      isBigMasjid ? 34 * spriteScale :
                                    (20 + (level - 1) * 6) * spriteScale
        dome.fillEllipse(0, -bodyH - h / 2 - 8 * spriteScale, domeW, domeH)
        container.add(dome)
        // Crescent moon on top
        const moonRiseY = -bodyH - h / 2 - (isBigMasjid ? 30 : isSurau ? 18 : 22 + (level - 1) * 6) * spriteScale
        const moon = this.add.text(
          0, moonRiseY, '☾',
          { fontSize: `${Math.round((isBigMasjid ? 22 : isSurau ? 14 : 18) * spriteScale)}px`, color: '#FFB703', fontStyle: 'bold' }
        ).setOrigin(0.5)
        container.add(moon)
        // Minarets — Musalla L≥2 gets 2 (or 4 at L3), Masjid landmark always 2,
        // Surau gets none (it's a humble prayer hall).
        const showMinarets = (template.id === 'musalla' && level >= 2) || isBigMasjid
        if (showMinarets) {
          const minaretsCount = (template.id === 'musalla' && level >= 3) ? 4 : 2
          for (let i = 0; i < minaretsCount; i++) {
            const mn = this.add.graphics()
            const side = (i % 2 === 0) ? -1 : 1
            const offset = i < 2 ? w * 0.42 : w * 0.28
            const mx = side * offset
            const mHeight = (isBigMasjid ? 42 : 34) * spriteScale
            // Minaret shaft
            mn.fillStyle(0xf5efe0, 1)
            mn.fillRect(mx - 3 * spriteScale, -bodyH - mHeight, 6 * spriteScale, mHeight)
            // Cap (small dome + spire)
            mn.fillStyle(accent, 1)
            mn.fillCircle(mx, -bodyH - mHeight, 4 * spriteScale)
            container.add(mn)
          }
        }
      }
    }

    // ─── Livestock pen structure ─────────────────────────────────
    // Draws a low fenced enclosure INSIDE a 1×1 iso tile: green ground pad,
    // 4 corner posts + rails between them, with a distinguishing icon marker
    // at one edge so the pen type is still recognisable at a glance.
    // Animals are spawned separately (via _spawnLivestockAnimals) and roam
    // inside this pen on the same container.
    _drawLivestockPen(container, template) {
      const w = TILE_W * 0.82
      const h = TILE_H * 0.82
      const accent = Phaser.Display.Color.HexStringToColor(template.accentColor).color
      const groundColor = Phaser.Display.Color.HexStringToColor(template.color).darken(8).color

      // Ground pad (iso diamond) — muted straw / dry earth colour so animals
      // stand out against it.
      const ground = this.add.graphics()
      ground.fillStyle(groundColor, 0.7)
      ground.beginPath()
      ground.moveTo(0, -h / 2)
      ground.lineTo(w / 2, 0)
      ground.lineTo(0, h / 2)
      ground.lineTo(-w / 2, 0)
      ground.closePath(); ground.fillPath()
      // Subtle outline to define the pen edge
      ground.lineStyle(1, accent, 0.55)
      ground.beginPath()
      ground.moveTo(0, -h / 2)
      ground.lineTo(w / 2, 0)
      ground.lineTo(0, h / 2)
      ground.lineTo(-w / 2, 0)
      ground.closePath(); ground.strokePath()
      container.add(ground)

      // Fence corner posts (4 vertical wooden sticks at the diamond corners)
      const postH = 12
      const postW = 3
      const corners = [
        { x: 0,       y: -h / 2 },
        { x: w / 2,   y: 0      },
        { x: 0,       y:  h / 2 },
        { x: -w / 2,  y: 0      },
      ]
      const posts = this.add.graphics()
      for (const c of corners) {
        // Post shadow tint slightly darker
        posts.fillStyle(Phaser.Display.Color.IntegerToColor(accent).darken(15).color, 1)
        posts.fillRect(c.x - postW / 2, c.y - postH, postW, postH)
        posts.fillStyle(accent, 1)
        posts.fillRect(c.x - postW / 2 + 0.5, c.y - postH, postW - 1, postH)
        // Rounded top cap
        posts.fillCircle(c.x, c.y - postH, postW * 0.7)
      }
      // Horizontal rails between adjacent posts (2 rails: upper + lower)
      posts.lineStyle(1.5, accent, 0.85)
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i]
        const b = corners[(i + 1) % corners.length]
        // Upper rail
        posts.beginPath()
        posts.moveTo(a.x, a.y - postH * 0.75)
        posts.lineTo(b.x, b.y - postH * 0.75)
        posts.strokePath()
        // Lower rail
        posts.beginPath()
        posts.moveTo(a.x, a.y - postH * 0.35)
        posts.lineTo(b.x, b.y - postH * 0.35)
        posts.strokePath()
      }
      container.add(posts)

      // (Removed floating emoji marker — the animated animals themselves make
      // the pen type instantly recognisable, and the emoji was drifting above
      // the back fence looking disconnected from the enclosure.)
    }

    // ─── Water features (perigi / kolam) ─────────────────────────
    // Draws an iso-diamond pool inset into the ground with rippling water and
    // (for the well) a stone rim + tiny wooden roof. Ripples animate via a
    // slow alpha yoyo so the water never looks static. Everything lives inside
    // the container so cleanup is automatic on re-render.
    _drawWaterFeature(container, template) {
      const w = TILE_W * 0.78
      const h = TILE_H * 0.78
      const isWell = template.id === 'perigi'
      const isWudhu = template.id === 'kolam_wudhu'

      // Outer stone/tile rim — sits on the ground diamond.
      const rimColor = Phaser.Display.Color.HexStringToColor(template.accentColor).color
      const rim = this.add.graphics()
      rim.fillStyle(rimColor, 1)
      rim.beginPath()
      rim.moveTo(0, -h / 2)
      rim.lineTo(w / 2, 0)
      rim.lineTo(0, h / 2)
      rim.lineTo(-w / 2, 0)
      rim.closePath(); rim.fillPath()
      rim.lineStyle(1.5, 0x000000, 0.28)
      rim.beginPath()
      rim.moveTo(0, -h / 2)
      rim.lineTo(w / 2, 0)
      rim.lineTo(0, h / 2)
      rim.lineTo(-w / 2, 0)
      rim.closePath(); rim.strokePath()
      container.add(rim)

      // Inner water surface — smaller diamond
      const iw = w * 0.72
      const ih = h * 0.72
      const water = this.add.graphics()
      const waterColor = Phaser.Display.Color.HexStringToColor(template.color).color
      water.fillStyle(waterColor, 1)
      water.beginPath()
      water.moveTo(0, -ih / 2)
      water.lineTo(iw / 2, 0)
      water.lineTo(0, ih / 2)
      water.lineTo(-iw / 2, 0)
      water.closePath(); water.fillPath()
      container.add(water)

      // Highlight sheen — a lighter thin ellipse on the top-RIGHT face for
      // gloss (matches the world-wide top-right sun convention).
      const sheen = this.add.graphics()
      sheen.fillStyle(0xffffff, 0.35)
      sheen.fillEllipse(iw * 0.15, -ih * 0.18, iw * 0.45, ih * 0.18)
      container.add(sheen)

      // Ripples — 2 concentric ellipses that fade in/out on a loop, giving
      // the water a subtle life without moving anything.
      const ripple1 = this.add.graphics()
      ripple1.lineStyle(1.2, 0xffffff, 0.55)
      ripple1.strokeEllipse(0, 0, iw * 0.35, ih * 0.35)
      container.add(ripple1)
      const ripple2 = this.add.graphics()
      ripple2.lineStyle(1, 0xffffff, 0.35)
      ripple2.strokeEllipse(iw * 0.15, -ih * 0.1, iw * 0.22, ih * 0.22)
      container.add(ripple2)
      this.tweens.add({ targets: ripple1, alpha: { from: 0.9, to: 0.1 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: ripple2, alpha: { from: 0.2, to: 0.9 }, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 500 })

      if (isWell) {
        // Stone shaft + tiny wooden roof — well should stand up from the
        // pool so it reads as a fetching well, not just a puddle.
        const shaft = this.add.graphics()
        shaft.fillStyle(0x8a7a5a, 1)
        shaft.fillRect(-8, -20, 16, 20)
        shaft.lineStyle(1, 0x4a3a2a, 1)
        shaft.strokeRect(-8, -20, 16, 20)
        // Stone brick lines
        shaft.beginPath()
        shaft.moveTo(-8, -13); shaft.lineTo(8, -13)
        shaft.moveTo(-8, -6);  shaft.lineTo(8, -6)
        shaft.strokePath()
        container.add(shaft)
        // Wooden roof (triangle on 2 vertical posts)
        const roof = this.add.graphics()
        // Posts
        roof.fillStyle(0x6a4a2a, 1)
        roof.fillRect(-9, -34, 2, 14)
        roof.fillRect(7, -34, 2, 14)
        // Roof (triangle)
        roof.fillStyle(0x8b4513, 1)
        roof.fillTriangle(-13, -34, 13, -34, 0, -46)
        roof.lineStyle(1, 0x4a2a10, 1)
        roof.strokeTriangle(-13, -34, 13, -34, 0, -46)
        container.add(roof)
        // Bucket rope hint (small line down)
        const rope = this.add.graphics()
        rope.lineStyle(1, 0x2a1a0a, 0.7)
        rope.beginPath()
        rope.moveTo(0, -34); rope.lineTo(0, -22)
        rope.strokePath()
        container.add(rope)
      } else if (isWudhu) {
        // Small fountain spout in the middle
        const spout = this.add.graphics()
        spout.fillStyle(0xa0a0a0, 1)
        spout.fillCircle(0, -3, 3)
        spout.fillRect(-1, -12, 2, 9)
        container.add(spout)
        // Water jets — thin arcs animated
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2
          const jet = this.add.graphics()
          jet.lineStyle(1.5, 0xdff3ff, 0.85)
          jet.beginPath()
          const dx = Math.cos(a) * 8
          const dy = Math.sin(a) * 4
          jet.moveTo(0, -12)
          jet.lineTo(dx, -6 + dy)
          jet.strokePath()
          container.add(jet)
          this.tweens.add({ targets: jet, alpha: { from: 1, to: 0.2 }, duration: 800, yoyo: true, repeat: -1, delay: i * 250 })
        }
      }
    }

    // (Legacy inline hook removed — livestock is now handled entirely in the
    // early branch at the top of drawBuildingSprite.)

    // ─── Livestock animals ───────────────────────────────────────
    // Draws N tiny animated animal sprites INSIDE a pen container.
    // Each animal is a small geometric shape (not emoji) with a proportional
    // size — chickens ~5px, camels ~16px — so a chicken is never the size of
    // a camel. Every animal wanders on a slow randomised loop within the pen.
    //
    // Called from drawBuildingSprite when template.category === 'ternakan'.
    // Animals are added as children of the building container, so they are
    // automatically destroyed when the container is destroyed (safe cleanup).
    _spawnLivestockAnimals(container, template) {
      // Spec per pen: count, wander radius (X), draw function, size scalar.
      const SPECS = {
        reban_ayam:      { count: 4, rx: 22, ry: 10, size: 5,  draw: this._drawChicken.bind(this) },
        kandang_kambing: { count: 2, rx: 20, ry: 9,  size: 9,  draw: this._drawGoat.bind(this)    },
        kandang_lembu:   { count: 2, rx: 22, ry: 10, size: 12, draw: this._drawCow.bind(this)     },
        kandang_unta:    { count: 1, rx: 18, ry: 8,  size: 16, draw: this._drawCamel.bind(this)   },
      }
      const spec = SPECS[template.id]
      if (!spec) return
      // Pick a starting point inside the pen for each animal.
      for (let i = 0; i < spec.count; i++) {
        const a0 = (i / spec.count) * Math.PI * 2 + Math.random() * 0.4
        const d0 = Math.random() * 0.7 + 0.2
        const startX = Math.cos(a0) * spec.rx * d0
        // Y is squashed for iso perspective + tiny front-of-pen bias so
        // animals feel like they're standing on the front half of the floor.
        const startY = 4 + Math.sin(a0) * spec.ry * d0
        const animal = spec.draw(startX, startY, spec.size)
        // Depth so animals draw ABOVE the pen floor but roughly at pen height.
        animal.setDepth(1)
        container.add(animal)

        // Continuous wander loop — pick a new target every 2-5s.
        const wander = () => {
          // Bail if the animal (or its container) was destroyed mid-loop.
          if (!animal.scene || !animal.active) return
          const a2 = Math.random() * Math.PI * 2
          const d2 = Math.random() * 0.75 + 0.2
          const tx = Math.cos(a2) * spec.rx * d2
          const ty = 4 + Math.sin(a2) * spec.ry * d2
          // Flip horizontally when heading left, so head faces movement direction.
          const facing = tx < animal.x ? -1 : 1
          this.tweens.add({
            targets: animal,
            x: tx,
            y: ty,
            scaleX: facing,   // flip
            duration: 2000 + Math.random() * 3000,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              // Small pause between hops (feels like grazing / pecking).
              this.time.delayedCall(400 + Math.random() * 1200, wander)
            },
          })
        }
        // Stagger the initial start so the pen doesn't feel synchronised.
        this.time.delayedCall(Math.random() * 800, wander)
      }
    }

    // ─── Animal shapes — refined geometric primitives ────────────
    // Each returns a container centered at (x,y) so it can be tweened as a
    // whole. All shapes drawn with Phaser Graphics (no emoji) so they stay
    // crisp at any zoom + easy to swap for future 3D asset overrides.

    _drawChicken(x, y, s) {
      const c = this.add.container(x, y)
      const g = this.add.graphics()
      // Legs
      g.lineStyle(1, 0xcc8800, 1)
      g.beginPath()
      g.moveTo(-s * 0.25, s * 0.35); g.lineTo(-s * 0.25, s * 0.7)
      g.moveTo(s * 0.15,  s * 0.35); g.lineTo(s * 0.15,  s * 0.7)
      g.strokePath()
      // Body — soft white oval
      g.fillStyle(0xfaf7f0, 1)
      g.fillEllipse(0, 0, s * 1.4, s * 0.95)
      g.lineStyle(1, 0xd6cfbf, 1)
      g.strokeEllipse(0, 0, s * 1.4, s * 0.95)
      // Wing (subtle)
      g.fillStyle(0xe6dfc9, 1)
      g.fillEllipse(-s * 0.15, 0, s * 0.7, s * 0.5)
      // Head
      g.fillStyle(0xfaf7f0, 1)
      g.fillCircle(s * 0.55, -s * 0.35, s * 0.4)
      // Comb (red)
      g.fillStyle(0xd93838, 1)
      g.fillCircle(s * 0.55, -s * 0.75, s * 0.18)
      g.fillCircle(s * 0.7,  -s * 0.7,  s * 0.14)
      // Beak
      g.fillStyle(0xffb300, 1)
      g.fillTriangle(s * 0.9, -s * 0.3, s * 1.15, -s * 0.2, s * 0.9, -s * 0.15)
      // Eye
      g.fillStyle(0x111111, 1)
      g.fillCircle(s * 0.65, -s * 0.4, s * 0.08)
      c.add(g)
      return c
    }

    _drawGoat(x, y, s) {
      const c = this.add.container(x, y)
      const g = this.add.graphics()
      // Legs (4 thin verticals)
      g.lineStyle(1.5, 0x4a3a2a, 1)
      g.beginPath()
      g.moveTo(-s * 0.45, s * 0.25); g.lineTo(-s * 0.45, s * 0.7)
      g.moveTo(-s * 0.15, s * 0.25); g.lineTo(-s * 0.15, s * 0.7)
      g.moveTo(s * 0.35,  s * 0.25); g.lineTo(s * 0.35,  s * 0.7)
      g.moveTo(s * 0.55,  s * 0.25); g.lineTo(s * 0.55,  s * 0.7)
      g.strokePath()
      // Body — creamy grey capsule
      g.fillStyle(0xe6dbc4, 1)
      g.fillRoundedRect(-s * 0.6, -s * 0.25, s * 1.35, s * 0.55, s * 0.25)
      g.lineStyle(1, 0x9a8570, 1)
      g.strokeRoundedRect(-s * 0.6, -s * 0.25, s * 1.35, s * 0.55, s * 0.25)
      // Head
      g.fillStyle(0xe6dbc4, 1)
      g.fillCircle(s * 0.75, -s * 0.35, s * 0.3)
      // Snout darker
      g.fillStyle(0xc9b892, 1)
      g.fillEllipse(s * 0.95, -s * 0.25, s * 0.35, s * 0.2)
      // Horns (little brown curls)
      g.fillStyle(0x7a5a3a, 1)
      g.fillTriangle(s * 0.7, -s * 0.55, s * 0.65, -s * 0.85, s * 0.8, -s * 0.55)
      g.fillTriangle(s * 0.85, -s * 0.55, s * 0.9, -s * 0.85, s * 0.75, -s * 0.55)
      // Eye
      g.fillStyle(0x111111, 1)
      g.fillCircle(s * 0.82, -s * 0.35, s * 0.06)
      // Little tail
      g.fillStyle(0xe6dbc4, 1)
      g.fillCircle(-s * 0.65, -s * 0.1, s * 0.1)
      c.add(g)
      return c
    }

    _drawCow(x, y, s) {
      const c = this.add.container(x, y)
      const g = this.add.graphics()
      // Legs
      g.lineStyle(2, 0x3a2a1a, 1)
      g.beginPath()
      g.moveTo(-s * 0.5, s * 0.22); g.lineTo(-s * 0.5, s * 0.65)
      g.moveTo(-s * 0.2, s * 0.22); g.lineTo(-s * 0.2, s * 0.65)
      g.moveTo(s * 0.35, s * 0.22); g.lineTo(s * 0.35, s * 0.65)
      g.moveTo(s * 0.55, s * 0.22); g.lineTo(s * 0.55, s * 0.65)
      g.strokePath()
      // Body — white capsule
      g.fillStyle(0xf6f0e6, 1)
      g.fillRoundedRect(-s * 0.65, -s * 0.3, s * 1.45, s * 0.6, s * 0.28)
      g.lineStyle(1, 0x6b5a48, 1)
      g.strokeRoundedRect(-s * 0.65, -s * 0.3, s * 1.45, s * 0.6, s * 0.28)
      // Black patches (Holstein-style)
      g.fillStyle(0x2a1e14, 1)
      g.fillEllipse(-s * 0.3, -s * 0.05, s * 0.4, s * 0.25)
      g.fillEllipse(s * 0.35, -s * 0.15, s * 0.3, s * 0.2)
      g.fillEllipse(s * 0.15, s * 0.15, s * 0.35, s * 0.18)
      // Head
      g.fillStyle(0xf6f0e6, 1)
      g.fillCircle(s * 0.8, -s * 0.3, s * 0.32)
      // Muzzle pink
      g.fillStyle(0xf5b8b8, 1)
      g.fillEllipse(s * 0.98, -s * 0.2, s * 0.28, s * 0.18)
      // Horns
      g.fillStyle(0xd4c39a, 1)
      g.fillTriangle(s * 0.7, -s * 0.5, s * 0.6, -s * 0.75, s * 0.78, -s * 0.5)
      g.fillTriangle(s * 0.88, -s * 0.5, s * 0.98, -s * 0.75, s * 0.8, -s * 0.5)
      // Eye
      g.fillStyle(0x111111, 1)
      g.fillCircle(s * 0.85, -s * 0.32, s * 0.06)
      // Tail
      g.lineStyle(1.5, 0x3a2a1a, 1)
      g.beginPath()
      g.moveTo(-s * 0.7, -s * 0.1); g.lineTo(-s * 0.85, s * 0.15)
      g.strokePath()
      g.fillStyle(0x3a2a1a, 1)
      g.fillCircle(-s * 0.85, s * 0.18, s * 0.08)
      c.add(g)
      return c
    }

    _drawCamel(x, y, s) {
      const c = this.add.container(x, y)
      const g = this.add.graphics()
      // Legs (long)
      g.lineStyle(2, 0x6a4a2a, 1)
      g.beginPath()
      g.moveTo(-s * 0.45, s * 0.2); g.lineTo(-s * 0.5, s * 0.8)
      g.moveTo(-s * 0.15, s * 0.2); g.lineTo(-s * 0.2, s * 0.8)
      g.moveTo(s * 0.3, s * 0.2); g.lineTo(s * 0.3, s * 0.8)
      g.moveTo(s * 0.5, s * 0.2); g.lineTo(s * 0.55, s * 0.8)
      g.strokePath()
      // Body — tan sandy
      g.fillStyle(0xd6a86a, 1)
      g.fillRoundedRect(-s * 0.65, -s * 0.15, s * 1.35, s * 0.45, s * 0.2)
      g.lineStyle(1, 0x8a6a3a, 1)
      g.strokeRoundedRect(-s * 0.65, -s * 0.15, s * 1.35, s * 0.45, s * 0.2)
      // Two humps
      g.fillStyle(0xc9995a, 1)
      g.fillEllipse(-s * 0.2, -s * 0.35, s * 0.55, s * 0.5)
      g.fillEllipse(s * 0.3,  -s * 0.35, s * 0.5,  s * 0.45)
      g.lineStyle(1, 0x8a6a3a, 1)
      g.strokeEllipse(-s * 0.2, -s * 0.35, s * 0.55, s * 0.5)
      g.strokeEllipse(s * 0.3,  -s * 0.35, s * 0.5,  s * 0.45)
      // Long curved neck
      g.fillStyle(0xd6a86a, 1)
      g.fillRoundedRect(s * 0.55, -s * 0.7, s * 0.22, s * 0.7, s * 0.1)
      // Head
      g.fillStyle(0xd6a86a, 1)
      g.fillEllipse(s * 0.75, -s * 0.75, s * 0.42, s * 0.3)
      // Snout darker
      g.fillStyle(0xa87a4a, 1)
      g.fillEllipse(s * 0.92, -s * 0.7, s * 0.2, s * 0.15)
      // Eye
      g.fillStyle(0x111111, 1)
      g.fillCircle(s * 0.78, -s * 0.8, s * 0.06)
      // Tail
      g.lineStyle(1.5, 0x6a4a2a, 1)
      g.beginPath()
      g.moveTo(-s * 0.7, -s * 0.05); g.lineTo(-s * 0.85, s * 0.15)
      g.strokePath()
      c.add(g)
      return c
    }
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
            const bnd = this._currentBounds || this._computeBounds()
            if (cx < bnd.minX || cx >= bnd.maxX || cy < bnd.minY || cy >= bnd.maxY) continue
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
            const bnd = this._currentBounds || this._computeBounds()
            if (x < bnd.minX || x >= bnd.maxX || y < bnd.minY || y >= bnd.maxY) continue
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
      // Effective footprint at the given level (musalla grows per upgrade,
      // rumah/kebun stay 1×1). For MUSALLA, position at the CENTER of its 4×4
      // reserved zone (matching renderSingleBuilding's _footprintCenter logic)
      // so the temp construction sprite lives at the SAME screen coord that
      // the real container will use once the DB record arrives — no more
      // "jumps to default location" flicker after finish.
      const foot = t.tileSizeByLevel?.[level] || t.tileSize || { w: 1, h: 1 }
      const sz = foot   // keep back-compat name (used further down for fence/dust)
      let cx, cy
      if (t.id === 'musalla' && t.reserveSize) {
        cx = gridX + (t.reserveSize.w - 1) / 2
        cy = gridY + (t.reserveSize.h - 1) / 2
      } else {
        cx = gridX + (foot.w - 1) / 2
        cy = gridY + (foot.h - 1) / 2
      }
      const { x, y } = gridToScreen(cx, cy, this.originX, this.originY)

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

      // ─── Phased build-up (extended to ~5500ms for pedagogical presence) ──
      // Phase 1 (0-1500ms): dust settles, foundation at 20% scale
      // Phase 2 (1500-3500ms): scaling up to 70% + heavy hammering
      // Phase 3 (3500-5000ms): final rise to 100% + subtle bounce
      // Phase 4 (5000-5500ms): fence & workers fade + sparkle burst
      scene.tweens.chain({
        targets: bContainer,
        tweens: [
          { scale: 0.4, alpha: 0.7, duration: 1500, ease: 'Sine.easeOut' },
          { scale: 0.85, alpha: 0.95, duration: 2000, ease: 'Sine.easeInOut' },
          { scale: 1.1, alpha: 1.0, duration: 1000, ease: 'Back.easeOut' },
          { scale: 1.0, duration: 500, ease: 'Sine.easeIn' },
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
              // Reparent the surviving building sprite directly to buildingLayer
              // (out of the temp constructionLayer) so syncStateFromRegistry
              // can find it via buildingLayer.list. Then dispose of the empty
              // constructionLayer shell.
              scene.time.delayedCall(600, () => {
                try {
                  constructionLayer.remove(bContainer, false)  // preserve bContainer
                  scene.buildingLayer.add(bContainer)
                  constructionLayer.destroy()
                } catch { /* teardown */ }
                // Tag the surviving sprite so sync can find & remove it later
                bContainer._isTempConstruction = true
                bContainer._tempTemplateId = templateId
                bContainer._tempGridX = gridX
                bContainer._tempGridY = gridY
                bContainer.setDepth(gridY + gridX)
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
