# Phase 5: Delete Dialog

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add delete confirmation dialog for single document deletion.

**Architecture:** AlertDialog with Supabase delete operation (DB + Storage).

**Tech Stack:** shadcn/ui AlertDialog, Supabase JS, Sonner toast

---

## Task 10: Create Delete Dialog Component

**Files:**
- Create: `frontend/components/documents/delete-dialog.tsx`

**Step 1: Create the delete confirmation dialog**

```tsx
'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClerkSupabaseClient } from '@/lib/supabase'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'

interface DeleteDialogProps {
  documentId: string
  filename: string
  filePath: string | null
}

export function DeleteDialog({ documentId, filename, filePath }: DeleteDialogProps) {
  const { getToken } = useAuth()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    const supabase = createClerkSupabaseClient(getToken)

    try {
      // Step 1: Delete from database (cascades to related tables)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (deleteError) throw deleteError

      // Step 2: Delete from storage (best effort)
      if (filePath) {
        const { error: storageError } = await supabase
          .storage
          .from('documents')
          .remove([filePath])

        if (storageError) {
          console.error('Storage cleanup failed:', storageError)
          // Don't throw - DB deletion succeeded
        }
      }

      toast.success('Document deleted')
      setOpen(false)
      router.push('/documents')
      router.refresh()
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete document')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <ActionButton icon={<Icons.Trash />} tooltip="Delete document">
          Delete
        </ActionButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{filename}</strong> and all its extracted data.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/components/documents/delete-dialog.tsx
git commit -m "feat: add delete confirmation dialog with Supabase operations"
```

---

## Task 11: Wire Up Delete in Document Detail Actions

**Files:**
- Modify: `frontend/app/(app)/@subbar/documents/[id]/page.tsx`
- Modify: `frontend/components/documents/document-detail-sub-bar.tsx`
- Modify: `frontend/components/documents/document-detail-actions.tsx`

**Data Flow:**
The DeleteDialog needs `documentId`, `filename`, and `filePath`. Currently the subbar server component only fetches stacks. We need to use `getDocumentWithExtraction()` (already cached) to get the full document data.

> **Note:** Database uses `file_path` (snake_case), but React props use `filePath` (camelCase).

**Step 1: Update server component to fetch document data**

```tsx
// frontend/app/(app)/@subbar/documents/[id]/page.tsx
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { DocumentDetailSubBar } from '@/components/documents/document-detail-sub-bar'

interface DocumentDetailSubBarPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailSubBarPage({ params }: DocumentDetailSubBarPageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  return (
    <DocumentDetailSubBar
      documentId={id}
      filename={document?.filename ?? 'Unknown'}
      filePath={document?.file_path ?? null}
      assignedStacks={document?.stacks ?? []}
    />
  )
}
```

**Step 2: Update DocumentDetailSubBar props interface**

```tsx
// frontend/components/documents/document-detail-sub-bar.tsx
interface DocumentDetailSubBarProps {
  documentId: string
  filename: string
  filePath: string | null
  assignedStacks: StackSummary[]
}

export function DocumentDetailSubBar({
  documentId,
  filename,
  filePath,
  assignedStacks,
}: DocumentDetailSubBarProps) {
  // ... existing code ...

  // Update DocumentDetailActions call:
  <DocumentDetailActions
    documentId={documentId}
    filename={filename}
    filePath={filePath}
    assignedStacks={assignedStacks}
  />
}
```

**Step 3: Update DocumentDetailActions props and add DeleteDialog**

```tsx
// frontend/components/documents/document-detail-actions.tsx
'use client'

import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { DeleteDialog } from '@/components/documents/delete-dialog'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'

interface DocumentDetailActionsProps {
  documentId: string
  filename: string
  filePath: string | null
  assignedStacks: Array<{ id: string; name: string }>
}

export function DocumentDetailActions({
  documentId,
  filename,
  filePath,
  assignedStacks,
}: DocumentDetailActionsProps) {
  return (
    <>
      <StacksDropdown assignedStacks={assignedStacks} />
      <ActionButton icon={<Icons.Edit />} tooltip="Edit document and extractions">
        Edit
      </ActionButton>
      <ActionButton icon={<Icons.Download />} tooltip="Download extraction data">
        Export
      </ActionButton>
      <DeleteDialog documentId={documentId} filename={filename} filePath={filePath} />
    </>
  )
}
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/app/(app)/@subbar/documents/[id]/page.tsx frontend/components/documents/document-detail-sub-bar.tsx frontend/components/documents/document-detail-actions.tsx
git commit -m "feat: wire up delete dialog in document detail"
```
