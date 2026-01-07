import { Button } from '@/components/ui/button'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'

interface PageNavigationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  variant?: 'overlay' | 'default'
  className?: string
}

export function PageNavigation({
  currentPage,
  totalPages,
  onPageChange,
  variant = 'default',
  className,
}: PageNavigationProps) {
  const isOverlay = variant === 'overlay'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        variant={isOverlay ? 'ghost' : 'outline'}
        size="icon"
        className={cn(
          'size-8',
          isOverlay && 'text-white hover:bg-white/20 hover:text-white'
        )}
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <Icons.ChevronLeft className="size-4" />
      </Button>

      <span
        className={cn(
          'text-sm tabular-nums min-w-[4rem] text-center',
          isOverlay ? 'text-white' : 'text-muted-foreground'
        )}
      >
        {currentPage} / {totalPages}
      </span>

      <Button
        variant={isOverlay ? 'ghost' : 'outline'}
        size="icon"
        className={cn(
          'size-8',
          isOverlay && 'text-white hover:bg-white/20 hover:text-white'
        )}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        <Icons.ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
