import { FileText } from 'lucide-react'

interface VisualPreviewProps {
  markdown: string | null
}

export function VisualPreview({ markdown }: VisualPreviewProps) {
  if (!markdown) {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center text-muted-foreground">
        <FileText className="size-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium">No OCR text available</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Run extraction to generate text
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[600px] overflow-auto p-4">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
        {markdown}
      </pre>
    </div>
  )
}
