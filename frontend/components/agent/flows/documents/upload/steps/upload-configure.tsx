// frontend/components/agent/flows/documents/upload-configure.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExtractionMethodCard } from './extraction-method-card'
import type { UploadFlowData } from '../../../../stores/agent-store'

interface UploadConfigureProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onNext: () => void
  isPrimaryDisabled: boolean
  primaryButtonText: string
}

export function UploadConfigure({
  data,
  onUpdate,
  onNext,
  isPrimaryDisabled,
  primaryButtonText,
}: UploadConfigureProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="document-name" className="text-sm font-medium">
          Document Name
        </label>
        <Input
          id="document-name"
          value={data.documentName}
          onChange={(e) => onUpdate({ documentName: e.target.value })}
          placeholder="Enter document name"
        />
      </div>

      {data.uploadStatus === 'uploading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="animate-pulse">Uploading...</span>
        </div>
      )}
      {data.uploadError && (
        <p className="text-sm text-destructive">{data.uploadError}</p>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Add to Stack</label>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="cursor-not-allowed opacity-50">
            Coming soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Stack grouping will be available in a future update
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Extraction Method</label>
        <div className="grid grid-cols-2 gap-3">
          <ExtractionMethodCard
            title="Auto Extract"
            description="AI analyzes and extracts all fields automatically"
            selected={data.extractionMethod === 'auto'}
            onSelect={() => onUpdate({ extractionMethod: 'auto' })}
          />
          <ExtractionMethodCard
            title="Custom Fields"
            description="Specify exactly which fields to extract"
            selected={data.extractionMethod === 'custom'}
            onSelect={() => onUpdate({ extractionMethod: 'custom' })}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={isPrimaryDisabled}>
          {primaryButtonText}
        </Button>
      </div>
    </div>
  )
}
