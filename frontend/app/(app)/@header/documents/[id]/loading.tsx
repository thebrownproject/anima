import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for document header slot.
 * Matches PageHeader layout: breadcrumb with icons + icon-only toggle action.
 */
export default function HeaderLoading() {
  return (
    <div
      className="flex flex-1 items-center justify-between"
      role="status"
      aria-label="Loading document header"
    >
      {/* Breadcrumb skeleton - matches PageHeader BreadcrumbList */}
      <div className="flex items-center gap-1.5">
        {/* Documents segment: icon + text */}
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 w-20" />
        {/* Separator */}
        <span className="mx-2 text-muted-foreground/50">&gt;</span>
        {/* Document filename segment: file icon + text */}
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 w-40" />
      </div>
      {/* Actions skeleton - icon-only toggle with mr-2.5 to match PreviewToggle */}
      <Skeleton className="size-7 mr-2.5 rounded-md" />
    </div>
  )
}
