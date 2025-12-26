"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconFileText,
  IconLayersLinked,
  IconStack2,
  IconSettings,
  IconUpload,
} from "@tabler/icons-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

interface GlobalSearchDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)

  // Use controlled or uncontrolled state
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [isOpen, setIsOpen])

  const runCommand = React.useCallback((command: () => void) => {
    setIsOpen(false)
    command()
  }, [setIsOpen])

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput placeholder="Search documents, pages, or actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/documents"))}
          >
            <IconFileText className="size-4" />
            <span>Documents</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/extractions"))}
          >
            <IconLayersLinked className="size-4" />
            <span>Extractions</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/stacks"))}
          >
            <IconStack2 className="size-4" />
            <span>Stacks</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(() => {
              // TODO: Trigger upload dialog
              console.log("Open upload dialog")
            })}
          >
            <IconUpload className="size-4" />
            <span>Upload Document</span>
          </CommandItem>
          <CommandItem disabled>
            <IconSettings className="size-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
