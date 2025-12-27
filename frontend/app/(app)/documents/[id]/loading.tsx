import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for document detail page.
 * Matches DocumentDetailClient layout: SubBar + resizable panels + AI chat bar.
 */
export default function DocumentDetailLoading() {
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
          {/* No stacks text placeholder */}
          <Skeleton className="h-4 w-16" />
          {/* Edit button */}
          <Skeleton className="h-7 w-14 rounded-md" />
          {/* Export button */}
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>

      {/* Main content - simulates resizable panel layout (60/40 split) */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Extracted Data table skeleton */}
        <div className="flex-[60] overflow-auto border-r">
          <div className="w-full">
            {/* Header row */}
            <div className="flex items-center h-9 px-4 bg-muted/30 border-b">
              {/* Checkbox column */}
              <div className="w-10 shrink-0">
                <Skeleton className="size-4 rounded" />
              </div>
              {/* Field column */}
              <div className="flex-1 min-w-0">
                <Skeleton className="h-3 w-12" />
              </div>
              {/* Value column */}
              <div className="w-48 shrink-0">
                <Skeleton className="h-3 w-12" />
              </div>
            </div>

            {/* Data rows */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center h-12 px-4 border-b">
                {/* Checkbox column */}
                <div className="w-10 shrink-0">
                  <Skeleton className="size-4 rounded" />
                </div>
                {/* Field column - chevron + confidence + field name */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <Skeleton className="size-4 rounded shrink-0" />
                  <Skeleton className="size-2 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-24" />
                </div>
                {/* Value column */}
                <div className="w-48 shrink-0">
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Preview panel skeleton */}
        <div className="flex-[40] flex flex-col">
          {/* Tab list */}
          <div className="flex items-center gap-1 px-4 py-2 border-b">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          {/* PDF preview area */}
          <div className="flex-1 p-4">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        </div>
      </div>

      {/* AI Chat bar skeleton - floating at bottom */}
      <div className="shrink-0 px-4 py-4 border-t">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
