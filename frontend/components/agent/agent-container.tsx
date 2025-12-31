// frontend/components/agent/agent-container.tsx
'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AgentBar } from './agent-bar'
import { AgentPopupContent } from './agent-popup-content'

// Routes where the agent bar should be visible
const AGENT_ROUTES = ['/documents', '/stacks']

interface AgentContainerProps {
  className?: string
}

export function AgentContainer({ className }: AgentContainerProps) {
  const pathname = usePathname()

  // Self-managed visibility - only show on supported routes
  const shouldShow = AGENT_ROUTES.some(route => pathname.startsWith(route))
  if (!shouldShow) return null

  // Mobile responsive: full width on mobile (<640px), max-width on sm+
  // Safe area padding at bottom avoids overlap with iOS home indicator/browser controls
  return (
    <div className={cn(
      'relative w-full sm:max-w-xl mx-auto',
      'pb-[env(safe-area-inset-bottom)]',
      className
    )}>
      <div className="absolute bottom-full left-0 right-0">
        <AgentPopupContent />
      </div>
      <AgentBar />
    </div>
  )
}
