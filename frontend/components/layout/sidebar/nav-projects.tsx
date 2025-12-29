// frontend/components/layout/sidebar/nav-projects.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as Icons from "@/components/icons"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface StackItem {
  id: string
  name: string
}

export function NavProjects({ stacks }: { stacks: StackItem[] }) {
  const pathname = usePathname()

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="group-data-[collapsible=icon]:hidden pt-0">
        <SidebarGroupLabel asChild>
          <div className="flex w-full items-center justify-between">
            <CollapsibleTrigger className="flex items-center hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors cursor-pointer px-2 py-1 -ml-2">
              Stacks
              <Icons.ChevronRight className="ml-1 size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/stacks/new"
                  className="opacity-0 group-hover/collapsible:opacity-100 p-1 hover:bg-sidebar-accent rounded-md transition-all"
                >
                  <Icons.Plus className="size-4 text-muted-foreground hover:text-foreground" />
                  <span className="sr-only">Create stack</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Create stack</TooltipContent>
            </Tooltip>
          </div>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={cn("gap-1.5", pathname === "/stacks" && "bg-sidebar-accent")}
                >
                  <Link href="/stacks">
                    <Icons.LayersLinked className="size-4" />
                    <span>All Stacks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {stacks.map((stack) => (
                <SidebarMenuItem key={stack.id}>
                  <SidebarMenuButton
                    asChild
                    className={cn("gap-1.5", pathname === `/stacks/${stack.id}` && "bg-sidebar-accent")}
                  >
                    <Link href={`/stacks/${stack.id}`}>
                      <Icons.Stack className="size-4" />
                      <span className="truncate">{stack.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {stacks.length === 0 && (
                <SidebarMenuItem>
                  <span className="text-xs text-muted-foreground px-2 py-1">
                    No stacks yet
                  </span>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
