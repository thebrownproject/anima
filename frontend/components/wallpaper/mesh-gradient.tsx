'use client'

import { useEffect, useRef, useState } from 'react'

interface MeshGradientProps {
  variant: string
}

interface AuroraBand {
  y: number
  thickness: number
  r: number; g: number; b: number
  intensity: number
  waveFreq: number
  waveAmp: number
  speed: number
}

const PALETTES: Record<string, { bg: string; bands: AuroraBand[] }> = {
  // 1. Purple Blue Grain — dark, curved arc of blue/purple from upper area
  'mesh-purple-blue-grain': {
    bg: '#04030a',
    bands: [
      { y: 0.28, thickness: 0.18, r: 20, g: 20, b: 70, intensity: 0.7, waveFreq: 0.8, waveAmp: 0.08, speed: 0.06 },
      { y: 0.35, thickness: 0.14, r: 40, g: 15, b: 80, intensity: 0.8, waveFreq: 1.2, waveAmp: 0.06, speed: 0.08 },
      { y: 0.42, thickness: 0.10, r: 60, g: 20, b: 60, intensity: 0.5, waveFreq: 1.5, waveAmp: 0.04, speed: 0.07 },
      { y: 0.30, thickness: 0.25, r: 15, g: 15, b: 50, intensity: 0.4, waveFreq: 0.6, waveAmp: 0.10, speed: 0.04 },
    ],
  },
  // 2. Deep Purple Gradient — dark blue-purple bg, bright pink/magenta streak to upper-right
  'mesh-deep-purple-gradient': {
    bg: '#06040e',
    bands: [
      { y: 0.10, thickness: 0.30, r: 30, g: 15, b: 55, intensity: 0.5, waveFreq: 0.5, waveAmp: 0.05, speed: 0.04 },
      { y: 0.40, thickness: 0.15, r: 80, g: 20, b: 90, intensity: 0.9, waveFreq: 1.0, waveAmp: 0.06, speed: 0.07 },
      { y: 0.45, thickness: 0.12, r: 100, g: 25, b: 70, intensity: 0.8, waveFreq: 1.3, waveAmp: 0.05, speed: 0.09 },
      { y: 0.55, thickness: 0.20, r: 20, g: 12, b: 45, intensity: 0.4, waveFreq: 0.8, waveAmp: 0.07, speed: 0.05 },
      { y: 0.75, thickness: 0.25, r: 15, g: 10, b: 35, intensity: 0.3, waveFreq: 0.6, waveAmp: 0.08, speed: 0.04 },
    ],
  },
  // 3. Blue Pink Gradient — dark, diagonal streak of blue-to-orange/pink from bottom-left
  'mesh-blue-pink-gradient': {
    bg: '#030510',
    bands: [
      { y: 0.60, thickness: 0.15, r: 80, g: 50, b: 30, intensity: 0.7, waveFreq: 0.8, waveAmp: 0.06, speed: 0.06 },
      { y: 0.55, thickness: 0.12, r: 50, g: 40, b: 70, intensity: 0.8, waveFreq: 1.2, waveAmp: 0.05, speed: 0.08 },
      { y: 0.50, thickness: 0.18, r: 25, g: 30, b: 65, intensity: 0.6, waveFreq: 0.6, waveAmp: 0.08, speed: 0.05 },
      { y: 0.70, thickness: 0.25, r: 15, g: 25, b: 55, intensity: 0.4, waveFreq: 0.5, waveAmp: 0.10, speed: 0.04 },
      { y: 0.40, thickness: 0.20, r: 10, g: 15, b: 40, intensity: 0.3, waveFreq: 0.7, waveAmp: 0.07, speed: 0.05 },
    ],
  },
  // 4. Dynamic Grain — dark, pink/red bottom-left, deep blue right side
  'mesh-dynamic-grain': {
    bg: '#060410',
    bands: [
      { y: 0.55, thickness: 0.30, r: 70, g: 20, b: 40, intensity: 0.7, waveFreq: 0.6, waveAmp: 0.08, speed: 0.05 },
      { y: 0.40, thickness: 0.25, r: 45, g: 15, b: 55, intensity: 0.6, waveFreq: 0.8, waveAmp: 0.06, speed: 0.06 },
      { y: 0.25, thickness: 0.30, r: 12, g: 15, b: 55, intensity: 0.5, waveFreq: 0.5, waveAmp: 0.07, speed: 0.04 },
      { y: 0.70, thickness: 0.20, r: 50, g: 12, b: 30, intensity: 0.5, waveFreq: 1.0, waveAmp: 0.05, speed: 0.07 },
      { y: 0.35, thickness: 0.35, r: 15, g: 10, b: 40, intensity: 0.3, waveFreq: 0.4, waveAmp: 0.10, speed: 0.03 },
    ],
  },
  // 5. Purple Haze — light, pastel lavender/pink/white dreamy clouds
  'mesh-purple-haze': {
    bg: '#b8a0c0',
    bands: [
      { y: 0.30, thickness: 0.30, r: 200, g: 170, b: 190, intensity: 0.8, waveFreq: 0.8, waveAmp: 0.08, speed: 0.05 },
      { y: 0.45, thickness: 0.25, r: 190, g: 150, b: 170, intensity: 0.7, waveFreq: 1.0, waveAmp: 0.06, speed: 0.06 },
      { y: 0.55, thickness: 0.30, r: 210, g: 200, b: 210, intensity: 0.9, waveFreq: 0.6, waveAmp: 0.10, speed: 0.04 },
      { y: 0.70, thickness: 0.25, r: 180, g: 160, b: 190, intensity: 0.6, waveFreq: 0.7, waveAmp: 0.07, speed: 0.05 },
      { y: 0.20, thickness: 0.25, r: 160, g: 150, b: 180, intensity: 0.5, waveFreq: 0.5, waveAmp: 0.09, speed: 0.04 },
    ],
  },
  // 6. Blues to Purple — teal left, purple right, golden streaks through center
  'mesh-blues-to-purple': {
    bg: '#0a2030',
    bands: [
      { y: 0.35, thickness: 0.20, r: 15, g: 70, b: 80, intensity: 0.7, waveFreq: 1.0, waveAmp: 0.06, speed: 0.07 },
      { y: 0.42, thickness: 0.15, r: 80, g: 65, b: 40, intensity: 0.6, waveFreq: 1.5, waveAmp: 0.04, speed: 0.09 },
      { y: 0.50, thickness: 0.25, r: 50, g: 30, b: 80, intensity: 0.8, waveFreq: 0.8, waveAmp: 0.07, speed: 0.06 },
      { y: 0.60, thickness: 0.20, r: 20, g: 50, b: 70, intensity: 0.5, waveFreq: 1.2, waveAmp: 0.05, speed: 0.08 },
      { y: 0.30, thickness: 0.30, r: 70, g: 55, b: 35, intensity: 0.4, waveFreq: 0.6, waveAmp: 0.08, speed: 0.05 },
    ],
  },
  // 7. Blue Beige Glow — very light, pastel white/pink/teal/purple soft blobs
  'mesh-blue-beige-glow': {
    bg: '#d8ccd0',
    bands: [
      { y: 0.30, thickness: 0.30, r: 180, g: 210, b: 210, intensity: 0.7, waveFreq: 0.6, waveAmp: 0.08, speed: 0.04 },
      { y: 0.50, thickness: 0.25, r: 200, g: 190, b: 200, intensity: 0.6, waveFreq: 0.8, waveAmp: 0.07, speed: 0.05 },
      { y: 0.25, thickness: 0.25, r: 140, g: 100, b: 140, intensity: 0.5, waveFreq: 0.5, waveAmp: 0.09, speed: 0.04 },
      { y: 0.65, thickness: 0.30, r: 210, g: 190, b: 195, intensity: 0.8, waveFreq: 0.7, waveAmp: 0.06, speed: 0.05 },
      { y: 0.45, thickness: 0.20, r: 160, g: 200, b: 200, intensity: 0.4, waveFreq: 0.9, waveAmp: 0.05, speed: 0.06 },
    ],
  },
  // 8. Deep Blue Purple — dark, blue/purple curved sweep, mostly black
  'mesh-deep-blue-purple': {
    bg: '#030308',
    bands: [
      { y: 0.30, thickness: 0.20, r: 25, g: 25, b: 70, intensity: 0.8, waveFreq: 0.8, waveAmp: 0.07, speed: 0.06 },
      { y: 0.40, thickness: 0.16, r: 40, g: 20, b: 60, intensity: 0.7, waveFreq: 1.2, waveAmp: 0.05, speed: 0.08 },
      { y: 0.50, thickness: 0.12, r: 55, g: 25, b: 55, intensity: 0.6, waveFreq: 1.5, waveAmp: 0.04, speed: 0.09 },
      { y: 0.35, thickness: 0.30, r: 20, g: 20, b: 50, intensity: 0.4, waveFreq: 0.5, waveAmp: 0.10, speed: 0.04 },
      { y: 0.60, thickness: 0.20, r: 15, g: 15, b: 35, intensity: 0.3, waveFreq: 0.7, waveAmp: 0.08, speed: 0.05 },
    ],
  },
  // 9. Colorful Grain — dark blue, pink/magenta wave center, teal accents
  'mesh-colorful-grain': {
    bg: '#050812',
    bands: [
      { y: 0.35, thickness: 0.20, r: 20, g: 20, b: 60, intensity: 0.6, waveFreq: 0.8, waveAmp: 0.06, speed: 0.06 },
      { y: 0.45, thickness: 0.18, r: 70, g: 25, b: 60, intensity: 0.8, waveFreq: 1.2, waveAmp: 0.05, speed: 0.08 },
      { y: 0.55, thickness: 0.15, r: 80, g: 40, b: 50, intensity: 0.7, waveFreq: 1.0, waveAmp: 0.07, speed: 0.07 },
      { y: 0.65, thickness: 0.20, r: 15, g: 40, b: 55, intensity: 0.5, waveFreq: 0.6, waveAmp: 0.08, speed: 0.05 },
      { y: 0.25, thickness: 0.25, r: 15, g: 15, b: 45, intensity: 0.4, waveFreq: 0.5, waveAmp: 0.09, speed: 0.04 },
      { y: 0.80, thickness: 0.20, r: 10, g: 25, b: 40, intensity: 0.3, waveFreq: 0.7, waveAmp: 0.07, speed: 0.05 },
    ],
  },
  // 10. Purple Fabric — medium-dark, wavy purple/blue/teal/pink bands
  'mesh-purple-fabric': {
    bg: '#181525',
    bands: [
      { y: 0.20, thickness: 0.18, r: 30, g: 25, b: 55, intensity: 0.6, waveFreq: 1.5, waveAmp: 0.06, speed: 0.08 },
      { y: 0.35, thickness: 0.16, r: 55, g: 30, b: 60, intensity: 0.7, waveFreq: 2.0, waveAmp: 0.05, speed: 0.10 },
      { y: 0.48, thickness: 0.14, r: 65, g: 35, b: 50, intensity: 0.8, waveFreq: 1.8, waveAmp: 0.04, speed: 0.09 },
      { y: 0.60, thickness: 0.16, r: 40, g: 25, b: 55, intensity: 0.6, waveFreq: 1.3, waveAmp: 0.06, speed: 0.07 },
      { y: 0.75, thickness: 0.18, r: 25, g: 30, b: 50, intensity: 0.5, waveFreq: 1.0, waveAmp: 0.07, speed: 0.06 },
      { y: 0.40, thickness: 0.30, r: 50, g: 20, b: 55, intensity: 0.4, waveFreq: 0.8, waveAmp: 0.08, speed: 0.05 },
    ],
  },
  // 11. Purple Grey Soft — medium-dark, muted purple/grey/pink
  'mesh-purple-grey-soft': {
    bg: '#1a1520',
    bands: [
      { y: 0.30, thickness: 0.25, r: 45, g: 30, b: 50, intensity: 0.6, waveFreq: 0.7, waveAmp: 0.07, speed: 0.05 },
      { y: 0.45, thickness: 0.20, r: 60, g: 35, b: 50, intensity: 0.7, waveFreq: 1.0, waveAmp: 0.06, speed: 0.06 },
      { y: 0.55, thickness: 0.22, r: 55, g: 40, b: 55, intensity: 0.5, waveFreq: 0.8, waveAmp: 0.08, speed: 0.05 },
      { y: 0.70, thickness: 0.25, r: 35, g: 28, b: 40, intensity: 0.4, waveFreq: 0.5, waveAmp: 0.09, speed: 0.04 },
      { y: 0.20, thickness: 0.20, r: 30, g: 25, b: 40, intensity: 0.4, waveFreq: 0.6, waveAmp: 0.08, speed: 0.04 },
    ],
  },
  // 12. Lavender White — very light, pastel lavender/pink/blue diagonal
  'mesh-lavender-white': {
    bg: '#d0c0d0',
    bands: [
      { y: 0.30, thickness: 0.25, r: 200, g: 170, b: 200, intensity: 0.7, waveFreq: 0.8, waveAmp: 0.07, speed: 0.05 },
      { y: 0.45, thickness: 0.20, r: 180, g: 140, b: 180, intensity: 0.8, waveFreq: 1.0, waveAmp: 0.06, speed: 0.07 },
      { y: 0.55, thickness: 0.18, r: 160, g: 170, b: 200, intensity: 0.6, waveFreq: 1.2, waveAmp: 0.05, speed: 0.08 },
      { y: 0.65, thickness: 0.25, r: 210, g: 200, b: 210, intensity: 0.5, waveFreq: 0.6, waveAmp: 0.08, speed: 0.04 },
      { y: 0.20, thickness: 0.20, r: 190, g: 180, b: 200, intensity: 0.4, waveFreq: 0.5, waveAmp: 0.09, speed: 0.04 },
    ],
  },
}

const DEFAULT = PALETTES['mesh-purple-blue-grain']

const POINTS = 12
const FRAME_INTERVAL = 1000 / 30
const RENDER_SCALE = 0.5

/** Generate a full-res grain data URL (called once on mount/resize). */
function createGrainDataUrl(w: number, h: number): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const data = img.data
  for (let i = 0; i < w * h; i++) {
    const v = Math.random() * 255
    const idx = i * 4
    data[idx] = v
    data[idx + 1] = v
    data[idx + 2] = v
    data[idx + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

export function MeshGradient({ variant }: MeshGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [grainSrc, setGrainSrc] = useState<string>('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const config = PALETTES[variant] ?? DEFAULT

    let w = 0
    let h = 0

    const resize = () => {
      w = Math.round(canvas.offsetWidth * RENDER_SCALE)
      h = Math.round(canvas.offsetHeight * RENDER_SCALE)
      canvas.width = w
      canvas.height = h
      setGrainSrc(createGrainDataUrl(Math.round(canvas.offsetWidth * 1.25), Math.round(canvas.offsetHeight * 1.25)))
    }
    resize()
    window.addEventListener('resize', resize)

    const startTime = performance.now()
    let lastFrame = 0

    const draw = (now: number) => {
      animRef.current = requestAnimationFrame(draw)

      if (w === 0 || h === 0) return

      if (now - lastFrame < FRAME_INTERVAL) return
      lastFrame = now

      const t = (now - startTime) / 1000

      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = config.bg
      ctx.fillRect(0, 0, w, h)

      ctx.globalCompositeOperation = 'screen'

      for (const band of config.bands) {
        const spread = band.thickness * Math.max(w, h)

        for (let p = -1; p <= POINTS; p++) {
          const nx = p / POINTS
          const x = nx * w

          const waveOffset = Math.sin(nx * band.waveFreq * Math.PI * 2 + t * band.speed) * band.waveAmp
          const cy = (band.y + waveOffset) * h

          const shimmer = 0.7 + 0.3 * Math.sin(nx * 6 + t * 0.4 + band.y * 15)
          const alpha = band.intensity * shimmer

          const grad = ctx.createRadialGradient(x, cy, 0, x, cy, spread)
          grad.addColorStop(0, `rgba(${band.r},${band.g},${band.b},${alpha})`)
          grad.addColorStop(0.4, `rgba(${band.r},${band.g},${band.b},${alpha * 0.3})`)
          grad.addColorStop(1, 'transparent')

          ctx.fillStyle = grad
          ctx.fillRect(x - spread, cy - spread, spread * 2, spread * 2)
        }
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [variant])

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
      />
      {grainSrc && (
        <img
          src={grainSrc}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ mixBlendMode: 'overlay', opacity: 0.75 }}
        />
      )}
    </div>
  )
}
