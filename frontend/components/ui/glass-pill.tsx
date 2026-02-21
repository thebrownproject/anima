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
        'flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
