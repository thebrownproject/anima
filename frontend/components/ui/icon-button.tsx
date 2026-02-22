'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

interface IconButtonProps {
  icon: ReactNode
  tooltip: string
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  onClick?: () => void
  className?: string
}

export function IconButton({
  icon,
  tooltip,
  tooltipSide = 'bottom',
  onClick,
  className,
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={onClick}
          className={cn('rounded-full text-muted-foreground [&_svg]:!size-5', className)}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
