'use client'

import Link from 'next/link'
import { SubBar } from '@/components/layout/sub-bar'
import { ActionButton } from '@/components/layout/action-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import * as Icons from '@/components/icons'
import type { StackWithCounts } from '@/types/stacks'

interface StacksListProps {
  stacks: StackWithCounts[]
}

export function StacksList({ stacks }: StacksListProps) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <SubBar
        left={
          <span className="text-sm text-muted-foreground">
            {stacks.length} stack{stacks.length !== 1 ? 's' : ''}
          </span>
        }
        right={
          <Link href="/stacks/new">
            <ActionButton icon={<Icons.Plus />}>
              New Stack
            </ActionButton>
          </Link>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {stacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-4">
              <Icons.Stack className="size-8 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">No stacks yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Create a stack to group related documents and extract data in bulk
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stacks.map((stack) => (
              <Link key={stack.id} href={`/stacks/${stack.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icons.Stack className="size-5 text-muted-foreground" />
                      <CardTitle className="text-base">{stack.name}</CardTitle>
                    </div>
                    {stack.description && (
                      <CardDescription className="line-clamp-2">
                        {stack.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Icons.Files className="size-4" />
                        <span>{stack.document_count} docs</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icons.Table className="size-4" />
                        <span>{stack.table_count} tables</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
