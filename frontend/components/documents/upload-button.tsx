'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'

interface UploadButtonProps {
  /** Use 'header' variant for smaller styling in the page header */
  variant?: 'default' | 'header'
}

/**
 * Upload button that triggers file picker and uploads to backend.
 * Supports 'header' variant for compact styling in page headers.
 */
export function UploadButton({ variant = 'default' }: UploadButtonProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [isUploading, setIsUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const formData = new FormData()
      formData.append('file', file)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/document/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      // Refresh the page to show the new document
      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      alert(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      // Reset input so same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload document file"
      />
      <Button
        variant={variant === 'header' ? 'ghost' : 'default'}
        size={variant === 'header' ? 'sm' : 'default'}
        onClick={handleClick}
        disabled={isUploading}
        className={variant === 'header' ? 'h-7 px-2 text-xs' : undefined}
      >
        {isUploading ? (
          <>
            <Loader2 className={variant === 'header' ? 'mr-1.5 size-3.5 animate-spin' : 'mr-2 size-4 animate-spin'} />
            {variant === 'header' ? 'Uploading' : 'Uploading...'}
          </>
        ) : (
          <>
            <Upload className={variant === 'header' ? 'mr-1.5 size-3.5' : 'mr-2 size-4'} />
            Upload
          </>
        )}
      </Button>
    </>
  )
}
