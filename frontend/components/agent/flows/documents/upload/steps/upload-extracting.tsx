// frontend/components/agent/flows/documents/upload-extracting.tsx
'use client'

import { useMemo } from 'react'
import * as Icons from '@/components/icons'
import { useAgentEvents } from '../../../../stores/agent-store'

export function UploadExtracting() {
  const events = useAgentEvents()
  const toolEvents = useMemo(
    () => events.filter((e) => e.type === 'tool'),
    [events]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span>Extracting data from document...</span>
      </div>

      {toolEvents.length > 0 && (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {toolEvents.map((event, i) => (
            <div
              key={`tool-${i}`}
              className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-150"
            >
              <Icons.Check className="size-3.5 text-green-500 shrink-0" />
              <span>{event.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
