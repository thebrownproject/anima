import Markdown, { Components } from 'react-markdown'
import { FileText } from 'lucide-react'

// Sanitize links to only allow safe protocols (prevent javascript: XSS)
const markdownComponents: Components = {
  a: ({ href, children }) => {
    const safeHref = href || ''
    if (!/^(https?:|mailto:)/i.test(safeHref)) {
      return <span className="text-muted-foreground">{children}</span>
    }
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
}

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
      <div className="prose prose-sm dark:prose-invert max-w-none
        prose-headings:font-medium prose-headings:text-foreground
        prose-p:text-foreground prose-p:leading-relaxed
        prose-strong:text-foreground
        prose-ul:text-foreground prose-ol:text-foreground
        prose-li:text-foreground
        prose-table:text-sm
        prose-th:bg-muted prose-th:px-3 prose-th:py-2
        prose-td:px-3 prose-td:py-2 prose-td:border-border">
        <Markdown components={markdownComponents}>{markdown}</Markdown>
      </div>
    </div>
  )
}
