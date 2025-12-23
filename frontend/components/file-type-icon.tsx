import { FileText, Image } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileTypeIconProps {
  mimeType: string
  className?: string
}

export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
  const iconClass = cn('size-4', className)

  if (mimeType === 'application/pdf') {
    return <FileText className={cn(iconClass, 'text-red-500 dark:text-red-400')} />
  }

  if (mimeType.startsWith('image/')) {
    return <Image className={cn(iconClass, 'text-blue-500 dark:text-blue-400')} />
  }

  return <FileText className={cn(iconClass, 'text-muted-foreground')} />
}
