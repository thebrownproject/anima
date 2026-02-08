'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Responsive,
  useContainerWidth,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Badge } from '@/components/ui/badge'

const BREAKPOINTS = { lg: 1200, md: 768, sm: 0 }
const COLS = { lg: 3, md: 2, sm: 1 }
const ROW_HEIGHT = 40

const INITIAL_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'stats', x: 0, y: 0, w: 1, h: 3 },
    { i: 'table', x: 1, y: 0, w: 2, h: 5 },
    { i: 'notes', x: 0, y: 3, w: 1, h: 4 },
    { i: 'auto-height', x: 0, y: 7, w: 1, h: 3, minW: 1 },
  ],
}

// Auto-height card: uses ResizeObserver to adjust grid h from content
function AutoHeightCard({
  onHeightChange,
}: {
  onHeightChange: (h: number) => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState(3)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const newH = Math.ceil(el.scrollHeight / ROW_HEIGHT)
      onHeightChange(Math.max(2, newH))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onHeightChange])

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
      <div className="drag-handle flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Auto-Height Test</span>
        <Badge variant="outline" className="text-[10px]">
          ResizeObserver
        </Badge>
      </div>
      <div ref={contentRef} className="flex-1 p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Click to add/remove lines. Height should auto-adjust.
        </p>
        {Array.from({ length: lines }, (_, i) => (
          <p key={i} className="text-sm">
            Line {i + 1}: Sample content for auto-height testing
          </p>
        ))}
        <div className="mt-2 flex gap-2">
          <button
            className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80"
            onClick={() => setLines((n) => n + 2)}
          >
            + Add lines
          </button>
          <button
            className="rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80"
            onClick={() => setLines((n) => Math.max(1, n - 2))}
          >
            - Remove lines
          </button>
        </div>
      </div>
    </div>
  )
}

export function GridLayoutSpike() {
  const { width, containerRef, mounted } = useContainerWidth()
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(INITIAL_LAYOUTS)
  const [breakpoint, setBreakpoint] = useState('lg')
  const [dragCount, setDragCount] = useState(0)
  const [resizeCount, setResizeCount] = useState(0)

  const handleLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts)
    },
    [],
  )

  const handleAutoHeight = useCallback(
    (newH: number) => {
      setLayouts((prev) => {
        const updated = { ...prev }
        for (const bp of Object.keys(updated)) {
          const bpLayout = updated[bp]
          if (!bpLayout) continue
          updated[bp] = bpLayout.map((item: LayoutItem) =>
            item.i === 'auto-height' ? { ...item, h: newH } : item,
          )
        }
        return updated
      })
    },
    [],
  )

  return (
    <div className="flex h-full flex-col">
      {/* Spike status bar */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          react-grid-layout v2 spike
        </span>
        <Badge variant="outline" className="text-[10px]">
          bp: {breakpoint}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          w: {Math.round(width)}px
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          drags: {dragCount}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          resizes: {resizeCount}
        </Badge>
      </div>

      {/* Grid container */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {mounted && (
          <Responsive
            width={width}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            layouts={layouts}
            rowHeight={ROW_HEIGHT}
            dragConfig={{ handle: '.drag-handle' }}
            onLayoutChange={handleLayoutChange}
            onBreakpointChange={(bp: string) => setBreakpoint(bp)}
            onDragStop={() => setDragCount((n) => n + 1)}
            onResizeStop={() => setResizeCount((n) => n + 1)}
          >
            {/* Stats card */}
            <div key="stats">
              <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
                <div className="drag-handle flex items-center border-b px-3 py-2">
                  <span className="text-sm font-medium">Quick Stats</span>
                </div>
                <div className="flex-1 p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Documents</span>
                      <span className="font-medium">24</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Extracted</span>
                      <span className="font-medium">18</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table card */}
            <div key="table">
              <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
                <div className="drag-handle flex items-center border-b px-3 py-2">
                  <span className="text-sm font-medium">Recent Invoices</span>
                </div>
                <div className="flex-1 overflow-auto p-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Invoice</th>
                        <th className="pb-2 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'INV-001', amount: '$1,200', status: 'Paid' },
                        { id: 'INV-002', amount: '$850', status: 'Pending' },
                        { id: 'INV-003', amount: '$2,100', status: 'Paid' },
                      ].map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="py-2">{row.id}</td>
                          <td className="py-2">{row.amount}</td>
                          <td className="py-2">
                            <Badge
                              variant={
                                row.status === 'Paid'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="text-[10px]"
                            >
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Notes card */}
            <div key="notes">
              <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
                <div className="drag-handle flex items-center border-b px-3 py-2">
                  <span className="text-sm font-medium">Notes</span>
                </div>
                <div className="flex-1 p-3">
                  <p className="text-sm text-muted-foreground">
                    Drag this card by its title bar. Resize from edges/corners.
                    Try different viewport widths to test responsive breakpoints.
                  </p>
                </div>
              </div>
            </div>

            {/* Auto-height test card */}
            <div key="auto-height">
              <AutoHeightCard onHeightChange={handleAutoHeight} />
            </div>
          </Responsive>
        )}
      </div>
    </div>
  )
}
