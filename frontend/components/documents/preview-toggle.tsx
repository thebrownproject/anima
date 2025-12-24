'use client'

import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePreviewPanel } from './preview-panel-context'
import { cn } from '@/lib/utils'

export function PreviewToggle() {
  const { isCollapsed, toggle } = usePreviewPanel()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={cn(
        'h-7 px-2 text-xs',
        !isCollapsed && 'bg-accent text-accent-foreground'
      )}
    >
      <PanelRight className="mr-1.5 size-3.5" />
      Preview
    </Button>
  )
}
