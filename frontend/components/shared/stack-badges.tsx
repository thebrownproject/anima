import { Badge } from '@/components/ui/badge'
import type { Stack } from '@/types/stacks'

interface StackBadgesProps {
  stacks: Pick<Stack, 'id' | 'name'>[]
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
