// frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx
'use client'

import { useState } from 'react'
import * as Icons from '@/components/icons'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { ActionButton } from '@/components/layout/action-button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { UploadDialogContent } from './upload-dialog-content'

export function UploadDialogTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <ActionButton icon={<Icons.Upload />}>
              Upload
            </ActionButton>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" collisionPadding={16}>Add documents to extract</TooltipContent>
      </Tooltip>
      <UploadDialogContent onClose={() => setOpen(false)} />
    </Dialog>
  )
}
