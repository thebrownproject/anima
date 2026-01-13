# Phase 3: Upload Flow Redesign

**Phase:** 3 of 5
**Depends on:** Phase 1 (Database), Phase 2 (Backend API)
**Status:** Ready to implement

## Overview

Replace the current upload flow (Dropzone -> Configure -> Fields -> Extracting -> Complete) with a new flow focused on metadata generation (Dropzone -> Processing -> Metadata -> Complete).

**Current flow:** User uploads, configures extraction method, optionally specifies fields, waits for extraction, views extracted data.

**New flow:** User uploads, waits for OCR + metadata generation, reviews/edits AI-generated metadata (display_name, tags, summary), optionally assigns to stack, saves document.

---

## Architecture Changes

### Flow Steps

| Current Step | New Step | Purpose |
|--------------|----------|---------|
| `dropzone` | `dropzone` | File selection (unchanged) |
| `configure` | `processing` | Processing state (OCR + metadata generation) |
| `fields` | `metadata` | Review/edit AI-generated metadata |
| `extracting` | (removed) | - |
| `complete` | `complete` | Success state with actions |

### State Changes

**UploadFlowStep type:**
```ts
// Current
type UploadFlowStep = 'dropzone' | 'configure' | 'fields' | 'extracting' | 'complete'

// New
type UploadFlowStep = 'dropzone' | 'processing' | 'metadata' | 'complete'
```

**UploadFlowData interface:**
```ts
// Current
interface UploadFlowData {
  file: File | null
  documentId: string | null
  documentName: string
  extractionMethod: ExtractionMethod
  customFields: CustomField[]
  uploadStatus: 'idle' | 'uploading' | 'ready' | 'error'
  uploadError: string | null
  extractionError: string | null
}

// New
interface UploadFlowData {
  file: File | null
  documentId: string | null
  // Metadata fields (AI-generated, user-editable)
  displayName: string
  tags: string[]
  summary: string
  // Optional stack assignment
  stackId: string | null
  stackName: string | null
  // Status tracking
  uploadStatus: 'idle' | 'uploading' | 'processing' | 'ready' | 'error'
  uploadError: string | null
  metadataError: string | null
}
```

---

## Tasks

### Task 1: Update Agent Store Types

**File:** `frontend/components/agent/stores/agent-store.ts`

**Changes:**
1. Update `UploadFlowStep` type to new steps
2. Update `UploadFlowData` interface to new fields
3. Update `initialUploadData` with new defaults
4. Update `getStepStatusText()` helper for new steps
5. Update `getUploadTitle()` helper for new steps

**Code changes:**

```ts
// Line ~10: Update step type
export type UploadFlowStep = 'dropzone' | 'processing' | 'metadata' | 'complete'

// Line ~27-36: Update data interface
export interface UploadFlowData {
  file: File | null
  documentId: string | null
  displayName: string
  tags: string[]
  summary: string
  stackId: string | null
  stackName: string | null
  uploadStatus: 'idle' | 'uploading' | 'processing' | 'ready' | 'error'
  uploadError: string | null
  metadataError: string | null
}

// Line ~66-75: Update initial data
export const initialUploadData: UploadFlowData = {
  file: null,
  documentId: null,
  displayName: '',
  tags: [],
  summary: '',
  stackId: null,
  stackName: null,
  uploadStatus: 'idle',
  uploadError: null,
  metadataError: null,
}

// Line ~178-187: Update status text helper
if (flowType === 'upload') {
  switch (step) {
    case 'dropzone': return 'Drop a file to get started'
    case 'processing': return 'Analyzing document...'
    case 'metadata': return 'Review document details'
    case 'complete': return 'Document saved'
  }
}

// Line ~194-201: Update title helper
export function getUploadTitle(step: UploadFlowStep): string {
  switch (step) {
    case 'dropzone': return 'Upload Document'
    case 'processing': return 'Processing'
    case 'metadata': return 'Document Details'
    case 'complete': return 'Complete'
  }
}
```

**Step 1b: Remove unused imports**

The old upload flow used `CustomField` and `ExtractionMethod` types. Remove these imports:

```ts
// REMOVE this import (around line 7):
import type { CustomField, ExtractionMethod } from '@/types/upload'
```

**Acceptance criteria:**
- [ ] TypeScript compiles with no errors
- [ ] New step types match design doc
- [ ] Initial data has sensible defaults
- [ ] No unused imports remaining

---

### Task 2: Add Metadata API Helper

**File:** `frontend/lib/agent-api.ts`

**Purpose:** Add function to call `POST /api/document/metadata` endpoint with SSE streaming.

**Add after `streamAgentExtraction` function (~line 282):**

```ts
/**
 * Stream document metadata generation.
 *
 * Calls the backend to generate AI metadata (display_name, tags, summary)
 * for a document that has completed OCR.
 *
 * @param documentId - Document to generate metadata for
 * @param onEvent - Callback for each SSE event
 * @param authToken - Clerk auth token
 * @param signal - AbortController signal for cancellation
 */
export async function streamDocumentMetadata(
  documentId: string,
  onEvent: OnEventCallback,
  authToken: string,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData()
  formData.append('document_id', documentId)

  const response = await fetch(`${API_URL}/api/document/metadata`, {
    method: 'POST',
    body: formData,
    signal,
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await getResponseError(response))
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

**Also update `humanizeToolName` (~line 26) to add metadata agent tools:**

```ts
const toolLabels: Record<string, string> = {
  // ... existing tools ...
  // Metadata agent tools
  generate_metadata: 'Generating metadata',
  save_metadata: 'Saving metadata',
}
```

**Acceptance criteria:**
- [ ] Function follows same pattern as `streamAgentExtraction`
- [ ] Proper error handling and cleanup
- [ ] Tool names humanized for status display

---

### Task 3: Create Processing Step Component

**File:** `frontend/components/agent/flows/documents/upload/steps/upload-processing.tsx` (new file)

**Purpose:** Show processing state while OCR and metadata generation run. Similar to current `upload-extracting.tsx` but for metadata generation.

```tsx
// frontend/components/agent/flows/documents/upload/steps/upload-processing.tsx
'use client'

import { useMemo } from 'react'
import * as Icons from '@/components/icons'
import { useAgentEvents } from '../../../../stores/agent-store'

export function UploadProcessing() {
  const events = useAgentEvents()
  const toolEvents = useMemo(
    () => events.filter((e) => e.type === 'tool'),
    [events]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span>Analyzing document...</span>
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
```

**Acceptance criteria:**
- [ ] Shows spinner with "Analyzing document..." message
- [ ] Displays tool events as they arrive (OCR, metadata generation)
- [ ] Matches existing extracting step visual style

---

### Task 4: Create Metadata Step Component

**File:** `frontend/components/agent/flows/documents/upload/steps/upload-metadata.tsx` (new file)

**Purpose:** Review and edit AI-generated metadata before saving. This is the core new component.

**UI mockup from design doc:**
```
+--------------------------------------------------+
| Document Details                                  |
|                                                   |
| Name                                              |
| [Invoice - Acme Corp - March 2026.pdf       ]    |
|                                                   |
| Tags                                              |
| [invoice] [acme-corp] [$1,250] [+]               |
|                                                   |
| Summary                                           |
| +-----------------------------------------------+|
| | Monthly consulting invoice from Acme Corp     ||
| | dated March 15, 2026 for $1,250.00           ||
| +-----------------------------------------------+|
|                                                   |
| Add to Stack (optional)                           |
| [Select a stack...                          v]   |
|                                                   |
|              [Regenerate]  [Save Document]        |
+--------------------------------------------------+
```

```tsx
// frontend/components/agent/flows/documents/upload/steps/upload-metadata.tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StackPickerContent } from '@/components/shared/stack-picker-content'
import * as Icons from '@/components/icons'
import type { UploadFlowData } from '../../../../stores/agent-store'

interface UploadMetadataProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onSave: () => void
  onRegenerate: () => void
  isSaving: boolean
  isRegenerating: boolean
}

export function UploadMetadata({
  data,
  onUpdate,
  onSave,
  onRegenerate,
  isSaving,
  isRegenerating,
}: UploadMetadataProps) {
  const [newTag, setNewTag] = useState('')
  const [stackPickerOpen, setStackPickerOpen] = useState(false)

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase()
    if (tag && !data.tags.includes(tag)) {
      onUpdate({ tags: [...data.tags, tag] })
    }
    setNewTag('')
  }, [newTag, data.tags, onUpdate])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    onUpdate({ tags: data.tags.filter((t) => t !== tagToRemove) })
  }, [data.tags, onUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }, [handleAddTag])

  const handleSelectStack = useCallback((stackId: string, stackName: string) => {
    // Toggle: if same stack selected, deselect
    if (data.stackId === stackId) {
      onUpdate({ stackId: null, stackName: null })
    } else {
      onUpdate({ stackId, stackName })
    }
    setStackPickerOpen(false)
  }, [data.stackId, onUpdate])

  const handleClearStack = useCallback(() => {
    onUpdate({ stackId: null, stackName: null })
  }, [onUpdate])

  return (
    <div className="space-y-4">
      {/* Display Name */}
      <div className="space-y-1.5">
        <label htmlFor="display-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="display-name"
          value={data.displayName}
          onChange={(e) => onUpdate({ displayName: e.target.value })}
          placeholder="Document name"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${tag} tag`}
              >
                <Icons.X className="size-3" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add tag..."
              className="h-6 w-24 text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              aria-label="Add tag"
            >
              <Icons.Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <label htmlFor="summary" className="text-sm font-medium">
          Summary
        </label>
        <Textarea
          id="summary"
          value={data.summary}
          onChange={(e) => onUpdate({ summary: e.target.value })}
          placeholder="Brief description of the document"
          className="min-h-16 resize-none"
          rows={2}
        />
      </div>

      {/* Stack Assignment */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Add to Stack <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        {data.stackId ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Icons.Stack className="size-3" />
              {data.stackName}
              <button
                type="button"
                onClick={handleClearStack}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label="Remove stack assignment"
              >
                <Icons.X className="size-3" />
              </button>
            </Badge>
          </div>
        ) : (
          <DropdownMenu open={stackPickerOpen} onOpenChange={setStackPickerOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="text-muted-foreground">Select a stack...</span>
                <Icons.ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              <StackPickerContent
                onSelectStack={handleSelectStack}
                isOpen={stackPickerOpen}
                showStackIcon
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Error display */}
      {data.metadataError && (
        <p className="text-sm text-destructive">{data.metadataError}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onRegenerate}
          disabled={isRegenerating || isSaving}
        >
          {isRegenerating ? (
            <>
              <Icons.Loader2 className="size-4 animate-spin mr-2" />
              Regenerating...
            </>
          ) : (
            <>
              <Icons.Refresh className="size-4 mr-2" />
              Regenerate
            </>
          )}
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving || isRegenerating || !data.displayName.trim()}
        >
          {isSaving ? (
            <>
              <Icons.Loader2 className="size-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Document'
          )}
        </Button>
      </div>
    </div>
  )
}
```

**Acceptance criteria:**
- [ ] Editable display name input
- [ ] Tag list with add/remove functionality
- [ ] Editable summary textarea
- [ ] Optional stack picker dropdown (uses existing `StackPickerContent`)
- [ ] Regenerate button to re-run metadata generation
- [ ] Save button with loading state
- [ ] Error display for metadata errors
- [ ] Proper form accessibility (labels, aria attributes)

---

### Task 5: Update Complete Step Component

**File:** `frontend/components/agent/flows/documents/upload/steps/upload-complete.tsx`

**Changes:**
1. Update success message (no longer mentions "extraction")
2. Change "View Document" to "Done" (navigates to documents list)
3. Keep "Upload Another" button

```tsx
// frontend/components/agent/flows/documents/upload/steps/upload-complete.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'

interface UploadCompleteProps {
  documentName: string
  onDone: () => void
  onUploadAnother: () => void
}

export function UploadComplete({
  documentName,
  onDone,
  onUploadAnother,
}: UploadCompleteProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Check className="size-4 text-green-500" />
        <span>Document saved: {documentName}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onUploadAnother}>
          Upload Another
        </Button>
        <Button onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}
```

**Acceptance criteria:**
- [ ] Success message says "Document saved" not "extracted"
- [ ] "Done" button closes flow and stays on documents page
- [ ] "Upload Another" resets flow to dropzone

---

### Task 6: Update Steps Index Export

**File:** `frontend/components/agent/flows/documents/upload/steps/index.ts`

**Changes:**
1. Remove exports for `UploadConfigure`, `UploadFields`, `UploadExtracting`
2. Add exports for `UploadProcessing`, `UploadMetadata`

```ts
// frontend/components/agent/flows/documents/upload/steps/index.ts
export { UploadDropzone } from './upload-dropzone'
export { UploadProcessing } from './upload-processing'
export { UploadMetadata } from './upload-metadata'
export { UploadComplete } from './upload-complete'
```

**Note:** Do not delete the old files yet - they can be deleted in Phase 5 cleanup.

**Acceptance criteria:**
- [ ] Only new step components exported
- [ ] TypeScript finds all exports correctly

---

### Task 7: Update Flow Metadata

**File:** `frontend/components/agent/flows/documents/upload/metadata.ts`

**Changes:**
1. Update steps array to new flow
2. Update icons for each step
3. Update status text for each step
4. Update component mapping
5. Update backable/confirmation steps

```ts
// frontend/components/agent/flows/documents/upload/metadata.ts
import * as Icons from '@/components/icons'
import type { FlowMetadata } from '../../types'
import type { UploadFlowStep } from '../../../stores/agent-store'

import {
  UploadDropzone,
  UploadProcessing,
  UploadMetadata,
  UploadComplete,
} from './steps'

export const uploadFlowMetadata: FlowMetadata<UploadFlowStep> = {
  type: 'upload',

  steps: ['dropzone', 'processing', 'metadata', 'complete'] as const,

  icons: {
    dropzone: Icons.Upload,
    processing: Icons.Loader2,
    metadata: Icons.FileText,
    complete: Icons.Check,
  },

  statusText: {
    dropzone: 'Drop a file to get started',
    processing: 'Analyzing document...',
    metadata: 'Review document details',
    complete: 'Document saved',
  },

  minimizedText: 'Continue file upload...',

  components: {
    dropzone: UploadDropzone,
    processing: UploadProcessing,
    metadata: UploadMetadata,
    complete: UploadComplete,
  },

  backableSteps: [] as const, // No back navigation in new flow

  confirmationSteps: ['processing'] as const, // Only confirm close during processing
}
```

**Acceptance criteria:**
- [ ] Steps array matches new flow
- [ ] Icons appropriate for each step
- [ ] Status text matches design doc
- [ ] Components correctly mapped
- [ ] Confirmation only during processing step

---

### Task 8: Rewrite Upload Flow Hook

**File:** `frontend/components/agent/flows/documents/upload/use-upload-flow.ts`

**Changes:**
This is a significant rewrite. The new flow:

1. **Dropzone** - User selects file
2. **handleFileSelect** - Upload to storage, wait for OCR, call metadata API
3. **Processing** - Show progress while OCR + metadata runs
4. **Metadata** - User reviews/edits metadata, optionally assigns stack
5. **handleSave** - Save metadata to database
6. **handleRegenerate** - Re-run metadata generation
7. **Complete** - Show success, offer to upload another or done

```ts
// frontend/components/agent/flows/documents/upload/use-upload-flow.ts
'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import {
  useAgentStore,
  useAgentFlow,
  type UploadFlowStep,
  type UploadFlowData,
} from '../../../stores/agent-store'
import { streamDocumentMetadata, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'
import { createClerkSupabaseClient } from '@/lib/supabase'
import { useSupabase } from '@/hooks/use-supabase'
import type { FlowHookResult } from '../../types'

export interface UploadFlowStepProps {
  dropzone: {
    onFileSelect: (file: File) => void
  }
  processing: Record<string, never>
  metadata: {
    data: UploadFlowData
    onUpdate: (data: Partial<UploadFlowData>) => void
    onSave: () => void
    onRegenerate: () => void
    isSaving: boolean
    isRegenerating: boolean
  }
  complete: {
    documentName: string
    onDone: () => void
    onUploadAnother: () => void
  }
}

export function useUploadFlow(): FlowHookResult<UploadFlowStep> & {
  stepProps: UploadFlowStepProps
} {
  const { getToken } = useAuth()
  const router = useRouter()
  const supabase = useSupabase()
  const flow = useAgentFlow()
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const actions = useAgentStore(
    useShallow((s) => ({
      setStep: s.setStep,
      updateFlowData: s.updateFlowData,
      setStatus: s.setStatus,
      addEvent: s.addEvent,
      collapse: s.collapse,
      close: s.close,
    }))
  )

  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  const step = (flow?.type === 'upload' ? flow.step : 'dropzone') as UploadFlowStep
  const data = (flow?.type === 'upload' ? flow.data : {}) as UploadFlowData

  const { setStep, updateFlowData, setStatus, addEvent, collapse, close } = actions

  // Generate metadata via SSE stream
  // Note: The backend agent writes metadata directly to the database via save_metadata tool.
  // After completion, we fetch the updated document to get the generated metadata.
  const generateMetadata = useCallback(async (documentId: string) => {
    const handleEvent = (event: AgentEvent) => {
      addEvent(event)
      if (event.type === 'tool') {
        setStatus('processing', event.content)
      } else if (event.type === 'error') {
        updateFlowData({ metadataError: event.content })
        setStatus('error', event.content)
        // Still advance to metadata step so user can manually edit or retry
        setStep('metadata')
      }
      // Note: 'text' events are Claude's responses, not metadata.
      // Metadata is written to DB by the agent, fetched below after complete.
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      await streamDocumentMetadata(
        documentId,
        handleEvent,
        token,
        abortControllerRef.current.signal
      )

      // After agent completes, fetch the updated document to get metadata
      const supabase = createClerkSupabaseClient(getToken)
      const { data: doc } = await supabase
        .from('documents')
        .select('display_name, tags, summary')
        .eq('id', documentId)
        .single()

      if (doc) {
        updateFlowData({
          displayName: doc.display_name || '',
          tags: doc.tags || [],
          summary: doc.summary || '',
        })
      }

      setStep('metadata')
      setStatus('idle', 'Review document details')

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Metadata generation failed'
      updateFlowData({ metadataError: message })
      setStatus('error', message)
      setStep('metadata')
    }
  }, [getToken, addEvent, setStatus, setStep, updateFlowData])

  // Handle file selection - upload then generate metadata
  const handleFileSelect = useCallback(async (file: File) => {
    updateFlowData({
      file,
      displayName: file.name.replace(/\.[^/.]+$/, ''), // Strip extension for default name
      uploadStatus: 'uploading',
      uploadError: null,
      metadataError: null,
    })
    setStep('processing')
    setStatus('processing', 'Uploading document...')
    collapse()

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/document/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(getUploadErrorMessage(response.status, error.detail))
      }

      const result = await response.json()
      updateFlowData({
        documentId: result.document_id,
        uploadStatus: 'processing',
      })
      setStatus('processing', 'Analyzing document...')

      // Now generate metadata
      await generateMetadata(result.document_id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      updateFlowData({ uploadStatus: 'error', uploadError: message })
      setStatus('error', message)
    }
  }, [getToken, updateFlowData, setStep, setStatus, collapse, generateMetadata])

  // Regenerate metadata
  const handleRegenerate = useCallback(async () => {
    if (!data.documentId) return

    setIsRegenerating(true)
    updateFlowData({ metadataError: null })
    setStatus('processing', 'Regenerating metadata...')

    await generateMetadata(data.documentId)
    setIsRegenerating(false)
  }, [data.documentId, generateMetadata, setStatus, updateFlowData])

  // Save metadata to database
  const handleSave = useCallback(async () => {
    if (!data.documentId) return

    setIsSaving(true)
    setStatus('processing', 'Saving document...')

    try {
      // Update document with metadata
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          display_name: data.displayName.trim() || null,
          tags: data.tags.length > 0 ? data.tags : null,
          summary: data.summary.trim() || null,
        })
        .eq('id', data.documentId)

      if (updateError) throw updateError

      // If stack selected, add to stack
      if (data.stackId) {
        const { error: stackError } = await supabase
          .from('stack_documents')
          .insert({
            stack_id: data.stackId,
            document_id: data.documentId,
          })

        // Ignore duplicate error (document already in stack)
        if (stackError && !stackError.message.includes('duplicate')) {
          console.error('Failed to add to stack:', stackError)
        }
      }

      updateFlowData({ uploadStatus: 'ready' })
      setStep('complete')
      setStatus('complete', 'Document saved')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed'
      updateFlowData({ metadataError: message })
      setStatus('error', message)
    } finally {
      setIsSaving(false)
    }
  }, [data, supabase, updateFlowData, setStep, setStatus])

  // Done - close flow and refresh page
  const handleDone = useCallback(() => {
    close()
    router.refresh()
  }, [close, router])

  // Upload another - reset flow
  const handleUploadAnother = useCallback(() => {
    updateFlowData({
      file: null,
      documentId: null,
      displayName: '',
      tags: [],
      summary: '',
      stackId: null,
      stackName: null,
      uploadStatus: 'idle',
      uploadError: null,
      metadataError: null,
    })
    setStep('dropzone')
    setStatus('idle', 'Drop a file to get started')
  }, [updateFlowData, setStep, setStatus])

  // No back navigation in new flow
  const handleBack = useCallback(() => {}, [])

  const stepProps: UploadFlowStepProps = {
    dropzone: {
      onFileSelect: handleFileSelect,
    },
    processing: {},
    metadata: {
      data,
      onUpdate: updateFlowData,
      onSave: handleSave,
      onRegenerate: handleRegenerate,
      isSaving,
      isRegenerating,
    },
    complete: {
      documentName: data.displayName || 'Document',
      onDone: handleDone,
      onUploadAnother: handleUploadAnother,
    },
  }

  return {
    step,
    canGoBack: false, // No back in new flow
    needsConfirmation: step === 'processing',
    onBack: handleBack,
    stepProps,
  }
}
```

**Acceptance criteria:**
- [ ] File upload triggers OCR + metadata generation
- [ ] Processing step shows progress from SSE events
- [ ] Metadata step receives AI-generated values
- [ ] Regenerate re-runs metadata generation
- [ ] Save writes to documents table + optional stack_documents
- [ ] Done closes flow and refreshes page
- [ ] Upload Another resets state
- [ ] Proper abort controller cleanup

---

### Task 9: Delete Old Step Components

**Files to delete:**
- `frontend/components/agent/flows/documents/upload/steps/upload-configure.tsx`
- `frontend/components/agent/flows/documents/upload/steps/upload-fields.tsx`
- `frontend/components/agent/flows/documents/upload/steps/upload-extracting.tsx`
- `frontend/components/agent/flows/documents/upload/steps/extraction-method-card.tsx`
- `frontend/components/agent/flows/documents/upload/steps/field-tag-input.tsx`

**Note:** Only delete after verifying the build passes with new components.

**Acceptance criteria:**
- [ ] All old step files removed
- [ ] No imports reference deleted files
- [ ] Build passes

---

### Task 10: Add Missing Icon Exports

**File:** `frontend/components/icons/index.ts`

**Verify these icons are exported (add if missing):**
- `Refresh` - for regenerate button
- `X` - for removing tags/stack
- `Plus` - for adding tags
- `ChevronDown` - for stack dropdown
- `FileText` - for metadata step icon

Check the existing barrel export and add any that are missing.

**Acceptance criteria:**
- [ ] All icons used in new components are exported
- [ ] TypeScript finds all icon imports

---

## Testing

### Manual Testing Checklist

1. **Upload Flow**
   - [ ] Drop a PDF file
   - [ ] See "Uploading document..." status
   - [ ] See "Analyzing document..." with tool events
   - [ ] Arrive at metadata step with pre-filled values

2. **Metadata Editing**
   - [ ] Edit display name
   - [ ] Add a new tag
   - [ ] Remove an existing tag
   - [ ] Edit summary
   - [ ] Select a stack from dropdown
   - [ ] Remove stack selection

3. **Regenerate**
   - [ ] Click Regenerate button
   - [ ] See loading state
   - [ ] Values update with new AI-generated content

4. **Save**
   - [ ] Click Save Document
   - [ ] See loading state
   - [ ] Arrive at complete step
   - [ ] Verify document in database has metadata

5. **Complete Actions**
   - [ ] "Upload Another" returns to dropzone
   - [ ] "Done" closes card and stays on page

6. **Error Handling**
   - [ ] Network error during upload shows error message
   - [ ] Metadata generation failure shows error but allows manual editing
   - [ ] Save failure shows error message

---

## Dependencies

This phase requires:
- Phase 1 (Database): `display_name`, `tags`, `summary` columns on `documents` table
- Phase 2 (Backend): `POST /api/document/metadata` endpoint operational

If implementing before Phase 2 is complete, the metadata step will show errors but should still allow manual entry and saving.

---

## Files Modified

| File | Change |
|------|--------|
| `frontend/components/agent/stores/agent-store.ts` | Update types and helpers |
| `frontend/lib/agent-api.ts` | Add `streamDocumentMetadata` function |
| `frontend/components/agent/flows/documents/upload/steps/upload-processing.tsx` | New file |
| `frontend/components/agent/flows/documents/upload/steps/upload-metadata.tsx` | New file |
| `frontend/components/agent/flows/documents/upload/steps/upload-complete.tsx` | Update props and messaging |
| `frontend/components/agent/flows/documents/upload/steps/index.ts` | Update exports |
| `frontend/components/agent/flows/documents/upload/metadata.ts` | Update flow config |
| `frontend/components/agent/flows/documents/upload/use-upload-flow.ts` | Rewrite flow logic |
| `frontend/components/icons/index.ts` | Add any missing icons |

**Files to delete:**
| File |
|------|
| `frontend/components/agent/flows/documents/upload/steps/upload-configure.tsx` |
| `frontend/components/agent/flows/documents/upload/steps/upload-fields.tsx` |
| `frontend/components/agent/flows/documents/upload/steps/upload-extracting.tsx` |
| `frontend/components/agent/flows/documents/upload/steps/extraction-method-card.tsx` |
| `frontend/components/agent/flows/documents/upload/steps/field-tag-input.tsx` |
