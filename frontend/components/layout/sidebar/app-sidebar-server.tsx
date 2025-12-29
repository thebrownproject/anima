import { getStacksForSidebar } from '@/lib/queries/stacks'
import { AppSidebarClient } from './app-sidebar-client'

export async function AppSidebar(props: React.ComponentProps<typeof AppSidebarClient>) {
  const stacks = await getStacksForSidebar()
  return <AppSidebarClient stacks={stacks} {...props} />
}
