'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { usePreviewPanel } from '@/components/documents/preview-panel-context'

/**
 * Loading skeleton for documents list page.
 * Uses preview panel context to match current layout (prevents shift on load).
 */
export default function DocumentsLoading() {
  const { isCollapsed, panelWidth } = usePreviewPanel()
  const mainWidth = isCollapsed ? 100 : 100 - panelWidth

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar skeleton */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
        <div className="flex items-center gap-2 ml-2">
          <Skeleton className="h-7 w-14 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
        <div className="flex items-center gap-2 mr-2">
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </div>

      {/* Main content with preview split */}
      <div className="flex flex-1 min-h-0">
        {/* Table area */}
        <div style={{ width: `${mainWidth}%` }} className="overflow-hidden border-r">
          {/* Table header skeleton */}
          <div className="flex h-9 items-center gap-4 border-b bg-muted/30 px-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          {/* Table rows skeleton */}
          <div className="p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-12 items-center gap-4 border-b px-4">
                <Skeleton className="h-4 w-4" />
                <div className="flex items-center gap-2 flex-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Preview area skeleton (if not collapsed) */}
        {!isCollapsed && (
          <div style={{ width: `${panelWidth}%` }} className="overflow-hidden">
            {/* Preview header skeleton */}
            <div className="flex h-[40.5px] items-center px-4 border-b">
              <Skeleton className="h-7 w-24" />
            </div>
            {/* Preview content skeleton */}
            <div className="p-4">
              <Skeleton className="h-[500px] w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
