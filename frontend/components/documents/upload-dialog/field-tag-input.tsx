// frontend/components/documents/upload-dialog/field-tag-input.tsx
'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CustomField } from '@/types/upload'

interface FieldTagInputProps {
  fields: readonly CustomField[]
  onAdd: (field: CustomField) => void
  onRemove: (name: string) => void
}

/**
 * Tag-based input for custom fields.
 * Allows adding field name + optional description.
 * Shows badges with tooltips for descriptions.
 */
export function FieldTagInput({ fields, onAdd, onRemove }: FieldTagInputProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    // Check for duplicates
    if (fields.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase())) {
      return
    }

    onAdd({
      name: trimmedName,
      description: description.trim() || undefined,
    })
    setName('')
    setDescription('')

    // Focus name input for adding another field
    nameInputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-4">
      {/* Input row */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            ref={nameInputRef}
            placeholder="Field name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!name.trim()}
          >
            Add
          </Button>
        </div>
        <Input
          placeholder="Description (optional) - helps AI understand what to extract"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm"
        />
      </div>

      {/* Field badges */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((field) => (
            <FieldBadge
              key={field.name}
              field={field}
              onRemove={() => onRemove(field.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FieldBadgeProps {
  field: CustomField
  onRemove: () => void
}

function FieldBadge({ field, onRemove }: FieldBadgeProps) {
  const badge = (
    <Badge
      variant="secondary"
      className="gap-1 pr-1 cursor-default"
    >
      {field.name}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
        aria-label={`Remove ${field.name}`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  )

  // Wrap in tooltip if description exists
  if (field.description) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{field.description}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return badge
}
