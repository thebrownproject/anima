// frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx
'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { UploadDialogContent } from './upload-dialog-content'

interface UploadDialogTriggerProps {
  /** Use 'header' for page header, 'subbar' for sub-bar toolbar */
  variant?: 'default' | 'header' | 'subbar'
}

/**
 * Button that opens the upload dialog.
 * Replaces the old UploadButton component.
 */
export function UploadDialogTrigger({
  variant = 'default',
}: UploadDialogTriggerProps) {
  const [open, setOpen] = useState(false)

  const buttonVariant = variant === 'header' ? 'ghost' : 'default'
  const buttonSize = variant === 'default' ? 'default' : 'sm'
  const buttonClassName = variant === 'header' ? 'h-7 px-2 text-xs' : undefined
  const iconClassName = variant === 'header' ? 'mr-1.5 size-3.5' : 'mr-1.5 size-4'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className={buttonClassName}>
          <Upload className={iconClassName} />
          Upload
        </Button>
      </DialogTrigger>
      <UploadDialogContent onClose={() => setOpen(false)} />
    </Dialog>
  )
}
