// Re-export Tabler icons with stripped prefixes for cleaner usage
//
// Usage:
//   import * as Icons from "@/components/icons"
//   <Icons.Check className="size-4" />
//
// Type imports:
//   import type { Icon } from "@/components/icons"

export {
  // Checkmarks & validation
  IconCheck as Check,
  IconCircle as Circle,

  // Navigation & chevrons
  IconChevronRight as ChevronRight,
  IconChevronDown as ChevronDown,
  IconChevronLeft as ChevronLeft,
  IconArrowUp as ArrowUp,
  IconArrowDown as ArrowDown,
  IconSelector as ChevronsUpDown,

  // Close & actions
  IconX as X,
  IconDots as DotsHorizontal,
  IconDotsVertical as DotsVertical,
  IconGripVertical as GripVertical,

  // Layout & panels
  IconLayoutSidebar as PanelLeft,

  // Search
  IconSearch as Search,

  // Files & documents
  IconFileText as FileText,
  IconPhoto as Image,
  IconUpload as Upload,
  IconFolder as Folder,

  // App-specific
  IconStack2 as Stack,
  IconLayersLinked as LayersLinked,
  IconSettings as Settings,
  IconLifebuoy as Lifebuoy,
  IconSend as Send,
  IconShare as Share,
  IconTrash as Trash,

  // Theme
  IconSun as Sun,
  IconMoon as Moon,
  IconDeviceDesktop as DeviceDesktop,

  // Loading
  IconLoader2 as Loader2,
} from "@tabler/icons-react"

// Re-export the Icon type for component props
export type { Icon } from "@tabler/icons-react"
