import { useCallback, useEffect, useRef } from 'react'

// Shared momentum physics constants — used by both DesktopViewport and DesktopCard
const MOMENTUM_DECAY = 0.92
const MOMENTUM_MIN = 0.5
const VELOCITY_BLEND = 0.6 // Exponential moving average weight for new samples
const FLICK_WINDOW_MS = 60 // Must move within this window to trigger glide

interface MomentumCallbacks {
  /** Called each animation frame with the decayed velocity. Apply the delta to your position. */
  onFrame: (vx: number, vy: number) => void
  /** Called when velocity drops below threshold and the glide stops. */
  onStop: () => void
}

interface MomentumControls {
  /** Record a movement sample (call on each pointer move). */
  trackVelocity: (dx: number, dy: number) => void
  /** Start the momentum glide if the pointer was released with a flick. Returns true if glide started. */
  releaseWithFlick: () => boolean
  /** Cancel any running momentum animation and call onStop. */
  cancel: () => void
  /** Whether a momentum animation is currently running. */
  isAnimating: () => boolean
}

/**
 * Shared momentum physics hook for drag-and-release glide behavior.
 *
 * Owns velocity tracking, flick detection, and the RAF decay loop.
 * The consumer provides onFrame/onStop callbacks to apply the physics
 * to their specific DOM element or coordinate system.
 */
export function useMomentum({ onFrame, onStop }: MomentumCallbacks): MomentumControls {
  const velocity = useRef({ x: 0, y: 0 })
  const lastMoveTime = useRef(0)
  const rafId = useRef(0)

  // Store callbacks in refs so the RAF loop always sees the latest version
  const onFrameRef = useRef(onFrame)
  const onStopRef = useRef(onStop)
  onFrameRef.current = onFrame
  onStopRef.current = onStop

  const stopAnimation = useCallback(() => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
      rafId.current = 0
    }
  }, [])

  const animate = useCallback(() => {
    const v = velocity.current
    v.x *= MOMENTUM_DECAY
    v.y *= MOMENTUM_DECAY

    if (Math.abs(v.x) < MOMENTUM_MIN && Math.abs(v.y) < MOMENTUM_MIN) {
      rafId.current = 0
      onStopRef.current()
      return
    }

    onFrameRef.current(v.x, v.y)
    rafId.current = requestAnimationFrame(animate)
  }, [])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => stopAnimation()
  }, [stopAnimation])

  const trackVelocity = useCallback((dx: number, dy: number) => {
    lastMoveTime.current = performance.now()
    velocity.current.x = dx * VELOCITY_BLEND + velocity.current.x * (1 - VELOCITY_BLEND)
    velocity.current.y = dy * VELOCITY_BLEND + velocity.current.y * (1 - VELOCITY_BLEND)
  }, [])

  const releaseWithFlick = useCallback((): boolean => {
    if (rafId.current) return false // Already animating — prevent RAF handle leak

    const timeSinceLastMove = performance.now() - lastMoveTime.current
    const v = velocity.current

    if (timeSinceLastMove < FLICK_WINDOW_MS && (Math.abs(v.x) > MOMENTUM_MIN || Math.abs(v.y) > MOMENTUM_MIN)) {
      rafId.current = requestAnimationFrame(animate)
      return true
    }
    return false
  }, [animate])

  const cancel = useCallback(() => {
    stopAnimation()
    velocity.current = { x: 0, y: 0 }
    onStopRef.current()
  }, [stopAnimation])

  const isAnimating = useCallback(() => rafId.current !== 0, [])

  return { trackVelocity, releaseWithFlick, cancel, isAnimating }
}
