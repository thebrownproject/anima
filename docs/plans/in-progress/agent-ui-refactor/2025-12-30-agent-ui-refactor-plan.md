# Agent UI Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate fragmented AI UI (chat bar, upload dialog, activity panel) into a unified "Dynamic Island" style agent system with a morphing chat bar and contextual popup.

**Architecture:** Zustand store with discriminated unions for type-safe flow routing. AgentBar renders status dynamically based on state. AgentPopup appears above bar when flow is active. All existing upload dialog logic migrates into UploadFlow component.

**Tech Stack:** Zustand (state), shadcn/ui (components), Tabler Icons (via barrel), existing agent-api.ts (SSE streaming)

---

## Phase 1: Foundation

### Task 1.1: Create Agent Store

**Files:**
- Create: `frontend/components/agent/stores/agent-store.ts`

**Step 1: Create store file with Zustand**

```typescript
// frontend/components/agent/stores/agent-store.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { AgentEvent } from '@/lib/agent-api'
import type { CustomField, ExtractionMethod } from '@/types/upload'

// Discriminated union for type-safe flow routing
export type AgentFlow =
  // Document flows
  | { type: 'upload'; step: 'dropzone' | 'configure' | 'fields' | 'extracting' | 'complete'; data: UploadFlowData }
  | { type: 'extract-document'; documentId: string }
  // Stack flows (post-MVP)
  | { type: 'create-stack' }
  | { type: 'edit-stack'; stackId: string }
  | { type: 'add-documents'; stackId: string }
  // Table flows (post-MVP)
  | { type: 'create-table'; stackId: string }
  | { type: 'manage-columns'; stackId: string; tableId: string }
  | { type: 'extract-table'; stackId: string; tableId: string }
  | null

export interface UploadFlowData {
  file: File | null
  documentId: string | null
  documentName: string
  extractionMethod: ExtractionMethod
  customFields: CustomField[]
  uploadStatus: 'idle' | 'uploading' | 'ready' | 'error'
  uploadError: string | null
  extractionError: string | null
}

export type AgentStatus = 'idle' | 'processing' | 'waiting' | 'complete' | 'error'

interface AgentStore {
  // Popup state
  flow: AgentFlow
  isExpanded: boolean  // Actions visible in bar
  isPopupOpen: boolean // Popup visible

  // Dynamic bar state
  status: AgentStatus
  statusText: string

  // SSE events (capped at 100)
  events: AgentEvent[]

  // Actions
  openFlow: (flow: NonNullable<AgentFlow>) => void
  setStep: <T extends AgentFlow>(step: T extends { step: string } ? T['step'] : never) => void
  updateFlowData: (data: Partial<UploadFlowData>) => void
  setStatus: (status: AgentStatus, text: string) => void
  addEvent: (event: AgentEvent) => void
  setExpanded: (expanded: boolean) => void
  collapsePopup: () => void
  expandPopup: () => void
  close: () => void
  reset: () => void
}

const initialUploadData: UploadFlowData = {
  file: null,
  documentId: null,
  documentName: '',
  extractionMethod: 'auto',
  customFields: [],
  uploadStatus: 'idle',
  uploadError: null,
  extractionError: null,
}

export const useAgentStore = create<AgentStore>()(
  devtools(
    (set, get) => ({
      flow: null,
      isExpanded: false,
      isPopupOpen: false,
      status: 'idle',
      statusText: 'How can I help you today?',
      events: [],

      openFlow: (flow) => set({
        flow,
        isPopupOpen: true,
        status: 'idle',
        statusText: getFlowStatusText(flow),
        events: [],
      }, undefined, 'agent/openFlow'),

      setStep: (step) => set((state) => {
        if (!state.flow || !('step' in state.flow)) return state
        return {
          flow: { ...state.flow, step } as AgentFlow,
          statusText: getStepStatusText(state.flow.type, step),
        }
      }, undefined, 'agent/setStep'),

      updateFlowData: (data) => set((state) => {
        if (!state.flow || state.flow.type !== 'upload') return state
        return {
          flow: {
            ...state.flow,
            data: { ...state.flow.data, ...data },
          },
        }
      }, undefined, 'agent/updateFlowData'),

      setStatus: (status, statusText) => set({ status, statusText }, undefined, 'agent/setStatus'),

      addEvent: (event) => set((state) => ({
        events: [...state.events, event].slice(-100), // Cap at 100
      }), undefined, 'agent/addEvent'),

      setExpanded: (isExpanded) => set({ isExpanded }, undefined, 'agent/setExpanded'),

      collapsePopup: () => set({ isPopupOpen: false }, undefined, 'agent/collapsePopup'),

      expandPopup: () => set({ isPopupOpen: true }, undefined, 'agent/expandPopup'),

      close: () => set({
        flow: null,
        isPopupOpen: false,
        status: 'idle',
        statusText: 'How can I help you today?',
        events: [],
      }, undefined, 'agent/close'),

      reset: () => set({
        flow: null,
        isPopupOpen: false,
        isExpanded: false,
        status: 'idle',
        statusText: 'How can I help you today?',
        events: [],
      }, undefined, 'agent/reset'),
    }),
    { name: 'AgentStore', enabled: process.env.NODE_ENV !== 'production' }
  )
)

// Helper functions for status text
function getFlowStatusText(flow: NonNullable<AgentFlow>): string {
  switch (flow.type) {
    case 'upload': return 'Drop a file to get started'
    case 'create-stack': return 'Create a new stack'
    default: return 'How can I help you today?'
  }
}

function getStepStatusText(flowType: string, step: string): string {
  if (flowType === 'upload') {
    switch (step) {
      case 'dropzone': return 'Drop a file to get started'
      case 'configure': return 'Configure extraction settings'
      case 'fields': return 'Specify fields to extract'
      case 'extracting': return 'Extracting...'
      case 'complete': return 'Extraction complete'
      default: return 'How can I help you today?'
    }
  }
  return 'How can I help you today?'
}

// Selector helpers (prevent unnecessary re-renders)
export const useAgentFlow = () => useAgentStore((s) => s.flow)
export const useAgentStatus = () => useAgentStore((s) => ({ status: s.status, statusText: s.statusText }))
export const useAgentPopup = () => useAgentStore((s) => ({ isPopupOpen: s.isPopupOpen, isExpanded: s.isExpanded }))
export const useAgentEvents = () => useAgentStore((s) => s.events)
```

**Step 2: Verify store compiles**

Run: `npx tsc --noEmit frontend/components/agent/stores/agent-store.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/stores/agent-store.ts
git commit -m "feat(agent): add Zustand store with discriminated union flows"
```

---

### Task 1.2: Create Agent Bar Component

**Files:**
- Create: `frontend/components/agent/agent-bar.tsx`

**Step 1: Create the dynamic agent bar**

```typescript
// frontend/components/agent/agent-bar.tsx
'use client'

import { useCallback, useState } from 'react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentStatus, useAgentPopup } from './stores/agent-store'
import { AgentActions } from './agent-actions'

interface AgentBarProps {
  className?: string
}

export function AgentBar({ className }: AgentBarProps) {
  const [message, setMessage] = useState('')
  const { status, statusText } = useAgentStatus()
  const { isExpanded, isPopupOpen } = useAgentPopup()
  const setExpanded = useAgentStore((s) => s.setExpanded)
  const expandPopup = useAgentStore((s) => s.expandPopup)
  const flow = useAgentStore((s) => s.flow)

  const isDisabled = status === 'processing'
  const showActions = isExpanded && !flow // Only show actions when no flow is active

  const handleFocus = useCallback(() => {
    setExpanded(true)
  }, [setExpanded])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Don't collapse if focus moves within the bar
    if (e.currentTarget.contains(e.relatedTarget)) return
    setExpanded(false)
  }, [setExpanded])

  const handleExpandClick = useCallback(() => {
    if (flow) {
      expandPopup()
    }
  }, [flow, expandPopup])

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return
    // TODO: Natural language processing (post-MVP)
    setMessage('')
  }, [message, isDisabled])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isDisabled) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Status icon based on current state
  const StatusIcon = getStatusIcon(status)
  const statusIconClass = getStatusIconClass(status)

  return (
    <div
      className={cn('relative', className)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div
        className={cn(
          'flex flex-col',
          'bg-sidebar border rounded-xl shadow-md',
          'transition-colors duration-150',
          'hover:border-muted-foreground/30',
          'focus-within:border-muted-foreground/30',
          isDisabled && 'opacity-50'
        )}
      >
        {/* Action buttons - shown when expanded and no flow active */}
        {showActions && (
          <div className="px-3 pt-3 pb-1">
            <AgentActions />
          </div>
        )}

        {/* Main input row */}
        <div className="flex items-center pl-[30px] pr-3.5 py-3">
          <StatusIcon
            className={cn(
              'size-4 transition-colors shrink-0',
              statusIconClass,
              status === 'processing' && 'animate-spin'
            )}
          />
          <Tooltip delayDuration={500} open={!message ? undefined : false}>
            <TooltipTrigger asChild>
              <Input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={statusText}
                aria-label="AI chat input"
                disabled={isDisabled}
                className="flex-1 border-none !bg-transparent shadow-none focus-visible:ring-0 !text-base text-foreground placeholder:text-muted-foreground -ml-1"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={8}
              className="text-center max-w-[280px]"
            >
              Ask your AI agent to help with documents
            </TooltipContent>
          </Tooltip>

          {/* Expand/Send button */}
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                onClick={message.trim() ? handleSubmit : handleExpandClick}
                disabled={isDisabled && !flow}
                className="size-8 rounded-full shrink-0"
                aria-label={message.trim() ? 'Send message' : 'Expand'}
              >
                {message.trim() ? (
                  <Icons.ArrowUp className="size-5" />
                ) : (
                  <Icons.ChevronUp className={cn(
                    'size-5 transition-transform',
                    isPopupOpen && 'rotate-180'
                  )} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {message.trim() ? 'Send message' : (isPopupOpen ? 'Collapse' : 'Expand')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'processing': return Icons.Loader2
    case 'waiting': return Icons.QuestionMark
    case 'complete': return Icons.Check
    case 'error': return Icons.X
    default: return Icons.Stack
  }
}

function getStatusIconClass(status: string) {
  switch (status) {
    case 'processing': return 'text-muted-foreground'
    case 'complete': return 'text-green-500'
    case 'error': return 'text-destructive'
    default: return 'text-muted-foreground group-hover:text-foreground group-focus-within:text-foreground'
  }
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit frontend/components/agent/agent-bar.tsx`
Expected: May fail due to missing AgentActions (created next)

**Step 3: Commit (after Task 1.3)**

---

### Task 1.3: Create Agent Actions Component

**Files:**
- Create: `frontend/components/agent/agent-actions.tsx`

**Step 1: Create context-aware action buttons**

```typescript
// frontend/components/agent/agent-actions.tsx
'use client'

import { usePathname } from 'next/navigation'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, type AgentFlow, type UploadFlowData } from './stores/agent-store'

interface ActionDef {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  flow: NonNullable<AgentFlow>
  tooltip?: string
}

const initialUploadData: UploadFlowData = {
  file: null,
  documentId: null,
  documentName: '',
  extractionMethod: 'auto',
  customFields: [],
  uploadStatus: 'idle',
  uploadError: null,
  extractionError: null,
}

// Actions by route pattern
const ACTION_CONFIG: Record<string, ActionDef[]> = {
  '/documents': [
    {
      id: 'upload',
      label: 'Upload',
      icon: Icons.Upload,
      flow: { type: 'upload', step: 'dropzone', data: initialUploadData },
      tooltip: 'Upload a new document',
    },
    {
      id: 'create-stack',
      label: 'Create Stack',
      icon: Icons.Stack,
      flow: { type: 'create-stack' },
      tooltip: 'Create a new document stack',
    },
  ],
  '/stacks': [
    {
      id: 'create-stack',
      label: 'Create Stack',
      icon: Icons.Stack,
      flow: { type: 'create-stack' },
      tooltip: 'Create a new document stack',
    },
    {
      id: 'upload',
      label: 'Upload',
      icon: Icons.Upload,
      flow: { type: 'upload', step: 'dropzone', data: initialUploadData },
      tooltip: 'Upload a new document',
    },
  ],
}

export function AgentActions() {
  const pathname = usePathname()
  const openFlow = useAgentStore((s) => s.openFlow)

  // Match route to actions (exact match or prefix)
  const actions = getActionsForRoute(pathname)

  if (actions.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          icon={<action.icon className="size-3.5" />}
          tooltip={action.tooltip}
          onClick={() => openFlow(action.flow)}
        >
          {action.label}
        </ActionButton>
      ))}
    </div>
  )
}

function getActionsForRoute(pathname: string): ActionDef[] {
  // Try exact match first
  if (ACTION_CONFIG[pathname]) {
    return ACTION_CONFIG[pathname]
  }

  // Try prefix match (e.g., /documents/[id] matches /documents)
  for (const [route, actions] of Object.entries(ACTION_CONFIG)) {
    if (pathname.startsWith(route + '/')) {
      return actions
    }
  }

  // Fallback to documents actions
  return ACTION_CONFIG['/documents'] || []
}
```

**Step 2: Verify components compile**

Run: `npx tsc --noEmit frontend/components/agent/agent-bar.tsx frontend/components/agent/agent-actions.tsx`
Expected: No errors

**Step 3: Commit foundation components**

```bash
git add frontend/components/agent/agent-bar.tsx frontend/components/agent/agent-actions.tsx
git commit -m "feat(agent): add AgentBar and AgentActions components"
```

---

### Task 1.4: Create Agent Popup Container

**Files:**
- Create: `frontend/components/agent/agent-popup.tsx`

**Step 1: Create popup container with chrome**

```typescript
// frontend/components/agent/agent-popup.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentFlow, useAgentPopup } from './stores/agent-store'

interface AgentPopupProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function AgentPopup({ children, title, showBack, onBack }: AgentPopupProps) {
  const { isPopupOpen } = useAgentPopup()
  const flow = useAgentFlow()
  const collapsePopup = useAgentStore((s) => s.collapsePopup)
  const close = useAgentStore((s) => s.close)

  // Don't render if no flow active
  if (!flow) return null

  const handleClose = () => {
    // TODO: Add confirmation if mid-flow (Task 2.4)
    close()
  }

  return (
    <Collapsible open={isPopupOpen} onOpenChange={(open) => !open && collapsePopup()}>
      <CollapsibleContent forceMount className={cn(!isPopupOpen && 'hidden')}>
        <div className="rounded-xl border border-border bg-background shadow-lg mb-3">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              {showBack && onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={onBack}
                >
                  <Icons.ChevronLeft className="size-4" />
                  <span className="sr-only">Go back</span>
                </Button>
              )}
              {title && (
                <h3 className="text-sm font-medium">{title}</h3>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={collapsePopup}
                aria-label="Collapse popup"
              >
                <Icons.ChevronDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleClose}
                aria-label="Close"
              >
                <Icons.X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {children}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit frontend/components/agent/agent-popup.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/agent-popup.tsx
git commit -m "feat(agent): add AgentPopup container component"
```

---

### Task 1.5: Create Agent Container and Barrel Export

**Files:**
- Create: `frontend/components/agent/agent-container.tsx`
- Create: `frontend/components/agent/index.ts`

**Step 1: Create agent container that orchestrates bar + popup**

```typescript
// frontend/components/agent/agent-container.tsx
'use client'

import { cn } from '@/lib/utils'
import { AgentBar } from './agent-bar'
import { AgentPopup } from './agent-popup'
import { AgentPopupContent } from './agent-popup-content'

interface AgentContainerProps {
  className?: string
}

export function AgentContainer({ className }: AgentContainerProps) {
  return (
    <div className={cn('relative w-full max-w-[640px] mx-auto', className)}>
      {/* Popup floats above bar */}
      <div className="absolute bottom-full left-0 right-0">
        <AgentPopupContent />
      </div>

      {/* Dynamic chat bar */}
      <AgentBar />
    </div>
  )
}
```

**Step 2: Create popup content router**

```typescript
// frontend/components/agent/agent-popup-content.tsx
'use client'

import { useAgentFlow } from './stores/agent-store'
import { AgentPopup } from './agent-popup'

export function AgentPopupContent() {
  const flow = useAgentFlow()

  if (!flow) return null

  switch (flow.type) {
    case 'upload':
      // TODO: Import and render UploadFlow (Phase 2)
      return (
        <AgentPopup title={getUploadTitle(flow.step)}>
          <div className="text-sm text-muted-foreground">
            Upload flow coming in Phase 2...
          </div>
        </AgentPopup>
      )
    case 'create-stack':
      return (
        <AgentPopup title="Create Stack">
          <div className="text-sm text-muted-foreground">
            Create stack flow coming post-MVP...
          </div>
        </AgentPopup>
      )
    default:
      return null
  }
}

function getUploadTitle(step: string): string {
  switch (step) {
    case 'dropzone': return 'Upload Document'
    case 'configure': return 'Configure Extraction'
    case 'fields': return 'Specify Fields'
    case 'extracting': return 'Extracting...'
    case 'complete': return 'Complete'
    default: return 'Upload Document'
  }
}
```

**Step 3: Create barrel export**

```typescript
// frontend/components/agent/index.ts
export { AgentContainer } from './agent-container'
export { AgentBar } from './agent-bar'
export { AgentPopup } from './agent-popup'
export { AgentActions } from './agent-actions'
export { useAgentStore, useAgentFlow, useAgentStatus, useAgentPopup, useAgentEvents } from './stores/agent-store'
export type { AgentFlow, UploadFlowData, AgentStatus } from './stores/agent-store'
```

**Step 4: Verify all components compile**

Run: `npx tsc --noEmit frontend/components/agent/index.ts`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/components/agent/
git commit -m "feat(agent): add AgentContainer and barrel exports"
```

---

## Phase 2: Upload Flow

### Task 2.1: Create Upload Flow Component

**Files:**
- Create: `frontend/components/agent/flows/documents/upload-flow.tsx`

**Step 1: Create upload flow that routes to steps**

```typescript
// frontend/components/agent/flows/documents/upload-flow.tsx
'use client'

import { useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useAgentStore, useAgentFlow } from '../../stores/agent-store'
import { AgentPopup } from '../../agent-popup'
import { UploadDropzone } from './upload-dropzone'
import { UploadConfigure } from './upload-configure'
import { UploadFields } from './upload-fields'
import { UploadExtracting } from './upload-extracting'
import { UploadComplete } from './upload-complete'
import { streamAgentExtraction, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'

export function UploadFlow() {
  const { getToken } = useAuth()
  const router = useRouter()
  const flow = useAgentFlow()
  const setStep = useAgentStore((s) => s.setStep)
  const updateFlowData = useAgentStore((s) => s.updateFlowData)
  const setStatus = useAgentStore((s) => s.setStatus)
  const addEvent = useAgentStore((s) => s.addEvent)
  const collapsePopup = useAgentStore((s) => s.collapsePopup)
  const close = useAgentStore((s) => s.close)

  // Only render for upload flow
  if (!flow || flow.type !== 'upload') return null

  const { step, data } = flow

  // Handle file selection from dropzone
  const handleFileSelect = useCallback(async (file: File) => {
    updateFlowData({
      file,
      documentName: file.name,
      uploadStatus: 'uploading',
      uploadError: null,
    })
    setStep('configure')
    setStatus('processing', 'Uploading document...')

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
        uploadStatus: 'ready',
      })
      setStatus('idle', 'Configure extraction settings')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      updateFlowData({ uploadStatus: 'error', uploadError: message })
      setStatus('error', message)
    }
  }, [getToken, updateFlowData, setStep, setStatus])

  // Start extraction
  const handleExtract = useCallback(async () => {
    if (!data.documentId) return

    setStep('extracting')
    collapsePopup()
    setStatus('processing', 'Extracting...')

    const handleEvent = (event: AgentEvent) => {
      addEvent(event)
      if (event.type === 'tool') {
        setStatus('processing', event.content)
      } else if (event.type === 'complete') {
        setStep('complete')
        setStatus('complete', 'Extraction complete')
      } else if (event.type === 'error') {
        updateFlowData({ extractionError: event.content })
        setStatus('error', event.content)
      }
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')

      await streamAgentExtraction(
        data.documentId,
        data.extractionMethod,
        data.extractionMethod === 'custom' ? data.customFields : null,
        handleEvent,
        token
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Extraction failed'
      updateFlowData({ extractionError: message })
      setStatus('error', message)
    }
  }, [data, getToken, setStep, collapsePopup, setStatus, addEvent, updateFlowData])

  // Navigation handlers
  const handleBack = useCallback(() => {
    if (step === 'configure') setStep('dropzone')
    else if (step === 'fields') setStep('configure')
  }, [step, setStep])

  const handleNext = useCallback(() => {
    if (step === 'configure' && data.extractionMethod === 'custom') {
      setStep('fields')
    } else {
      handleExtract()
    }
  }, [step, data.extractionMethod, setStep, handleExtract])

  const handleViewDocument = useCallback(() => {
    if (data.documentId) {
      router.push(`/documents/${data.documentId}`)
      router.refresh()
      close()
    }
  }, [data.documentId, router, close])

  const handleUploadAnother = useCallback(() => {
    updateFlowData({
      file: null,
      documentId: null,
      documentName: '',
      extractionMethod: 'auto',
      customFields: [],
      uploadStatus: 'idle',
      uploadError: null,
      extractionError: null,
    })
    setStep('dropzone')
    setStatus('idle', 'Drop a file to get started')
  }, [updateFlowData, setStep, setStatus])

  const getTitle = () => {
    switch (step) {
      case 'dropzone': return 'Upload Document'
      case 'configure': return 'Configure Extraction'
      case 'fields': return 'Specify Fields'
      case 'extracting': return 'Extracting...'
      case 'complete': return 'Complete'
      default: return 'Upload Document'
    }
  }

  const showBack = step === 'configure' || step === 'fields'

  return (
    <AgentPopup title={getTitle()} showBack={showBack} onBack={handleBack}>
      {step === 'dropzone' && (
        <UploadDropzone onFileSelect={handleFileSelect} />
      )}
      {step === 'configure' && (
        <UploadConfigure
          data={data}
          onUpdate={updateFlowData}
          onNext={handleNext}
          isPrimaryDisabled={data.uploadStatus !== 'ready'}
          primaryButtonText={data.uploadStatus === 'uploading' ? 'Uploading...' : (data.extractionMethod === 'custom' ? 'Next' : 'Extract')}
        />
      )}
      {step === 'fields' && (
        <UploadFields
          data={data}
          onUpdate={updateFlowData}
          onExtract={handleExtract}
        />
      )}
      {step === 'extracting' && (
        <UploadExtracting />
      )}
      {step === 'complete' && (
        <UploadComplete
          documentName={data.documentName}
          onViewDocument={handleViewDocument}
          onUploadAnother={handleUploadAnother}
        />
      )}
    </AgentPopup>
  )
}
```

**Step 2: Commit (after creating step components)**

---

### Task 2.2: Create Upload Step Components

**Files:**
- Create: `frontend/components/agent/flows/documents/upload-dropzone.tsx`
- Create: `frontend/components/agent/flows/documents/upload-configure.tsx`
- Create: `frontend/components/agent/flows/documents/upload-fields.tsx`
- Create: `frontend/components/agent/flows/documents/upload-extracting.tsx`
- Create: `frontend/components/agent/flows/documents/upload-complete.tsx`

**Step 1: Create dropzone step (adapt from existing)**

```typescript
// frontend/components/agent/flows/documents/upload-dropzone.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { UPLOAD_CONSTRAINTS } from '@/lib/upload-config'

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void
}

export function UploadDropzone({ onFileSelect }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null)

      if (!UPLOAD_CONSTRAINTS.ACCEPTED_TYPES.includes(file.type as typeof UPLOAD_CONSTRAINTS.ACCEPTED_TYPES[number])) {
        setError('File must be PDF, JPG, or PNG')
        return
      }

      if (file.size > UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES) {
        setError(`File must be under ${UPLOAD_CONSTRAINTS.MAX_SIZE_MB}MB`)
        return
      }

      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleClick = () => inputRef.current?.click()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSelect(file)
    if (inputRef.current) inputRef.current.value = ''
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
    if (file) validateAndSelect(file)
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
```

**Step 2: Create configure step with document rename**

```typescript
// frontend/components/agent/flows/documents/upload-configure.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExtractionMethodCard } from '@/components/layout/upload-dialog/extraction-method-card'
import type { UploadFlowData } from '../../stores/agent-store'

interface UploadConfigureProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onNext: () => void
  isPrimaryDisabled: boolean
  primaryButtonText: string
}

export function UploadConfigure({
  data,
  onUpdate,
  onNext,
  isPrimaryDisabled,
  primaryButtonText,
}: UploadConfigureProps) {
  return (
    <div className="space-y-6">
      {/* Document name (editable) */}
      <div className="space-y-2">
        <Label htmlFor="document-name">Document Name</Label>
        <Input
          id="document-name"
          value={data.documentName}
          onChange={(e) => onUpdate({ documentName: e.target.value })}
          placeholder="Enter document name"
        />
      </div>

      {/* Upload status */}
      {data.uploadStatus === 'uploading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="animate-pulse">Uploading...</span>
        </div>
      )}
      {data.uploadError && (
        <p className="text-sm text-destructive">{data.uploadError}</p>
      )}

      {/* Stack selection - placeholder */}
      <div className="space-y-2">
        <Label>Add to Stack</Label>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="cursor-not-allowed opacity-50">
            Coming soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Stack grouping will be available in a future update
        </p>
      </div>

      {/* Extraction method */}
      <div className="space-y-3">
        <Label>Extraction Method</Label>
        <div className="grid grid-cols-2 gap-3">
          <ExtractionMethodCard
            title="Auto Extract"
            description="AI analyzes and extracts all fields automatically"
            selected={data.extractionMethod === 'auto'}
            onSelect={() => onUpdate({ extractionMethod: 'auto' })}
          />
          <ExtractionMethodCard
            title="Custom Fields"
            description="Specify exactly which fields to extract"
            selected={data.extractionMethod === 'custom'}
            onSelect={() => onUpdate({ extractionMethod: 'custom' })}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={isPrimaryDisabled}>
          {primaryButtonText}
        </Button>
      </div>
    </div>
  )
}
```

**Step 3: Create fields step**

```typescript
// frontend/components/agent/flows/documents/upload-fields.tsx
'use client'

import { Button } from '@/components/ui/button'
import { FieldTagInput } from '@/components/layout/upload-dialog/field-tag-input'
import type { UploadFlowData } from '../../stores/agent-store'
import type { CustomField } from '@/types/upload'

interface UploadFieldsProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onExtract: () => void
}

export function UploadFields({ data, onUpdate, onExtract }: UploadFieldsProps) {
  const handleAddField = (field: CustomField) => {
    onUpdate({ customFields: [...data.customFields, field] })
  }

  const handleRemoveField = (name: string) => {
    onUpdate({ customFields: data.customFields.filter((f) => f.name !== name) })
  }

  return (
    <div className="space-y-6">
      <FieldTagInput
        fields={data.customFields}
        onAddField={handleAddField}
        onRemoveField={handleRemoveField}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={onExtract} disabled={data.customFields.length === 0}>
          Extract
        </Button>
      </div>
    </div>
  )
}
```

**Step 4: Create extracting step (minimal - popup is collapsed)**

```typescript
// frontend/components/agent/flows/documents/upload-extracting.tsx
'use client'

import * as Icons from '@/components/icons'
import { useAgentEvents } from '../../stores/agent-store'

export function UploadExtracting() {
  const events = useAgentEvents()
  const toolEvents = events.filter((e) => e.type === 'tool')

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
```

**Step 5: Create complete step**

```typescript
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
```

**Step 6: Verify all compile**

Run: `npx tsc --noEmit frontend/components/agent/flows/documents/*.tsx`
Expected: No errors

**Step 7: Commit**

```bash
git add frontend/components/agent/flows/
git commit -m "feat(agent): add upload flow step components"
```

---

### Task 2.3: Wire Upload Flow into Popup Content

**Files:**
- Modify: `frontend/components/agent/agent-popup-content.tsx`

**Step 1: Import and render UploadFlow**

Replace the placeholder in `agent-popup-content.tsx`:

```typescript
// frontend/components/agent/agent-popup-content.tsx
'use client'

import { useAgentFlow } from './stores/agent-store'
import { UploadFlow } from './flows/documents/upload-flow'

export function AgentPopupContent() {
  const flow = useAgentFlow()

  if (!flow) return null

  switch (flow.type) {
    case 'upload':
      return <UploadFlow />
    case 'create-stack':
      // Post-MVP
      return null
    default:
      return null
  }
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit frontend/components/agent/agent-popup-content.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/agent-popup-content.tsx
git commit -m "feat(agent): wire UploadFlow into popup content router"
```

---

### Task 2.4: Add Close Confirmation Dialog

**Files:**
- Create: `frontend/components/agent/panels/confirm-close.tsx`
- Modify: `frontend/components/agent/agent-popup.tsx`

**Step 1: Create confirmation dialog component**

```typescript
// frontend/components/agent/panels/confirm-close.tsx
'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmCloseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  description?: string
}

export function ConfirmClose({
  open,
  onOpenChange,
  onConfirm,
  title = 'Cancel upload?',
  description = 'You have an upload in progress. Are you sure you want to cancel?',
}: ConfirmCloseProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancel Upload</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Step 2: Update AgentPopup to use confirmation**

```typescript
// frontend/components/agent/agent-popup.tsx
'use client'

import { useState, useCallback } from 'react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentFlow, useAgentPopup } from './stores/agent-store'
import { ConfirmClose } from './panels/confirm-close'

interface AgentPopupProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function AgentPopup({ children, title, showBack, onBack }: AgentPopupProps) {
  const { isPopupOpen } = useAgentPopup()
  const flow = useAgentFlow()
  const collapsePopup = useAgentStore((s) => s.collapsePopup)
  const close = useAgentStore((s) => s.close)
  const [showConfirm, setShowConfirm] = useState(false)

  // Determine if we need confirmation before closing
  const needsConfirmation = useCallback(() => {
    if (!flow) return false
    if (flow.type === 'upload') {
      const { step, data } = flow
      // Need confirmation if:
      // - File selected (configure/fields step)
      // - Currently extracting
      if (step === 'configure' || step === 'fields') return true
      if (step === 'extracting') return true
      if (data.file) return true
    }
    return false
  }, [flow])

  const handleClose = useCallback(() => {
    if (needsConfirmation()) {
      setShowConfirm(true)
    } else {
      close()
    }
  }, [needsConfirmation, close])

  const handleConfirmClose = useCallback(() => {
    setShowConfirm(false)
    close()
  }, [close])

  // Don't render if no flow active
  if (!flow) return null

  return (
    <>
      <Collapsible open={isPopupOpen} onOpenChange={(open) => !open && collapsePopup()}>
        <CollapsibleContent forceMount className={cn(!isPopupOpen && 'hidden')}>
          <div className="rounded-xl border border-border bg-background shadow-lg mb-3">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                {showBack && onBack && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={onBack}
                  >
                    <Icons.ChevronLeft className="size-4" />
                    <span className="sr-only">Go back</span>
                  </Button>
                )}
                {title && (
                  <h3 className="text-sm font-medium">{title}</h3>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={collapsePopup}
                  aria-label="Collapse popup"
                >
                  <Icons.ChevronDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={handleClose}
                  aria-label="Close"
                >
                  <Icons.X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ConfirmClose
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmClose}
      />
    </>
  )
}
```

**Step 3: Verify compiles**

Run: `npx tsc --noEmit frontend/components/agent/agent-popup.tsx frontend/components/agent/panels/confirm-close.tsx`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/components/agent/panels/ frontend/components/agent/agent-popup.tsx
git commit -m "feat(agent): add close confirmation for mid-flow cancellation"
```

---

## Phase 3: Integration

### Task 3.1: Replace AiChatBar in Documents Layout

**Files:**
- Modify: `frontend/app/(app)/documents/layout.tsx`
- Modify: `frontend/components/documents/selected-document-context.tsx`

**Step 1: Update documents layout to use AgentContainer**

```typescript
// frontend/app/(app)/documents/layout.tsx
'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { PreviewPanel } from '@/components/documents/preview-panel'
import { usePreviewPanel } from '@/components/documents/preview-panel-context'
import { useSelectedDocument } from '@/components/documents/selected-document-context'
import { AgentContainer } from '@/components/agent'

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { panelRef, setIsCollapsed, panelWidth, setPanelWidth } = usePreviewPanel()
  const { signedUrl, ocrText, mimeType, showAgentBar } = useSelectedDocument()

  const mainPanelSize = 100 - panelWidth

  const handleLayoutChange = (sizes: number[]) => {
    if (sizes[1] !== undefined) {
      setPanelWidth(sizes[1])
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 overflow-hidden"
        onLayout={handleLayoutChange}
      >
        {/* Main content panel */}
        <ResizablePanel
          defaultSize={mainPanelSize}
          minSize={40}
          className="overflow-hidden min-w-0 flex flex-col"
        >
          {children}
        </ResizablePanel>

        <ResizableHandle />

        {/* Preview panel */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={panelWidth}
          minSize={30}
          maxSize={50}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-hidden"
        >
          <div className="h-full">
            <PreviewPanel
              pdfUrl={signedUrl}
              ocrText={ocrText}
              mimeType={mimeType}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Agent Container - full width below panels */}
      {showAgentBar && (
        <div className="p-4">
          <AgentContainer />
        </div>
      )}
    </div>
  )
}
```

**Step 2: Update selected-document-context to expose showAgentBar flag**

Read the current context file and add a `showAgentBar` boolean instead of `aiChatBarContent` ReactNode:

```typescript
// Add to SelectedDocumentContext interface:
showAgentBar: boolean

// Replace aiChatBarContent with:
showAgentBar: !!documentId  // Show on detail pages
```

**Step 3: Verify compiles**

Run: `npx tsc --noEmit frontend/app/(app)/documents/layout.tsx`
Expected: No errors

**Step 4: Test locally**

Run: `npm run dev`
Navigate to `/documents` and verify:
- AgentBar appears at bottom
- Focus reveals action buttons
- Clicking Upload opens popup with dropzone

**Step 5: Commit**

```bash
git add frontend/app/(app)/documents/layout.tsx frontend/components/documents/selected-document-context.tsx
git commit -m "feat(agent): integrate AgentContainer into documents layout"
```

---

### Task 3.2: Add Upload Button to Header Actions

**Files:**
- Modify: `frontend/app/(app)/@header/documents/page.tsx`

**Step 1: Add upload action button to documents list header**

```typescript
// frontend/app/(app)/@header/documents/page.tsx
import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'
import { UploadButton } from '@/components/agent/upload-button'

export default function DocumentsHeaderSlot() {
  return (
    <PageHeader
      actions={
        <div className="flex items-center gap-2">
          <UploadButton />
          <PreviewToggle />
        </div>
      }
    />
  )
}
```

**Step 2: Create UploadButton component**

```typescript
// frontend/components/agent/upload-button.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useAgentStore, type UploadFlowData } from './stores/agent-store'

const initialUploadData: UploadFlowData = {
  file: null,
  documentId: null,
  documentName: '',
  extractionMethod: 'auto',
  customFields: [],
  uploadStatus: 'idle',
  uploadError: null,
  extractionError: null,
}

export function UploadButton() {
  const openFlow = useAgentStore((s) => s.openFlow)

  const handleClick = () => {
    openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })
  }

  return (
    <Button size="sm" onClick={handleClick}>
      <Icons.Upload className="size-4 mr-1.5" />
      Upload
    </Button>
  )
}
```

**Step 3: Add to barrel export**

```typescript
// frontend/components/agent/index.ts
export { UploadButton } from './upload-button'
```

**Step 4: Verify compiles**

Run: `npx tsc --noEmit frontend/app/(app)/@header/documents/page.tsx frontend/components/agent/upload-button.tsx`
Expected: No errors

**Step 5: Test locally**

Run: `npm run dev`
- Click Upload button in header
- Verify popup opens with dropzone
- Complete full upload flow

**Step 6: Commit**

```bash
git add frontend/app/(app)/@header/documents/page.tsx frontend/components/agent/upload-button.tsx frontend/components/agent/index.ts
git commit -m "feat(agent): add Upload button to documents header"
```

---

### Task 3.3: End-to-End Flow Testing

**Files:** None (manual testing)

**Step 1: Test upload flow end-to-end**

Run: `npm run dev`

Test cases:
1. ✅ Upload button in header opens popup
2. ✅ Dropzone accepts PDF/JPG/PNG files
3. ✅ File validation rejects invalid types/sizes
4. ✅ Document rename field works
5. ✅ Auto Extract → Extract triggers SSE streaming
6. ✅ Custom Fields → Next → Fields step works
7. ✅ Popup collapses during extraction
8. ✅ Bar shows dynamic status during extraction
9. ✅ Complete step shows success + actions
10. ✅ View Document navigates correctly
11. ✅ Upload Another resets flow
12. ✅ Close mid-flow shows confirmation
13. ✅ Focus on bar reveals action buttons
14. ✅ Actions change based on route

**Step 2: Fix any issues found**

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix(agent): address issues found during e2e testing"
```

---

## Phase 4: Cleanup

### Task 4.1: Remove Old Upload Dialog Components

**Files:**
- Delete: `frontend/components/layout/upload-dialog/` (entire folder)
- Delete: `frontend/components/layout/ai-chat-bar.tsx`
- Delete: `frontend/components/layout/ai-activity-panel.tsx`
- Modify: Any files that import the deleted components

**Step 1: Find all imports of deleted components**

Run: `grep -r "upload-dialog\|ai-chat-bar\|ai-activity-panel" frontend/`

**Step 2: Update imports to use new agent components**

For each file found, update imports:
- `UploadDialogTrigger` / `UploadDialogContent` → `UploadButton` from `@/components/agent`
- `AiChatBar` → `AgentContainer` from `@/components/agent`
- `AiActivityPanel` → Remove (integrated into agent system)

**Step 3: Delete old files**

```bash
rm -rf frontend/components/layout/upload-dialog/
rm frontend/components/layout/ai-chat-bar.tsx
rm frontend/components/layout/ai-activity-panel.tsx
```

**Step 4: Verify no broken imports**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(agent): remove old upload dialog and chat bar components"
```

---

### Task 4.2: Update Barrel Exports

**Files:**
- Modify: `frontend/components/layout/index.ts` (if exists)

**Step 1: Remove deleted exports**

Remove any exports of:
- `UploadDialogTrigger`
- `UploadDialogContent`
- `AiChatBar`
- `AiActivityPanel`

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/layout/
git commit -m "refactor(layout): clean up barrel exports after agent migration"
```

---

### Task 4.3: Final Verification and Cleanup

**Files:** None (verification only)

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (or only pre-existing ones)

**Step 3: Test production build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup after agent UI refactor"
```

---

## Success Criteria

After completing all phases, verify:

- [ ] Upload button in header opens agent popup (not modal)
- [ ] Dropzone → Configure → Processing → Complete flow works
- [ ] User can rename document in configure step
- [ ] Bar shows dynamic status during upload/extraction
- [ ] Popup auto-collapses during processing
- [ ] Actions appear on bar focus, hidden otherwise
- [ ] Actions change based on current route
- [ ] Close mid-flow shows confirmation dialog
- [ ] No regressions in upload/extraction functionality
- [ ] Old upload dialog components deleted
- [ ] Build passes with no TypeScript errors

---

## Files Summary

### Created
- `frontend/components/agent/stores/agent-store.ts`
- `frontend/components/agent/agent-bar.tsx`
- `frontend/components/agent/agent-popup.tsx`
- `frontend/components/agent/agent-popup-content.tsx`
- `frontend/components/agent/agent-actions.tsx`
- `frontend/components/agent/agent-container.tsx`
- `frontend/components/agent/upload-button.tsx`
- `frontend/components/agent/index.ts`
- `frontend/components/agent/flows/documents/upload-flow.tsx`
- `frontend/components/agent/flows/documents/upload-dropzone.tsx`
- `frontend/components/agent/flows/documents/upload-configure.tsx`
- `frontend/components/agent/flows/documents/upload-fields.tsx`
- `frontend/components/agent/flows/documents/upload-extracting.tsx`
- `frontend/components/agent/flows/documents/upload-complete.tsx`
- `frontend/components/agent/panels/confirm-close.tsx`

### Modified
- `frontend/app/(app)/documents/layout.tsx`
- `frontend/app/(app)/@header/documents/page.tsx`
- `frontend/components/documents/selected-document-context.tsx`

### Deleted
- `frontend/components/layout/upload-dialog/` (entire folder)
- `frontend/components/layout/ai-chat-bar.tsx`
- `frontend/components/layout/ai-activity-panel.tsx`
