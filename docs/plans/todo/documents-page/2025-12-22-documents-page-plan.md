# Documents Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the documents list page and document detail page with extracted data viewing, PDF preview, and AI-powered editing.

**Architecture:** Server components fetch data from Supabase, pass to client table/detail components. Page header uses React Context for breadcrumbs and a portal pattern for actions. PDF viewing uses react-pdf with client-side rendering. AI chat uses SSE streaming to the existing extraction agent.

**Tech Stack:** Next.js 16, TanStack Table, shadcn/ui (table, dialog, badge, tabs, dropdown-menu, popover), react-pdf, Supabase

---

## Design System: Linear-Inspired Precision

**Aesthetic Direction:** Extreme restraint. Let content speak. Every element earns its place.

**Typography:**
- Headers: `font-medium` only - never bold, never uppercase
- Table headers: `text-muted-foreground text-sm` - lowercase, understated
- IDs/codes: `font-mono text-muted-foreground text-sm` - like Linear's `BUI-1`
- Body: Default weight, generous line height

**Color Palette:**
- Base: Near-monochrome - `text-foreground` and `text-muted-foreground`
- Status icons only: Small colored dots/icons, never colored text blocks
- Backgrounds: `bg-transparent` or very subtle `hover:bg-muted/50`
- Borders: `border-border` - visible but not heavy

**Spacing:**
- Rows: `py-3` minimum - content needs room to breathe
- Sections: `space-y-6` between major blocks
- Inline: `gap-3` for property pills

**Borders & Containers:**
- Tables: Single outer border, no internal row borders (use hover bg instead)
- Empty states: `border-dashed` with muted placeholder text
- Cards: `rounded-lg border` - subtle, not boxy

**Motion:**
- Transitions: `duration-150` - instant feel
- Hover: `bg-muted/50` - barely there
- No transforms, no scaling, no bounce

**Interactions:**
- Rows: Full clickable area, subtle bg on hover
- Buttons: Ghost by default, outline for secondary, filled only for primary CTA
- Property pills: Inline badges with icons, clickable for dropdowns

---

## Phase 1: Foundation - shadcn Components & Page Header System

### Task 1: Install Required shadcn Components

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/components/ui/table.tsx`
- Create: `frontend/components/ui/dialog.tsx`
- Create: `frontend/components/ui/badge.tsx`
- Create: `frontend/components/ui/tabs.tsx`
- Create: `frontend/components/ui/popover.tsx`
- Create: `frontend/components/ui/checkbox.tsx`

**Step 1: Install shadcn components**

Run:
```bash
cd frontend && npx shadcn@latest add table dialog badge tabs popover checkbox
```

Expected: Components added to `components/ui/`

**Step 2: Install TanStack Table**

Run:
```bash
cd frontend && npm install @tanstack/react-table
```

Expected: Package added to package.json

**Step 3: Commit**

```bash
git add frontend/components/ui frontend/package.json frontend/package-lock.json
git commit -m "feat: add shadcn table, dialog, badge, tabs, popover, checkbox components"
```

---

### Task 2: Create Page Header Context System

**Files:**
- Create: `frontend/contexts/page-header-context.tsx`
- Create: `frontend/components/page-header.tsx`

**Step 1: Create the page header context**

Create `frontend/contexts/page-header-context.tsx`:

```tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderContextType {
  breadcrumbs: BreadcrumbItem[]
  setBreadcrumbs: (items: BreadcrumbItem[]) => void
}

const PageHeaderContext = createContext<PageHeaderContextType | null>(null)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])

  return (
    <PageHeaderContext.Provider value={{ breadcrumbs, setBreadcrumbs }}>
      {children}
    </PageHeaderContext.Provider>
  )
}

export function useBreadcrumbs() {
  const context = useContext(PageHeaderContext)
  if (!context) {
    throw new Error('useBreadcrumbs must be used within PageHeaderProvider')
  }
  return context
}
```

**Step 2: Create the PageHeader component**

Create `frontend/components/page-header.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useBreadcrumbs } from '@/contexts/page-header-context'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment, ReactNode } from 'react'

interface PageHeaderProps {
  actions?: ReactNode
}

export function PageHeader({ actions }: PageHeaderProps) {
  const { breadcrumbs } = useBreadcrumbs()

  return (
    <div className="flex items-center justify-between">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((item, index) => (
            <Fragment key={index}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href || '#'}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/contexts frontend/components/page-header.tsx
git commit -m "feat: add page header context system with breadcrumbs"
```

---

### Task 3: Integrate Page Header into App Layout

**Files:**
- Modify: `frontend/app/(app)/layout.tsx`

**Step 1: Update the app layout**

Modify `frontend/app/(app)/layout.tsx`:

```tsx
import { cookies } from 'next/headers'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { PageHeaderProvider } from '@/contexts/page-header-context'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true'

  return (
    <PageHeaderProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          </header>
          <main className="flex-1 p-4 pt-0">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </PageHeaderProvider>
  )
}
```

**Step 2: Verify the app still loads**

Run:
```bash
cd frontend && npm run dev
```

Navigate to http://localhost:3000/documents - page should load without errors.

**Step 3: Commit**

```bash
git add frontend/app/\(app\)/layout.tsx
git commit -m "feat: integrate PageHeaderProvider into app layout"
```

---

## Phase 2: Documents List Page

### Task 4: Create Document Type Definitions

**Files:**
- Create: `frontend/types/documents.ts`

**Step 1: Create type definitions**

Create `frontend/types/documents.ts`:

```ts
export interface Stack {
  id: string
  name: string
}

export interface Document {
  id: string
  filename: string
  mime_type: string
  status: 'processing' | 'completed' | 'failed'
  uploaded_at: string
  stacks: Stack[]
}

export interface DocumentWithExtraction extends Document {
  extraction_id: string | null
  extracted_fields: Record<string, unknown> | null
  confidence_scores: Record<string, number> | null
  session_id: string | null
  ocr_raw_text: string | null
  file_path: string
}
```

**Step 2: Commit**

```bash
git add frontend/types
git commit -m "feat: add document type definitions"
```

---

### Task 5: Create Data Fetching Function

**Files:**
- Create: `frontend/lib/queries/documents.ts`

**Step 1: Create the documents query function**

Create `frontend/lib/queries/documents.ts`:

```ts
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Document, DocumentWithExtraction } from '@/types/documents'

export async function getDocumentsWithStacks(): Promise<Document[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('documents')
    .select(`
      id,
      filename,
      mime_type,
      status,
      uploaded_at,
      stack_documents (
        stacks (
          id,
          name
        )
      )
    `)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  // Transform the nested structure
  return (data || []).map((doc) => ({
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    status: doc.status,
    uploaded_at: doc.uploaded_at,
    stacks: (doc.stack_documents || [])
      .map((sd: { stacks: { id: string; name: string } | null }) => sd.stacks)
      .filter((s): s is { id: string; name: string } => s !== null),
  }))
}

export async function getDocumentWithExtraction(
  documentId: string
): Promise<DocumentWithExtraction | null> {
  const supabase = await createServerSupabaseClient()

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select(`
      id,
      filename,
      mime_type,
      status,
      uploaded_at,
      file_path,
      stack_documents (
        stacks (
          id,
          name
        )
      )
    `)
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    console.error('Error fetching document:', docError)
    return null
  }

  // Get latest extraction
  const { data: extraction } = await supabase
    .from('extractions')
    .select('id, extracted_fields, confidence_scores, session_id')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get OCR text
  const { data: ocr } = await supabase
    .from('ocr_results')
    .select('raw_text')
    .eq('document_id', documentId)
    .single()

  return {
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    status: doc.status,
    uploaded_at: doc.uploaded_at,
    file_path: doc.file_path,
    stacks: (doc.stack_documents || [])
      .map((sd: { stacks: { id: string; name: string } | null }) => sd.stacks)
      .filter((s): s is { id: string; name: string } => s !== null),
    extraction_id: extraction?.id || null,
    extracted_fields: extraction?.extracted_fields || null,
    confidence_scores: extraction?.confidence_scores || null,
    session_id: extraction?.session_id || null,
    ocr_raw_text: ocr?.raw_text || null,
  }
}
```

**Step 2: Commit**

```bash
git add frontend/lib/queries
git commit -m "feat: add document data fetching functions"
```

---

### Task 6: Create File Type Icon Component

**Files:**
- Create: `frontend/components/file-type-icon.tsx`

**Step 1: Create the FileTypeIcon component**

Create `frontend/components/file-type-icon.tsx`:

```tsx
import { IconFileTypePdf, IconPhoto } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

interface FileTypeIconProps {
  mimeType: string
  className?: string
}

export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
  const iconClass = cn('size-4', className)

  if (mimeType === 'application/pdf') {
    return <IconFileTypePdf className={cn(iconClass, 'text-red-500')} />
  }

  if (mimeType.startsWith('image/')) {
    return <IconPhoto className={cn(iconClass, 'text-blue-500')} />
  }

  return <IconFileTypePdf className={iconClass} />
}
```

**Step 2: Commit**

```bash
git add frontend/components/file-type-icon.tsx
git commit -m "feat: add FileTypeIcon component"
```

---

### Task 7: Create Stack Badges Component

**Files:**
- Create: `frontend/components/stack-badges.tsx`

**Step 1: Create the StackBadges component**

Create `frontend/components/stack-badges.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import type { Stack } from '@/types/documents'

interface StackBadgesProps {
  stacks: Stack[]
  maxVisible?: number
}

export function StackBadges({ stacks, maxVisible = 2 }: StackBadgesProps) {
  if (stacks.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  const visible = stacks.slice(0, maxVisible)
  const overflow = stacks.length - maxVisible

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((stack) => (
        <Badge key={stack.id} variant="secondary" className="text-xs">
          {stack.name}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="text-xs">
          +{overflow}
        </Badge>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/stack-badges.tsx
git commit -m "feat: add StackBadges component"
```

---

### Task 8: Create Documents Table Component

**Files:**
- Create: `frontend/components/documents/documents-table.tsx`
- Create: `frontend/components/documents/columns.tsx`

**Step 1: Create column definitions**

Create `frontend/components/documents/columns.tsx`:

```tsx
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { FileTypeIcon } from '@/components/file-type-icon'
import { StackBadges } from '@/components/stack-badges'
import type { Document } from '@/types/documents'
import { IconLoader2, IconAlertCircle } from '@tabler/icons-react'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const columns: ColumnDef<Document>[] = [
  {
    accessorKey: 'filename',
    header: 'Name',
    cell: ({ row }) => {
      const doc = row.original
      return (
        <div className="flex items-center gap-2">
          <FileTypeIcon mimeType={doc.mime_type} />
          <span className="font-medium">{doc.filename}</span>
          {doc.status === 'processing' && (
            <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          {doc.status === 'failed' && (
            <IconAlertCircle className="size-4 text-destructive" />
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'stacks',
    header: 'Stacks',
    cell: ({ row }) => <StackBadges stacks={row.original.stacks} />,
  },
  {
    accessorKey: 'uploaded_at',
    header: 'Date',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.uploaded_at)}
      </span>
    ),
  },
]
```

**Step 2: Create the DataTable component**

Create `frontend/components/documents/documents-table.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { columns } from './columns'
import type { Document } from '@/types/documents'

interface DocumentsTableProps {
  documents: Document[]
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  const router = useRouter()

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 text-sm font-normal text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer border-0 hover:bg-muted/50 transition-colors duration-150"
                onClick={() => router.push(`/documents/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <p className="text-sm text-muted-foreground">No documents</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/components/documents
git commit -m "feat: add DocumentsTable with TanStack Table"
```

---

### Task 9: Create Documents List Page Client Wrapper

**Files:**
- Create: `frontend/components/documents/documents-list.tsx`

**Step 1: Create the client wrapper with breadcrumbs**

Create `frontend/components/documents/documents-list.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useBreadcrumbs } from '@/contexts/page-header-context'
import { PageHeader } from '@/components/page-header'
import { DocumentsTable } from './documents-table'
import { Button } from '@/components/ui/button'
import { IconUpload } from '@tabler/icons-react'
import type { Document } from '@/types/documents'

interface DocumentsListProps {
  documents: Document[]
}

export function DocumentsList({ documents }: DocumentsListProps) {
  const { setBreadcrumbs } = useBreadcrumbs()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Workspace', href: '/' },
      { label: 'Documents' },
    ])
  }, [setBreadcrumbs])

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button disabled>
            <IconUpload className="mr-2 size-4" />
            Upload
          </Button>
        }
      />
      <DocumentsTable documents={documents} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/documents-list.tsx
git commit -m "feat: add DocumentsList client wrapper with breadcrumbs"
```

---

### Task 10: Update Documents Page

**Files:**
- Modify: `frontend/app/(app)/documents/page.tsx`

**Step 1: Update the documents page to fetch and display data**

Replace `frontend/app/(app)/documents/page.tsx`:

```tsx
import { getDocumentsWithStacks } from '@/lib/queries/documents'
import { DocumentsList } from '@/components/documents/documents-list'

export default async function DocumentsPage() {
  const documents = await getDocumentsWithStacks()

  return <DocumentsList documents={documents} />
}
```

**Step 2: Verify the page works**

Run:
```bash
cd frontend && npm run dev
```

Navigate to http://localhost:3000/documents - should see the table (may be empty if no documents exist).

**Step 3: Commit**

```bash
git add frontend/app/\(app\)/documents/page.tsx
git commit -m "feat: implement documents list page with server-side data fetching"
```

---

## Phase 3: Document Detail Page

### Task 11: Install react-pdf

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install react-pdf**

Run:
```bash
cd frontend && npm install react-pdf
```

**Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add react-pdf dependency"
```

---

### Task 12: Create PDF Viewer Component

**Files:**
- Create: `frontend/components/pdf-viewer.tsx`

**Step 1: Create the PDF viewer client component**

Create `frontend/components/pdf-viewer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  url: string
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setLoading(false)
  }

  function onDocumentLoadError(error: Error) {
    setError(error.message)
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center">
      {error ? (
        <div className="text-destructive p-4">Failed to load PDF: {error}</div>
      ) : (
        <>
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex h-[600px] items-center justify-center">
                <span className="text-muted-foreground">Loading PDF...</span>
              </div>
            }
            className="max-h-[600px] overflow-auto"
          >
            <Page
              pageNumber={pageNumber}
              width={500}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>

          {!loading && numPages > 1 && (
            <div className="mt-4 flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => p - 1)}
              >
                <IconChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pageNumber} of {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((p) => p + 1)}
              >
                <IconChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/pdf-viewer.tsx
git commit -m "feat: add PdfViewer component with react-pdf"
```

---

### Task 13: Create Visual Preview Component

**Files:**
- Create: `frontend/components/visual-preview.tsx`

**Step 1: Create the visual preview component**

Create `frontend/components/visual-preview.tsx`:

```tsx
interface VisualPreviewProps {
  markdown: string | null
}

export function VisualPreview({ markdown }: VisualPreviewProps) {
  if (!markdown) {
    return (
      <div className="flex h-[600px] items-center justify-center text-muted-foreground">
        No OCR text available
      </div>
    )
  }

  return (
    <div className="prose prose-sm max-h-[600px] max-w-none overflow-auto p-4">
      {/* Render as preformatted text for now - can enhance with markdown renderer later */}
      <pre className="whitespace-pre-wrap font-sans text-sm">{markdown}</pre>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/visual-preview.tsx
git commit -m "feat: add VisualPreview component for OCR text"
```

---

### Task 14: Create Preview Panel Component

**Files:**
- Create: `frontend/components/documents/preview-panel.tsx`

**Step 1: Create the preview panel with tabs**

Create `frontend/components/documents/preview-panel.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VisualPreview } from '@/components/visual-preview'

// Dynamic import to avoid SSR issues with react-pdf
const PdfViewer = dynamic(() => import('@/components/pdf-viewer').then(mod => ({ default: mod.PdfViewer })), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center text-muted-foreground">
      Loading viewer...
    </div>
  ),
})

interface PreviewPanelProps {
  pdfUrl: string | null
  ocrText: string | null
  mimeType: string
}

export function PreviewPanel({ pdfUrl, ocrText, mimeType }: PreviewPanelProps) {
  const isPdf = mimeType === 'application/pdf'

  return (
    <Tabs defaultValue={isPdf ? 'pdf' : 'visual'} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="pdf" disabled={!isPdf}>
          PDF
        </TabsTrigger>
        <TabsTrigger value="visual">Visual</TabsTrigger>
      </TabsList>
      <TabsContent value="pdf" className="border rounded-md mt-2">
        {isPdf && pdfUrl ? (
          <PdfViewer url={pdfUrl} />
        ) : (
          <div className="flex h-[600px] items-center justify-center text-muted-foreground">
            PDF preview not available for this file type
          </div>
        )}
      </TabsContent>
      <TabsContent value="visual" className="border rounded-md mt-2">
        <VisualPreview markdown={ocrText} />
      </TabsContent>
    </Tabs>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/preview-panel.tsx
git commit -m "feat: add PreviewPanel with PDF and Visual tabs"
```

---

### Task 15: Create Extracted Data Table Component

**Files:**
- Create: `frontend/components/documents/extracted-data-table.tsx`

**Step 1: Create the extracted data display component**

Create `frontend/components/documents/extracted-data-table.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null
  confidenceScores: Record<string, number> | null
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>
  }

  if (Array.isArray(value)) {
    return (
      <Badge variant="secondary" className="font-mono text-xs">
        {value.length} items
      </Badge>
    )
  }

  if (typeof value === 'object') {
    return (
      <Badge variant="secondary" className="font-mono text-xs">
        Object
      </Badge>
    )
  }

  // Format currency values
  if (typeof value === 'string' && /^\$?[\d,]+\.?\d*$/.test(value)) {
    return <span className="font-mono tabular-nums">{value}</span>
  }

  return <span className="text-foreground">{String(value)}</span>
}

function ConfidenceIndicator({ score }: { score: number }) {
  const percentage = Math.round(score * 100)

  // Simple dot + percentage, colored by confidence level
  const dotColor = score >= 0.9
    ? 'bg-green-500'
    : score >= 0.7
      ? 'bg-amber-500'
      : 'bg-red-500'

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <span className={cn('size-1.5 rounded-full', dotColor)} />
      <span className="text-xs tabular-nums text-muted-foreground">
        {percentage}%
      </span>
    </div>
  )
}

export function ExtractedDataTable({
  fields,
  confidenceScores,
}: ExtractedDataTableProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
        <div className="text-center">
          <p className="text-sm">No extracted data</p>
          <p className="text-xs mt-1">Run extraction to populate fields</p>
        </div>
      </div>
    )
  }

  const entries = Object.entries(fields)

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 text-sm font-normal text-muted-foreground w-1/3">
              Field
            </TableHead>
            <TableHead className="h-10 text-sm font-normal text-muted-foreground">
              Value
            </TableHead>
            <TableHead className="h-10 text-sm font-normal text-muted-foreground w-28 text-right">
              Confidence
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => {
            const confidence = confidenceScores?.[key]
            return (
              <TableRow
                key={key}
                className="border-0 hover:bg-muted/50 transition-colors duration-150"
              >
                <TableCell className="py-3">
                  <span className="text-sm text-muted-foreground">
                    {key.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  {renderValue(value)}
                </TableCell>
                <TableCell className="py-3">
                  {confidence !== undefined ? (
                    <ConfidenceIndicator score={confidence} />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/extracted-data-table.tsx
git commit -m "feat: add ExtractedDataTable component"
```

---

### Task 16: Create Stacks Dropdown Component

**Files:**
- Create: `frontend/components/documents/stacks-dropdown.tsx`

**Step 1: Create the stacks dropdown component**

Create `frontend/components/documents/stacks-dropdown.tsx`:

```tsx
'use client'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Stack } from '@/types/documents'

interface StacksDropdownProps {
  assignedStacks: Stack[]
  allStacks?: Stack[]
  onToggleStack?: (stackId: string, assigned: boolean) => void
}

export function StacksDropdown({
  assignedStacks,
  allStacks = [],
  onToggleStack,
}: StacksDropdownProps) {
  const assignedIds = new Set(assignedStacks.map((s) => s.id))

  if (assignedStacks.length === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground cursor-not-allowed">
        No stacks
      </Badge>
    )
  }

  const displayText =
    assignedStacks.length === 1
      ? assignedStacks[0].name
      : `${assignedStacks[0].name} +${assignedStacks.length - 1}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors"
        >
          {displayText}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Assign to Stacks</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allStacks.length > 0 ? (
          allStacks.map((stack) => (
            <DropdownMenuCheckboxItem
              key={stack.id}
              checked={assignedIds.has(stack.id)}
              onCheckedChange={(checked) => onToggleStack?.(stack.id, checked)}
            >
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        ) : (
          assignedStacks.map((stack) => (
            <DropdownMenuCheckboxItem
              key={stack.id}
              checked={true}
              disabled
            >
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/stacks-dropdown.tsx
git commit -m "feat: add StacksDropdown component"
```

---

### Task 17: Create Document Detail Page Client Component

**Files:**
- Create: `frontend/components/documents/document-detail.tsx`

**Step 1: Create the document detail client component**

Create `frontend/components/documents/document-detail.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useBreadcrumbs } from '@/contexts/page-header-context'
import { PageHeader } from '@/components/page-header'
import { ExtractedDataTable } from './extracted-data-table'
import { PreviewPanel } from './preview-panel'
import { StacksDropdown } from './stacks-dropdown'
import { Button } from '@/components/ui/button'
import { IconEdit, IconDownload } from '@tabler/icons-react'
import type { DocumentWithExtraction } from '@/types/documents'

interface DocumentDetailProps {
  document: DocumentWithExtraction
  signedUrl: string | null
}

export function DocumentDetail({ document, signedUrl }: DocumentDetailProps) {
  const { setBreadcrumbs } = useBreadcrumbs()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Documents', href: '/documents' },
      { label: document.filename },
    ])
  }, [setBreadcrumbs, document.filename])

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <StacksDropdown assignedStacks={document.stacks} />
            <Button variant="outline" size="sm" disabled>
              <IconEdit className="mr-2 size-4" />
              Edit
            </Button>
            <Button variant="outline" size="sm" disabled>
              <IconDownload className="mr-2 size-4" />
              Export
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Extracted Data */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Extracted Data</h2>
          <ExtractedDataTable
            fields={document.extracted_fields}
            confidenceScores={document.confidence_scores}
          />
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Preview</h2>
          <PreviewPanel
            pdfUrl={signedUrl}
            ocrText={document.ocr_raw_text}
            mimeType={document.mime_type}
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/document-detail.tsx
git commit -m "feat: add DocumentDetail client component"
```

---

### Task 18: Create Document Detail Page

**Files:**
- Create: `frontend/app/(app)/documents/[id]/page.tsx`

**Step 1: Create the document detail server page**

Create `frontend/app/(app)/documents/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { DocumentDetail } from '@/components/documents/document-detail'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  // Get signed URL for PDF viewing
  let signedUrl: string | null = null
  if (document.file_path) {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_path, 3600) // 1 hour expiry

    signedUrl = data?.signedUrl || null
  }

  return <DocumentDetail document={document} signedUrl={signedUrl} />
}
```

**Step 2: Verify the page works**

Run:
```bash
cd frontend && npm run dev
```

Navigate to http://localhost:3000/documents/[some-id] - should show 404 or document detail if ID exists.

**Step 3: Commit**

```bash
git add frontend/app/\(app\)/documents/\[id\]
git commit -m "feat: implement document detail page with server-side data fetching"
```

---

## Phase 4: AI Chat Bar (Stub)

### Task 19: Create AI Chat Bar Component (Stub)

**Files:**
- Create: `frontend/components/documents/ai-chat-bar.tsx`

**Step 1: Create the AI chat bar stub**

Create `frontend/components/documents/ai-chat-bar.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { IconSparkles, IconArrowUp, IconLoader2 } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

interface AiChatBarProps {
  documentId: string
  sessionId: string | null
  onSubmit?: (message: string) => void
}

export function AiChatBar({ documentId, sessionId, onSubmit }: AiChatBarProps) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [message])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isSubmitting) return

    setIsSubmitting(true)
    // TODO: Implement actual agent call
    console.log('Submit to agent:', { documentId, sessionId, message })
    onSubmit?.(message)
    setMessage('')
    setIsSubmitting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 pb-4 pt-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-2xl px-4 pointer-events-auto"
      >
        <div
          className={cn(
            'flex items-end gap-2 rounded-xl border bg-background/95 backdrop-blur-sm p-3 shadow-lg transition-all duration-200',
            isFocused && 'ring-2 ring-primary/20 border-primary/50'
          )}
        >
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0">
            <IconSparkles className="size-4 text-primary" />
          </div>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent to edit, analyze, or transform data..."
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-[120px] py-1"
            rows={1}
            disabled={isSubmitting}
          />

          <Button
            type="submit"
            size="icon"
            className={cn(
              'size-8 shrink-0 rounded-lg transition-all duration-200',
              message.trim()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground'
            )}
            disabled={!message.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconArrowUp className="size-4" />
            )}
          </Button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/ai-chat-bar.tsx
git commit -m "feat: add AI chat bar component stub"
```

---

### Task 20: Add AI Chat Bar to Document Detail

**Files:**
- Modify: `frontend/components/documents/document-detail.tsx`

**Step 1: Update document detail to include chat bar**

Update `frontend/components/documents/document-detail.tsx` to include the AI chat bar at the bottom:

Add import at top:
```tsx
import { AiChatBar } from './ai-chat-bar'
```

Add before the closing `</div>` of the component return:
```tsx
      {/* AI Chat Bar */}
      <AiChatBar
        documentId={document.id}
        sessionId={document.session_id}
      />

      {/* Spacer for fixed chat bar */}
      <div className="h-20" />
```

**Step 2: Verify everything works**

Run:
```bash
cd frontend && npm run dev
```

Navigate to a document detail page - should see the chat bar at the bottom.

**Step 3: Commit**

```bash
git add frontend/components/documents/document-detail.tsx
git commit -m "feat: integrate AI chat bar into document detail page"
```

---

## Phase 5: Final Integration & Testing

### Task 21: Run Build and Fix Any Issues

**Step 1: Run TypeScript check**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No type errors

**Step 2: Run build**

Run:
```bash
cd frontend && npm run build
```

Expected: Build succeeds

**Step 3: Fix any errors**

If errors occur, fix them and commit:
```bash
git add -A
git commit -m "fix: resolve build errors"
```

---

### Task 22: Final Commit

**Step 1: Final commit with summary**

```bash
git add -A
git commit -m "feat: complete documents page implementation

- Documents list page with TanStack Table
- Document detail page with extracted data and preview
- Page header system with breadcrumbs and actions
- PDF viewer with react-pdf
- AI chat bar stub (ready for agent integration)
- Stack badges and dropdown components"
```

---

## Summary

**Components Created:**
1. `PageHeaderProvider` - React Context for breadcrumbs
2. `PageHeader` - Header with breadcrumbs and actions slot
3. `DocumentsTable` - TanStack Table for documents list
4. `FileTypeIcon` - PDF/image icon by mime type
5. `StackBadges` - Badge chips with overflow
6. `PdfViewer` - react-pdf integration
7. `VisualPreview` - OCR text display
8. `PreviewPanel` - Tabs for PDF/Visual
9. `ExtractedDataTable` - Field/Value/Confidence table
10. `StacksDropdown` - Stack assignment dropdown
11. `DocumentDetail` - Full detail page layout
12. `AiChatBar` - Stub for agent interaction

**Pages Implemented:**
- `/documents` - Documents list with table
- `/documents/[id]` - Document detail with extraction + preview

**Deferred for Future:**
- Edit Document dialog (field schema editing)
- Agent Response Panel (streaming output)
- Actual AI chat integration with backend
- Export functionality
- Upload functionality
