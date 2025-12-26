import { FileText, Image } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileTypeIconProps {
  mimeType: string
  className?: string
}

export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
  const iconClass = cn('size-4', className)

  if (mimeType === 'application/pdf') {
    return <FileText className={iconClass} />
  }

  if (mimeType.startsWith('image/')) {
    return <Image className={iconClass} />
  }

  return <FileText className={iconClass} />
}
