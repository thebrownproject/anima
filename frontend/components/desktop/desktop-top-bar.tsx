'use client'

import { GlassTabSwitcher } from '@/components/desktop/glass-tab-switcher'
import { IconButton } from '@/components/ui/icon-button'
import { GlassPill } from '@/components/ui/glass-pill'
import * as Icons from '@/components/icons'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { useChatStore } from '@/lib/stores/chat-store'
import { useTheme } from 'next-themes'
import { useWebSocket } from './ws-provider'

const launcherClass = 'border bg-card border-border shadow-sm'

export function DesktopTopBar() {
  const stacks = useDesktopStore((s) => s.stacks)
  const archivedStackIds = useDesktopStore((s) => s.archivedStackIds)
  const activeStackId = useDesktopStore((s) => s.activeStackId)
  const setActiveStackId = useDesktopStore((s) => s.setActiveStackId)
  const toggleLeftPanel = useDesktopStore((s) => s.toggleLeftPanel)
  const chatMode = useChatStore((s) => s.mode)
  const setMode = useChatStore((s) => s.setMode)
  const { send } = useWebSocket()
  const { theme, setTheme } = useTheme()

  const visibleStacks = stacks.filter((s) => !archivedStackIds.includes(s.id))

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-4 pt-4">
      {/* Left — App launcher circles */}
      <div className="pointer-events-auto flex items-center gap-2">
        <IconButton
          icon={<Icons.FileText  />}
          tooltip="Documents"
          onClick={() => toggleLeftPanel('documents')}
          className={launcherClass}
        />
        <IconButton
          icon={<Icons.LayoutGrid  />}
          tooltip="Apps"
          className={launcherClass}
        />
        <IconButton
          icon={<Icons.SlidersHorizontal  />}
          tooltip="Settings"
          className={launcherClass}
        />
      </div>

      {/* Center — Back + Workspace Tabs + Add (absolute for true page centering) */}
      <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2">
        <IconButton
          icon={<Icons.ChevronLeft />}
          tooltip="Back"
          className={launcherClass}
        />
        {visibleStacks.length > 0 ? (
          <GlassTabSwitcher
            value={activeStackId}
            onValueChange={setActiveStackId}
            onClose={(stackId) => {
              send({
                type: 'canvas_interaction',
                payload: { action: 'archive_stack', card_id: '', data: { stack_id: stackId } },
              })
            }}
            tabs={visibleStacks.map((s) => ({ value: s.id, label: s.name, dot: s.color ?? undefined }))}
          />
        ) : (
          <div className="flex h-10 items-center rounded-full bg-card border border-border px-4 shadow-sm">
            <span className="text-sm text-muted-foreground">Anima</span>
          </div>
        )}
        <IconButton
          icon={<Icons.Plus  />}
          tooltip="New stack"
          className={launcherClass}
          onClick={() => {
            send({
              type: 'canvas_interaction',
              payload: { action: 'create_stack', card_id: '', data: null },
            })
          }}
        />
      </div>

      {/* Right — System tray */}
      <GlassPill className="h-10 gap-0 px-1 pointer-events-auto [&>div]:flex [&>div]:items-center [&_button]:size-9">
        <IconButton
          icon={theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
          tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
        <IconButton
          icon={<Icons.Search  />}
          tooltip="Search"
        />
        <IconButton
          icon={<Icons.Bell  />}
          tooltip="Notifications"
        />
        <IconButton
          icon={<Icons.User  />}
          tooltip="Account"
        />
        <IconButton
          icon={chatMode === 'panel' ? <Icons.LayoutBottombar /> : <Icons.PanelRight />}
          tooltip={chatMode === 'panel' ? 'Dock to bottom' : 'Chat panel'}
          onClick={() => setMode(chatMode === 'panel' ? 'bar' : 'panel')}
        />
      </GlassPill>
    </div>
  )
}
