'use client'

import { GlassButton } from '@/components/ui/glass-button'
import { GlassTabSwitcher } from '@/components/desktop/glass-tab-switcher'
import {
  GlassTooltip,
  GlassTooltipTrigger,
  GlassTooltipContent,
} from '@/components/ui/glass-tooltip'
import * as Icons from '@/components/icons'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { cn } from '@/lib/utils'

function GlassPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DesktopTopBar() {
  const scale = useDesktopStore((s) => s.view.scale)
  const activeWorkspace = useDesktopStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useDesktopStore((s) => s.setActiveWorkspace)
  const toggleLeftPanel = useDesktopStore((s) => s.toggleLeftPanel)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-4 pt-4">
      {/* Left — App launcher circles */}
      <div className="pointer-events-auto flex items-center gap-2">
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton
              variant="ghost"
              size="icon"
              onClick={() => toggleLeftPanel('documents')}
              className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
            >
              <Icons.FileText className="size-[22px] text-white/80" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">Documents</GlassTooltipContent>
        </GlassTooltip>
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton
              variant="ghost"
              size="icon"
              className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
            >
              <Icons.LayoutGrid className="size-[22px] text-white/80" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">Apps</GlassTooltipContent>
        </GlassTooltip>
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton
              variant="ghost"
              size="icon"
              className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
            >
              <Icons.SlidersHorizontal className="size-[22px] text-white/80" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">Settings</GlassTooltipContent>
        </GlassTooltip>
      </div>

      {/* Center — Back + Workspace Tabs + Add */}
      <div className="pointer-events-auto flex items-center gap-2">
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton
              variant="ghost"
              size="icon"
              className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
            >
              <Icons.ChevronLeft className="-ml-0.5 size-5 text-white/80" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">Back</GlassTooltipContent>
        </GlassTooltip>
        <GlassTabSwitcher
          value={activeWorkspace}
          onValueChange={setActiveWorkspace}
          onClose={() => {
            // TODO: remove workspace
          }}
          tabs={[
            { value: 'default', label: 'Q4 Invoices' },
            { value: 'tax', label: 'Tax Returns' },
          ]}
        />
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton
              variant="ghost"
              size="icon"
              className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
            >
              <Icons.Plus className="size-[22px] text-white/80" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">New workspace</GlassTooltipContent>
        </GlassTooltip>
      </div>

      {/* Right — System tray */}
      <GlassPill className="h-10 pointer-events-auto [&>div]:flex [&>div]:items-center">
        <span className="px-2 text-xs font-medium text-white/70">
          {Math.round(scale * 100)}%
        </span>
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton variant="ghost" size="icon" className="size-8 rounded-full">
              <Icons.Search className="size-[22px] text-white/80" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">Search</GlassTooltipContent>
        </GlassTooltip>
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton variant="ghost" size="icon" className="size-8 rounded-full">
              <Icons.Bell className="size-[22px] text-white/80" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">Notifications</GlassTooltipContent>
        </GlassTooltip>
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton variant="ghost" size="icon" className="size-8 rounded-full">
              <Icons.User className="size-[22px] text-white/80" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">Account</GlassTooltipContent>
        </GlassTooltip>
      </GlassPill>
    </div>
  )
}
