// frontend/components/documents/upload-dialog/steps/dropzone-step.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { UPLOAD_CONSTRAINTS } from '@/lib/upload-config'

interface DropzoneStepProps {
  onFileSelect: (file: File) => void
}

/**
 * Step 1: File dropzone.
 * Accepts PDF, JPG, PNG up to 10MB.
 * Immediately triggers onFileSelect when file is chosen.
 */
export function DropzoneStep({ onFileSelect }: DropzoneStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null)

      // Check type
      if (!UPLOAD_CONSTRAINTS.ACCEPTED_TYPES.includes(file.type as typeof UPLOAD_CONSTRAINTS.ACCEPTED_TYPES[number])) {
        setError('File must be PDF, JPG, or PNG')
        return
      }

      // Check size
      if (file.size > UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES) {
        setError(`File must be under ${UPLOAD_CONSTRAINTS.MAX_SIZE_MB}MB`)
        return
      }

      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSelect(file)
    }
    // Reset input for re-selection of same file
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      validateAndSelect(file)
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS}
        onChange={handleChange}
        className="hidden"
        aria-label="Upload document file"
      />

      <button
        type="button"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging
            ? 'border-primary bg-accent/50'
            : 'border-border hover:border-muted-foreground/50 hover:bg-accent/30'
        )}
      >
        <div className="rounded-full bg-muted p-3">
          <Icons.Upload className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            Drop a file here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, JPG, PNG up to {UPLOAD_CONSTRAINTS.MAX_SIZE_MB}MB
          </p>
        </div>
      </button>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  )
}
