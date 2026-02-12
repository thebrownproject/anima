'use client'

import { useState } from 'react'
import * as Icons from '@/components/icons'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { GlassButton } from '@/components/ui/glass-button'
import {
  GlassTooltip,
  GlassTooltipTrigger,
  GlassTooltipContent,
} from '@/components/ui/glass-tooltip'
import { GlassSidePanel } from './glass-side-panel'

// =============================================================================
// Mock file tree (replaced by real data when upload pipeline is built)
// =============================================================================

interface FileNode {
  id: string
  name: string
  type: 'folder' | 'file'
  icon?: 'pdf' | 'image' | 'sheet' | 'text'
  children?: FileNode[]
  isOpen?: boolean
}

const MOCK_FILES: FileNode[] = [
  {
    id: 'uploads',
    name: 'Uploads',
    type: 'folder',
    isOpen: true,
    children: [
      {
        id: 'invoices',
        name: 'Invoices',
        type: 'folder',
        isOpen: true,
        children: [
          { id: 'inv-001', name: 'Invoice_001.pdf', type: 'file', icon: 'pdf' },
          { id: 'inv-002', name: 'Invoice_002.pdf', type: 'file', icon: 'pdf' },
          { id: 'inv-003', name: 'Invoice_003.pdf', type: 'file', icon: 'pdf' },
        ],
      },
      {
        id: 'receipts',
        name: 'Receipts',
        type: 'folder',
        children: [
          { id: 'rec-001', name: 'Receipt_Oct.jpg', type: 'file', icon: 'image' },
          { id: 'rec-002', name: 'Receipt_Nov.jpg', type: 'file', icon: 'image' },
        ],
      },
      { id: 'expenses', name: 'Expenses_2025.xlsx', type: 'file', icon: 'sheet' },
    ],
  },
  {
    id: 'extractions',
    name: 'Extractions',
    type: 'folder',
    children: [
      { id: 'ext-q4', name: 'Q4_Summary.csv', type: 'file', icon: 'sheet' },
      { id: 'ext-tax', name: 'Tax_Deductions.csv', type: 'file', icon: 'sheet' },
    ],
  },
]

// =============================================================================
// File icon helper
// =============================================================================

function FileIcon({ type, icon }: { type: 'folder' | 'file'; icon?: string }) {
  if (type === 'folder') return <Icons.Folder className="size-3.5 text-blue-300" />
  if (icon === 'pdf') return <Icons.FileTypePdf className="size-3.5 text-red-300" />
  if (icon === 'sheet') return <Icons.Table className="size-3.5 text-emerald-300" />
  if (icon === 'image') return <Icons.Image className="size-3.5 text-purple-300" />
  return <Icons.FileText className="size-3.5 text-white/50" />
}

// =============================================================================
// Recursive tree item
// =============================================================================

function TreeItem({ node, level = 0 }: { node: FileNode; level?: number }) {
  const [isOpen, setIsOpen] = useState(node.isOpen ?? false)

  return (
    <div>
      <button
        onClick={() => node.type === 'folder' && setIsOpen(!isOpen)}
        className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <div className="flex size-4 shrink-0 items-center justify-center text-white/40">
          {node.type === 'folder' && (
            isOpen
              ? <Icons.ChevronDown className="size-3" />
              : <Icons.ChevronRight className="size-3" />
          )}
        </div>
        <FileIcon type={node.type} icon={node.icon} />
        <span className="flex-1 truncate text-[13px] font-medium text-white/70 transition-colors group-hover:text-white/90">
          {node.name}
        </span>
        <span className="flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100">
          <Icons.DotsHorizontal className="size-3 text-white/40" />
        </span>
      </button>

      {node.type === 'folder' && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Documents panel
// =============================================================================

export function DocumentsPanel() {
  const leftPanel = useDesktopStore((s) => s.leftPanel)
  const setLeftPanel = useDesktopStore((s) => s.setLeftPanel)

  return (
    <GlassSidePanel
      isOpen={leftPanel === 'documents'}
      onClose={() => setLeftPanel('none')}
      side="left"
      title="Documents"
      icon={<Icons.Folder className="size-4 text-blue-400" />}
      width="w-[280px]"
      headerActions={
        <GlassTooltip>
          <GlassTooltipTrigger asChild>
            <GlassButton variant="ghost" size="icon" className="size-7 rounded-full">
              <Icons.Search className="size-3.5 text-white/50" />
            </GlassButton>
          </GlassTooltipTrigger>
          <GlassTooltipContent side="bottom">Search files</GlassTooltipContent>
        </GlassTooltip>
      }
      footer={
        <div className="p-4">
          <GlassButton className="mb-3 w-full justify-center gap-2 rounded-xl text-xs">
            <Icons.Upload className="size-3.5" />
            Upload files
          </GlassButton>
          <div className="mb-2 flex justify-between text-[11px] font-medium text-white/40">
            <span>Storage</span>
            <span className="text-white/60">3 documents</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
          </div>
        </div>
      }
    >
      <div className="p-3">
        {MOCK_FILES.map((node) => (
          <TreeItem key={node.id} node={node} />
        ))}
      </div>
    </GlassSidePanel>
  )
}
