"use client"

import * as React from "react"
import {
  IconFileText,
  IconLayers,
  IconLifebuoy,
  IconSend,
  IconStack2,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "User", // Will be replaced with Clerk user data in Phase 2
    email: "user@example.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Workspace",
      url: "#",
      icon: IconStack2,
      isActive: true,
      items: [
        {
          title: "Documents",
          url: "/documents",
        },
        {
          title: "Extractions",
          url: "/extractions",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: IconLifebuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: IconSend,
    },
  ],
  // Stacks will be loaded dynamically from Supabase in Phase 2
  // For now, show placeholder
  projects: [
    {
      name: "All Stacks",
      url: "/stacks",
      icon: IconLayers,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/documents">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <IconFileText className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">StackDocs</span>
                  <span className="truncate text-xs">Document Extraction</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
