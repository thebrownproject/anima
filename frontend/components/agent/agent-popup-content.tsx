// frontend/components/agent/agent-popup-content.tsx
'use client'

import { useAgentFlow } from './stores/agent-store'
import { UploadFlow } from './flows/documents/upload-flow'

export function AgentPopupContent() {
  const flow = useAgentFlow()

  if (!flow) return null

  switch (flow.type) {
    case 'upload':
      return <UploadFlow />
    case 'create-stack':
      // Post-MVP
      return null
    default:
      return null
  }
}
