# UI Components

Mix of shadcn/ui managed primitives and project-owned components.

## shadcn/ui Managed (do not modify)

| File | Description |
|------|-------------|
| `button.tsx` | Radix button with CVA variants |
| `card.tsx` | Card container (div composition) |
| `collapsible.tsx` | Expandable sections |
| `context-menu.tsx` | Right-click context menu (Radix) |
| `sonner.tsx` | Toast notifications (via Sonner) |
| `tooltip.tsx` | Tooltip (Radix, exports TooltipProvider) |

Update via: `npx shadcn@latest add <component> --overwrite`

## Project-Owned Components

| File | Description |
|------|-------------|
| `icon-button.tsx` | Tooltip + icon button wrapper (shadcn Button ghost + Tooltip) |
| `glass-pill.tsx` | Small label pill (restyled for light mode) |

## Archived Glass Components

Legacy glassmorphism components in `_archived-glass/`. Not imported anywhere. Kept for reference until confirmed safe to delete.

## Key Patterns

- **CSS variables**: All components use shadcn CSS variable classes (`bg-card`, `text-foreground`, etc.)
- **Icons**: Import from `@/components/icons` barrel (never direct `@tabler/icons-react`)
- **Radix primitives**: `tooltip` and `context-menu` wrap Radix UI
