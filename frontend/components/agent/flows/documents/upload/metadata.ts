// frontend/components/agent/flows/documents/upload/metadata.ts
import * as Icons from '@/components/icons'
import type { FlowMetadata } from '../../types'
import type { UploadFlowStep } from '../../../stores/agent-store'

// Step components
import {
  UploadDropzone,
  UploadConfigure,
  UploadFields,
  UploadExtracting,
  UploadComplete,
} from './steps'

/**
 * Static metadata for the upload flow.
 * Defines visual properties and step components.
 */
export const uploadFlowMetadata: FlowMetadata<UploadFlowStep> = {
  type: 'upload',

  steps: ['dropzone', 'configure', 'fields', 'extracting', 'complete'] as const,

  icons: {
    dropzone: Icons.Upload,
    configure: Icons.Settings,
    fields: Icons.List,
    extracting: Icons.Loader2,
    complete: Icons.Check,
  },

  statusText: {
    dropzone: 'Drop a file to get started',
    configure: 'Configure extraction settings',
    fields: 'Specify fields to extract',
    extracting: 'Extracting...',
    complete: 'Extraction complete',
  },

  minimizedText: 'Continue file upload...',

  components: {
    dropzone: UploadDropzone,
    configure: UploadConfigure,
    fields: UploadFields,
    extracting: UploadExtracting,
    complete: UploadComplete,
  },

  backableSteps: ['configure', 'fields'] as const,

  confirmationSteps: ['configure', 'fields', 'extracting'] as const,
}
