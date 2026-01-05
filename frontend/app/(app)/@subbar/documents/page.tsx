import { getStacksForSidebar } from '@/lib/queries/stacks'
import { DocumentsSubBarContent } from './documents-subbar-content'

/**
 * SubBar for documents list page (server component).
 * Fetches stacks for filter dropdown and passes to client component.
 */
export default async function DocumentsSubBar() {
  const stacks = await getStacksForSidebar()

  return <DocumentsSubBarContent stacks={stacks} />
}
