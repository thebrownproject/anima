// frontend/components/documents/upload-dialog/upload-status.tsx
'use client'

import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import type { UploadStatus as UploadStatusType } from '@/types/upload'

interface UploadStatusProps {
  status: UploadStatusType
  error?: string | null
  className?: string
}

/**
 * Shows upload/OCR progress indicator.
 * Displays checkmarks for completed steps, spinner for in-progress.
 */
export function UploadStatus({ status, error, className }: UploadStatusProps) {
  if (status === 'idle') {
    return null
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      {status === 'uploading' && (
        <>
          <Icons.Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Uploading document...</span>
        </>
      )}

      {status === 'processing_ocr' && (
        <>
          <Icons.Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Processing OCR...</span>
        </>
      )}

      {status === 'ready' && (
        <>
          <Icons.Check className="size-3.5 text-green-500" />
          <span className="text-muted-foreground">Ready</span>
        </>
      )}

      {status === 'error' && (
        <>
          <Icons.X className="size-3.5 text-destructive" />
          <span className="text-destructive">{error || 'Upload failed'}</span>
        </>
      )}
    </div>
  )
}
