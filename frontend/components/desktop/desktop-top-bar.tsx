'use client'

import { GlassButton } from '@/components/ui/glass-button'
import { GlassTabSwitcher } from '@/components/desktop/glass-tab-switcher'
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

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-4 pt-4">
      {/* Left — App launcher circles */}
      <div className="pointer-events-auto flex items-center gap-2">
        <GlassButton
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
        >
          <Icons.FileText className="size-5 text-white/80" />
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
        >
          <Icons.LayoutGrid className="size-5 text-white/80" />
        </GlassButton>
        <GlassButton
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
        >
          <Icons.SlidersHorizontal className="size-5 text-white/80" />
        </GlassButton>
      </div>

      {/* Center — Back + Workspace Tabs + Add */}
      <div className="pointer-events-auto flex items-center gap-2">
        <GlassButton
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
        >
          <Icons.ChevronLeft className="size-5 text-white/80" />
        </GlassButton>
        <GlassTabSwitcher
          value={activeWorkspace}
          onValueChange={setActiveWorkspace}
          onClose={(v) => {
            // TODO: remove workspace
            console.log('close workspace', v)
          }}
          tabs={[
            { value: 'default', label: 'Q4 Invoices' },
            { value: 'tax', label: 'Tax Returns' },
          ]}
        />
        <GlassButton
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-2xl"
        >
          <Icons.Plus className="size-5 text-white/80" />
        </GlassButton>
      </div>

      {/* Right — System tray */}
      <GlassPill className="h-10 pointer-events-auto">
        <span className="px-2 text-xs font-medium text-white/70">
          {Math.round(scale * 100)}%
        </span>
        <GlassButton variant="ghost" size="icon" className="size-8 rounded-xl">
          <Icons.Search className="size-5 text-white/80" />
        </GlassButton>
        <GlassButton variant="ghost" size="icon" className="size-8 rounded-xl">
          <Icons.Bell className="size-5 text-white/80" />
        </GlassButton>
        <GlassButton variant="ghost" size="icon" className="size-8 rounded-xl">
          <Icons.User className="size-5 text-white/80" />
        </GlassButton>
      </GlassPill>
    </div>
  )
}
