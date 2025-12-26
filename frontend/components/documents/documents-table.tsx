'use client'

import * as React from 'react'
import { useAuth } from '@clerk/nextjs'
import {
  ColumnFiltersState,
  SortingState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { createClerkSupabaseClient } from '@/lib/supabase'
import { columns } from './columns'
import { SubBar } from './sub-bar'
import { FilterButton } from './filter-button'
import { SelectionActions } from './selection-actions'
import { UploadDialogTrigger } from './upload-dialog'
import { PreviewPanel } from './preview-panel'
import { usePreviewPanel } from './preview-panel-context'
import type { Document } from '@/types/documents'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const LAYOUT_STORAGE_KEY = 'stackdocs-doc-list-layout'

interface DocumentsTableProps {
  documents: Document[]
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null)
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null)

  // Auth for Supabase client
  const { getToken } = useAuth()

  // Preview panel integration
  const { panelRef, isCollapsed, setIsCollapsed } = usePreviewPanel()

  // Find selected document from documents array
  const selectedDoc = React.useMemo(() => {
    if (!selectedDocId) return null
    return documents.find((d) => d.id === selectedDocId) ?? null
  }, [selectedDocId, documents])

  // Fetch signed URL when selected document changes
  React.useEffect(() => {
    const filePath = selectedDoc?.file_path
    if (!filePath) {
      setSignedUrl(null)
      return
    }

    const fetchSignedUrl = async () => {
      try {
        const supabase = createClerkSupabaseClient(getToken)
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 3600) // 1 hour expiry
        setSignedUrl(data?.signedUrl ?? null)
      } catch {
        setSignedUrl(null)
      }
    }

    fetchSignedUrl()
  }, [selectedDocId, selectedDoc?.file_path, getToken])

  // Layout persistence for resizable panels
  const [defaultLayout] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved) as number[]
        } catch {
          return [70, 30]
        }
      }
    }
    return [70, 30]
  })

  const handleLayoutChange = React.useCallback((sizes: number[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(sizes))
    }
  }, [])

  // Clear selection when preview panel closes
  React.useEffect(() => {
    if (isCollapsed) {
      setSelectedDocId(null)
    }
  }, [isCollapsed])

  const table = useReactTable({
    data: documents,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  })

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar */}
      <SubBar
        left={
          <>
            <FilterButton />
            <ExpandableSearch
              value={(table.getColumn('filename')?.getFilterValue() as string) ?? ''}
              onChange={(value) => table.getColumn('filename')?.setFilterValue(value)}
              placeholder="Search documents..."
            />
          </>
        }
        right={
          <>
            <SelectionActions
              selectedCount={table.getFilteredSelectedRowModel().rows.length}
            />
            <UploadDialogTrigger />
          </>
        }
      />

      {/* Main content - resizable layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 overflow-hidden"
        onLayout={handleLayoutChange}
      >
        {/* Left: Documents table - main content */}
        <ResizablePanel
          defaultSize={defaultLayout[0]}
          minSize={40}
          className="overflow-hidden min-w-0"
        >
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30 group/header">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "h-9 text-sm font-normal text-muted-foreground",
                          header.column.id === 'select' && "w-4",
                          header.column.id === 'uploaded_at' && "w-24 text-right pr-5"
                        )}
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
              <TableBody className="[&_tr:last-child]:border-b">
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "h-12 hover:bg-muted/30 transition-colors duration-150 group/row",
                        selectedDocId === row.original.id && "bg-muted/50"
                      )}
                      data-state={row.getIsSelected() && 'selected'}
                      onClick={() => {
                        // Toggle: if clicking same row, collapse; otherwise expand
                        if (selectedDocId === row.original.id) {
                          panelRef.current?.collapse()
                        } else {
                          setSelectedDocId(row.original.id)
                          if (panelRef.current?.isCollapsed()) {
                            panelRef.current.expand()
                          }
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "py-3",
                            cell.column.id === 'select' && "w-4",
                            cell.column.id === 'filename' && "max-w-0",
                            cell.column.id === 'stacks' && "max-w-0",
                            cell.column.id === 'uploaded_at' && "w-24"
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center py-8">
                        <div className="rounded-full bg-muted/50 p-4 mb-4">
                          <FileText className="size-8 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium">No documents yet</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                          Upload a document to start extracting data
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Preview - collapsible sidebar */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={defaultLayout[1]}
          minSize={25}
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
              ocrText={null}
              mimeType={selectedDoc?.mime_type ?? ''}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
