"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import * as Icons from "@/components/icons"
import * as PopoverPrimitive from "@radix-ui/react-popover"

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
        {/* Pulsing glow (matches Ein UI glass-tabs) */}
        <motion.div
          className="absolute -inset-1 rounded-full bg-linear-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 blur-lg"
          animate={{ opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        />

        <div
          ref={containerRef}
          className={cn(
            "relative inline-flex h-10 items-center rounded-full p-1",
            "border border-white/20 bg-white/10 backdrop-blur-xl",
            "shadow-[0_4px_16px_rgba(0,0,0,0.2)]",
          )}
        >
          {/* Sliding glass indicator */}
          {indicator.width > 0 && (
            <div
              className="absolute inset-y-1 overflow-hidden rounded-full bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-white/20 before:to-transparent"
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
                    ? "text-white"
                    : "text-white/50 group-hover:bg-white/5 group-hover:text-white/80",
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
              <PopoverPrimitive.Root>
                <PopoverPrimitive.Trigger asChild>
                  <span
                    role="button"
                    tabIndex={-1}
                    className="absolute left-0.5 z-20 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                  >
                    <Icons.DotsHorizontal className="size-3 text-white/60" />
                  </span>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                  <PopoverPrimitive.Content
                    side="bottom"
                    align="start"
                    sideOffset={12}
                    className={cn(
                      "z-50 w-56 overflow-hidden rounded-xl p-1.5",
                      "bg-white/10 backdrop-blur-xl border border-white/20",
                      "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
                      "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                      "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
                      "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                    )}
                  >
                    <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Workspace
                    </p>
                    <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                      <Icons.Edit className="size-4" />
                      Rename
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                      <Icons.Files className="size-4" />
                      Duplicate
                    </button>
                    <div className="mx-2 my-1 h-px bg-white/10" />
                    <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-400/70 transition-colors hover:bg-white/10 hover:text-red-300">
                      <Icons.Trash className="size-4" />
                      Delete
                    </button>
                  </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
              </PopoverPrimitive.Root>

              {/* Close button (right) */}
              {onClose && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(tab.value)
                  }}
                  className="absolute right-0.5 z-20 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                >
                  <Icons.X className="size-3 text-white/60" />
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
