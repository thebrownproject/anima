// frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx
'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { UploadDialogContent } from './upload-dialog-content'

interface UploadDialogTriggerProps {
  /** Use 'header' variant for smaller styling in the page header */
  variant?: 'default' | 'header'
}

/**
 * Button that opens the upload dialog.
 * Replaces the old UploadButton component.
 */
export function UploadDialogTrigger({
  variant = 'default',
}: UploadDialogTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant === 'header' ? 'ghost' : 'default'}
          size={variant === 'header' ? 'sm' : 'default'}
          className={variant === 'header' ? 'h-7 px-2 text-xs' : undefined}
        >
          <Upload
            className={variant === 'header' ? 'mr-1.5 size-3.5' : 'mr-2 size-4'}
          />
          Upload
        </Button>
      </DialogTrigger>
      <UploadDialogContent onClose={() => setOpen(false)} />
    </Dialog>
  )
}
