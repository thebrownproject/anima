'use client'

import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePreviewPanel } from './preview-panel-context'

export function PreviewToggle() {
  const { isCollapsed, toggle } = usePreviewPanel()

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('size-7 mr-2.5', !isCollapsed && 'bg-accent text-accent-foreground')}
      onClick={toggle}
      aria-label={isCollapsed ? 'Show preview' : 'Hide preview'}
      aria-pressed={!isCollapsed}
    >
      <PanelRight />
      <span className="sr-only">Toggle Preview</span>
    </Button>
  )
}
