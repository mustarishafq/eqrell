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
    })()

    return () => {
      cancelled = true
      if (gameRef.current) {
        try { gameRef.current.destroy(true) } catch { /* teardown race */ }
        gameRef.current = null
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

  // Push lang changes into the scene — new bubbles will pick this up immediately
  useEffect(() => {
    const g = gameRef.current
    if (!g) return
    try { g.registry.set('lang', lang) } catch { /* not ready */ }
  }, [lang])

  // Camera commands from React (zoom in/out/reset)
  useEffect(() => {
    const g = gameRef.current
    if (!g || !cameraCommand) return
    const scene = g.scene.getScene('WorldScene')
    if (!scene?.cameras?.main) return
    const cam = scene.cameras.main
    if (cameraCommand.action === 'zoomIn') {
      const next = Math.min(1.8, cam.zoom * 1.15)
      scene.tweens.add({ targets: cam, zoom: next, duration: 200 })
    } else if (cameraCommand.action === 'zoomOut') {
      const next = Math.max(0.6, cam.zoom / 1.15)
      scene.tweens.add({ targets: cam, zoom: next, duration: 200 })
    } else if (cameraCommand.action === 'center') {
      // Center on Musalla anchor
      if (scene.originX != null) {
        // Import gridToScreen from module-level? use inline formula
        const TW = 96, TH = 48
        const mx = scene.originX + (7 - 7) * TW / 2   // MUSALLA_ANCHOR (7,7)
        const my = scene.originY + (7 + 7) * TH / 2
        scene.tweens.add({
          targets: cam,
          scrollX: mx - cam.width / (2 * cam.zoom),
          scrollY: my - cam.height / (2 * cam.zoom),
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
