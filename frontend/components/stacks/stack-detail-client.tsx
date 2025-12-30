'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SubBar } from '@/components/layout/sub-bar'
import { ActionButton } from '@/components/layout/action-button'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { Separator } from '@/components/ui/separator'
import { SelectionActions } from '@/components/layout/selection-actions'
import { StackDocumentsTab } from './stack-documents-tab'
import { StackTableView } from './stack-table-view'
import * as Icons from '@/components/icons'
import type { StackWithDetails, StackTable, StackTableRow } from '@/types/stacks'

interface StackDetailClientProps {
  stack: StackWithDetails
  activeTab: string
  activeTable: StackTable | null
  tableRows: StackTableRow[] | null
}

const MAX_VISIBLE_TABS = 3

export function StackDetailClient({
  stack,
  activeTab,
  activeTable,
  tableRows,
}: StackDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchFilter, setSearchFilter] = React.useState('')
  const [selectedDocCount, setSelectedDocCount] = React.useState(0)

  React.useEffect(() => {
    localStorage.setItem(`stack-${stack.id}-view`, activeTab)
  }, [stack.id, activeTab])

  const handleTabChange = (tab: string, tableId?: string) => {
    setSearchFilter('') // Reset search when changing tabs
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    if (tableId) params.set('table', tableId)
    else params.delete('table')
    router.push(`/stacks/${stack.id}?${params.toString()}`)
  }

  const visibleTables = stack.tables.slice(0, MAX_VISIBLE_TABS)
  const overflowTables = stack.tables.slice(MAX_VISIBLE_TABS)
  const isDocumentsActive = activeTab === 'documents'
  const isTableActive = activeTab === 'table' && activeTable

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <SubBar
        left={
          <div className="flex items-center gap-1">
            <ActionButton
              icon={<Icons.Files />}
              onClick={() => handleTabChange('documents')}
              className={isDocumentsActive ? 'text-foreground' : 'text-muted-foreground'}
            >
              Docs
            </ActionButton>

            <Separator
              orientation="vertical"
              className="mx-1 data-[orientation=vertical]:h-4"
            />

            {visibleTables.map((table) => (
              <ActionButton
                key={table.id}
                icon={<Icons.Table />}
                onClick={() => handleTabChange('table', table.id)}
                className={activeTable?.id === table.id ? 'text-foreground max-w-[120px]' : 'text-muted-foreground max-w-[120px]'}
              >
                <span className="truncate">{table.name}</span>
              </ActionButton>
            ))}

            {overflowTables.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Icons.ChevronDown className="size-4" />
                    {overflowTables.length} more
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {overflowTables.map((table) => (
                    <DropdownMenuItem
                      key={table.id}
                      onClick={() => handleTabChange('table', table.id)}
                    >
                      <Icons.Table className="size-4 mr-2" />
                      {table.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <ActionButton
              icon={<Icons.Plus />}
              tooltip="Create table"
            >
              <span className="sr-only">Create table</span>
            </ActionButton>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            {isDocumentsActive && (
              <SelectionActions selectedCount={selectedDocCount} />
            )}
            <ExpandableSearch
              value={searchFilter}
              onChange={setSearchFilter}
              placeholder={isDocumentsActive ? 'Search documents...' : 'Search table...'}
            />
            {isDocumentsActive && (
              <ActionButton icon={<Icons.Plus />} tooltip="Add documents" className="mr-2">
                Add
              </ActionButton>
            )}
            {isTableActive && (
              <ActionButton icon={<Icons.Download />} tooltip="Export as CSV" className="mr-2">
                Export CSV
              </ActionButton>
            )}
          </div>
        }
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {isDocumentsActive && (
          <StackDocumentsTab
            documents={stack.documents}
            stackId={stack.id}
            searchFilter={searchFilter}
            onSelectionChange={setSelectedDocCount}
          />
        )}
        {isTableActive && tableRows && (
          <StackTableView
            table={activeTable}
            rows={tableRows}
            searchFilter={searchFilter}
          />
        )}
      </div>
    </div>
  )
}
