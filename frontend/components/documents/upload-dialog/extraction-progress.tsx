// frontend/components/documents/upload-dialog/extraction-progress.tsx
'use client'

import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import type { AgentEvent } from '@/lib/agent-api'
import type { ExtractionStatus } from '@/types/upload'

interface ExtractionProgressProps {
  status: ExtractionStatus
  events: readonly AgentEvent[]
  error: string | null
}

/**
 * Shows extraction progress with event list.
 * Similar styling to AiActivityPanel but inline in dialog.
 */
export function ExtractionProgress({
  status,
  events,
  error,
}: ExtractionProgressProps) {
  if (status === 'idle') {
    return null
  }

  const isExtracting = status === 'extracting'
  const isComplete = status === 'complete'
  const isError = status === 'error'

  const toolEvents = events.filter((e) => e.type === 'tool')

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {isExtracting && (
          <>
            <Icons.Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm font-medium">Extracting...</span>
          </>
        )}
        {isComplete && (
          <>
            <Icons.Check className="size-4 text-green-500" />
            <span className="text-sm font-medium">Extraction complete</span>
          </>
        )}
        {isError && (
          <>
            <Icons.AlertCircle className="size-4 text-destructive" />
            <span className="text-sm font-medium">Extraction failed</span>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive mb-2">{error}</p>
      )}

      {/* Events list */}
      {toolEvents.length > 0 && (
        <div className="space-y-1.5">
          {toolEvents.map((event, i) => (
            <div
              key={`tool-${i}`}
              className={cn(
                'flex items-center gap-2 text-sm text-muted-foreground',
                'animate-in fade-in duration-150'
              )}
            >
              <Icons.Check className="size-3 text-green-500 shrink-0" />
              <span>{event.content}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isExtracting && events.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Connecting to agent...
        </p>
      )}

      {/* Complete message */}
      {isComplete && (
        <p className="text-sm text-muted-foreground mt-2">
          Redirecting to document...
        </p>
      )}
    </div>
  )
}
