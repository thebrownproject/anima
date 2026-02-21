'use client'

import { useState } from 'react'
import * as Icons from '@/components/icons'
import { useDesktopStore } from '@/lib/stores/desktop-store'
import { IconButton } from '@/components/ui/icon-button'
import { GlassSidePanel } from './glass-side-panel'
import {
  FileTree,
  FileTreeFile,
  FileTreeFolder,
} from '@/components/ai-elements/file-tree'

export function DocumentsPanel() {
  const leftPanel = useDesktopStore((s) => s.leftPanel)
  const setLeftPanel = useDesktopStore((s) => s.setLeftPanel)
  const [selectedPath, setSelectedPath] = useState<string | undefined>()

  return (
    <GlassSidePanel
      isOpen={leftPanel === 'documents'}
      onClose={() => setLeftPanel('none')}
      side="left"
      title="Documents"
      width="w-[280px]"
      headerActions={
        <>
          <IconButton
            icon={<Icons.Upload  />}
            tooltip="Upload files"
          />
          <IconButton
            icon={<Icons.Search  />}
            tooltip="Search files"
          />
        </>
      }
      footer={
        <div className="p-4">
          <div className="mb-2 flex justify-between text-[11px] font-medium text-muted-foreground">
            <span>Storage</span>
            <span>3 documents</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
          </div>
        </div>
      }
    >
      <div className="p-1">
        <FileTree
          defaultExpanded={new Set(['uploads', 'invoices'])}
          onSelect={(path: string) => setSelectedPath(path)}
          selectedPath={selectedPath}
        >
          <FileTreeFolder name="Uploads" path="uploads">
            <FileTreeFolder name="Invoices" path="invoices">
              <FileTreeFile
                name="Invoice_001.pdf"
                path="invoices/Invoice_001.pdf"
                icon={<Icons.FileTypePdf className="size-3.5 text-muted-foreground" />}
              />
              <FileTreeFile
                name="Invoice_002.pdf"
                path="invoices/Invoice_002.pdf"
                icon={<Icons.FileTypePdf className="size-3.5 text-muted-foreground" />}
              />
              <FileTreeFile
                name="Invoice_003.pdf"
                path="invoices/Invoice_003.pdf"
                icon={<Icons.FileTypePdf className="size-3.5 text-muted-foreground" />}
              />
            </FileTreeFolder>
            <FileTreeFolder name="Receipts" path="receipts">
              <FileTreeFile
                name="Receipt_Oct.jpg"
                path="receipts/Receipt_Oct.jpg"
                icon={<Icons.Image className="size-3.5 text-muted-foreground" />}
              />
              <FileTreeFile
                name="Receipt_Nov.jpg"
                path="receipts/Receipt_Nov.jpg"
                icon={<Icons.Image className="size-3.5 text-muted-foreground" />}
              />
            </FileTreeFolder>
            <FileTreeFile
              name="Expenses_2025.xlsx"
              path="uploads/Expenses_2025.xlsx"
              icon={<Icons.Table className="size-3.5 text-muted-foreground" />}
            />
          </FileTreeFolder>
          <FileTreeFolder name="Extractions" path="extractions">
            <FileTreeFile
              name="Q4_Summary.csv"
              path="extractions/Q4_Summary.csv"
              icon={<Icons.Table className="size-3.5 text-muted-foreground" />}
            />
            <FileTreeFile
              name="Tax_Deductions.csv"
              path="extractions/Tax_Deductions.csv"
              icon={<Icons.Table className="size-3.5 text-muted-foreground" />}
            />
          </FileTreeFolder>
        </FileTree>
      </div>
    </GlassSidePanel>
  )
}
