"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import * as Icons from "@/components/icons"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

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
              <Popover>
                <PopoverTrigger asChild>
                  <span
                    role="button"
                    tabIndex={-1}
                    className="absolute left-0.5 z-20 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                  >
                    <Icons.DotsHorizontal className="size-3 text-white/60" />
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="start"
                  sideOffset={12}
                  className="w-56 rounded-2xl border border-white/20 bg-white/10 p-0 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
                >
                  <div className="p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Workspace
                    </p>
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10">
                      <Icons.Edit className="size-4 text-white/50" />
                      Rename
                    </button>
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10">
                      <Icons.Files className="size-4 text-white/50" />
                      Duplicate
                    </button>
                  </div>
                  <div className="border-t border-white/10 p-3">
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-red-400/80 transition-colors hover:bg-white/10">
                      <Icons.Trash className="size-4 text-red-400/50" />
                      Delete
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

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
