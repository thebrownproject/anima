"use client";

import * as React from "react";
import {
  IconFileText,
  IconLayersLinked,
  IconStack2,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { SidebarHeaderMenu } from "@/components/sidebar-header-menu";
import { SidebarUserFooter } from "@/components/sidebar-user-footer";
import {
  Sidebar,
  SidebarContent,
} from "@/components/ui/sidebar";

const data = {
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
          icon: IconFileText,
        },
        {
          title: "Extractions",
          url: "/extractions",
          icon: IconLayersLinked,
        },
      ],
    },
  ],
  // Stacks will be loaded dynamically from Supabase in Phase 2
  // For now, show placeholder
  projects: [
    {
      name: "All Stacks",
      url: "/stacks",
      icon: IconLayersLinked,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeaderMenu />
      <SidebarContent className="gap-0">
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarUserFooter />
    </Sidebar>
  );
}
