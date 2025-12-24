// frontend/components/documents/upload-dialog/steps/fields-step.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { FieldTagInput } from '../field-tag-input'
import type { CustomField } from '@/types/upload'

interface FieldsStepProps {
  fileName: string
  fields: readonly CustomField[]
  onAddField: (field: CustomField) => void
  onRemoveField: (name: string) => void
}

/**
 * Step 3: Specify custom fields.
 * Shows file badge and field tag input.
 */
export function FieldsStep({
  fileName,
  fields,
  onAddField,
  onRemoveField,
}: FieldsStepProps) {
  return (
    <div className="space-y-6">
      {/* Selected file badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">File:</span>
        <Badge variant="outline" className="font-normal">
          {fileName}
        </Badge>
      </div>

      {/* Field input */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Fields to Extract</label>
          <p className="mt-1 text-xs text-muted-foreground">
            Add the fields you want to extract. Descriptions help the AI understand what to look for.
          </p>
        </div>
        <FieldTagInput
          fields={fields}
          onAdd={onAddField}
          onRemove={onRemoveField}
        />
      </div>

      {/* Helper text */}
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          Add at least one field to continue
        </p>
      )}
    </div>
  )
}
