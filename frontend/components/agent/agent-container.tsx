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

  return (
    <div className={cn('relative w-full max-w-[640px] mx-auto', className)}>
      {/* Popup floats above bar */}
      <div className="absolute bottom-full left-0 right-0">
        <AgentPopupContent />
      </div>

      {/* Dynamic chat bar */}
      <AgentBar />
    </div>
  )
}
