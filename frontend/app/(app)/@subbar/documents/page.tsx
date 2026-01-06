'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterBar } from '@/components/layout/filter-bar'
import { SelectionActions } from '@/components/layout/selection-actions'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, initialUploadData } from '@/components/agent'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'
import { useSelectedDocument } from '@/components/documents/selected-document-context'
import { usePreviewPanel } from '@/components/documents/preview-panel-context'
import { DocumentDetailActions } from '@/components/documents/document-detail-actions'
import { useStacks } from '@/hooks/use-stacks'
import * as Icons from '@/components/icons'

/**
 * SubBar for documents list page.
 * Renders filter bar, selection actions, and document actions when previewed.
 * Search is now integrated into FilterButton dropdown.
 *
 * Right side states:
 * 1. No selection, no preview -> Upload button only
 * 2. Checkboxes selected -> SelectionActions + Upload
 * 3. Document previewed (panel visible) -> Document actions (Stacks, Edit, Export, Delete) + Upload
 * 4. Both selection AND preview -> SelectionActions | separator | Document actions + Upload
 *
 * Note: Document actions only show when preview panel is visible (not collapsed).
 */
export default function DocumentsSubBar() {
  const { selectedCount, selectedIds, clearSelection } = useDocumentsFilter()
  const {
    selectedDocId,
    filename,
    filePath,
    assignedStacks,
    extractedFields,
  } = useSelectedDocument()
  const { isCollapsed } = usePreviewPanel()
  const { stacks } = useStacks()
  const openFlow = useAgentStore((state) => state.openFlow)

  // Document actions only show when preview panel is visible
  const showDocumentActions = selectedDocId && filename && !isCollapsed

  return (
    <SubBar
      left={<FilterBar stacks={stacks} />}
      right={
        <div className="flex items-center gap-2">
          {/* Selection actions (when checkboxes selected) */}
          {selectedCount > 0 && (
            <SelectionActions
              selectedCount={selectedCount}
              selectedIds={selectedIds}
              onClearSelection={clearSelection}
            />
          )}

          {/* Separator when both selection and preview visible */}
          {selectedCount > 0 && showDocumentActions && (
            <div className="h-4 w-px bg-border" />
          )}

          {/* Document actions (when preview panel is visible) */}
          {showDocumentActions && (
            <DocumentDetailActions
              documentId={selectedDocId}
              assignedStacks={assignedStacks}
              filename={filename}
              extractedFields={extractedFields}
              filePath={filePath}
            />
          )}

          <ActionButton
            icon={<Icons.Upload />}
            onClick={() => openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })}
          >
            Upload
          </ActionButton>
        </div>
      }
    />
  )
}
