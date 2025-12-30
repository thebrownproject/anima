import Link from 'next/link'
import { getStacksWithCounts } from '@/lib/queries/stacks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import * as Icons from '@/components/icons'

export default async function StacksPage() {
  const stacks = await getStacksWithCounts()

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm text-muted-foreground">
            {stacks.length} stack{stacks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 mr-2">
          <Link
            href="/stacks/new"
            className="inline-flex items-center gap-2 rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
          >
            <Icons.Plus className="size-4" />
            New Stack
          </Link>
        </div>
      </div>

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
