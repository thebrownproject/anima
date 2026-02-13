# UI Components

Mix of shadcn/ui managed primitives and custom glass morphism components.

## shadcn/ui Managed (do not modify)

| File | Description |
|------|-------------|
| `button.tsx` | Radix button with CVA variants |
| `collapsible.tsx` | Expandable sections |
| `sonner.tsx` | Toast notifications (via Sonner) |

Update via: `npx shadcn@latest add <component> --overwrite`

## Glass Components (project-owned, editable)

| File | Description |
|------|-------------|
| `glass-button.tsx` | Glass morphism button (variants: default, primary, outline, ghost, destructive) |
| `glass-card.tsx` | Glass morphism card with optional glow effect |
| `glass-icon-button.tsx` | Reusable tooltip + icon button (size-10, text-white/70, 22px icons) |
| `glass-input.tsx` | Glass input field |
| `glass-tabs.tsx` | Glass tab switcher (framer-motion animated) |
| `glass-tooltip.tsx` | Glass tooltip |
| `glass-context-menu.tsx` | Glass right-click context menu |

## Key Patterns

- **CVA variants**: `glass-button` uses `class-variance-authority` for variant/size system
- **Icons**: Import from `@/components/icons` barrel (never direct `@tabler/icons-react`)
- **Radix primitives**: `glass-tooltip` and `glass-context-menu` wrap Radix UI
- **Ein UI registry**: Glass components installed via `@einui` registry in `components.json`
