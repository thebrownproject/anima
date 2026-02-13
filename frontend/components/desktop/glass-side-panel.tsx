'use client'

import type { ReactNode } from 'react'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { GlassIconButton } from '@/components/ui/glass-icon-button'

interface GlassSidePanelProps {
  isOpen: boolean
  onClose: () => void
  side: 'left' | 'right'
  title?: string
  icon?: ReactNode
  closeIcon?: ReactNode
  closeTooltip?: string
  width?: string
  headerActions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  containerClassName?: string
  className?: string
}

export function GlassSidePanel({
  isOpen,
  onClose,
  side,
  title,
  icon,
  closeIcon,
  closeTooltip = 'Close',
  width = 'w-[320px]',
  headerActions,
  footer,
  children,
  containerClassName,
  className,
}: GlassSidePanelProps) {
  return (
    <div
      className={cn(
        'fixed top-16 bottom-6 z-40',
        side === 'left' ? 'left-4' : 'right-4',
        width,
        'transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        isOpen
          ? 'translate-x-0 opacity-100'
          : `${side === 'left' ? '-translate-x-[110%]' : 'translate-x-[110%]'} opacity-0 pointer-events-none`,
        className,
      )}
    >
      <div className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl',
        containerClassName,
      )}>
        {/* Header */}
        <div className={cn(
          'flex h-14 shrink-0 items-center px-5',
          title ? 'justify-between' : 'justify-end',
        )}>
          {title && (
            <div className="flex items-center gap-2.5">
              {icon}
              <span className="text-base font-semibold tracking-wide text-white/90">{title}</span>
            </div>
          )}
          <div className="flex items-center">
            {headerActions}
            <GlassIconButton
              icon={closeIcon ?? <Icons.X />}
              tooltip={closeTooltip}
              onClick={onClose}
              className="-mr-2"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
