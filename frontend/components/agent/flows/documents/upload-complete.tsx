// frontend/components/agent/flows/documents/upload-complete.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'

interface UploadCompleteProps {
  documentName: string
  onViewDocument: () => void
  onUploadAnother: () => void
}

export function UploadComplete({
  documentName,
  onViewDocument,
  onUploadAnother,
}: UploadCompleteProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Check className="size-4 text-green-500" />
        <span>Successfully extracted data from {documentName}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onUploadAnother}>
          Upload Another
        </Button>
        <Button onClick={onViewDocument}>
          View Document
        </Button>
      </div>
    </div>
  )
}
