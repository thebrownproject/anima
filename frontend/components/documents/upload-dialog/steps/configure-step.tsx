// frontend/components/documents/upload-dialog/steps/configure-step.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { ExtractionMethodCard } from '../extraction-method-card'
import type { ExtractionMethod } from '@/types/upload'

interface ConfigureStepProps {
  fileName: string
  extractionMethod: ExtractionMethod
  onMethodChange: (method: ExtractionMethod) => void
}

/**
 * Step 2: Configure extraction.
 * Shows file badge, stack chips (placeholder), and extraction method cards.
 */
export function ConfigureStep({
  fileName,
  extractionMethod,
  onMethodChange,
}: ConfigureStepProps) {
  return (
    <div className="space-y-6">
      {/* Selected file badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">File:</span>
        <Badge variant="outline" className="font-normal">
          {fileName}
        </Badge>
      </div>

      {/* Stack selection - placeholder */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Add to Stack</label>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className="cursor-not-allowed opacity-50"
          >
            Coming soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Stack grouping will be available in a future update
        </p>
      </div>

      {/* Extraction method */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Extraction Method</label>
        <div className="grid grid-cols-2 gap-3">
          <ExtractionMethodCard
            title="Auto Extract"
            description="AI analyzes and extracts all fields automatically"
            selected={extractionMethod === 'auto'}
            onSelect={() => onMethodChange('auto')}
          />
          <ExtractionMethodCard
            title="Custom Fields"
            description="Specify exactly which fields to extract"
            selected={extractionMethod === 'custom'}
            onSelect={() => onMethodChange('custom')}
          />
        </div>
      </div>
    </div>
  )
}
