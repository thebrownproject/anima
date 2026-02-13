'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GlassButton } from '@/components/ui/glass-button'
import {
  GlassTooltip,
  GlassTooltipTrigger,
  GlassTooltipContent,
} from '@/components/ui/glass-tooltip'

interface GlassIconButtonProps {
  icon: ReactNode
  tooltip: string
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  onClick?: () => void
  className?: string
}

export function GlassIconButton({
  icon,
  tooltip,
  tooltipSide = 'bottom',
  onClick,
  className,
}: GlassIconButtonProps) {
  return (
    <GlassTooltip>
      <GlassTooltipTrigger asChild>
        <GlassButton
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn('size-10 rounded-full text-white/70 [&_svg]:size-[22px]', className)}
        >
          {icon}
        </GlassButton>
      </GlassTooltipTrigger>
      <GlassTooltipContent side={tooltipSide}>{tooltip}</GlassTooltipContent>
    </GlassTooltip>
  )
}
