"use client"

import * as React from "react"
import { ContextMenu as ContextMenuPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

const GlassContextMenu = ContextMenuPrimitive.Root

const GlassContextMenuTrigger = ContextMenuPrimitive.Trigger

const GlassContextMenuGroup = ContextMenuPrimitive.Group

const GlassContextMenuSub = ContextMenuPrimitive.Sub

const GlassContextMenuContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 min-w-[14rem] overflow-hidden rounded-xl p-1.5",
        "bg-white/10 backdrop-blur-xl border border-white/20",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
GlassContextMenuContent.displayName = "GlassContextMenuContent"

const GlassContextMenuItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-hidden select-none",
      "text-white/70 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white",
      "transition-colors",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  />
))
GlassContextMenuItem.displayName = "GlassContextMenuItem"

function GlassContextMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(
        "px-2 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider",
        className,
      )}
      {...props}
    />
  )
}

function GlassContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("h-px bg-white/10 my-1 mx-2", className)}
      {...props}
    />
  )
}

export {
  GlassContextMenu,
  GlassContextMenuTrigger,
  GlassContextMenuContent,
  GlassContextMenuItem,
  GlassContextMenuLabel,
  GlassContextMenuSeparator,
  GlassContextMenuGroup,
  GlassContextMenuSub,
}
