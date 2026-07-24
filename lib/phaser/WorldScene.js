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
      this.buildingLayer = this.add.container(0, 0)
      this.villagerLayer = this.add.container(0, 0)
      this.overlayLayer  = this.add.container(0, 0) // ghosts, hover indicators

      this.drawGround()
      this.drawGrid()
      this.syncStateFromRegistry()

      // React-driven build event (see startBuild in page.js)
      const emitter = this.game.registry.events
      emitter.on('changedata-pendingBuild', (_p, val) => this.handlePendingBuild(val))

      this.scale.on('resize', () => this.handleResize())
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
      this.spawnVillagers(state.buildings || [])
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
    spawnVillagers(buildings) {
      this.villagerLayer.removeAll(true)
      if (this.villagerTweens) this.villagerTweens.forEach(t => t?.stop?.())
      this.villagerTweens = []
      if (this.gatherTimer) { this.gatherTimer.remove(); this.gatherTimer = null }

      const musalla = buildings.find(b => b.templateId === 'musalla')
      if (!musalla) return

      let capacity = 0
      for (const b of buildings) {
        const t = BUILDING_TEMPLATES[b.templateId]
        if (t) capacity += (t.villagerSpawn || 0)
      }
      const count = Math.min(capacity, 10)

      // Variety pool — mix of adults, children, elders (universal Muslim iconography)
      const emojis = ['👳', '🧕', '👨', '👩', '🧔', '👦', '👧', '🧑', '👴', '👵']

      // Musalla anchor for prayer-time gather
      const anchor = gridToScreen(musalla.x, musalla.y, this.originX, this.originY)

      const villagers = []
      for (let i = 0; i < count; i++) {
        const emoji = emojis[i % emojis.length]
        const angle = (i / count) * Math.PI * 2
        const r = 60 + Math.random() * 80
        const startX = anchor.x + Math.cos(angle) * r
        const startY = anchor.y + Math.sin(angle) * r * 0.5
        const v = this.add.text(startX, startY, emoji, {
          fontSize: `${20 + Math.floor(Math.random() * 8)}px`,
        }).setOrigin(0.5)
        v.setDepth(9999)
        v.gatherMode = false // toggles during prayer time
        this.villagerLayer.add(v)
        villagers.push(v)
      }

      const wander = (villager) => {
        if (!villager.active) return
        if (villager.gatherMode) return // paused during prayer
        const targetX = anchor.x + (Math.random() - 0.5) * 300
        const targetY = anchor.y + (Math.random() - 0.5) * 160
        const dist = Math.hypot(targetX - villager.x, targetY - villager.y)
        const dur = 2400 + dist * 8
        // Subtle bob for "walk" impression
        this.villagerTweens.push(this.tweens.add({
          targets: villager,
          x: targetX, y: targetY,
          duration: dur, ease: 'Sine.easeInOut',
          onComplete: () => this.time.delayedCall(400 + Math.random() * 1200, () => wander(villager)),
        }))
      }
      villagers.forEach((v, i) => this.time.delayedCall(200 + i * 250, () => wander(v)))

      // Prayer-time gather — every 90s do a 15s gather to musalla (demo pace)
      // In production this would trigger from real prayer times via registry.
      const gatherAtMusalla = () => {
        villagers.forEach((v, i) => {
          if (!v.active) return
          v.gatherMode = true
          const gAngle = (i / villagers.length) * Math.PI * 2
          const gR = 40 + (i % 3) * 12
          const gX = anchor.x + Math.cos(gAngle) * gR
          const gY = anchor.y + Math.sin(gAngle) * gR * 0.5
          this.villagerTweens.push(this.tweens.add({
            targets: v, x: gX, y: gY, duration: 1800, ease: 'Sine.easeInOut',
          }))
        })
        this.time.delayedCall(15000, () => {
          // Prayer ends — resume wandering
          villagers.forEach(v => {
            if (v.active) { v.gatherMode = false; wander(v) }
          })
        })
      }
      // Kick off a gather every 90 seconds (demo). Prayer-times integration comes next.
      this.gatherTimer = this.time.addEvent({
        delay: 90_000, callback: gatherAtMusalla, loop: true, startAt: 45_000, // first gather at 45s
      })
    }

    // ─── Interaction ────────────────────────────────────────────
    onCellHover(col, row, entering) {
      // For future: highlight during drag mode
      const pending = this.game.registry.get('pendingBuild')
      if (!pending || !pending.dragMode) return
      // TODO: valid/invalid highlight overlay
    }

    onCellTap(col, row) {
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

    // ─── Building placement animation ───────────────────────────
    playConstructionAnimation(building, onComplete) {
      const t = BUILDING_TEMPLATES[building.templateId]
      if (!t) { onComplete?.(); return }
      const { x, y } = gridToScreen(building.x, building.y, this.originX, this.originY)

      const container = this.add.container(x, y)
      container.setDepth(building.y + building.x)
      this.drawBuildingSprite(container, t, building.level || 1)
      container.setScale(0.1)
      container.alpha = 0

      // Dust particles under the base
      const dust = this.add.particles(x, y + 10, undefined, {})
      // Simple flash "dust" via tweened graphics circles
      for (let i = 0; i < 6; i++) {
        const puff = this.add.graphics()
        puff.fillStyle(0xffffff, 0.7)
        puff.fillCircle(0, 0, 6)
        puff.x = x + (Math.random() - 0.5) * 60
        puff.y = y + 10 + (Math.random() - 0.5) * 20
        this.tweens.add({
          targets: puff,
          alpha: 0, scale: 2, y: puff.y - 40,
          duration: 700 + Math.random() * 400,
          onComplete: () => puff.destroy(),
        })
      }

      this.tweens.chain({
        targets: container,
        tweens: [
          { alpha: 1, duration: 200 },
          { scale: 1.1, duration: 900, ease: 'Back.easeOut' },
          { scale: 1.0, duration: 200, ease: 'Sine.easeOut' },
        ],
        onComplete: () => {
          container.destroy() // temp; renderBuildings will re-render final
          dust?.destroy?.()
          onComplete?.()
        },
      })
    }
  }
}
