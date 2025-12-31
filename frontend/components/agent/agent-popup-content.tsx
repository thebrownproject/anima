// frontend/components/agent/agent-popup-content.tsx
'use client'

import { useAgentFlow } from './stores/agent-store'
import { AgentPopup } from './agent-popup'

export function AgentPopupContent() {
  const flow = useAgentFlow()

  if (!flow) return null

  switch (flow.type) {
    case 'upload':
      // TODO: Import and render UploadFlow (Phase 2)
      return (
        <AgentPopup title={getUploadTitle(flow.step)}>
          <div className="text-sm text-muted-foreground">
            Upload flow coming in Phase 2...
          </div>
        </AgentPopup>
      )
    case 'create-stack':
      return (
        <AgentPopup title="Create Stack">
          <div className="text-sm text-muted-foreground">
            Create stack flow coming post-MVP...
          </div>
        </AgentPopup>
      )
    default:
      return null
  }
}

function getUploadTitle(step: string): string {
  switch (step) {
    case 'dropzone': return 'Upload Document'
    case 'configure': return 'Configure Extraction'
    case 'fields': return 'Specify Fields'
    case 'extracting': return 'Extracting...'
    case 'complete': return 'Complete'
    default: return 'Upload Document'
  }
}
