// frontend/components/agent/agent-popup.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentFlow, useAgentPopup } from './stores/agent-store'

interface AgentPopupProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function AgentPopup({ children, title, showBack, onBack }: AgentPopupProps) {
  const { isPopupOpen } = useAgentPopup()
  const flow = useAgentFlow()
  const collapsePopup = useAgentStore((s) => s.collapsePopup)
  const close = useAgentStore((s) => s.close)

  // Don't render if no flow active
  if (!flow) return null

  const handleClose = () => {
    // TODO: Add confirmation if mid-flow (Phase 2, Task 4)
    close()
  }

  return (
    <Collapsible open={isPopupOpen} onOpenChange={(open) => !open && collapsePopup()}>
      <CollapsibleContent forceMount className={cn(!isPopupOpen && 'hidden')}>
        <div className="rounded-xl border border-border bg-background shadow-lg mb-3">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              {showBack && onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={onBack}
                >
                  <Icons.ChevronLeft className="size-4" />
                  <span className="sr-only">Go back</span>
                </Button>
              )}
              {title && (
                <h3 className="text-sm font-medium">{title}</h3>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={collapsePopup}
                aria-label="Collapse popup"
              >
                <Icons.ChevronDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleClose}
                aria-label="Close"
              >
                <Icons.X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {children}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
