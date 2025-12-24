# Upload Dialog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the simple file picker with a multi-step upload dialog that uploads immediately, lets users configure extraction while OCR processes, and shows streaming extraction progress.

**Architecture:** Step-based dialog using React state machine. Uploads start on file selection (Step 1), user configures extraction method (Step 2), optionally adds custom fields (Step 3), then triggers SSE extraction. Dialog stays open until extraction completes, then navigates to document detail.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui (Dialog, Card, Input, Badge, Tooltip), Tailwind CSS, SSE streaming

---

## Task 1: Create Type Definitions

**Files:**
- Create: `frontend/components/documents/upload-dialog/types.ts`

**Step 1: Create the types file**

```typescript
// frontend/components/documents/upload-dialog/types.ts
import type { AgentEvent } from '@/lib/agent-api'

export type UploadStep = 'dropzone' | 'configure' | 'fields'

export type UploadStatus = 'idle' | 'uploading' | 'processing_ocr' | 'ready' | 'error'

export type ExtractionMethod = 'auto' | 'custom'

export type ExtractionStatus = 'idle' | 'extracting' | 'complete' | 'error'

export interface CustomField {
  name: string
  description?: string
}

export interface UploadDialogState {
  // Navigation
  step: UploadStep
  isOpen: boolean

  // From Step 1
  file: File | null
  documentId: string | null

  // Upload/OCR progress
  uploadStatus: UploadStatus
  uploadError: string | null

  // From Step 2
  extractionMethod: ExtractionMethod

  // From Step 3 (if custom)
  customFields: CustomField[]

  // Extraction progress
  extractionStatus: ExtractionStatus
  extractionError: string | null
  extractionEvents: AgentEvent[]
}

export interface UploadDialogActions {
  // Navigation
  setStep: (step: UploadStep) => void
  setOpen: (open: boolean) => void
  reset: () => void

  // Step 1
  setFile: (file: File | null) => void
  setDocumentId: (id: string | null) => void
  setUploadStatus: (status: UploadStatus) => void
  setUploadError: (error: string | null) => void

  // Step 2
  setExtractionMethod: (method: ExtractionMethod) => void

  // Step 3
  addCustomField: (field: CustomField) => void
  removeCustomField: (name: string) => void

  // Extraction
  setExtractionStatus: (status: ExtractionStatus) => void
  setExtractionError: (error: string | null) => void
  addExtractionEvent: (event: AgentEvent) => void
}
```

**Step 2: Verify file created correctly**

Run: `cat frontend/components/documents/upload-dialog/types.ts`
Expected: File contents match above

**Step 3: Commit**

```bash
git add frontend/components/documents/upload-dialog/types.ts
git commit -m "feat(upload-dialog): add type definitions for dialog state"
```

---

## Task 2: Add streamAgentExtraction to agent-api.ts

**Files:**
- Modify: `frontend/lib/agent-api.ts`

**Step 1: Add extraction tool labels to humanizeToolName**

Add these entries to the `toolLabels` object (around line 29):

```typescript
// Inside humanizeToolName function, add to toolLabels:
const toolLabels: Record<string, string> = {
  read_ocr: 'Reading OCR',
  read_extraction: 'Reading extraction',
  save_extraction: 'Saving extraction',
  set_field: 'Updating field',
  delete_field: 'Removing field',
  complete: 'Completing',
  // Add for extraction
  analyze_document: 'Analyzing document',
}
```

**Step 2: Add CustomField interface**

Add below the AgentEvent interface (after line 18):

```typescript
export interface CustomField {
  name: string
  description?: string
}
```

**Step 3: Add streamAgentExtraction function**

Add at the end of the file (after streamAgentCorrection):

```typescript
/**
 * Stream agent extraction request.
 *
 * Uses fetch + ReadableStream with proper SSE buffering.
 *
 * @param documentId - Document to extract from (must have OCR cached)
 * @param mode - "auto" or "custom"
 * @param customFields - Array of custom fields (required if mode=custom)
 * @param onEvent - Callback for each event
 * @param authToken - Clerk auth token for Authorization header
 * @param signal - AbortController signal for cancellation
 */
export async function streamAgentExtraction(
  documentId: string,
  mode: 'auto' | 'custom',
  customFields: CustomField[] | null,
  onEvent: OnEventCallback,
  authToken: string,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData()
  formData.append('document_id', documentId)
  formData.append('mode', mode)
  if (customFields && customFields.length > 0) {
    formData.append('custom_fields', JSON.stringify(customFields))
  }

  const response = await fetch(`${API_URL}/api/agent/extract`, {
    method: 'POST',
    body: formData,
    signal,
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`
    try {
      const text = await response.text()
      try {
        const errorData = JSON.parse(text)
        errorMessage = errorData.detail || errorData.message || text
      } catch {
        errorMessage = text || errorMessage
      }
    } catch {
      // Failed to read body
    }
    throw new Error(errorMessage)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      buffer += text

      const messages = buffer.split('\n\n')
      buffer = messages.pop() || ''

      for (const message of messages) {
        if (!message.trim()) continue
        const lines = message.split('\n')
        for (const line of lines) {
          processSSELine(line, onEvent)
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        processSSELine(line, onEvent)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
```

**Step 4: Verify changes compile**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors related to agent-api.ts

**Step 5: Commit**

```bash
git add frontend/lib/agent-api.ts
git commit -m "feat(upload-dialog): add streamAgentExtraction function for SSE extraction"
```

---

## Task 3: Create useUploadDialog Hook

**Files:**
- Create: `frontend/hooks/use-upload-dialog.ts`

**Step 1: Create the hook file**

```typescript
// frontend/hooks/use-upload-dialog.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { streamAgentExtraction, type AgentEvent, type CustomField } from '@/lib/agent-api'
import type {
  UploadStep,
  UploadStatus,
  ExtractionMethod,
  ExtractionStatus,
  UploadDialogState,
  UploadDialogActions,
} from '@/components/documents/upload-dialog/types'

const initialState: UploadDialogState = {
  step: 'dropzone',
  isOpen: false,
  file: null,
  documentId: null,
  uploadStatus: 'idle',
  uploadError: null,
  extractionMethod: 'auto',
  customFields: [],
  extractionStatus: 'idle',
  extractionError: null,
  extractionEvents: [],
}

export function useUploadDialog(): UploadDialogState & UploadDialogActions & {
  uploadFile: (file: File) => Promise<void>
  startExtraction: () => Promise<void>
} {
  const { getToken } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<UploadDialogState>(initialState)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Navigation actions
  const setStep = useCallback((step: UploadStep) => {
    setState((prev) => ({ ...prev, step }))
  }, [])

  const setOpen = useCallback((isOpen: boolean) => {
    setState((prev) => ({ ...prev, isOpen }))
    if (!isOpen) {
      // Reset state when dialog closes
      setState(initialState)
    }
  }, [])

  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setState(initialState)
  }, [])

  // Step 1 actions
  const setFile = useCallback((file: File | null) => {
    setState((prev) => ({ ...prev, file }))
  }, [])

  const setDocumentId = useCallback((documentId: string | null) => {
    setState((prev) => ({ ...prev, documentId }))
  }, [])

  const setUploadStatus = useCallback((uploadStatus: UploadStatus) => {
    setState((prev) => ({ ...prev, uploadStatus }))
  }, [])

  const setUploadError = useCallback((uploadError: string | null) => {
    setState((prev) => ({ ...prev, uploadError }))
  }, [])

  // Step 2 actions
  const setExtractionMethod = useCallback((extractionMethod: ExtractionMethod) => {
    setState((prev) => ({ ...prev, extractionMethod }))
  }, [])

  // Step 3 actions
  const addCustomField = useCallback((field: CustomField) => {
    setState((prev) => ({
      ...prev,
      customFields: [...prev.customFields, field],
    }))
  }, [])

  const removeCustomField = useCallback((name: string) => {
    setState((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((f) => f.name !== name),
    }))
  }, [])

  // Extraction actions
  const setExtractionStatus = useCallback((extractionStatus: ExtractionStatus) => {
    setState((prev) => ({ ...prev, extractionStatus }))
  }, [])

  const setExtractionError = useCallback((extractionError: string | null) => {
    setState((prev) => ({ ...prev, extractionError }))
  }, [])

  const addExtractionEvent = useCallback((event: AgentEvent) => {
    setState((prev) => ({
      ...prev,
      extractionEvents: [...prev.extractionEvents, event],
    }))
  }, [])

  // Upload file to backend
  const uploadFile = useCallback(async (file: File) => {
    setFile(file)
    setUploadStatus('uploading')
    setUploadError(null)
    setStep('configure')

    try {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const formData = new FormData()
      formData.append('file', file)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/document/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const data = await response.json()
      setDocumentId(data.document_id)
      setUploadStatus('ready')
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
      setUploadStatus('error')
    }
  }, [getToken, setFile, setUploadStatus, setUploadError, setStep, setDocumentId])

  // Start extraction
  const startExtraction = useCallback(async () => {
    if (!state.documentId) {
      setExtractionError('No document to extract from')
      return
    }

    setExtractionStatus('extracting')
    setExtractionError(null)
    setState((prev) => ({ ...prev, extractionEvents: [] }))

    abortControllerRef.current = new AbortController()

    const handleEvent = (event: AgentEvent) => {
      if (event.type === 'error') {
        setExtractionError(event.content)
        setExtractionStatus('error')
      } else if (event.type === 'complete') {
        setExtractionStatus('complete')
        addExtractionEvent(event)
        // Navigate to document page after a brief delay
        setTimeout(() => {
          router.push(`/documents/${state.documentId}`)
          router.refresh()
          setOpen(false)
        }, 1000)
      } else {
        addExtractionEvent(event)
      }
    }

    try {
      const token = await getToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      await streamAgentExtraction(
        state.documentId,
        state.extractionMethod,
        state.extractionMethod === 'custom' ? state.customFields : null,
        handleEvent,
        token,
        abortControllerRef.current.signal
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : 'Unknown error'
      setExtractionError(message)
      setExtractionStatus('error')
    }
  }, [
    state.documentId,
    state.extractionMethod,
    state.customFields,
    getToken,
    setExtractionStatus,
    setExtractionError,
    addExtractionEvent,
    router,
    setOpen,
  ])

  return {
    ...state,
    setStep,
    setOpen,
    reset,
    setFile,
    setDocumentId,
    setUploadStatus,
    setUploadError,
    setExtractionMethod,
    addCustomField,
    removeCustomField,
    setExtractionStatus,
    setExtractionError,
    addExtractionEvent,
    uploadFile,
    startExtraction,
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/hooks/use-upload-dialog.ts
git commit -m "feat(upload-dialog): add useUploadDialog hook with state management"
```

---

## Task 4: Create UploadStatus Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/upload-status.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/upload-status.tsx
'use client'

import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UploadStatus as UploadStatusType } from './types'

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
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Uploading document...</span>
        </>
      )}

      {status === 'processing_ocr' && (
        <>
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Processing OCR...</span>
        </>
      )}

      {status === 'ready' && (
        <>
          <Check className="size-3.5 text-green-500" />
          <span className="text-muted-foreground">Ready</span>
        </>
      )}

      {status === 'error' && (
        <>
          <X className="size-3.5 text-destructive" />
          <span className="text-destructive">{error || 'Upload failed'}</span>
        </>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/upload-status.tsx
git commit -m "feat(upload-dialog): add UploadStatus component for progress display"
```

---

## Task 5: Create ExtractionMethodCard Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/extraction-method-card.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/extraction-method-card.tsx
'use client'

import { cn } from '@/lib/utils'

interface ExtractionMethodCardProps {
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}

/**
 * Selectable card for choosing extraction method.
 * Linear-style: subtle background change when selected, no colored borders.
 */
export function ExtractionMethodCard({
  title,
  description,
  selected,
  onSelect,
}: ExtractionMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors',
        'hover:bg-accent/50',
        selected
          ? 'border-border bg-accent/70'
          : 'border-border bg-background'
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/extraction-method-card.tsx
git commit -m "feat(upload-dialog): add ExtractionMethodCard component"
```

---

## Task 6: Create FieldTagInput Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/field-tag-input.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/field-tag-input.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CustomField } from './types'

interface FieldTagInputProps {
  fields: CustomField[]
  onAdd: (field: CustomField) => void
  onRemove: (name: string) => void
}

/**
 * Tag-based input for custom fields.
 * Allows adding field name + optional description.
 * Shows badges with tooltips for descriptions.
 */
export function FieldTagInput({ fields, onAdd, onRemove }: FieldTagInputProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleAdd = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    // Check for duplicates
    if (fields.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase())) {
      return
    }

    onAdd({
      name: trimmedName,
      description: description.trim() || undefined,
    })
    setName('')
    setDescription('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-4">
      {/* Input row */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            placeholder="Field name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!name.trim()}
          >
            Add
          </Button>
        </div>
        <Input
          placeholder="Description (optional) - helps AI understand what to extract"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm"
        />
      </div>

      {/* Field badges */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((field) => (
            <FieldBadge
              key={field.name}
              field={field}
              onRemove={() => onRemove(field.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FieldBadgeProps {
  field: CustomField
  onRemove: () => void
}

function FieldBadge({ field, onRemove }: FieldBadgeProps) {
  const badge = (
    <Badge
      variant="secondary"
      className="gap-1 pr-1 cursor-default"
    >
      {field.name}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
        aria-label={`Remove ${field.name}`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  )

  // Wrap in tooltip if description exists
  if (field.description) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{field.description}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return badge
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/field-tag-input.tsx
git commit -m "feat(upload-dialog): add FieldTagInput component with badges and tooltips"
```

---

## Task 7: Create DropzoneStep Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/steps/dropzone-step.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/steps/dropzone-step.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropzoneStepProps {
  onFileSelect: (file: File) => void
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png'
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

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
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('File must be PDF, JPG, or PNG')
        return
      }

      // Check size
      if (file.size > MAX_SIZE_BYTES) {
        setError(`File must be under ${MAX_SIZE_MB}MB`)
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
        accept={ACCEPTED_EXTENSIONS}
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
          <Upload className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            Drop a file here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, JPG, PNG up to {MAX_SIZE_MB}MB
          </p>
        </div>
      </button>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/steps/dropzone-step.tsx
git commit -m "feat(upload-dialog): add DropzoneStep component with drag-drop"
```

---

## Task 8: Create ConfigureStep Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/steps/configure-step.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/steps/configure-step.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { ExtractionMethodCard } from '../extraction-method-card'
import type { ExtractionMethod } from '../types'

interface ConfigureStepProps {
  fileName: string
  extractionMethod: ExtractionMethod
  onMethodChange: (method: ExtractionMethod) => void
}

/**
 * Step 2: Configure extraction.
 * Shows file badge, stack chips (placeholder), and extraction method cards.
 */
export function ConfigureStep({
  fileName,
  extractionMethod,
  onMethodChange,
}: ConfigureStepProps) {
  return (
    <div className="space-y-6">
      {/* Selected file badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">File:</span>
        <Badge variant="outline" className="font-normal">
          {fileName}
        </Badge>
      </div>

      {/* Stack selection - placeholder */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Add to Stack</label>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className="cursor-not-allowed opacity-50"
          >
            Coming soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Stack grouping will be available in a future update
        </p>
      </div>

      {/* Extraction method */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Extraction Method</label>
        <div className="grid grid-cols-2 gap-3">
          <ExtractionMethodCard
            title="Auto Extract"
            description="AI analyzes and extracts all fields automatically"
            selected={extractionMethod === 'auto'}
            onSelect={() => onMethodChange('auto')}
          />
          <ExtractionMethodCard
            title="Custom Fields"
            description="Specify exactly which fields to extract"
            selected={extractionMethod === 'custom'}
            onSelect={() => onMethodChange('custom')}
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/steps/configure-step.tsx
git commit -m "feat(upload-dialog): add ConfigureStep component with method selection"
```

---

## Task 9: Create FieldsStep Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/steps/fields-step.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/steps/fields-step.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { FieldTagInput } from '../field-tag-input'
import type { CustomField } from '../types'

interface FieldsStepProps {
  fileName: string
  fields: CustomField[]
  onAddField: (field: CustomField) => void
  onRemoveField: (name: string) => void
}

/**
 * Step 3: Specify custom fields.
 * Shows file badge and field tag input.
 */
export function FieldsStep({
  fileName,
  fields,
  onAddField,
  onRemoveField,
}: FieldsStepProps) {
  return (
    <div className="space-y-6">
      {/* Selected file badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">File:</span>
        <Badge variant="outline" className="font-normal">
          {fileName}
        </Badge>
      </div>

      {/* Field input */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Fields to Extract</label>
          <p className="mt-1 text-xs text-muted-foreground">
            Add the fields you want to extract. Descriptions help the AI understand what to look for.
          </p>
        </div>
        <FieldTagInput
          fields={fields}
          onAdd={onAddField}
          onRemove={onRemoveField}
        />
      </div>

      {/* Helper text */}
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          Add at least one field to continue
        </p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/steps/fields-step.tsx
git commit -m "feat(upload-dialog): add FieldsStep component for custom field input"
```

---

## Task 10: Create ExtractionProgress Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/extraction-progress.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/extraction-progress.tsx
'use client'

import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentEvent } from '@/lib/agent-api'
import type { ExtractionStatus } from './types'

interface ExtractionProgressProps {
  status: ExtractionStatus
  events: AgentEvent[]
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
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm font-medium">Extracting...</span>
          </>
        )}
        {isComplete && (
          <>
            <Check className="size-4 text-green-500" />
            <span className="text-sm font-medium">Extraction complete</span>
          </>
        )}
        {isError && (
          <>
            <AlertCircle className="size-4 text-destructive" />
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
              <Check className="size-3 text-green-500 shrink-0" />
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
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/extraction-progress.tsx
git commit -m "feat(upload-dialog): add ExtractionProgress component for SSE events"
```

---

## Task 11: Create Main UploadDialog Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/upload-dialog.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/upload-dialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { DropzoneStep } from './steps/dropzone-step'
import { ConfigureStep } from './steps/configure-step'
import { FieldsStep } from './steps/fields-step'
import { UploadStatus } from './upload-status'
import { ExtractionProgress } from './extraction-progress'
import { useUploadDialog } from '@/hooks/use-upload-dialog'

/**
 * Multi-step upload dialog.
 *
 * Step 1: Dropzone - select file (upload starts immediately)
 * Step 2: Configure - choose extraction method
 * Step 3: Fields - add custom fields (if custom method selected)
 *
 * Shows upload progress and extraction streaming events.
 */
export function UploadDialog() {
  const dialog = useUploadDialog()

  const {
    isOpen,
    step,
    file,
    uploadStatus,
    uploadError,
    extractionMethod,
    customFields,
    extractionStatus,
    extractionError,
    extractionEvents,
    setOpen,
    setStep,
    setExtractionMethod,
    addCustomField,
    removeCustomField,
    uploadFile,
    startExtraction,
  } = dialog

  // Determine dialog title based on step
  const getTitle = () => {
    switch (step) {
      case 'dropzone':
        return 'Upload Document'
      case 'configure':
        return 'Configure Extraction'
      case 'fields':
        return 'Specify Fields'
      default:
        return 'Upload Document'
    }
  }

  // Can go back?
  const canGoBack = step !== 'dropzone' && extractionStatus === 'idle'

  // Handle back navigation
  const handleBack = () => {
    if (step === 'configure') {
      setStep('dropzone')
    } else if (step === 'fields') {
      setStep('configure')
    }
  }

  // Handle primary action
  const handlePrimaryAction = () => {
    if (step === 'configure') {
      if (extractionMethod === 'auto') {
        startExtraction()
      } else {
        setStep('fields')
      }
    } else if (step === 'fields') {
      startExtraction()
    }
  }

  // Determine if primary button should be disabled
  const isPrimaryDisabled = () => {
    if (uploadStatus !== 'ready') return true
    if (extractionStatus === 'extracting') return true
    if (step === 'fields' && customFields.length === 0) return true
    return false
  }

  // Get primary button text
  const getPrimaryButtonText = () => {
    if (extractionStatus === 'extracting') return 'Extracting...'
    if (step === 'configure' && extractionMethod === 'custom') return 'Next'
    return 'Extract'
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {canGoBack && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleBack}
              >
                <ChevronLeft className="size-4" />
                <span className="sr-only">Go back</span>
              </Button>
            )}
            <DialogTitle>{getTitle()}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Step content */}
        <div className="py-4">
          {step === 'dropzone' && (
            <DropzoneStep onFileSelect={uploadFile} />
          )}

          {step === 'configure' && file && (
            <ConfigureStep
              fileName={file.name}
              extractionMethod={extractionMethod}
              onMethodChange={setExtractionMethod}
            />
          )}

          {step === 'fields' && file && (
            <FieldsStep
              fileName={file.name}
              fields={customFields}
              onAddField={addCustomField}
              onRemoveField={removeCustomField}
            />
          )}

          {/* Extraction progress */}
          {extractionStatus !== 'idle' && (
            <div className="mt-4">
              <ExtractionProgress
                status={extractionStatus}
                events={extractionEvents}
                error={extractionError}
              />
            </div>
          )}
        </div>

        {/* Footer with status and action */}
        {step !== 'dropzone' && (
          <div className="flex items-center justify-between border-t pt-4">
            <UploadStatus
              status={uploadStatus}
              error={uploadError}
            />
            <Button
              onClick={handlePrimaryAction}
              disabled={isPrimaryDisabled()}
            >
              {getPrimaryButtonText()}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/upload-dialog.tsx
git commit -m "feat(upload-dialog): add main UploadDialog component with step machine"
```

---

## Task 12: Create UploadDialogTrigger Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx
'use client'

import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UploadDialogContent } from './upload-dialog-content'

interface UploadDialogTriggerProps {
  /** Use 'header' variant for smaller styling in the page header */
  variant?: 'default' | 'header'
}

/**
 * Button that opens the upload dialog.
 * Replaces the old UploadButton component.
 */
export function UploadDialogTrigger({ variant = 'default' }: UploadDialogTriggerProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant={variant === 'header' ? 'ghost' : 'default'}
          size={variant === 'header' ? 'sm' : 'default'}
          className={variant === 'header' ? 'h-7 px-2 text-xs' : undefined}
        >
          <Upload
            className={
              variant === 'header' ? 'mr-1.5 size-3.5' : 'mr-2 size-4'
            }
          />
          Upload
        </Button>
      </DialogTrigger>
      <UploadDialogContent />
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx
git commit -m "feat(upload-dialog): add UploadDialogTrigger component"
```

---

## Task 13: Create UploadDialogContent Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/upload-dialog-content.tsx`

This is needed because Dialog and its content need to share state but DialogTrigger is separate.

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/upload-dialog-content.tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DropzoneStep } from './steps/dropzone-step'
import { ConfigureStep } from './steps/configure-step'
import { FieldsStep } from './steps/fields-step'
import { UploadStatus } from './upload-status'
import { ExtractionProgress } from './extraction-progress'
import { streamAgentExtraction, type AgentEvent } from '@/lib/agent-api'
import type {
  UploadStep,
  UploadStatus as UploadStatusType,
  ExtractionMethod,
  ExtractionStatus,
  CustomField,
} from './types'

/**
 * Upload dialog content with internal state management.
 * Manages the full upload and extraction flow.
 */
export function UploadDialogContent() {
  const { getToken } = useAuth()
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)

  // State
  const [step, setStep] = useState<UploadStep>('dropzone')
  const [file, setFile] = useState<File | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatusType>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extractionMethod, setExtractionMethod] = useState<ExtractionMethod>('auto')
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle')
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [extractionEvents, setExtractionEvents] = useState<AgentEvent[]>([])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Upload file handler
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setUploadStatus('uploading')
    setUploadError(null)
    setStep('configure')

    try {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const formData = new FormData()
      formData.append('file', selectedFile)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/document/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const data = await response.json()
      setDocumentId(data.document_id)
      setUploadStatus('ready')
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
      setUploadStatus('error')
    }
  }, [getToken])

  // Start extraction
  const handleExtraction = useCallback(async () => {
    if (!documentId) {
      setExtractionError('No document to extract from')
      return
    }

    setExtractionStatus('extracting')
    setExtractionError(null)
    setExtractionEvents([])

    abortControllerRef.current = new AbortController()

    const handleEvent = (event: AgentEvent) => {
      if (event.type === 'error') {
        setExtractionError(event.content)
        setExtractionStatus('error')
      } else if (event.type === 'complete') {
        setExtractionStatus('complete')
        setExtractionEvents((prev) => [...prev, event])
        // Navigate after brief delay
        setTimeout(() => {
          router.push(`/documents/${documentId}`)
          router.refresh()
        }, 1000)
      } else {
        setExtractionEvents((prev) => [...prev, event])
      }
    }

    try {
      const token = await getToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      await streamAgentExtraction(
        documentId,
        extractionMethod,
        extractionMethod === 'custom' ? customFields : null,
        handleEvent,
        token,
        abortControllerRef.current.signal
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : 'Unknown error'
      setExtractionError(message)
      setExtractionStatus('error')
    }
  }, [documentId, extractionMethod, customFields, getToken, router])

  // Add custom field
  const handleAddField = useCallback((field: CustomField) => {
    setCustomFields((prev) => [...prev, field])
  }, [])

  // Remove custom field
  const handleRemoveField = useCallback((name: string) => {
    setCustomFields((prev) => prev.filter((f) => f.name !== name))
  }, [])

  // Navigation
  const canGoBack = step !== 'dropzone' && extractionStatus === 'idle'

  const handleBack = () => {
    if (step === 'configure') {
      setStep('dropzone')
    } else if (step === 'fields') {
      setStep('configure')
    }
  }

  const handlePrimaryAction = () => {
    if (step === 'configure') {
      if (extractionMethod === 'auto') {
        handleExtraction()
      } else {
        setStep('fields')
      }
    } else if (step === 'fields') {
      handleExtraction()
    }
  }

  const isPrimaryDisabled = () => {
    if (uploadStatus !== 'ready') return true
    if (extractionStatus === 'extracting') return true
    if (step === 'fields' && customFields.length === 0) return true
    return false
  }

  const getPrimaryButtonText = () => {
    if (extractionStatus === 'extracting') return 'Extracting...'
    if (step === 'configure' && extractionMethod === 'custom') return 'Next'
    return 'Extract'
  }

  const getTitle = () => {
    switch (step) {
      case 'dropzone':
        return 'Upload Document'
      case 'configure':
        return 'Configure Extraction'
      case 'fields':
        return 'Specify Fields'
      default:
        return 'Upload Document'
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-2">
          {canGoBack && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleBack}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Go back</span>
            </Button>
          )}
          <DialogTitle>{getTitle()}</DialogTitle>
        </div>
      </DialogHeader>

      {/* Step content */}
      <div className="py-4">
        {step === 'dropzone' && (
          <DropzoneStep onFileSelect={handleFileSelect} />
        )}

        {step === 'configure' && file && (
          <ConfigureStep
            fileName={file.name}
            extractionMethod={extractionMethod}
            onMethodChange={setExtractionMethod}
          />
        )}

        {step === 'fields' && file && (
          <FieldsStep
            fileName={file.name}
            fields={customFields}
            onAddField={handleAddField}
            onRemoveField={handleRemoveField}
          />
        )}

        {/* Extraction progress */}
        {extractionStatus !== 'idle' && (
          <div className="mt-4">
            <ExtractionProgress
              status={extractionStatus}
              events={extractionEvents}
              error={extractionError}
            />
          </div>
        )}
      </div>

      {/* Footer with status and action */}
      {step !== 'dropzone' && (
        <div className="flex items-center justify-between border-t pt-4">
          <UploadStatus
            status={uploadStatus}
            error={uploadError}
          />
          <Button
            onClick={handlePrimaryAction}
            disabled={isPrimaryDisabled()}
          >
            {getPrimaryButtonText()}
          </Button>
        </div>
      )}
    </DialogContent>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/upload-dialog-content.tsx
git commit -m "feat(upload-dialog): add UploadDialogContent with state management"
```

---

## Task 14: Create Barrel Export

**Files:**
- Create: `frontend/components/documents/upload-dialog/index.ts`

**Step 1: Create the barrel file**

```typescript
// frontend/components/documents/upload-dialog/index.ts
export { UploadDialogTrigger } from './upload-dialog-trigger'
export { UploadDialogContent } from './upload-dialog-content'
export type { CustomField, UploadStep, ExtractionMethod } from './types'
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/index.ts
git commit -m "feat(upload-dialog): add barrel export"
```

---

## Task 15: Update Documents Header to Use New Dialog

**Files:**
- Modify: `frontend/app/(app)/@header/documents/page.tsx`

**Step 1: Update the import and component**

Replace the file contents:

```typescript
// frontend/app/(app)/@header/documents/page.tsx
import { PageHeader } from '@/components/layout/page-header'
import { UploadDialogTrigger } from '@/components/documents/upload-dialog'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with Upload action.
 */
export default function DocumentsHeaderSlot() {
  return (
    <PageHeader
      actions={<UploadDialogTrigger variant="header" />}
    />
  )
}
```

**Step 2: Verify build passes**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add frontend/app/(app)/@header/documents/page.tsx
git commit -m "feat(upload-dialog): integrate UploadDialogTrigger in documents header"
```

---

## Task 16: Update Backend to Accept JSON Custom Fields

**Files:**
- Modify: `backend/app/routes/agent.py`

**Step 1: Update custom_fields parsing**

Find the section around line 75-77 where custom_fields is parsed:

```python
# Parse custom fields
fields_list: list[str] | None = None
if custom_fields:
    fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]
```

Replace with:

```python
# Parse custom fields - supports both JSON format and comma-separated
fields_list: list[dict] | list[str] | None = None
if custom_fields:
    try:
        # Try JSON format first: [{"name": "...", "description": "..."}]
        parsed = json.loads(custom_fields)
        if isinstance(parsed, list):
            fields_list = parsed
    except json.JSONDecodeError:
        # Fall back to comma-separated format for backwards compatibility
        fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]
```

**Step 2: Update the extraction agent call**

The `fields_list` will now be a list of dicts or strings. Update the agent to handle both.

In `backend/app/agents/extraction_agent/__init__.py`, find where custom_fields is used in the prompt and update to handle objects:

```python
# In the prompt building section, format fields appropriately
if custom_fields:
    fields_text = []
    for field in custom_fields:
        if isinstance(field, dict):
            name = field.get('name', '')
            desc = field.get('description', '')
            if desc:
                fields_text.append(f"- {name}: {desc}")
            else:
                fields_text.append(f"- {name}")
        else:
            fields_text.append(f"- {field}")
    fields_prompt = "\n".join(fields_text)
```

**Step 3: Verify backend starts**

Run: `cd /Users/fraserbrown/stackdocs/backend && python -c "from app.routes.agent import router; print('OK')"`
Expected: Prints "OK"

**Step 4: Commit**

```bash
git add backend/app/routes/agent.py backend/app/agents/extraction_agent/__init__.py
git commit -m "feat(upload-dialog): support JSON custom_fields with descriptions"
```

---

## Task 17: Manual Testing Checklist

**Files:** None (testing)

**Step 1: Start development servers**

```bash
# Terminal 1: Frontend
cd /Users/fraserbrown/stackdocs/frontend && npm run dev

# Terminal 2: Backend
cd /Users/fraserbrown/stackdocs/backend && uvicorn app.main:app --reload
```

**Step 2: Test the upload flow**

1. Navigate to `/documents`
2. Click the Upload button in header
3. Verify dialog opens at Step 1 (Dropzone)
4. Drag or click to select a PDF/image
5. Verify auto-advance to Step 2
6. Verify upload status shows "Uploading..." then "Ready"
7. Test "Auto Extract" - click Extract, verify SSE events show
8. Test "Custom Fields":
   - Select Custom Fields method
   - Click Next to go to Step 3
   - Add fields with descriptions
   - Verify badges show with tooltips
   - Click Extract
9. Verify navigation to document detail page after extraction

**Step 3: Test edge cases**

1. Invalid file type - should show error
2. File too large - should show error
3. Back navigation - should work correctly
4. Close dialog mid-upload - should not crash
5. Network error - should show error state

---

## Task 18: Clean Up Old UploadButton (Optional)

**Files:**
- Archive: `frontend/components/documents/upload-button.tsx`

**Step 1: Verify no other usages**

```bash
grep -r "upload-button" frontend/
grep -r "UploadButton" frontend/
```

Expected: Only the old header page import (now updated)

**Step 2: Delete or archive the file**

```bash
git rm frontend/components/documents/upload-button.tsx
```

**Step 3: Commit**

```bash
git commit -m "chore: remove deprecated UploadButton component"
```

---

## Summary

This plan creates a complete multi-step upload dialog with:

1. **Type definitions** for state management
2. **SSE streaming function** for extraction
3. **Step components**: Dropzone, Configure, Fields
4. **Helper components**: UploadStatus, ExtractionMethodCard, FieldTagInput, ExtractionProgress
5. **Main dialog** with state machine navigation
6. **Backend update** for JSON custom fields format
7. **Integration** in documents header

The dialog follows the design doc closely with Linear-style aesthetics (subtle backgrounds, no colored borders, clean typography).
