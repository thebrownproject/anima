'use client'

import { PanelRight } from 'lucide-react'
import { ActionButton } from '@/components/layout/action-button'
import { usePreviewPanel } from './preview-panel-context'

export function PreviewToggle() {
  const { isCollapsed, toggle } = usePreviewPanel()

  return (
    <ActionButton
      icon={<PanelRight />}
      onClick={toggle}
      className={!isCollapsed ? 'bg-accent text-accent-foreground' : undefined}
    >
      Preview
    </ActionButton>
  )
}
