/**
 * WorldScene — main Phaser 3 scene for the EQrel World Engine.
 * Renders an isometric grid, buildings (procedural placeholder art),
 * villagers, and handles React-driven placement events.
 *
 * Exported as a factory so we can bind the Phaser namespace at runtime
 * (must be dynamic-imported client-side only).
 */
import { WORLD_SIZE, MAX_WORLD_SIZE, MUSALLA_ANCHOR, BUILDING_TEMPLATES, getCurrentBounds, isCellInWorld } from '@/lib/worldEngine'
import { TILE_W, TILE_H, gridToScreen } from '@/components/eqrel/WorldCanvas'
import { createVillager, setFacing, attachWalkAnimation, stopWalkAnimation, VILLAGER_KIND_POOL } from '@/lib/phaser/Villager'
import { showBubble, GREETINGS, GREETING_REPLIES, DHIKR_POOL, ARRIVAL_DHIKR, ADHAN_BUBBLE, pickBubbleByLang } from '@/lib/phaser/Bubble'
import { renderNature } from '@/lib/phaser/Nature'

// Color palette derived from EQrel brand
// Uniform grass palette (no checkerboard) — subtle natural blobs are drawn
// separately so the ground doesn't look like a grid of alternating boxes.
// Tones are intentionally very close in luminance so the eye reads it as
// one meadow, not distinct patches.
// (2026-07-26) User: "adjust warna grid untuk blend warna dengan aset".
// Palette shifted from cool mint (0x7ec091) → warm sage (0x9cbf6f) so the
// grass shares undertones with the olive/palm/fig canopy warm-greens.
// Trees now feel rooted on the same "kampung soil" rather than floating on
// a differently-tinted mint blanket.
const GRASS_BASE  = 0x9cbf6f   // warm sage baseline — blends with tree bases
const GRASS_BLOB  = 0x94b968   // very slightly darker, olive-tinted patch
const GRASS_LIGHT_BLOB = 0xa5c877 // gentle yellow-green highlight
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
      // yOffset = 24 (= TILE_H/2) plants the image BASE at the FRONT-BOTTOM
      // vertex of the isometric diamond so buildings are firmly rooted on
      // the tile — no more floating above the grid. All assets are re-cropped
      // with ~2px bottom padding so the image bottom edge IS the visual base.
      // (User: "semua binaan kita masih floating dan tak betul2 berada pada
      // grid land yang kita design, sebab tu nampak offset keatas sedikit".)
      //
      // MUSALLA — supports per-level asset override via `levels` map.
      //   L1 = musalla.webp        (kabin ibadat kecil, 2×2 foot)
      //   L2 = masjid_l2.webp      (masjid dengan 1 menara, kubah emas, 3×3 foot)
      //   L3 = masjid_l3.webp      (Jami' Masjid megah — 2 menara sisi + kubah
      //                             emas besar + kubah hijau kecil + air pancut,
      //                             4×4 foot, mengisi golden zone 8×8 dengan
      //                             buffer padding di sekeliling).
      // MUSALLA scales tuned so sprite width NEVER exceeds the level's tile
      // diamond width (2×2=192, 3×3=288, 4×4=384 px @ TILE_W=96). Previous
      // 0.55/0.90/1.20 overshot the diamond by 8-16px, giving the "built
      // beyond grid" look. New: 0.48/0.80/1.05 all fit with safe margin.
      // Musalla/Masjid/Jami' Masjid — user v3: "dibesarkan sedikit bagi logik
      // size dengan orang dan ternakan". Previous 0.48/0.80/1.05 kept sprites
      // safely inside the diamond but read too small next to the new pens
      // (kambing 2×2 @ 0.60, unta 4×4 @ 0.80). Bumped ~10% to 0.52/0.86/1.14
      // — still comfortably inside their respective footprints (2×2 = 192w,
      // 3×3 = 288w, 4×4 = 384w).
      musalla:    {
        path: '/assets/world/musalla.webp',
        baseScale: 0.52, yOffset: 24, upgradeScale: 0.25,
        levels: {
          2: { path: '/assets/world/masjid_l2.webp', baseScale: 0.86, yOffset: 24 },
          3: { path: '/assets/world/masjid_l3.webp', baseScale: 1.14, yOffset: 24 },
        },
      },
      // Rumah scales — bumped so a house reads bigger than the goat pen on
      // the same 2×2 footprint (user v3: houses should scale logically with
      // people & livestock).
      //   • rumah_kayu 1×1 : 0.30 → 0.34
      //   • rumah_batu 2×2 : 0.32 → 0.40
      //   • banglo     2×2 : 0.42 → 0.50
      banglo:      { path: '/assets/world/rumah/banglo.webp',       baseScale: 0.50 },
      rumah_batu:  { path: '/assets/world/rumah/rumah_batu.webp',   baseScale: 0.40 },
      rumah_kayu:  { path: '/assets/world/rumah/rumah_kayu.webp',   baseScale: 0.34 },
      // Single date palm — reusable atom for procedural orchard composition.
      // See _drawOrchard() below: for any 'kebun' template we compose an
      // orchard by placing N×N tree instances across the footprint with
      // deterministic jitter. Ground/soil live on the tile grid, NOT in this
      // asset (transparent background, no shadow, no terrain).
      palm_tree:   { path: '/assets/world/kebun/palm_tree.webp',    baseScale: 0.55 },
      // Fig tree — same procedural composition pattern, smaller crown than
      // date palm to reflect fig's naturally shorter/bushier profile.
      fig_tree:    { path: '/assets/world/kebun/fig_tree.webp',     baseScale: 0.42 },
      // Pomegranate tree — same size profile as fig (baseScale 0.42) per user
      // spec, but placed with wider spacing in _drawOrchard so the orchard
      // reads visually different from the tightly-packed fig grove.
      pomegranate_tree: { path: '/assets/world/kebun/pomegranate_tree.webp', baseScale: 0.42 },
      // Olive tree (zaitun) — smaller compact tree with golden foliage,
      // placed procedurally like fig/pomegranate. Same scale profile.
      olive_tree:  { path: '/assets/world/kebun/olive_tree.webp',   baseScale: 0.60 },
      // Grape vineyard (anggur) — user request: kecilkan pokok anggur dan
      // jadikan 4 pokok per orchard. Original asset shows a horizontal row
      // of 3 vines; we now scale each instance DOWN (baseScale 0.55) and
      // compose 4 tiny vine-rows in a 2×2 grid via _drawOrchard (same
      // procedural pattern as delima/zaitun). No more single-panel path.
      grape_row:   { path: '/assets/world/kebun/grape_row.webp',    baseScale: 0.55 },
      // ── Livestock — kandang_kambing uses a real wooden-pen PNG asset now.
      // Tile footprint 2×2 (same as rumah_batu). 2 goat sprites are spawned
      // inside procedurally with minimal forward/backward movement (no flip,
      // no rotation) — user: "letak 2 ekor kambing, bergerak minimal
      // kedepan dan belakang tanpa perlu berpusing".
      kandang_kambing: { path: '/assets/world/ternakan/kandang_kambing.webp', baseScale: 0.60 },
      // Cattle ranch — bigger pen (3×3 grid) so it towers over the goat pen.
      // baseScale slightly smaller than the kambing pen because the raw art
      // (383×194) is already larger.  User: "buat kandang lembu lebih besar
      // dari kandang kambing".
      kandang_lembu:   { path: '/assets/world/ternakan/kandang_lembu.webp',   baseScale: 0.78 },
      // Chicken coop — user: "jadikan lebih kecil dari reban kambing".
      // Same 2×2 grid footprint as kambing pen but baseScale reduced (0.48
      // vs 0.60) so the visual is noticeably smaller.
      reban_ayam:      { path: '/assets/world/ternakan/reban_ayam.webp',      baseScale: 0.48 },
      // Camel barn — user tuned visual to ~3.5×3.5 (VS the initial 4×4 look).
      // We keep the 4×4 grid footprint (larger buffer around the pen for the
      // camel to roam), but shrink the sprite from 0.90 → 0.80 so it visually
      // reads as roughly halfway between the cattle ranch (3×3, 0.78) and the
      // original oversized 4×4 look.
      kandang_unta:    { path: '/assets/world/ternakan/kandang_unta.webp',    baseScale: 0.80 },
    }

    preload() {
      // Load every registered asset with a stable key 'bld_<id>'.
      // Also load level-specific asset variants under key 'bld_<id>_L<level>'.
      const reg = WorldScene.ASSET_REGISTRY
      for (const [id, cfg] of Object.entries(reg)) {
        this.load.image(`bld_${id}`, cfg.path)
        if (cfg.levels) {
          for (const [lvl, sub] of Object.entries(cfg.levels)) {
            this.load.image(`bld_${id}_L${lvl}`, sub.path)
          }
        }
      }
      // ── Flower patches (8 variants — user: "gunakan semua assets")
      for (let i = 1; i <= 8; i++) {
        const k = `flower_patch_${String(i).padStart(2, '0')}`
        this.load.image(k, `/assets/world/flowers/patches/${k}.webp`)
      }
      // ── Bushes (8 variants)
      for (let i = 1; i <= 8; i++) {
        const k = `bush_${String(i).padStart(2, '0')}`
        this.load.image(k, `/assets/world/bushes/${k}.webp`)
      }
      // ── Saplings / trees (10 variants — 5×2 pack)
      for (let i = 1; i <= 10; i++) {
        const k = `sapling_${String(i).padStart(2, '0')}`
        this.load.image(k, `/assets/world/saplings/${k}.webp`)
      }
      // ── Grass tufts (8 variants)
      for (let i = 1; i <= 8; i++) {
        const k = `grass_${String(i).padStart(2, '0')}`
        this.load.image(k, `/assets/world/grass/${k}.webp`)
      }
      // ── Rocks (8 variants)
      for (let i = 1; i <= 8; i++) {
        const k = `rock_${String(i).padStart(2, '0')}`
        this.load.image(k, `/assets/world/rocks/${k}.webp`)
      }
      // ── Dust path decals (SPECIAL — spline-driven, not scatter). 12 variants
      // (positive-space smart-sliced from Dust_pack.webp, 3×4 pack).
      for (let i = 1; i <= 12; i++) {
        const k = `path_dust_${String(i).padStart(2, '0')}`
        this.load.image(k, `/assets/world/paths/${k}.webp`)
      }
      // ── Signboards (8 variants)
      for (let i = 1; i <= 8; i++) {
        const k = `sign_${String(i).padStart(2, '0')}`
        this.load.image(k, `/assets/world/signs/${k}.webp`)
      }
      // ── Livestock animals (real PNG replacements for procedural shapes).
      // Goat is the first — 2 goats per pen, minimal forward/backward
      // movement, no rotation/flip (user spec).
      this.load.image('animal_kambing', '/assets/world/ternakan/kambing.webp')
      // Cow — bigger sprite than goat, roams around inside its larger 3×3 pen
      this.load.image('animal_lembu',   '/assets/world/ternakan/lembu.webp')
      // Chicken family pack — 7 smart-sliced variants
      // (rooster + hens + chick) placed as 2 flocks in the coop.
      for (let i = 1; i <= 7; i++) {
        const k = `chicken_${String(i).padStart(2, '0')}`
        this.load.image(k, `/assets/world/ternakan/chickens/${k}.webp`)
      }
      // Camel — largest livestock sprite, walks around inside the biggest
      // 4×4 pen. Pen art already contains a static resting camel.
      this.load.image('animal_unta',    '/assets/world/ternakan/unta.webp')
      // ── Construction assets (v5): fence + EQ workers (4 poses) +
      // excavator (4 poses) replace the previous procedural fence lines
      // and tiny stick-figure workers.  Loaded once; playConstruction()
      // spawns instances per build.
      this.load.image('construction_fence', '/assets/world/construction/fence.webp')
      for (let i = 1; i <= 4; i++) {
        const k = String(i).padStart(2, '0')
        this.load.image(`worker_${k}`,    `/assets/world/construction/workers/worker_${k}.webp`)
        this.load.image(`excavator_${k}`, `/assets/world/construction/excavator/excavator_${k}.webp`)
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
      // ── DRAG LIFECYCLE FULLY DISABLED (v5: user report "always accidently
      // touch to relocated"). Root cause: Phaser's dragTimeThreshold and
      // dragDistanceThreshold use OR logic (see InputPlugin.js line 1146-
      // 1157) — dragstart fires the instant EITHER threshold is met. On
      // mobile, a natural pan gesture always moves > 10px, so dragstart
      // ALWAYS fires when the finger starts on a building.
      //
      // New pattern: SELECT-FIRST-THEN-MOVE (Clash of Clans / SimCity BuildIt
      // style). Buildings are tap-only in the world scene; relocation is
      // engaged EXPLICITLY via [Pindah] button in BuildingInfoCard, which
      // calls scene.enterMoveMode(buildingId). Only THEN can the finger
      // move the sprite. Pan/zoom stay 100% free at all times.
      this.input.dragTimeThreshold = 0
      this.input.dragDistanceThreshold = 0

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
    // Mobile-first design: wider zoom range (0.5 - 2.5), smoother pinch
    // scaling, momentum on pan release, and pan works from ANY empty tile
    // (not just outside the world). Prevents building-drag conflict via
    // _buildingDragging flag.
    setupCameraControls() {
      const camera = this.cameras.main
      // Enable up to 3 pointers so pinch (2) still works while a UI overlay
      // taps briefly (3rd finger). Improves mobile robustness.
      this.input.addPointer(3)
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

      // ── PAN state with velocity tracking for momentum on release ────
      let panStart = null
      let lastPointerX = 0, lastPointerY = 0, lastTime = 0
      let velocityX = 0, velocityY = 0
      this._panMomentum = null   // active Phaser tween or null

      this.input.on('pointerdown', (pointer, targets) => {
        if (this._buildingDragging) return
        // ── MOVE-MODE OVERRIDE: if a building is in "picked up" state via
        // enterMoveMode(), the pointer directly controls its position and
        // pan is DISABLED for this gesture.  Also skip building-hit early
        // return in move mode so tap doesn't fire when clicking around.
        if (this._activeMoveContainer) return
        // v5: We NO LONGER early-return when the pointer landed on a
        // building. Buildings are tap-only now (no Phaser drag), so the
        // pan gesture must always be able to start — even from a finger
        // landing on a rooftop — otherwise on a small phone every touch
        // gets stuck. RC#1 in analysis.
        if (this._panMomentum) { try { this._panMomentum.stop() } catch { /* noop */ } this._panMomentum = null }
        panStart = {
          px: pointer.x, py: pointer.y,
          sx: camera.scrollX, sy: camera.scrollY,
        }
        lastPointerX = pointer.x; lastPointerY = pointer.y; lastTime = performance.now()
        velocityX = 0; velocityY = 0
      })
      this.input.on('pointermove', (pointer) => {
        // ── MOVE-MODE: pointer follows the picked-up building. Preview
        // ghost is drawn at the snapped destination cell.
        if (this._activeMoveContainer) {
          const container = this._activeMoveContainer
          const sz = this._activeMoveSz || { w: 1, h: 1 }
          // Use Phaser's pointer.worldX/worldY which correctly accounts for
          // camera scroll, zoom AND viewport origin (my previous manual
          // formula `scrollX + pointer.x / zoom` missed the camera
          // origin/matrix corrections and caused a visible offset between
          // finger and building on zoomed views).
          const worldX = pointer.worldX
          const worldY = pointer.worldY
          container.x = worldX
          container.y = worldY
          this._moveHasMoved = true
          const { col, row } = this.screenToGrid(worldX, worldY)
          const b = this._currentBounds || this._computeBounds()
          const clampedCol = Math.max(b.minX, Math.min(b.maxX - sz.w, col))
          const clampedRow = Math.max(b.minY, Math.min(b.maxY - sz.h, row))
          const valid = this.isCellPlacementValid(clampedCol, clampedRow, sz, container.buildingData.id)
          container._pendingCell = { x: clampedCol, y: clampedRow, valid }
          if (this._moveGhost) this._moveGhost.clear()
          this._dragGhost = this._moveGhost
          this._drawDragGhost(clampedCol, clampedRow, sz, valid)
          this._dragGhost = null
          if (this._moveGlow) {
            this._moveGlow.x = container.x
            this._moveGlow.y = container.y + 4
          }
          return
        }
        if (!panStart || this._buildingDragging) return
        // Pinch check happens in the separate pointermove handler below.
        if (this.input.pointer1?.isDown && this.input.pointer2?.isDown) return
        camera.scrollX = panStart.sx - (pointer.x - panStart.px) / camera.zoom
        camera.scrollY = panStart.sy - (pointer.y - panStart.py) / camera.zoom
        // Track velocity (pixels/ms) for momentum flick.
        const now = performance.now()
        const dt = Math.max(1, now - lastTime)
        velocityX = (pointer.x - lastPointerX) / dt
        velocityY = (pointer.y - lastPointerY) / dt
        lastPointerX = pointer.x; lastPointerY = pointer.y; lastTime = now
      })
      const finishPan = () => {
        // ── MOVE-MODE handoff: if a building is being moved, this pointerup
        // decides whether to request confirmation OR snap back.
        if (this._activeMoveContainer) {
          const container = this._activeMoveContainer
          const pending = container._pendingCell
          const hasMoved = this._moveHasMoved
          if (!hasMoved || !pending || !pending.valid ||
              (pending.x === container._origGridX && pending.y === container._origGridY)) {
            // Invalid / no-op drop → snap back and exit move mode
            this._exitMoveMode(true)
            this.game.registry.get('onEvent')?.('move-mode-cancelled', {})
            return
          }
          // Valid destination — emit move-requested (React shows Ya/Tidak card).
          // Keep the building visually AT the destination while React confirms.
          const destWorld = gridToScreen(pending.x, pending.y, this.originX, this.originY)
          container.x = destWorld.x
          container.y = destWorld.y
          // Clean up glow + ghost but leave the container elevated (React
          // will call confirmPendingMove which starts restructure animation,
          // OR cancelMoveMode which calls _exitMoveMode(true) to snap back).
          if (this._moveGlow) { try { this._moveGlow.destroy() } catch { /* noop */ } this._moveGlow = null }
          if (this._moveGhost) { try { this._moveGhost.destroy() } catch { /* noop */ } this._moveGhost = null }
          this._activeMoveContainer = null    // release pointer control
          this._activeMoveSz = null
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
          return
        }
        if (!panStart) return
        panStart = null
        // If the flick is fast enough, glide to a stop over ~400ms.
        const speed = Math.hypot(velocityX, velocityY)
        if (speed > 0.35) {
          const decayDist = 300  // px of scroll from flick
          const targetX = camera.scrollX - (velocityX * decayDist) / camera.zoom
          const targetY = camera.scrollY - (velocityY * decayDist) / camera.zoom
          this._panMomentum = this.tweens.add({
            targets: camera,
            scrollX: targetX,
            scrollY: targetY,
            duration: 450,
            ease: 'Cubic.easeOut',
            onComplete: () => { this._panMomentum = null },
          })
        }
      }
      this.input.on('pointerup',        finishPan)
      this.input.on('pointerupoutside', finishPan)

      // ── WHEEL zoom (desktop) — anchor zoom around pointer position ─
      this.input.on('wheel', (pointer, _objs, _dx, dy) => {
        const factor = dy > 0 ? 0.88 : 1.14
        const prevZoom = camera.zoom
        const next = Phaser.Math.Clamp(prevZoom * factor, 0.3, 2.5)
        // Zoom toward the pointer so content under cursor stays put.
        const worldX = camera.getWorldPoint(pointer.x, pointer.y).x
        const worldY = camera.getWorldPoint(pointer.x, pointer.y).y
        camera.setZoom(next)
        const newWorldX = camera.getWorldPoint(pointer.x, pointer.y).x
        const newWorldY = camera.getWorldPoint(pointer.x, pointer.y).y
        camera.scrollX += worldX - newWorldX
        camera.scrollY += worldY - newWorldY
      })

      // ── PINCH zoom (mobile) — 2-finger distance ratio, midpoint-anchored ─
      this._pinchInitialDist = null
      this._pinchInitialZoom = null
      this._pinchInitialMidWorld = null
      this.input.on('pointermove', () => {
        const p1 = this.input.pointer1
        const p2 = this.input.pointer2
        if (!p1?.isDown || !p2?.isDown) {
          this._pinchInitialDist = null
          this._pinchInitialMidWorld = null
          return
        }
        // Cancel pan while pinching so camera doesn't jitter.
        panStart = null
        if (this._panMomentum) { try { this._panMomentum.stop() } catch { /* noop */ } this._panMomentum = null }
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y)
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        if (this._pinchInitialDist == null) {
          this._pinchInitialDist = dist
          this._pinchInitialZoom = camera.zoom
          this._pinchInitialMidWorld = camera.getWorldPoint(midX, midY)
          return
        }
        const ratio = dist / this._pinchInitialDist
        const next = Phaser.Math.Clamp(this._pinchInitialZoom * ratio, 0.3, 2.5)
        camera.setZoom(next)
        // Keep the pinch midpoint anchored under the fingers (feels natural).
        if (this._pinchInitialMidWorld) {
          const nowWorld = camera.getWorldPoint(midX, midY)
          camera.scrollX += this._pinchInitialMidWorld.x - nowWorld.x
          camera.scrollY += this._pinchInitialMidWorld.y - nowWorld.y
        }
      })
    }

    // Compute + apply camera bounds around the current world extent so the
    // player can only pan within a reasonable box. Padding is intentionally
    // GENEROUS so kids can zoom out and pan slightly past the island edge
    // to appreciate its shape and see the surrounding sea, per user request:
    // "zoom out dan drag dibesarkan melebihi grid world untuk jadikan ianya
    // lebih praktical apabila binaan banyak".
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
      // Padding budget scales with world radius so a big island still has
      // room to breathe at max zoom-out. 6 tile-widths / 8 tile-heights of
      // buffer + a flat 400px minimum gives a comfortable border.
      const padX = Math.max(TILE_W * 6, 400)
      const padY = Math.max(TILE_H * 8, 400)
      const minX = Math.min(...xs) - TILE_W - padX
      const maxX = Math.max(...xs) + TILE_W + padX
      const minY = Math.min(...ys) - TILE_H * 2 - padY
      const maxY = Math.max(...ys) + TILE_H * 2 + padY
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
      // Preserve what the user was currently looking at BEFORE we recompute
      // origin — otherwise a resize (or an alhamdulillah overlay that briefly
      // affects layout) causes the camera to snap back to the default
      // Musalla-centered position, giving a "flash + jump" feeling right when
      // a new building is placed. Convert screen center → world coords using
      // the OLD origin, then after recompute translate back to the new
      // scroll offset so the same world tile stays under the viewport center.
      const cam = this.cameras?.main
      let worldCenter = null
      if (cam) {
        // getWorldPoint would need current camera, save via direct math on
        // scrollX + halfWidth (in world coords).
        worldCenter = {
          wx: cam.scrollX + cam.width / (2 * cam.zoom),
          wy: cam.scrollY + cam.height / (2 * cam.zoom),
          zoom: cam.zoom,
        }
      }
      const oldOriginX = this.originX
      const oldOriginY = this.originY
      this.recomputeOrigin()
      this._currentBounds = this._computeBounds()
      this.drawGround()
      this.drawGrid()
      this.syncStateFromRegistry()
      // Rebind camera bounds after resize since origin changed
      if (cam) {
        this._applyCameraBounds()
        if (worldCenter) {
          // The old world point (worldCenter.wx, worldCenter.wy) was measured
          // relative to oldOriginX/Y. Translate that point into the NEW origin
          // frame — the entire grid shifted by (newOrigin - oldOrigin), so
          // the same tile is now at (wx + dx, wy + dy).
          const dx = this.originX - oldOriginX
          const dy = this.originY - oldOriginY
          const targetWx = worldCenter.wx + dx
          const targetWy = worldCenter.wy + dy
          cam.setZoom(worldCenter.zoom)
          cam.setScroll(
            targetWx - cam.width / (2 * cam.zoom),
            targetWy - cam.height / (2 * cam.zoom),
          )
        }
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
          // ─── CIRCULAR WORLD MASK ─────────────────────────────────
          // Skip cells outside the circular island. This is what gives the
          // world its round/organic RTS shape (user: "kalau kita boleh
          // jadikan bentuknya bulat macam red alert"). Tiles at the exact
          // circle boundary are still drawn — the 0.5-cell buffer inside
          // isCellInWorld gives us a soft rather than harsh edge.
          if (b.center && b.radius != null && !isCellInWorld(col, row, b.center, b.radius)) continue
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
          // Match circular ground mask — no grid lines outside the island.
          if (b.center && b.radius != null && !isCellInWorld(col, row, b.center, b.radius)) continue
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
      // ─── SUBTLE GRID DOTS (circular world) ─────────────────────
      // The rectangular row/col line grid doesn't fit a round island (would
      // extend past the water edge). Instead we drop a tiny mid-tile marker
      // in every cell so kids still get a placement grid affordance while
      // dragging. Very light — 1×1 pixel at 0.35 alpha — invisible unless
      // eyes go looking for it.
      const dots = this.add.graphics()
      dots.fillStyle(GRID_LINE, 0.18)
      for (let row = b.minY; row < b.maxY; row++) {
        for (let col = b.minX; col < b.maxX; col++) {
          if (b.center && b.radius != null && !isCellInWorld(col, row, b.center, b.radius)) continue
          const { x, y } = gridToScreen(col, row, this.originX, this.originY)
          dots.fillRect(x - 0.5, y - 0.5, 1, 1)
          // Small tick at each of the 4 diamond vertices
          dots.fillRect(x - 0.5, y - TILE_H / 2 - 0.5, 1, 1)
          dots.fillRect(x + TILE_W / 2 - 0.5, y - 0.5, 1, 1)
        }
      }
      this.tileLayer.add(dots)
    }

    // Draw a golden diamond outline covering the 8×8 SACRED RESERVED zone —
    // this is TANAH WAQAF MASJID (mosque waqf land in Islam). Behaviours:
    //   • Zone is VISIBLE for L1 (Musalla) and L2 (Masjid) so kids can see
    //     the reserved land around a small mosque and learn about waqaf.
    //   • Zone is HIDDEN for L3 (Jami' Masjid) since the mosque fills it.
    //   • Rendered at LOW depth (in tileLayer, on the ground plane) so it
    //     NEVER overlays buildings — houses, trees, and the mosque itself
    //     always sit ON TOP of the zone marker.
    //   • Educational label "🕌 Tanah Waqaf Masjid" floats above the zone
    //     top vertex — teaches children the Islamic concept of endowment.
    _drawSacredZone(buildings) {
      if (this._sacredZone) { try { this._sacredZone.destroy() } catch { /* noop */ } this._sacredZone = null }
      if (this._sacredZoneLabel) { try { this._sacredZoneLabel.destroy() } catch { /* noop */ } this._sacredZoneLabel = null }
      if (this._sacredZoneTween) { try { this._sacredZoneTween.stop() } catch { /* noop */ } this._sacredZoneTween = null }
      const musalla = buildings.find(b => b.templateId === 'musalla')
      if (!musalla) return
      const musallaLevel = musalla.level || 1
      // Hide zone entirely at L3 — the Jami' Masjid fully occupies the reserved
      // land, so the outline becomes redundant and visually noisy.
      if (musallaLevel >= 3) return

      // Corners of the 8×8 golden diamond.
      const topC   = gridToScreen(musalla.x,     musalla.y,     this.originX, this.originY)
      const rightC = gridToScreen(musalla.x + 7, musalla.y,     this.originX, this.originY)
      const botC   = gridToScreen(musalla.x + 7, musalla.y + 7, this.originX, this.originY)
      const leftC  = gridToScreen(musalla.x,     musalla.y + 7, this.originX, this.originY)
      const TOP    = { x: topC.x,                y: topC.y - TILE_H / 2 }
      const RIGHT  = { x: rightC.x + TILE_W / 2, y: rightC.y }
      const BOTTOM = { x: botC.x,                y: botC.y + TILE_H / 2 }
      const LEFT   = { x: leftC.x - TILE_W / 2,  y: leftC.y }

      const g = this.add.graphics()
      // Very light amber wash so waqf land is subtly distinguished from grass
      // but doesn't compete visually with buildings placed on top.
      g.fillStyle(0xffb703, 0.06)
      g.beginPath()
      g.moveTo(TOP.x, TOP.y)
      g.lineTo(RIGHT.x, RIGHT.y)
      g.lineTo(BOTTOM.x, BOTTOM.y)
      g.lineTo(LEFT.x, LEFT.y)
      g.closePath()
      g.fillPath()
      // Golden dashed outline — moderate visibility (thicker than before but
      // still muted). Kids clearly see the waqf perimeter without it being
      // garish.
      g.lineStyle(2, 0xffb703, 0.60)
      const drawEdge = (x1, y1, x2, y2) => {
        const dashLen = 10, gapLen = 6
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
      // GROUND-LEVEL DEPTH: add to tileLayer with negative offset so buildings
      // (which use isometric y+x depth-sorting) always render ON TOP of the
      // sacred zone — no more overlay conflicts.
      g.setDepth(-1)
      this.tileLayer.add(g)
      this._sacredZone = g

      // ── Educational label "🕌 Tanah Waqaf Masjid" ─────────────────
      // Position: INSIDE the golden diamond, near the FRONT (bottom) edge —
      // 40px above the BOTTOM vertex so it sits within the diamond boundary
      // (not floating outside). This keeps the label clearly visible in
      // front of the mosque while respecting the reserved zone boundary.
      // (User: "biar berada dalam grid tanah masjid bukan di sebelah luar
      // grid, sebab masih ada empty space sebelah dalam".)
      const lang = this.game.registry.get('lang') || 'ms'
      const waqfText = {
        ms: '🕌 Tanah Waqaf Masjid',
        en: '🕌 Mosque Waqf Land',
        id: '🕌 Tanah Wakaf Masjid',
        ar: '🕌 أرض وقف المسجد',
      }[lang] || '🕌 Tanah Waqaf Masjid'
      const label = this.add.text(BOTTOM.x, BOTTOM.y - 40, waqfText, {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#8a5a00',
        backgroundColor: 'rgba(255, 236, 179, 0.88)',
        padding: { left: 8, right: 8, top: 3, bottom: 3 },
        stroke: '#c88a00',
        strokeThickness: 1,
      })
      label.setOrigin(0.5, 1)   // anchor at bottom-center (label sits ABOVE anchor)
      label.setDepth(99998)     // ABOVE grid but under popups
      this._sacredZoneLabel = label
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
        // ─── Level upgrade detection ───────────────────────────────
        // When a level changes (e.g. Musalla L1 → Masjid L2, Rumah Kayu L1
        // → L2), we need to REDRAW the sprite because the visual differs
        // (bigger dome, added minarets, upgraded PNG scale). The old sprite
        // is destroyed and a fresh one is rendered via renderSingleBuilding.
        // We ALSO clean up any leftover playConstruction temp sprite that
        // still lives on the buildingLayer at the same grid coord (this was
        // the actual source of the "Musalla L2 built at a different spot"
        // + "Banglo L2 doesn't appear" bugs — the temp sprite was tagged
        // isTempConstruction and was only cleaned up on NEW builds, never
        // on upgrades).
        const prevLevel = c.buildingData.level || 1
        const nextLevel = b.level || 1
        if (prevLevel !== nextLevel) {
          // Sweep away any temp construction sprite lingering at this cell
          for (const other of [...this.buildingLayer.list]) {
            if (other?._isTempConstruction &&
                other._tempTemplateId === b.templateId &&
                other._tempGridX === b.x && other._tempGridY === b.y) {
              try { other.destroy() } catch { /* teardown */ }
            }
          }
          // Destroy the old sprite container + re-render fresh at new level
          try { c.destroy() } catch { /* teardown */ }
          this.renderSingleBuilding(b)
          continue
        }
        // BUG FIX: use _footprintCenter (same as renderSingleBuilding) so
        // multi-tile buildings — most importantly the Musalla with its 4×4
        // reserveSize — stay pinned to their true visual center on every diff
        // sync. Previously we used raw gridToScreen(b.x, b.y) which is the
        // TOP-LEFT corner of the footprint, causing Musalla to visibly jump
        // to the corner of its sacred zone whenever an unrelated building
        // was moved (bug: "musalla relocated sendiri semasa page refresh").
        const t = BUILDING_TEMPLATES[b.templateId]
        const { cx, cy } = t ? this._footprintCenter(b, t) : { cx: b.x, cy: b.y }
        const { x, y } = gridToScreen(cx, cy, this.originX, this.originY)
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
    // ═════════════════════════════════════════════════════════════════════
    // PROCEDURAL ORCHARD COMPOSITION — locked architecture (2026-07-26).
    // See EQrel spec: an orchard is a COLLECTION of palm_tree instances, not
    // a pre-rendered image. Same single-tree sprite scales from 2×2 up to
    // 5×5+ plantations without creating new artwork. Ground/soil belong to
    // the world's tile layer, not the trees. Trees are decorative overlays
    // attached to the terrain grid.
    //
    // Layout algorithm:
    //   • For a foot.w × foot.h orchard, we compose (foot.w+1) × (foot.h+1)
    //     palm instances arranged on a sub-grid.
    //   • Each sub-tile center is mapped to isometric screen coords relative
    //     to the container origin (footprint center on screen).
    //   • Trees are inserted back-to-front (sorted by sub_x + sub_y ascending)
    //     so front trees occlude back trees naturally within the container.
    //   • Deterministic jitter based on a seeded pseudo-random per-tile ID
    //     keeps orchards visually varied but stable across re-renders.
    // ═════════════════════════════════════════════════════════════════════
    _drawOrchard(container, template, level) {
      const foot = template.tileSizeByLevel?.[level] || template.tileSize || { w: 2, h: 2 }
      // ─── TREE VARIANT LOOKUP ──────────────────────────────────────
      // Each kebun template maps to a single-tree asset key that _drawOrchard
      // composes. Adding a new orchard type = drop a tree.webp + one line here.
      const TREE_BY_KEBUN = {
        kebun_kurma:  'palm_tree',
        kebun_tin:    'fig_tree',
        kebun_delima: 'pomegranate_tree',
        kebun_zaitun: 'olive_tree',
        kebun_anggur: 'grape_row',
      }
      const treeKey = TREE_BY_KEBUN[template.id] || 'palm_tree'
      // User: "bayang bentuk circle masih ada dibawah pokok, remove bayang
      // tersebut". The diamond ground shadow that used to sit under every
      // orchard has been REMOVED — trees now sit directly on the grass.
      // (Cleaner look, and each tree PNG carries its own soft base already.)

      // ─── PER-VARIANT PLANT DENSITY ────────────────────────────────
      // User request (kebun_delima): "sama seperti pokok tin dari segi size
      // pokok dan jarakan sikit pokok untuk beri effect berbeza". We keep
      // the base scale identical to fig (0.42) but plant FEWER trees on the
      // same 2×2 footprint so each pomegranate stands with more breathing
      // room, giving the orchard a visually distinct rhythm. Fig/palm keep
      // the default dense N=foot.w+1 packing (3×3 = 9 trees for a 2×2 tile).
      // Anggur (user request 2026-07-26): "kecilkan pokok anggur dan
      // dijadikan 4 pokok dalam setiap kebun" → N=2 with smaller baseScale
      // (0.55) so 4 mini vine-rows sit in a 2×2 layout.
      const DENSITY_BY_VARIANT = {
        kebun_delima: 2,   // 2×2 = 4 trees, wider spacing
        kebun_zaitun: 2,   // olive trees — solo & stately, sparse layout
        kebun_anggur: 2,   // 4 mini grape-rows per orchard
      }
      // Trees per side = footprint tiles + 1 (2×2 → 3×3 = 9 trees, etc).
      const defaultN = Math.max(2, Math.min(6, foot.w + 1))
      const N = DENSITY_BY_VARIANT[template.id] || defaultN
      const step = foot.w / N
      const seedBase = ((container.buildingData?.id || 'k').charCodeAt(0) * 9301 + 49297)
      const trees = []
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const ox = -(foot.w / 2) + step * (c + 0.5)
          const oy = -(foot.h / 2) + step * (r + 0.5)
          const sdx = (ox - oy) * TILE_W / 2
          const sdy = (ox + oy) * TILE_H / 2
          const seed = (seedBase + r * 131 + c * 71) >>> 0
          const rand = (n) => {
            const x = Math.sin(seed + n) * 10000
            return x - Math.floor(x)
          }
          trees.push({
            x: sdx + (rand(1) - 0.5) * 4,   // ±2 px jitter
            y: sdy + (rand(2) - 0.5) * 2,   // ±1 px jitter
            scaleJit: 0.97 + rand(3) * 0.06,
            angleJit: (rand(4) - 0.5) * 6,
            isoZ: ox + oy,
          })
        }
      }
      trees.sort((a, b) => a.isoZ - b.isoZ)
      const baseScale = WorldScene.ASSET_REGISTRY[treeKey]?.baseScale || 0.55
      for (const t of trees) {
        const img = this.add.image(t.x, t.y, `bld_${treeKey}`)
          .setOrigin(0.5, 1.0)
          .setScale(baseScale * t.scaleJit)
        if (t.angleJit) img.setAngle(t.angleJit)
        container.add(img)
      }
    }


    // of the 8×8 golden diamond. Full bottom-tip (b.x+7, b.y+7) looked TOO
    // FAR FORWARD (mosque leaning out of the diamond); using
    // (b.x + reserveSize - 2.5) shifts the anchor 2.5 tiles back into the
    // diamond so the sprite's ground contact sits comfortably inside the
    // reserved zone while the bulk still fills backward.
    // (User: "adjust sedikit kebelakang musala/masjid/jami masjid ke
    //  belakang sebab terlalu kedepan".)
    _footprintCenter(b, t) {
      const level = b.level || 1
      const foot = t.tileSizeByLevel?.[level] || t.tileSize || { w: 1, h: 1 }
      if (t.id === 'musalla' && t.reserveSize) {
        const cx = b.x + (t.reserveSize.w - 2.5)
        const cy = b.y + (t.reserveSize.h - 2.5)
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

      // Procedural shadow — SKIP for buildings that use an illustrated PNG
      // asset (each PNG bakes its own shadow into the grass base so an
      // additional ellipse just made them look "floating" above a smudge).
      // ALSO SKIP for orchards (category=='kebun') — trees compose their own
      // sprites via _drawOrchard and don't need a container-level ground
      // ellipse (user: "ada bayang bentuk bulat pada setiap grid kebun, saya
      // rasa itu kod lama, boleh semak dan buang").
      if (!WorldScene.ASSET_REGISTRY[t.id] && t.category !== 'kebun') {
        const shadow = this.add.graphics()
        shadow.fillStyle(0x000000, SHADOW_ALPHA)
        // Shadow drifts to the bottom-left (opposite of the top-right sun).
        shadow.fillEllipse(SHADOW_DX, TILE_H / 4 + SHADOW_DY * 0.4, TILE_W * 0.7, TILE_H * 0.55)
        container.add(shadow)
      }

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
      // v7 fix: buildingLayer children draw in ADD-ORDER, not by depth.
      // Fresh incremental add appended this container to the END = drawn
      // on top of everything → covered any existing building in front.
      // Sort by depth to restore proper isometric back-to-front order.
      this.buildingLayer.sort('depth')

      // Attach interactive/tap handlers to EVERY building (including sacred).
      // Sacred buildings (Musalla) still need pointerdown/pointerup so the
      // tap-to-BuildingInfoCard flow works — without this Musalla would look
      // unresponsive (bug: "tekan musalla tiada popup naik"). The drag part
      // is skipped inside enableBuildingDrag when template.isSacred=true.
      if (b.id) {
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

        // Shadow (elliptical, ground level) — SKIP for PNG-asset buildings
        // whose illustration bakes its own shadow. Also skip orchards (kebun)
        // — trees are composed procedurally via _drawOrchard, no need for a
        // container-level ellipse (user: "ada bayang bentuk bulat pada setiap
        // grid kebun, saya rasa itu kod lama").
        if (!WorldScene.ASSET_REGISTRY[t.id] && t.category !== 'kebun') {
          const shadow = this.add.graphics()
          shadow.fillStyle(0x000000, SHADOW_ALPHA)
          // Shadow drifts to the bottom-left (opposite of the top-right sun).
          shadow.fillEllipse(SHADOW_DX, TILE_H / 4 + SHADOW_DY * 0.4, TILE_W * 0.7, TILE_H * 0.55)
          container.add(shadow)
        }

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

        // ─── Drag & drop + tap detection ─────────────────────────
        // Called for EVERY building including sacred ones (Musalla) — the
        // sacred variants only skip the drag part; tap-to-info-card still
        // fires. Fixes "tekan musalla tiada popup naik" bug.
        if (b.id) {
          this.enableBuildingDrag(container, t)
        }
      }
    }

    // Enable Phaser's built-in drag on a building container. Combined with
    // scene-level `input.dragTimeThreshold = 250` + `dragDistanceThreshold = 10`,
    // a small hold+move is required — casual taps stay taps. Not as strict as
    // a 2s long-press but reliably functional across devices (custom hold-to-
    // drag was flaky on some mobile browsers per user testing).
    //
    // For SACRED buildings (Musalla) we still need the container to be
    // interactive so `pointerdown`/`pointerup` fire for the tap-to-info-card
    // flow (opens BuildingInfoCard → offers upgrade). We just skip
    // setDraggable() so no drag lifecycle is engaged — sacred buildings
    // can be tapped but not moved.
    enableBuildingDrag(container, template) {
      const level = container.buildingData?.level || 1
      const sz = template.tileSizeByLevel?.[level] || template.tileSize || { w: 1, h: 1 }
      const hitW = TILE_W * (sz.w + 0.4)
      const hitH = TILE_H * (Math.max(2.2, 1.4 * sz.h + 0.8))
      const hitArea = new Phaser.Geom.Rectangle(-hitW / 2, -hitH * 0.8, hitW, hitH)
      // v5: NO `draggable: true` flag — Phaser's drag lifecycle is fully
      // disabled for buildings. Interactivity is only for tap detection
      // (opens BuildingInfoCard). Movement is engaged via [Pindah] button.
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains)

      // Hover affordance (desktop only — mobile ignores)
      container.on('pointerover', () => {
        if (this.game.registry.get('interactionLocked')) return
        if (this._activeMoveContainer) return   // don't hover-affordance during move
        container.setScale(1.06)
      })
      container.on('pointerout', () => {
        if (this._activeMoveContainer === container) return
        container.setScale(1.0)
      })

      // Tap detection ONLY — no drag, no long-press.  Short tap on a
      // building emits `cell-tap` → React opens BuildingInfoCard with
      // action buttons ([Pindah] [Info] [Naik Taraf] [Batal]).
      container.on('pointerdown', (pointer) => {
        if (this.game.registry.get('interactionLocked')) return
        if (this._activeMoveContainer) return   // move-mode consumes taps
        container._downTime = Date.now()
        container._downPX = pointer.x
        container._downPY = pointer.y
        container._tapCandidate = true
      })
      container.on('pointerup', (pointer) => {
        if (!container._tapCandidate) return
        container._tapCandidate = false
        if (this._activeMoveContainer) return
        const moved = Math.hypot(pointer.x - container._downPX, pointer.y - container._downPY)
        const dt = Date.now() - (container._downTime || 0)
        // Slightly larger tolerance than the pan dead-zone so a small
        // wobble on a real tap still opens the InfoCard. Pan is handled at
        // the scene level and does NOT block cell-tap since it never fires
        // building-move-requested from casual movement.
        if (moved < 12 && dt < 500) {
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
    cancelPendingMove(buildingId) {
      // v5: In move-mode flow, we left the container at the destination
      // while React showed the confirmation card.  On cancel, snap it back
      // to origin.
      const container = this.buildingLayer.list.find(c => c?.buildingData?.id === buildingId)
      if (!container || container._origX === undefined) return
      this.tweens.add({
        targets: container,
        x: container._origX, y: container._origY,
        scaleX: 1.0, scaleY: 1.0, alpha: 1.0,
        duration: 260, ease: 'Back.easeOut',
      })
      container.setDepth(container._origGridY + container._origGridX)
    }

    // ─── Public: React → Phaser MOVE MODE bridge (v5) ────────────
    // Called by React when the user taps [Pindah] in BuildingInfoCard.
    // Engages a custom pointer-drag flow that bypasses Phaser's built-in
    // drag lifecycle entirely (which was the root cause of accidental
    // relocations — Phaser fires dragstart on distance OR time, not AND).
    //
    // While in move mode:
    //   • The chosen building follows the pointer and snaps to the nearest
    //     valid grid cell (green preview) or blocks with a red preview.
    //   • Pan/zoom on the scene are NOT triggered because the scene's
    //     pointermove pan handler bails out when `_activeMoveContainer` is
    //     set (added in the pointerdown/move handlers).
    //   • On pointerup at a valid + non-origin destination → fire
    //     `building-move-requested` (same shape as before) so React can
    //     show its confirmation card. On cancel/invalid → snap back.
    enterMoveMode(buildingId) {
      // Guard: exit any prior move mode first
      if (this._activeMoveContainer) this._exitMoveMode(true)
      const container = this.buildingLayer.list.find(c => c?.buildingData?.id === buildingId)
      if (!container) return false
      const t = BUILDING_TEMPLATES[container.buildingData.templateId]
      if (!t) return false
      if (t.isSacred) return false
      const level = container.buildingData.level || 1
      const sz = t.tileSizeByLevel?.[level] || t.tileSize || { w: 1, h: 1 }

      // Record origin so we can snap back on cancel/invalid drop
      container._origX = container.x
      container._origY = container.y
      container._origGridX = container.buildingData.x
      container._origGridY = container.buildingData.y
      container.setDepth(30000)
      container.setAlpha(0.9)
      this.tweens.add({
        targets: container, scaleX: 1.10, scaleY: 1.10,
        duration: 200, ease: 'Back.easeOut',
      })
      // Golden pulse ring at the base — "picked up" affordance.
      const glow = this.add.graphics()
      glow.setDepth(29998)
      this.buildingLayer.add(glow)
      glow.lineStyle(3, 0xffb703, 0.85)
      glow.strokeEllipse(0, 0, TILE_W * (sz.w + 0.4), TILE_H * (sz.h + 0.4))
      glow.x = container.x
      glow.y = container.y + 4
      this.tweens.add({
        targets: glow, scaleX: 1.12, scaleY: 1.12, alpha: 0.55,
        duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      this._moveGlow = glow
      // Preview ghost graphics for the destination cell.
      this._moveGhost = this.add.graphics()
      this._moveGhost.setDepth(29999)
      this.buildingLayer.add(this._moveGhost)

      this._activeMoveContainer = container
      this._activeMoveSz = sz
      this._moveHasMoved = false

      // Notify React so it can show a persistent HUD ("Alih ke petak baru...").
      this.game.registry.get('onEvent')?.('move-mode-entered', {
        buildingId: container.buildingData.id,
      })
      return true
    }

    // Internal helper — snap back OR commit and clean up glow/ghost.
    _exitMoveMode(snapBack = true) {
      const container = this._activeMoveContainer
      if (!container) return
      this._activeMoveContainer = null
      this._activeMoveSz = null
      if (this._moveGlow) { try { this._moveGlow.destroy() } catch { /* noop */ } this._moveGlow = null }
      if (this._moveGhost) { try { this._moveGhost.destroy() } catch { /* noop */ } this._moveGhost = null }
      container.setAlpha(1.0)
      this.tweens.add({
        targets: container, scaleX: 1.0, scaleY: 1.0,
        duration: 160, ease: 'Sine.easeOut',
      })
      if (snapBack) {
        this.tweens.add({
          targets: container,
          x: container._origX, y: container._origY,
          duration: 260, ease: 'Back.easeOut',
        })
        container.setDepth(container._origGridY + container._origGridX)
      }
    }

    // Called by React when user taps a cancel/close on the confirmation card.
    cancelMoveMode() {
      this._exitMoveMode(true)
    }


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
      // Musalla anchors 2.5 tiles back from BOTTOM-tip of reserved zone so
      // the sprite ground contact sits inside the diamond (not leaning out).
      const isMusalla = t.id === 'musalla' && t.reserveSize
      const cx = isMusalla ? toX + (t.reserveSize.w - 2.5) : toX + (foot.w - 1) / 2
      const cy = isMusalla ? toY + (t.reserveSize.h - 2.5) : toY + (foot.h - 1) / 2
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
      // v6 fix: same-tile depth so buildings in front correctly overlay
      // the restructure visuals (fence/workers/excavator).
      layer.setDepth(toY + toX)
      this.buildingLayer.add(layer)
      // CRITICAL v7 fix: buildingLayer children draw in ADD-ORDER, not by
      // .depth property. Without this sort, the newly-added layer sits at
      // the END = drawn on TOP of every existing building, obscuring
      // anything the user has in front of the destination tile.
      this.buildingLayer.sort('depth')

      // ─── Construction FENCE sprite (v5+v6: replaces procedural yellow diamond) ─
      const fence = this.add.image(target.x, target.y + 4, 'construction_fence')
      fence.setOrigin(0.5, 0.5)
      const fenceTargetW = TILE_W * (sz.w + 0.8)
      const fenceScale = fenceTargetW / 351
      fence.setScale(fenceScale, fenceScale * 0.9)
      layer.add(fence)

      // ─── EQ Mascot workers (v6: real sprite art in restructure too) ──
      const workers = []
      const WORKER_SCALE = 0.30
      const wOffX = TILE_W * (sz.w + 0.5) * 0.65
      const wOffY = TILE_H * (sz.h + 0.5) * 0.65
      const workerSlots = [
        { key: 'worker_01', dx: -wOffX,       dy: -wOffY * 0.15 },
        { key: 'worker_04', dx:  wOffX,       dy: -wOffY * 0.25 },
        { key: 'worker_02', dx: -wOffX * 0.5, dy:  wOffY * 0.55 },
      ]
      for (let i = 0; i < workerSlots.length; i++) {
        const slot = workerSlots[i]
        const w = this.add.image(target.x + slot.dx, target.y + slot.dy, slot.key)
        w.setOrigin(0.5, 1.0)
        w.setScale(WORKER_SCALE)
        layer.add(w)
        workers.push(w)
        const baseY = w.y
        this.tweens.add({
          targets: w, y: baseY - 3,
          duration: 340 + Math.random() * 120,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
        const swapPair = slot.key === 'worker_01' ? ['worker_01', 'worker_02']
                       : slot.key === 'worker_02' ? ['worker_02', 'worker_01']
                       : slot.key === 'worker_04' ? ['worker_04', 'worker_03']
                       : ['worker_03', 'worker_04']
        let poseIdx = 0
        const swapTimer = this.time.addEvent({
          delay: 900 + Math.random() * 500, loop: true,
          callback: () => {
            poseIdx = 1 - poseIdx
            try { w.setTexture(swapPair[poseIdx]) } catch { /* teardown */ }
          },
        })
        w._swapTimer = swapTimer
      }

      // ─── Excavator patrol (v6: outside fence) ─────
      const excavStartX = target.x - fenceTargetW * 0.55
      const excavEndX   = target.x + fenceTargetW * 0.55
      const excavY      = target.y + TILE_H * sz.h * 0.5 + 8
      const excavator = this.add.image(excavStartX, excavY, 'excavator_02')
      excavator.setOrigin(0.5, 1.0)
      excavator.setScale(0.34)
      layer.add(excavator)
      const patrolLoop = () => {
        if (!excavator || !excavator.active) return
        this.tweens.add({
          targets: excavator, x: excavEndX, duration: 2600, ease: 'Sine.easeInOut',
          onStart: () => { try { excavator.setTexture('excavator_02') } catch { /* noop */ } },
          onComplete: () => {
            try { excavator.setTexture('excavator_01') } catch { /* noop */ }
            this.tweens.add({
              targets: excavator, x: excavStartX, duration: 2600, ease: 'Sine.easeInOut',
              onComplete: patrolLoop,
            })
          },
        })
      }
      const excavTimer = this.time.delayedCall(600, patrolLoop)

      // Progress bar above scaffolding
      const barW = 60, barH = 6
      // v6: fH kept for progress-bar positioning (used to be tied to the
      // procedural fence height). We recompute it from the tile size.
      const fH = TILE_H * (sz.h * 0.9)
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

      // Continuous dust puffs while restructuring — v6: more frequent + more
      // per-puff so the transition is properly blurred (matches new build).
      const dustTimer = this.time.addEvent({
        delay: 220, loop: true,
        callback: () => this.spawnDustPuffs(target.x, target.y, 2),
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
        // Cleanup EQ worker swap timers + excavator patrol
        workers.forEach(w => { if (w._swapTimer) { try { w._swapTimer.remove(false) } catch { /* noop */ } } })
        if (excavTimer) { try { excavTimer.remove(false) } catch { /* noop */ } }
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
                // v7 fix: re-sort buildingLayer so the relocated container
                // moves to its correct z-position (otherwise it stays in
                // its original position in the child list and appears to
                // overlay any building in front until the next refresh).
                this.buildingLayer.sort('depth')
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
      // Musalla additionally occupies a RESERVED 8×8 sacred zone (waqf land
      // buffer). Everything else uses its BUILDING_TEMPLATES.tileSize so
      // bigger buildings (banglo 2×2, rumah_batu 2×2) reserve enough grid
      // cells that neighbours placed via drag can't overlap them.
      const RESERVED = { musalla: { w: 8, h: 8 } }
      const b = this._currentBounds || this._computeBounds()
      if (col < b.minX || row < b.minY || col + size.w > b.maxX || row + size.h > b.maxY) return false
      // ─── CIRCULAR ISLAND CHECK ────────────────────────────────
      // Every cell the building occupies must be inside the round world.
      // This is what stops kids from placing on empty rectangle corners
      // that used to be playable in the old square world.
      if (b.center && b.radius != null) {
        for (let dx = 0; dx < size.w; dx++) {
          for (let dy = 0; dy < size.h; dy++) {
            if (!isCellInWorld(col + dx, row + dy, b.center, b.radius)) return false
          }
        }
      }
      for (const bd of buildings) {
        if (bd.id === excludeId) continue
        // Effective footprint = RESERVED override (musalla) OR the template's
        // per-level tileSize (falls back to base tileSize for L1 or non-
        // upgradeable buildings). Never guess 1×1 for unknown templates —
        // that's how banglo used to overlap its neighbours.
        const tpl = BUILDING_TEMPLATES[bd.templateId]
        const lvl = bd.level || 1
        const s = RESERVED[bd.templateId]
          || tpl?.tileSizeByLevel?.[lvl]
          || tpl?.tileSize
          || { w: 1, h: 1 }
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
      // Livestock pens: some templates now use a REAL wooden-pen PNG asset
      // (e.g. kandang_kambing → kandang_kambing.webp). If ASSET_REGISTRY has
      // the template, fall through to the standard PNG renderer below — the
      // animals are spawned after the sprite draws (see spawn-after-return
      // block near the end of the PNG path).
      // If no asset registered, use the original procedural fenced enclosure.
      if (template.category === 'ternakan') {
        const hasPenAsset = !!WorldScene.ASSET_REGISTRY[template.id]
        if (!hasPenAsset) {
          this._drawLivestockPen(container, template)
          this._spawnLivestockAnimals(container, template)
          return
        }
        // else: fall through to PNG renderer + animals spawned there
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
      // ── PROCEDURAL ORCHARD (kebun) ────────────────────────────────
      // Kebun templates DO NOT use a pre-rendered orchard PNG. Instead the
      // world composes an orchard procedurally by placing multiple palm_tree
      // sprites across the footprint. This scales naturally: 2×2 → 3×3 palms,
      // 3×3 → 4×4 palms, etc. Ground stays on the tile grid; trees are pure
      // decorative overlays. See EQrel Orchard Architecture spec.
      if (template.category === 'kebun') {
        this._drawOrchard(container, template, level)
        return
      }
      if (asset) {
        // Level-specific asset override (e.g. musalla L2 → masjid_l2.webp).
        // Falls back to base asset + upgradeScale if no override for this level.
        const levelOverride = asset.levels?.[level]
        const useCfg  = levelOverride || asset
        const useKey  = levelOverride ? `bld_${template.id}_L${level}` : `bld_${template.id}`
        const bumpPerLevel = asset.upgradeScale || 0
        const scale = levelOverride
          ? (levelOverride.baseScale || asset.baseScale)
          : (asset.baseScale + (level - 1) * bumpPerLevel)
        // AUTO yOffset — plant sprite bottom at the DIAMOND BOTTOM VERTEX so
        // buildings sit FIRMLY on their tile (no more floating). Bottom
        // vertex is foot.h × TILE_H / 2 pixels below the footprint center
        // (where the container sits). Musalla keeps its explicit yOffset
        // because its anchor logic is non-standard (2.5 tiles back from
        // bottom tip). Buildings with 2×2 tiles now correctly plant at
        // yOffset=48 instead of the hardcoded 24 that caused the float.
        const footprint = template.tileSizeByLevel?.[level] || template.tileSize || { w: 1, h: 1 }
        const autoY = (footprint.h * TILE_H) / 2
        const yOff = useCfg.yOffset !== undefined
          ? useCfg.yOffset
          : (asset.yOffset !== undefined ? asset.yOffset : autoY)
        // Support independent X/Y scaling — needed to STRETCH artwork exactly
        // into the tile grid regardless of its native aspect ratio (user
        // approved distortion for kebun to force-fit 2×2 diamond size).
        // Default: uniform scale using `scale`. Override: explicit scaleX/Y
        // on the asset OR level config for non-uniform stretch.
        const scaleX = (useCfg.scaleX !== undefined ? useCfg.scaleX
                      : (asset.scaleX !== undefined ? asset.scaleX : scale))
        const scaleY = (useCfg.scaleY !== undefined ? useCfg.scaleY
                      : (asset.scaleY !== undefined ? asset.scaleY : scale))
        const img = this.add.image(0, yOff, useKey)
          .setOrigin(0.5, 1.0)
          .setScale(scaleX, scaleY)
        // Optional rotation to align artwork with isometric grid axes.
        // Some assets are drawn with a flat-top perspective; a slight
        // counter-rotation makes the base rectangle align with the tile
        // diamond. Applied via .setAngle() which rotates around origin.
        // (User: "asset kena rotate ke kiri sikit bagi betul2 match grid
        //  orientation".)
        const angleDeg = useCfg.angleDeg !== undefined ? useCfg.angleDeg
                       : (asset.angleDeg !== undefined ? asset.angleDeg : 0)
        if (angleDeg) img.setAngle(angleDeg)
        container.add(img)
        // Livestock: after the pen sprite renders, spawn the animals INSIDE
        // the pen. See _spawnLivestockAnimals for the per-template config
        // (kandang_kambing → 2 goats, minimal forward/back movement).
        if (template.category === 'ternakan') {
          this._spawnLivestockAnimals(container, template)
        }
        return
      }
      const g = this.add.graphics()
      const baseColor = Phaser.Display.Color.HexStringToColor(template.color).color
      const accent = Phaser.Display.Color.HexStringToColor(template.accentColor).color
      // Effective footprint may grow per level (musalla → masjid → jami' masjid).
      // Sprite dimensions scale linearly with the ABSOLUTE footprint width
      // (relative to a 1×1 baseline) so a 2×2 kebun draws twice as large as
      // a 1×1 hut — filling its assigned tile grid instead of shrinking
      // inside the diamond. Previous formula (currFoot/baseFoot) always
      // returned 1 for level-1 non-upgradable buildings, leaving a large
      // 2×2 diamond with a tiny sprite floating in the middle.
      const baseFoot = template.tileSize || { w: 1, h: 1 }
      const currFoot = template.tileSizeByLevel?.[level] || baseFoot
      let spriteScale = currFoot.w   // absolute, relative to 1×1 baseline
      // Auto-landmarks size themselves by absolute footprint (compared to the
      // musalla level-1 baseline of 2×2) so Surau (2×2) matches a Musalla L1
      // and Masjid landmark (3×3) sits between L1 and L2 in mass.
      if (template.id === 'surau') spriteScale = 2.0
      if (template.id === 'masjid_landmark') spriteScale = 3.1
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
      // ── PNG-based livestock (kandang_kambing) ─────────────────────
      // For pens that use a real wooden-pen PNG asset, we place N goat
      // sprites INSIDE the pen with minimal forward/backward pacing and
      // NO rotation/flip.  User: "letak 2 ekor kambing, bergerak minimal
      // kedepan dan belakang tanpa perlu berpusing".
      const PNG_SPECS = {
        kandang_kambing: {
          count: 2,
          // Slots inside the 2×2 pen (relative to container center).
          // Each slot can override the top-level `key`/`scale`; for kambing
          // and lembu we use a single sprite key applied to all slots.
          key: 'animal_kambing',
          scale: 0.20,                // goat sprite is ~160×185px raw → ~32×37 on tile
          slots: [
            { x: -16, y: 8 },
            { x:  16, y: 12 },
          ],
          paceRange: 10,
          paceXRange: 0,           // no horizontal wander for goats
        },
        kandang_lembu: {
          key: 'animal_lembu',
          count: 1,
          // Cow raw is 184×130 → 0.34 scale ≈ 63×44 px. User: "besarkan
          // sedikit lembu" (v2) — increased from 0.28 for more prominence
          // inside the larger 3×3 pen.
          scale: 0.34,
          slots: [
            { x: -32, y: 14 },
          ],
          paceRange: 16,           // bigger pace since the pen is 3×3
          paceXRange: 6,           // slight left/right wander for natural grazing
        },
        // ── Camel barn (4×4 pen, biggest livestock pen). Pen art already
        // contains ONE static resting camel at center-right. We overlay ONE
        // walking camel bigger than the cow (user: "unta lebih besar dari
        // lembu"). Wider pace + more X wander thanks to the roomier 4×4
        // floor space.
        kandang_unta: {
          key: 'animal_unta',
          count: 1,
          // Camel raw is 233×163 → 0.35 scale ≈ 82×57 px.
          scale: 0.35,
          slots: [
            { x: -40, y: 16 },
          ],
          // User v3: "ubah unta bergerak ke kanan dan ke kiri" — swap the
          // primary axis. Now the camel struts left↔right across the sandy
          // floor (paceXRange large, paceRange small = only gentle forward
          // bob).
          paceRange: 4,            // minimal front/back
          paceXRange: 22,          // primary left↔right stride
        },
        // ── Chicken coop (2×2 pen, visually smallest livestock pen).
        // Two flocks (Family A near coop, Family B toward the gate) placed
        // manually via per-slot `key` overrides so we get variety without
        // repeating the same sprite twice.  All chickens are much smaller
        // than the goat (user: "Pastikan ayam lebih kecil dari kambing").
        //
        // #01 rooster (dark tail)    · #02 hen orange standing
        // #03 white hen bending      · #04 orange hen standing
        // #05 orange hen bending     · #06 white hen bending  · #07 chick
        //
        // 6 chickens are scattered — one flock behind the rooster on the
        // left, one flock spread across the right half of the floor.
        reban_ayam: {
          count: 6,
          // Adult chickens ~0.30 (≈ 20–27 px), chick ~0.35 (still smaller
          // than any goat/cow since raw art is smallest).
          scale: 0.30,
          paceRange: 5,             // chickens strut in small steps
          paceXRange: 3,            // subtle sideways bob for natural pecking
          slots: [
            // Flock A — clustered near the coop (left-back area)
            { key: 'chicken_01', x: -12, y: 12, scale: 0.34 }, // rooster (bigger)
            { key: 'chicken_02', x:  -2, y:  4 },              // hen behind rooster
            { key: 'chicken_07', x: -20, y: 20, scale: 0.36 }, // chick (art is tiny → boost scale)
            // Flock B — across the right half, near the gate
            { key: 'chicken_03', x:  14, y:  6 },              // white hen bending
            { key: 'chicken_04', x:  26, y: 14 },              // orange hen standing
            { key: 'chicken_06', x:  10, y: 22 },              // white hen bending, front
          ],
        },
      }
      const pngSpec = PNG_SPECS[template.id]
      if (pngSpec) {
        // Determine which sprite key to check for existence — for multi-key
        // specs we check the first slot's key.
        const probeKey = pngSpec.slots[0]?.key || pngSpec.key
        if (!this.textures.exists(probeKey)) return   // assets not yet loaded (edge case)
        for (let i = 0; i < pngSpec.count; i++) {
          const slot = pngSpec.slots[i % pngSpec.slots.length]
          const useKey = slot.key || pngSpec.key
          const useScale = slot.scale !== undefined ? slot.scale : pngSpec.scale
          if (!this.textures.exists(useKey)) continue
          const img = this.add.image(slot.x, slot.y, useKey)
            .setOrigin(0.5, 1.0)          // stand on the ground
            .setScale(useScale)
          img.setDepth(2 + i * 0.01)      // above the pen floor

          // NOTE: No procedural shadow ellipse — the sprite art already
          // contains its own baked shadow.  User: "Remove shadow untuk
          // kambing dan lembu, asset dah ada shadow" — extended to all
          // livestock PNGs for consistency.
          container.add(img)

          // Minimal forward/backward pace loop — NO rotation, NO flip. If
          // paceXRange > 0 we also add a subtle horizontal component for a
          // more natural grazing/pecking look.
          const baseX = slot.x
          const baseY = slot.y
          const paceLoop = () => {
            if (!img.scene || !img.active) return
            const dirY = Math.random() > 0.5 ? 1 : -1
            const dy = dirY * pngSpec.paceRange
            const dx = pngSpec.paceXRange
              ? (Math.random() * 2 - 1) * pngSpec.paceXRange
              : 0
            const dur = 900 + Math.random() * 900
            this.tweens.add({
              targets: img,
              x: baseX + dx,
              y: baseY + dy,
              duration: dur,
              ease: 'Sine.easeInOut',
              yoyo: true,
              onComplete: () => {
                this.time.delayedCall(400 + Math.random() * 800, paceLoop)
              },
            })
            // Continuous vertical body bob (breathing/gait) — subtle scale
            // pulse on the sprite y so the animal looks alive even mid-pace.
            this.tweens.add({
              targets: img,
              scaleY: useScale * 1.05,
              duration: dur / 2,
              yoyo: true,
              repeat: 1,
              ease: 'Sine.easeInOut',
            })
          }
          // Stagger initial start so animals don't move in sync
          this.time.delayedCall(Math.random() * 800, paceLoop)
        }
        return
      }

      // ── Original procedural animals (chickens, cows, camels — still used
      // for pens that haven't received a real asset yet). Each animal is a
      // tiny geometric shape wandering around inside the fenced enclosure.
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

      // Precompute POI (points of interest) grid positions for goal system.
      // BUG FIX: was `templateId === 'rumah'` / `'kebun'` — those literal IDs
      // never exist (actual IDs are `rumah_kayu`, `banglo`, `kebun_kurma`, etc.)
      // so villagers had zero houses/orchards to target and only walked to
      // Musalla or "rest" random cells. Now filters by category so every
      // variant of house/orchard is a valid destination.
      const houses = buildings.filter(b => BUILDING_TEMPLATES[b.templateId]?.category === 'rumah')
      const orchards = buildings.filter(b => BUILDING_TEMPLATES[b.templateId]?.category === 'kebun')

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

      // Compute a wander cell adjacent to a target building.
      // Musalla is SPECIAL: its grid anchor (b.x, b.y) is the NW corner of
      // the 8×8 sacred zone, but the visible mosque asset is drawn at the
      // zone's center-front (see _footprintCenter for musalla). Villagers
      // must walk toward the VISIBLE mosque, not the invisible NW corner
      // (user: "orang tak tertumpu pada aset masjid sebenar"). We compute
      // the visible footprint at the current level and pick perimeter cells.
      const targetCellNear = (targetBuilding) => {
        const t = BUILDING_TEMPLATES[targetBuilding.templateId]
        if (!t) return null
        let nwX, nwY, footW, footH
        if (targetBuilding.templateId === 'musalla' && t.reserveSize) {
          // Visible mosque center via the same math as renderSingleBuilding.
          const { cx, cy } = this._footprintCenter(targetBuilding, t)
          const lvl = targetBuilding.level || 1
          const foot = t.tileSizeByLevel?.[lvl] || t.tileSize || { w: 2, h: 2 }
          footW = foot.w; footH = foot.h
          nwX = Math.round(cx - (footW - 1) / 2)
          nwY = Math.round(cy - (footH - 1) / 2)
        } else {
          const sz = t.tileSize || { w: 1, h: 1 }
          footW = sz.w; footH = sz.h
          nwX = targetBuilding.x; nwY = targetBuilding.y
        }
        const candidates = []
        for (let dx = -1; dx <= footW; dx++) {
          for (let dy = -1; dy <= footH; dy++) {
            // Only cells on the perimeter (skip interior)
            if (dx >= 0 && dx < footW && dy >= 0 && dy < footH) continue
            const cx = nwX + dx, cy = nwY + dy
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
    // Pick a random free cell in a "ring" at Chebyshev distance [minR..maxR]
    // around the Musalla's VISIBLE center (not its NW anchor). Villager
    // spawn + wander uses this so newcomers appear near the actual mosque,
    // not at the empty NW corner of the sacred zone.
    pickFreeCellNearMusalla(musalla, minR, maxR) {
      const occupied = this._occupiedCells || new Set()
      const t = BUILDING_TEMPLATES.musalla
      // Use visible center if available, else fall back to anchor
      let ax = musalla.x, ay = musalla.y
      if (t?.reserveSize) {
        const { cx, cy } = this._footprintCenter(musalla, t)
        ax = Math.round(cx); ay = Math.round(cy)
      }
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
      const isMusalla = templateId === 'musalla' && !!t.reserveSize
      // Effective footprint at the given level. Musalla anchors 2.5 tiles
      // back from BOTTOM-tip of reserved zone — matches
      // renderSingleBuilding's _footprintCenter logic (sprite ground contact
      // sits inside the golden diamond, bulk extends up-back).
      const foot = t.tileSizeByLevel?.[level] || t.tileSize || { w: 1, h: 1 }
      const sz = foot   // keep back-compat name (used further down for fence/dust)
      const cx = isMusalla ? gridX + (t.reserveSize.w - 2.5) : gridX + (foot.w - 1) / 2
      const cy = isMusalla ? gridY + (t.reserveSize.h - 2.5) : gridY + (foot.h - 1) / 2
      const { x, y } = gridToScreen(cx, cy, this.originX, this.originY)

      const scene = this
      const constructionLayer = scene.add.container(0, 0)
      // v6 fix: use the SAME depth as a normal building on this tile so
      // that any building in front (higher grid sum) correctly overlays
      // the construction visuals (fence, workers, excavator).
      constructionLayer.setDepth(gridY + gridX)
      scene.buildingLayer.add(constructionLayer)
      // CRITICAL v7 fix: buildingLayer children draw in ADD-ORDER, not by
      // .depth property (renderSingleBuilding relies on pre-sorted insert).
      // Fresh `add()` puts constructionLayer at the END of the list =
      // drawn on TOP of everything.  Call `sort('depth')` so front-buildings
      // correctly overlay the construction site.  User: "assets construction
      // overlay current asset dihadapan".
      scene.buildingLayer.sort('depth')

      // ─── Construction FENCE sprite (v5: replaces procedural yellow diamond) ─
      // Real fence sprite from user asset. Scaled so its footprint slightly
      // exceeds the building's tile footprint — building rises INSIDE the
      // fence. Fades out at ~80% construction progress ("hampir siap → fence
      // hilang"). Native fence art is 351×175 (aspect ~2.0:1).
      const fence = scene.add.image(x, y + 4, 'construction_fence')
      fence.setOrigin(0.5, 0.5)
      // Scale to slightly exceed tile size on X. On Y (isometric), the
      // building diamond is taller than wide so we compress a bit.
      const fenceTargetW = TILE_W * (sz.w + 0.8)  // + margin so fence sits OUTSIDE tapak
      const fenceScale = fenceTargetW / 351
      fence.setScale(fenceScale, fenceScale * 0.9)
      fence.setDepth(gridY + gridX + 11)   // above ground, below building
      constructionLayer.add(fence)

      // ─── Initial dust burst ──────────────────────────────
      const dustPuffs = []
      const fenceW = TILE_W * sz.w * 0.9   // used by legacy dust + workers positioning
      const fenceH = TILE_H * sz.h * 0.9
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

      // ─── Continuous dust emission (v6 fix: user "tambah dust untuk blurkan
      // building grow terlalu jelas"). Emits 2 puffs every 220ms during the
      // full 5.5s construction window so the building sprite visually rises
      // through a haze rather than snapping into view. Puffs concentrate
      // around the building base + around the workers' feet.
      const dustTimer = scene.time.addEvent({
        delay: 220,
        repeat: 22,   // 22 * 220ms ≈ 4.8s (finishes before fence fade)
        callback: () => {
          for (let k = 0; k < 2; k++) {
            const p = scene.add.graphics()
            p.fillStyle(0xe6d4b0, 0.55 + Math.random() * 0.25)
            const r = 5 + Math.random() * 4
            p.fillCircle(0, 0, r)
            // Random within/around building tile — bias toward base
            const ang = Math.random() * Math.PI * 2
            const rad = Math.random() * (fenceW * 0.5)
            p.x = x + Math.cos(ang) * rad
            p.y = y + Math.abs(Math.sin(ang) * fenceH * 0.35) + 6
            constructionLayer.add(p)
            scene.tweens.add({
              targets: p,
              y: p.y - 18 - Math.random() * 20,
              x: p.x + (Math.random() - 0.5) * 15,
              alpha: 0,
              scaleX: 2.5, scaleY: 2.5,
              duration: 900 + Math.random() * 500,
              ease: 'Sine.easeOut',
              onComplete: () => p.destroy(),
            })
          }
        },
      })

      // ─── Building sprite — rises from tiny to full over the phases ──
      const bContainer = scene.add.container(x, y)
      this.drawBuildingSprite(bContainer, t, level || 1)
      bContainer.setScale(0.15)
      bContainer.alpha = 0.5
      constructionLayer.add(bContainer)

      // ─── EQ Mascot workers (v5: real sprite art replaces stick figures) ──
      // 3 workers placed OUTSIDE the fence perimeter, at fixed cardinal-ish
      // slots so they always frame the building. Mix of front-facing (mata
      // nampak) + back-facing sprites for depth. Each animates with a subtle
      // vertical bob + periodic sprite swap between hammer/plank pose to
      // simulate "working".  Fixed pixel size regardless of tile footprint
      // (user: "size workers remain the same what ever size of the building").
      const workers = []
      const WORKER_SCALE = 0.30            // ~28 px tall regardless of building
      // Slot offsets are RELATIVE to the fence footprint so bigger buildings
      // spread workers wider. All slots are OUTSIDE the fence rectangle.
      const wOffX = TILE_W * (sz.w + 0.5) * 0.65
      const wOffY = TILE_H * (sz.h + 0.5) * 0.65
      const workerSlots = [
        // sprite key, dx, dy (offset from building center)
        { key: 'worker_01', dx: -wOffX,      dy: -wOffY * 0.15 },  // front, left
        { key: 'worker_04', dx:  wOffX,      dy: -wOffY * 0.25 },  // back, right
        { key: 'worker_02', dx: -wOffX * 0.5, dy:  wOffY * 0.55 }, // front, front-left
      ]
      if (!isMusalla) {
        for (let i = 0; i < workerSlots.length; i++) {
          const slot = workerSlots[i]
          const w = scene.add.image(x + slot.dx, y + slot.dy, slot.key)
          w.setOrigin(0.5, 1.0)      // stand on ground
          w.setScale(WORKER_SCALE)
          w.setDepth(gridY + gridX + 12)   // above fence
          constructionLayer.add(w)
          workers.push(w)
          // Vertical bob (working motion) — never rotates, never flips
          const baseY = w.y
          scene.tweens.add({
            targets: w,
            y: baseY - 3,
            duration: 340 + Math.random() * 120,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          })
          // Periodic pose swap (hammer ↔ plank) — feels like they're
          // switching tasks. Alternates between the two same-facing poses.
          const swapPair = slot.key === 'worker_01' ? ['worker_01', 'worker_02']
                         : slot.key === 'worker_02' ? ['worker_02', 'worker_01']
                         : slot.key === 'worker_04' ? ['worker_04', 'worker_03']
                         : ['worker_03', 'worker_04']
          let poseIdx = 0
          const swapTimer = scene.time.addEvent({
            delay: 900 + Math.random() * 500,
            loop: true,
            callback: () => {
              poseIdx = 1 - poseIdx
              try { w.setTexture(swapPair[poseIdx]) } catch { /* teardown race */ }
            },
          })
          w._swapTimer = swapTimer
        }
      }

      // ─── Excavator (v5: moves in small arc OUTSIDE the fence occasionally) ─
      // For non-sacred builds, spawn 1 excavator that patrols left↔right
      // along the front edge of the site. Sprite pose swaps based on
      // movement direction so it looks natural. Runs for full construction
      // duration then destroys.
      let excavator = null
      let excavTimer = null
      if (!isMusalla) {
        const excavStartX = x - fenceTargetW * 0.55
        const excavEndX   = x + fenceTargetW * 0.55
        const excavY      = y + TILE_H * sz.h * 0.5 + 8   // in front of the fence
        excavator = scene.add.image(excavStartX, excavY, 'excavator_02')
        excavator.setOrigin(0.5, 1.0)
        excavator.setScale(0.34)
        excavator.setDepth(gridY + gridX + 13)   // above workers
        constructionLayer.add(excavator)
        // Ping-pong tween. On yoyo halfpoint swap texture to face the other way.
        const patrolLoop = () => {
          if (!excavator || !excavator.active) return
          scene.tweens.add({
            targets: excavator,
            x: excavEndX,
            duration: 2600,
            ease: 'Sine.easeInOut',
            onStart:    () => { try { excavator.setTexture('excavator_02') } catch { /* noop */ } }, // facing right
            onComplete: () => {
              try { excavator.setTexture('excavator_01') } catch { /* noop */ } // facing left
              scene.tweens.add({
                targets: excavator,
                x: excavStartX,
                duration: 2600,
                ease: 'Sine.easeInOut',
                onComplete: patrolLoop,
              })
            },
          })
        }
        excavTimer = scene.time.delayedCall(600, patrolLoop)
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
          // Cleanup timers: worker sprite-swap + excavator patrol + dust
          workers.forEach(w => { if (w._swapTimer) { try { w._swapTimer.remove(false) } catch { /* noop */ } } })
          if (excavTimer) { try { excavTimer.remove(false) } catch { /* noop */ } }
          if (dustTimer)  { try { dustTimer.remove(false)  } catch { /* noop */ } }
          // Fade fence FIRST (user: "apabila hampir berkembang, fence hilang"),
          // then workers + excavator + sacred glow.
          scene.tweens.add({
            targets: [fence],
            alpha: 0,
            duration: 300,
          })
          scene.tweens.add({
            targets: [...workers, ...(excavator ? [excavator] : []), ...(sacredGlow ? [sacredGlow] : [])],
            alpha: 0,
            duration: 400,
            delay: 100,
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
                  // v7 fix: sort by depth so the newly-reparented building
                  // doesn't sit at the end of the child list (which caused
                  // it to overlay any front-neighbouring building until the
                  // next full sync/refresh).
                  scene.buildingLayer.sort('depth')
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

    // ─── Auto-upgrade animation on the actual world tile ─────────
    // Called when the Musalla auto-upgrades (7 rumah → Masjid L2, 15 rumah →
    // Jami' Masjid L3) AFTER the celebratory popup closes. User: "process
    // upgrade bukan pada popup tetapi pada actual worlds macam kita baru bina
    // asset". Approach:
    //   1. Find the existing container by buildingId.
    //   2. Fade it out over 400ms → destroy so it doesn't stack with the new
    //      construction sprite.
    //   3. Delegate to playConstruction with the target level → renders the
    //      Red-Alert scaffolding + rising sprite AT THE SAME TILE.
    //   4. On complete, onEvent('auto-upgrade-anim-done') so React can call
    //      load() to persist Phaser's registry alignment.
    playAutoUpgrade(buildingId, toLevel, onComplete) {
      const container = this.buildingLayer.list.find(
        c => c?.buildingData?.id === buildingId
      )
      if (!container) { onComplete?.(); return }
      const gridX = container.buildingData.x
      const gridY = container.buildingData.y
      const templateId = container.buildingData.templateId

      // Fade out the current sprite so it doesn't clash with the scaffolding.
      this.tweens.add({
        targets: container,
        alpha: 0,
        scaleX: 0.85,
        scaleY: 0.85,
        duration: 400,
        ease: 'Sine.easeIn',
        onComplete: () => {
          try { container.destroy() } catch { /* teardown race */ }
          // Now play the standard construction ceremony at the same tile
          // with the NEW level → shows scaffolding + workers + rising sprite.
          this.playConstruction(gridX, gridY, templateId, toLevel, () => {
            onComplete?.()
          })
        },
      })
    }
  }
}
