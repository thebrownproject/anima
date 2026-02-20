import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { type CardColor, COLOR_STYLES } from './colors'

interface BaseCardProps {
  children: ReactNode
  className?: string
  color?: CardColor
}

export function BaseCard({ children, className, color = 'white' }: BaseCardProps) {
  const { bg, text, border } = COLOR_STYLES[color]

  return (
    <div
      data-testid="base-card"
      data-color={color}
      className={cn(
        'rounded-[40px] shadow-2xl overflow-hidden border',
        // dark card uses a visible border; light cards suppress it
        color === 'dark' ? '' : 'border-transparent',
        className,
      )}
      style={{
        backgroundColor: bg,
        color: text,
        borderColor: border ?? undefined,
      }}
    >
      <div className="p-8 flex flex-col h-full">
        {children}
      </div>
    </div>
  )
}
