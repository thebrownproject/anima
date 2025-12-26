"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import {
  IconStack2,
  IconChevronDown,
  IconSearch,
  IconUpload,
  IconSettings,
  IconLifebuoy,
  IconSend,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconCheck,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarHeader, SidebarMenuButton } from "@/components/ui/sidebar"
import { GlobalSearchDialog } from "@/components/global-search-dialog"
import { UploadDialogContent } from "@/components/documents/upload-dialog/upload-dialog-content"

export function SidebarHeaderMenu() {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [uploadOpen, setUploadOpen] = React.useState(false)

  return (
    <>
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <UploadDialogContent onClose={() => setUploadOpen(false)} />
      </Dialog>
      <SidebarHeader className="h-[47px] flex flex-row items-center justify-between gap-2 px-2 py-0">
        {/* Logo + Name + Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="flex-1 h-8 gap-1.5 data-[state=open]:bg-sidebar-accent">
              <IconStack2 className="size-6" />
              <span className="font-semibold">Stackdocs</span>
              <IconChevronDown className="size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem disabled>
              <IconSettings className="size-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="#">
                <IconLifebuoy className="size-4" />
                <span>Support</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="#">
                <IconSend className="size-4" />
                <span>Feedback</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconSun className="size-4 dark:hidden" />
                <IconMoon className="size-4 hidden dark:block" />
                <span>Theme</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <IconDeviceDesktop className="size-4" />
                  <span>Auto</span>
                  {theme === "system" && <IconCheck className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <IconSun className="size-4" />
                  <span>Light</span>
                  {theme === "light" && <IconCheck className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <IconMoon className="size-4" />
                  <span>Dark</span>
                  {theme === "dark" && <IconCheck className="ml-auto size-4" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setSearchOpen(true)}
          >
            <IconSearch className="size-4" />
            <span className="sr-only">Search</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setUploadOpen(true)}
          >
            <IconUpload className="size-4" />
            <span className="sr-only">Upload</span>
          </Button>
        </div>
      </SidebarHeader>
    </>
  )
}
