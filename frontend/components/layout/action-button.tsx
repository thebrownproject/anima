'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  children: React.ReactNode
}

export function ActionButton({
  icon,
  children,
  className,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-7 px-2 text-xs text-foreground', className)}
      {...props}
    >
      {icon && <span className="mr-1 size-3.5 [&>svg]:size-full">{icon}</span>}
      {children}
    </Button>
  )
}
