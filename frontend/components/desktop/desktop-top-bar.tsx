'use client'

import { GlassTabSwitcher } from '@/components/desktop/glass-tab-switcher'
import { GlassIconButton } from '@/components/ui/glass-icon-button'
import * as Icons from '@/components/icons'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { cn } from '@/lib/utils'

const launcherClass = 'border border-white/20 bg-white/10 backdrop-blur-2xl'

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
  const activeWorkspace = useDesktopStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useDesktopStore((s) => s.setActiveWorkspace)
  const toggleLeftPanel = useDesktopStore((s) => s.toggleLeftPanel)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-4 pt-4">
      {/* Left — App launcher circles */}
      <div className="pointer-events-auto flex items-center gap-2">
        <GlassIconButton
          icon={<Icons.FileText  />}
          tooltip="Documents"
          onClick={() => toggleLeftPanel('documents')}
          className={launcherClass}
        />
        <GlassIconButton
          icon={<Icons.LayoutGrid  />}
          tooltip="Apps"
          className={launcherClass}
        />
        <GlassIconButton
          icon={<Icons.SlidersHorizontal  />}
          tooltip="Settings"
          className={launcherClass}
        />
      </div>

      {/* Center — Back + Workspace Tabs + Add (absolute for true page centering) */}
      <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2">
        <GlassIconButton
          icon={<Icons.ChevronLeft />}
          tooltip="Back"
          className={launcherClass}
        />
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
        <GlassIconButton
          icon={<Icons.Plus  />}
          tooltip="New workspace"
          className={launcherClass}
        />
      </div>

      {/* Right — System tray */}
      <GlassPill className="h-10 pointer-events-auto [&>div]:flex [&>div]:items-center">
        <GlassIconButton
          icon={<Icons.Search  />}
          tooltip="Search"
          className="size-8"
        />
        <GlassIconButton
          icon={<Icons.Bell  />}
          tooltip="Notifications"
          className="size-8"
        />
        <GlassIconButton
          icon={<Icons.User  />}
          tooltip="Account"
          className="size-8"
        />
      </GlassPill>
    </div>
  )
}
