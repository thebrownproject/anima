"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import * as Icons from "@/components/icons"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { DesktopMenuBody } from "@/components/desktop/desktop-context-menu"

function TabMenuPopover() {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <span
          role="button"
          tabIndex={-1}
          className="absolute left-0.5 z-20 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
        >
          <Icons.DotsHorizontal className="size-3 text-muted-foreground" />
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={12}
          className={cn(
            "z-50 min-w-[14rem] overflow-hidden rounded-xl p-1.5",
            "bg-popover border border-border",
            "shadow-md",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2",
          )}
        >
          <DesktopMenuBody />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

interface GlassTabSwitcherProps {
  tabs: { value: string; label: string; dot?: string }[]
  value: string
  onValueChange: (value: string) => void
  onClose?: (value: string) => void
  className?: string
}

const GlassTabSwitcher = React.forwardRef<HTMLDivElement, GlassTabSwitcherProps>(
  ({ tabs, value, onValueChange, onClose, className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [indicator, setIndicator] = React.useState({ left: 0, width: 0 })

    // Measure active tab position on value change + mount
    React.useEffect(() => {
      const container = containerRef.current
      if (!container) return
      const activeBtn = container.querySelector<HTMLDivElement>(`[data-value="${value}"]`)
      if (!activeBtn) return
      setIndicator({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      })
    }, [value])

    return (
      <div ref={ref} className={cn("relative", className)}>
        <div
          ref={containerRef}
          className={cn(
            "relative inline-flex h-10 items-center rounded-full p-1",
            "bg-card border border-border shadow-sm",
          )}
        >
          {/* Sliding glass indicator */}
          {indicator.width > 0 && (
            <div
              className="absolute inset-y-1 rounded-full bg-accent transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{ left: indicator.left, width: indicator.width }}
            />
          )}

          {/* Tab buttons */}
          {tabs.map((tab) => (
            <div
              key={tab.value}
              data-value={tab.value}
              className="group relative flex h-full items-center"
            >
              <button
                onClick={() => onValueChange(tab.value)}
                className={cn(
                  "relative z-10 flex h-full items-center whitespace-nowrap rounded-full px-6 text-xs font-medium transition-colors duration-200",
                  tab.value === value
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:bg-accent/50 group-hover:text-foreground",
                )}
              >
                {tab.dot && (
                  <span
                    className="mr-2 size-1.5 rounded-full"
                    style={{ backgroundColor: tab.dot }}
                  />
                )}
                {tab.label}
              </button>

              {/* More button (left) */}
              <TabMenuPopover />

              {/* Close button (right) */}
              {onClose && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(tab.value)
                  }}
                  className="absolute right-0.5 z-20 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                >
                  <Icons.X className="size-3 text-muted-foreground" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  },
)
GlassTabSwitcher.displayName = "GlassTabSwitcher"

export { GlassTabSwitcher }
