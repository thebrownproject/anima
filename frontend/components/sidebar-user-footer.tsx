"use client"

import { useUser, useClerk } from "@clerk/nextjs"
import { IconLogout, IconSettings } from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarUserFooter() {
  const { user, isLoaded } = useUser()
  const { openUserProfile, signOut } = useClerk()

  // Don't render until Clerk has loaded
  if (!isLoaded || !user) {
    return (
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center h-8 px-2">
              <div className="size-6 rounded-full bg-muted animate-pulse" />
              <div className="ml-2 h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    )
  }

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "?"
  const displayName = user.fullName || user.primaryEmailAddress?.emailAddress || "User"

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center justify-between w-full h-8 px-2">
            {/* Left: Avatar + Name (clickable to open profile) */}
            <button
              onClick={() => openUserProfile()}
              className="flex items-center gap-2 min-w-0 rounded-md px-1 -ml-1 hover:bg-sidebar-accent transition-colors"
            >
              <Avatar className="size-6">
                <AvatarImage src={user.imageUrl} alt={displayName} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{displayName}</span>
            </button>

            {/* Right: Icon Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => openUserProfile()}
              >
                <IconSettings className="size-4" />
                <span className="sr-only">Manage Account</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => signOut({ redirectUrl: "/" })}
              >
                <IconLogout className="size-4" />
                <span className="sr-only">Sign Out</span>
              </Button>
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
