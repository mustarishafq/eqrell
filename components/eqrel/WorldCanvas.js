/**
 * WorldCanvas — Client-only Phaser 3 mount point.
 * Boots the game engine, wires the WorldScene, and bridges React ↔ Phaser
 * via the game registry + onEvent callback.
 */
'use client'

import { useEffect, useRef } from 'react'
import { WORLD_SIZE } from '@/lib/worldEngine'

// Isometric tile dimensions (diamond shape). Half-height for classic 2:1 projection.
export const TILE_W = 96
export const TILE_H = 48

// Grid → screen coordinate helpers (top-down isometric)
export const gridToScreen = (col, row, originX, originY) => ({
  x: originX + (col - row) * (TILE_W / 2),
  y: originY + (col + row) * (TILE_H / 2),
})

export default function WorldCanvas({
  childId,
  worldState,       // { buildings, demeritCount }
  onEvent,          // (type, payload) => void — bubbles game events to React
  interactionLocked = false, // when true, Phaser ignores cell taps (used while modals are open)
  construct,         // { x, y, templateId, level, key } | null — when set, triggers Red-Alert-style build anim
  lang = 'ms',       // language toggle for villager bubbles (ms/en/id/ar)
  cameraCommand,     // { action: 'zoomIn'|'zoomOut'|'center', key } | null
  buildDrag,         // { templateId, pointerX, pointerY, key } | null — for drag-from-sidebar preview
}) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return
    let cancelled = false

    ;(async () => {
      const Phaser = (await import('phaser')).default
      if (cancelled) return

      // Build WorldScene dynamically so we don't pull Phaser into server bundle
      const { buildWorldScene } = await import('@/lib/phaser/WorldScene')
      const WorldScene = buildWorldScene(Phaser)

      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width,
        height,
        transparent: true,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [WorldScene],
        callbacks: {
          preBoot: (game) => {
            game.registry.set('childId', childId)
            game.registry.set('worldState', worldState)
            game.registry.set('onEvent', onEvent)
            game.registry.set('interactionLocked', interactionLocked)
            game.registry.set('lang', lang)
          },
        },
      })
      // Expose the running game globally so React can read/write registry
      // (used by drag-from-sidebar to read buildDropTarget after pointer-up)
      if (typeof window !== 'undefined') {
        window.__eqrelPhaser = gameRef.current
      }
    })()

    return () => {
      cancelled = true
      if (gameRef.current) {
        try { gameRef.current.destroy(true) } catch { /* teardown race */ }
        gameRef.current = null
      }
      if (typeof window !== 'undefined' && window.__eqrelPhaser) {
        window.__eqrelPhaser = null
      }
    }
  }, [childId]) // Only re-mount when child changes; state updates handled by scene

  // Push updated worldState into the running scene without remounting
  useEffect(() => {
    const g = gameRef.current
    if (!g || !worldState) return
    try {
      g.registry.set('worldState', worldState)
      const scene = g.scene.getScene('WorldScene')
      if (scene && typeof scene.syncStateFromRegistry === 'function') {
        scene.syncStateFromRegistry()
      }
    } catch { /* scene may not be ready yet */ }
  }, [worldState])

  // Push interactionLocked changes into the scene
  useEffect(() => {
    const g = gameRef.current
    if (!g) return
    try { g.registry.set('interactionLocked', interactionLocked) } catch { /* not ready */ }
  }, [interactionLocked])

  // Push lang changes into the scene — new bubbles will pick this up immediately.
  // Also nudge the WorldScene to redraw the Tanah Waqaf Masjid label so it
  // re-reads translations from the shared registry.
  useEffect(() => {
    const g = gameRef.current
    if (!g) return
    try { g.registry.set('lang', lang) } catch { /* not ready */ }
    try {
      const scene = g.scene.getScene('WorldScene')
      const state = scene?.game?.registry?.get('worldState')
      if (scene?._drawSacredZone && state?.buildings) {
        scene._drawSacredZone(state.buildings)
      }
    } catch { /* not ready */ }
  }, [lang])

  // Camera commands from React (zoom in/out/reset)
  useEffect(() => {
    const g = gameRef.current
    if (!g || !cameraCommand) return
    const scene = g.scene.getScene('WorldScene')
    if (!scene?.cameras?.main) return
    const cam = scene.cameras.main
    if (cameraCommand.action === 'zoomIn') {
      const next = Math.min(2.5, cam.zoom * 1.15)
      scene.tweens.add({ targets: cam, zoom: next, duration: 200 })
    } else if (cameraCommand.action === 'zoomOut') {
      const next = Math.max(0.3, cam.zoom / 1.15)
      scene.tweens.add({ targets: cam, zoom: next, duration: 200 })
    } else if (cameraCommand.action === 'worldEnter') {
      // Cinematic frictionless "descend onto the island" tween. Fired on
      // the SAME frame that the Archipelago map begins its scale-into-
      // island exit — the two zooms overlap so the child perceives one
      // continuous camera dolly, from archipelago overview → island fills
      // screen → world revealed → Musalla settles at natural zoom. Start
      // wide (0.55), tween to 1.0 over 1.6s so the motion is still in
      // progress AFTER the map finishes exiting at ~0.9s — no visible cut.
      // (User: "action camera must continuety frictionless to enter the
      //  world".)
      try { cam.setZoom(0.55) } catch { /* not ready */ }
      // Center on Musalla (if present) so the descent lands on the mosque
      if (scene.originX != null) {
        const state = scene.game?.registry?.get('worldState')
        const musalla = state?.buildings?.find(b => b.templateId === 'musalla')
        const mx = musalla ? musalla.x : 17
        const my = musalla ? musalla.y : 17
        const sx = scene.originX + (mx - my) * TILE_W / 2
        const sy = scene.originY + (mx + my) * TILE_H / 2
        scene.tweens.add({
          targets: cam,
          scrollX: sx - cam.width / (2 * 1.0),
          scrollY: sy - cam.height / (2 * 1.0),
          zoom: 1.0,
          duration: 1600,
          ease: 'Sine.easeInOut',
        })
      } else {
        scene.tweens.add({ targets: cam, zoom: 1.0, duration: 1600, ease: 'Sine.easeInOut' })
      }
    } else if (cameraCommand.action === 'center') {
      // Center on Musalla's actual position (falls back to anchor)
      if (scene.originX != null) {
        const state = scene.game?.registry?.get('worldState')
        const musalla = state?.buildings?.find(b => b.templateId === 'musalla')
        const mx = musalla ? musalla.x : 17
        const my = musalla ? musalla.y : 17
        const sx = scene.originX + (mx - my) * TILE_W / 2
        const sy = scene.originY + (mx + my) * TILE_H / 2
        scene.tweens.add({
          targets: cam,
          scrollX: sx - cam.width / (2 * cam.zoom),
          scrollY: sy - cam.height / (2 * cam.zoom),
          zoom: 1.0,
          duration: 400, ease: 'Sine.easeOut',
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraCommand?.key])

  // Trigger construction animation when `construct` prop changes to a new key
  useEffect(() => {
    const g = gameRef.current
    if (!g || !construct) return
    const trigger = () => {
      const scene = g.scene.getScene('WorldScene')
      if (!scene || typeof scene.playConstruction !== 'function') {
        // Try again after a beat if scene not yet ready
        setTimeout(trigger, 120)
        return
      }
      scene.playConstruction(
        construct.x, construct.y, construct.templateId, construct.level || 1,
        () => { onEvent?.('construction-done', construct) }
      )
    }
    trigger()
    // Only re-run when a new construction key is issued
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [construct?.key])

  // Trigger build preview when user drags a template from the sidebar over the canvas
  useEffect(() => {
    const g = gameRef.current
    if (!g) return
    const scene = g.scene.getScene('WorldScene')
    if (!scene) return
    // Toggle grid visibility — grid appears only while dragging a new build
    try { g.registry.set('buildDragActive', !!buildDrag) } catch { /* not ready */ }
    if (buildDrag && buildDrag.pointerX != null) {
      scene.showBuildPreview?.(buildDrag.templateId, buildDrag.pointerX, buildDrag.pointerY)
    } else {
      scene.hideBuildPreview?.()
    }
  }, [buildDrag])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        // Prevent text selection / callout during long-press drag on mobile
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    />
  )
}
