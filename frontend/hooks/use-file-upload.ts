'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useWebSocket } from '@/components/desktop/ws-provider'

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const ALLOWED_EXTS = /\.(pdf|png|jpg|jpeg)$/i

export function useFileUpload() {
  const { send } = useWebSocket()

  const sendUpload = useCallback((file: File): boolean => {
    if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTS.test(file.name)) {
      toast.error('Unsupported file type. Use PDF, PNG, or JPEG.')
      return false
    }
    if (file.size > MAX_SIZE) {
      toast.error('File too large. Maximum size is 10MB.')
      return false
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip data:...;base64, prefix
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
      send({
        type: 'file_upload',
        payload: { filename: file.name, mime_type: file.type, data },
      })
    }
    reader.readAsDataURL(file)
    return true
  }, [send])

  return { sendUpload }
}
