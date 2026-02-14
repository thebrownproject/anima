'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface GlassPillProps {
  children: ReactNode
  className?: string
}

export function GlassPill({ children, className }: GlassPillProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
