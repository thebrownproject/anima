import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for document header slot.
 * Shown while document data is being fetched.
 */
export default function HeaderLoading() {
  return (
    <div
      className="flex items-center justify-between shrink-0 w-full"
      role="status"
      aria-label="Loading document header"
    >
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <span className="text-muted-foreground/30">/</span>
        <Skeleton className="h-4 w-32" />
      </div>
      {/* Actions skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-14" />
        <Skeleton className="h-7 w-16" />
      </div>
    </div>
  )
}
