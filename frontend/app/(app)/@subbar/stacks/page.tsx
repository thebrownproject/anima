'use client'

import Link from 'next/link'
import { SubBar } from '@/components/layout/sub-bar'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { Button } from '@/components/ui/button'
import { useStacksFilter } from '@/components/stacks/stacks-filter-context'
import * as Icons from '@/components/icons'

/**
 * SubBar for stacks list page.
 * Renders search input and "New Stack" button.
 * Consumes filter state from StacksFilterContext (shared with StacksList).
 */
export default function StacksSubBar() {
  const { filterValue, setFilterValue } = useStacksFilter()

  return (
    <SubBar
      left={
        <ExpandableSearch
          value={filterValue}
          onChange={setFilterValue}
          placeholder="Search stacks..."
        />
      }
      right={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
          <Link href="/stacks/new">
            <Icons.Plus className="size-3.5" />
            New Stack
          </Link>
        </Button>
      }
    />
  )
}
