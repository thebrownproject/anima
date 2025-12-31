// frontend/components/agent/flows/documents/upload-fields.tsx
'use client'

import { Button } from '@/components/ui/button'
import { FieldTagInput } from '@/components/layout/upload-dialog/field-tag-input'
import type { UploadFlowData } from '../../stores/agent-store'
import type { CustomField } from '@/types/upload'

interface UploadFieldsProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onExtract: () => void
}

export function UploadFields({ data, onUpdate, onExtract }: UploadFieldsProps) {
  const handleAddField = (field: CustomField) => {
    onUpdate({ customFields: [...data.customFields, field] })
  }

  const handleRemoveField = (name: string) => {
    onUpdate({ customFields: data.customFields.filter((f) => f.name !== name) })
  }

  return (
    <div className="space-y-6">
      <FieldTagInput
        fields={data.customFields}
        onAdd={handleAddField}
        onRemove={handleRemoveField}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={onExtract} disabled={data.customFields.length === 0}>
          Extract
        </Button>
      </div>
    </div>
  )
}
