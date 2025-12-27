import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for documents list header slot.
 * Matches PageHeader layout: breadcrumb with icon + icon-only toggle action.
 */
export default function HeaderLoading() {
  return (
    <div
      className="flex flex-1 items-center justify-between"
      role="status"
      aria-label="Loading documents header"
    >
      {/* Breadcrumb skeleton - single segment: icon + text */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 w-24" />
      </div>
      {/* Actions skeleton - icon-only toggle with mr-2.5 to match PreviewToggle */}
      <Skeleton className="size-7 mr-2.5 rounded-md" />
    </div>
  )
}
