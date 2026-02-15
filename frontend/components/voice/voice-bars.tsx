'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const BAR_COUNT = 4
const SMOOTHING = 0.6 // 0–1, higher = smoother

interface VoiceBarsProps {
  analyser: AnalyserNode | null
  className?: string
}

export function VoiceBars({ analyser, className }: VoiceBarsProps) {
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.15))
  const rafRef = useRef<number>(0)
  const prevLevels = useRef<number[]>(Array(BAR_COUNT).fill(0.15))

  useEffect(() => {
    if (!analyser) return

    const data = new Uint8Array(analyser.frequencyBinCount)

    function tick() {
      analyser!.getByteFrequencyData(data)

      // Sample BAR_COUNT evenly-spaced frequency bins
      const binStep = Math.floor(data.length / BAR_COUNT)
      const raw: number[] = []
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = data[i * binStep] / 255 // normalise to 0–1
        // Smooth with previous frame
        const smoothed = prevLevels.current[i] * SMOOTHING + val * (1 - SMOOTHING)
        raw.push(Math.max(0.15, smoothed)) // min height so bars are always visible
      }

      prevLevels.current = raw
      setLevels(raw)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <div className={cn('flex items-end gap-[3px]', className)}>
      {levels.map((level, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-white/70 transition-[height] duration-75"
          style={{ height: `${Math.round(level * 20)}px` }}
        />
      ))}
    </div>
  )
}
