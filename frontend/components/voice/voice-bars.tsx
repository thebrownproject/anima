'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const BAR_COUNT = 4
const SMOOTHING = 0.6 // 0–1, higher = smoother
const MIN_PX = 3 // idle height in pixels
const MAX_PX = 20 // max active height in pixels

interface VoiceBarsProps {
  analyser: AnalyserNode | null
  className?: string
}

export function VoiceBars({ analyser, className }: VoiceBarsProps) {
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0))
  const rafRef = useRef<number>(0)
  const prevLevels = useRef<number[]>(Array(BAR_COUNT).fill(0))
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    if (!analyser) return

    const data = new Uint8Array(analyser.frequencyBinCount)

    function tick() {
      analyser!.getByteFrequencyData(data)

      // Average BAR_COUNT bands within speech range (~200Hz–4kHz)
      // At 24kHz / fftSize 2048: each bin ≈ 23.4Hz, speech range ≈ bins 9–171
      const lo = Math.max(1, Math.floor(data.length * 0.008))  // ~200Hz
      const hi = Math.floor(data.length * 0.33)                // ~4kHz
      const bandSize = Math.floor((hi - lo) / BAR_COUNT)
      const raw: number[] = []
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0
        const start = lo + i * bandSize
        for (let j = start; j < start + bandSize; j++) {
          sum += data[j]
        }
        const val = sum / bandSize / 255
        const smoothed = prevLevels.current[i] * SMOOTHING + val * (1 - SMOOTHING)
        raw.push(smoothed)
      }

      prevLevels.current = raw
      const now = performance.now()
      if (now - lastUpdateRef.current >= 66) { // ~15fps
        setLevels(raw)
        lastUpdateRef.current = now
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <div className={cn('flex items-center gap-[3px]', className)} style={{ height: `${MAX_PX}px` }}>
      {levels.map((level, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-white/70"
          style={{ height: `${MIN_PX + Math.round(level * (MAX_PX - MIN_PX))}px` }}
        />
      ))}
    </div>
  )
}
