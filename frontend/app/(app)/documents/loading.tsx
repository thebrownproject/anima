import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for documents list page.
 * Matches DocumentsTable layout: SubBar + table with resizable preview panel.
 */
export default function DocumentsLoading() {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar skeleton - matches SubBar layout */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
        <div className="flex items-center gap-2 ml-2">
          {/* Filter button */}
          <Skeleton className="h-7 w-14 rounded-md" />
          {/* Search - collapsed state */}
          <Skeleton className="size-7 rounded-md" />
        </div>
        <div className="flex items-center gap-2 mr-2">
          {/* Upload button */}
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="flex-1 overflow-auto">
        <div className="w-full">
          {/* Header row - matches bg-muted/30 */}
          <div className="flex items-center h-9 px-4 bg-muted/30 border-b">
            {/* Checkbox column */}
            <div className="w-10 shrink-0">
              <Skeleton className="size-4 rounded" />
            </div>
            {/* Filename column */}
            <div className="flex-1 min-w-0">
              <Skeleton className="h-3 w-16" />
            </div>
            {/* Stacks column */}
            <div className="w-32 shrink-0">
              <Skeleton className="h-3 w-12" />
            </div>
            {/* Status column */}
            <div className="w-24 shrink-0">
              <Skeleton className="h-3 w-12" />
            </div>
            {/* Date column */}
            <div className="w-24 shrink-0 text-right pr-1">
              <Skeleton className="h-3 w-16 ml-auto" />
            </div>
          </div>

          {/* Data rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center h-12 px-4 border-b">
              {/* Checkbox column */}
              <div className="w-10 shrink-0">
                <Skeleton className="size-4 rounded" />
              </div>
              {/* Filename column - icon + text */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <Skeleton className="size-4 rounded shrink-0" />
                <Skeleton className="h-4 w-48" />
              </div>
              {/* Stacks column - badge */}
              <div className="w-32 shrink-0">
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              {/* Status column - badge */}
              <div className="w-24 shrink-0">
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              {/* Date column */}
              <div className="w-24 shrink-0 text-right pr-1">
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
