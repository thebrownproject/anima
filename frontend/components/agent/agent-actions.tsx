// frontend/components/agent/agent-actions.tsx
'use client'

import { usePathname } from 'next/navigation'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, initialUploadData, type AgentFlow } from './stores/agent-store'

interface ActionDef {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  flow: NonNullable<AgentFlow>
  tooltip?: string
}

// Actions by route pattern
const ACTION_CONFIG: Record<string, ActionDef[]> = {
  '/documents': [
    {
      id: 'upload',
      label: 'Upload',
      icon: Icons.Upload,
      flow: { type: 'upload', step: 'dropzone', data: initialUploadData },
      tooltip: 'Upload a new document',
    },
    {
      id: 'create-stack',
      label: 'Create Stack',
      icon: Icons.Stack,
      flow: { type: 'create-stack' },
      tooltip: 'Create a new document stack',
    },
  ],
  '/stacks': [
    {
      id: 'create-stack',
      label: 'Create Stack',
      icon: Icons.Stack,
      flow: { type: 'create-stack' },
      tooltip: 'Create a new document stack',
    },
    {
      id: 'upload',
      label: 'Upload',
      icon: Icons.Upload,
      flow: { type: 'upload', step: 'dropzone', data: initialUploadData },
      tooltip: 'Upload a new document',
    },
  ],
}

export function AgentActions() {
  const pathname = usePathname()
  const openFlow = useAgentStore((s) => s.openFlow)

  // Match route to actions (exact match or prefix)
  const actions = getActionsForRoute(pathname)

  if (actions.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          icon={<action.icon className="size-3.5" />}
          tooltip={action.tooltip}
          onClick={() => openFlow(action.flow)}
        >
          {action.label}
        </ActionButton>
      ))}
    </div>
  )
}

function getActionsForRoute(pathname: string): ActionDef[] {
  // Try exact match first
  if (ACTION_CONFIG[pathname]) {
    return ACTION_CONFIG[pathname]
  }

  // Try prefix match (e.g., /documents/[id] matches /documents)
  for (const [route, actions] of Object.entries(ACTION_CONFIG)) {
    if (pathname.startsWith(route + '/')) {
      return actions
    }
  }

  // Fallback to documents actions
  return ACTION_CONFIG['/documents'] || []
}
