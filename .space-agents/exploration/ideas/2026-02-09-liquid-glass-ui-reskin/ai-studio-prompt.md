# Google AI Studio Prompts — Session 142

Collection of prompts used to build the interactive prototype in Google AI Studio Build mode.

---

## System Instructions (set before first prompt)

```
- Styling: Use Tailwind CSS for layout and utilities. CSS custom properties for theming.
- Animations: Use Framer Motion for all transitions (fadeIn, slideIn, hover scales).
- Design: Dark mode only. No light theme.
- Colors: Deep blue/purple wallpaper tones. All text white/light gray.
- Glass: Use backdrop-filter: blur() with rgba backgrounds on all surfaces.
- Structure: Single-page React app. No routing.
```

---

## Prompt 1: Initial Concept

Build an interactive prototype of a **spatial glass desktop OS** — a next-generation AI workspace where an agent renders floating glass cards on a wallpaper-backed canvas. This is NOT a traditional web app. It should feel like an operating system desktop — think macOS meets Jarvis, with frosted glass surfaces floating over a beautiful wallpaper.

[Full prompt in git history — see original file version]

---

## Prompt 2: Liquid Glass Refinement

Restyle everything to match a liquid glass / frosted glass aesthetic. The current design is too dark and solid. I want the glass to feel LIGHT, AIRY, and TRANSLUCENT — like frosted glass panels floating in space.

Glass should be MORE transparent. Use backdrop-filter: blur(24px) saturate(180%) with very low opacity backgrounds (rgba(255,255,255,0.05) to 0.08). Remove hard borders. Let blur and shadow create edge definition.

---

## Prompt 3: iPadOS 26 Liquid Glass Style

Complete redesign. iPadOS 26 / Apple Liquid Glass design language. Glass surfaces tinted by wallpaper. backdrop-filter: blur(40px) saturate(200%) brightness(1.1). Bright vibrant wallpaper (aqua blue).

Three separate floating glass pills across the top: Left (user avatar), Center (dock with apps | workspaces), Right (notifications + settings).

---

## Prompt 4: Chat Bar — Single Line with Chips

Chat bar as ONE element, all on one line. Layout: [paperclip] [chips or text input] [keyboard] [mic]. Chips and text input mutually exclusive. Agent text responses as a separate canvas card.

---

## Prompt 5: Final Layout (Latest)

Updated dock with: apps (left, including saved generative apps) | workspaces (right). Demo calculator app card. User avatar dropdown (left pill). Notifications dropdown (right pill). Documents icon in dock opens file browser card.

---

## Key Learnings

- Start with vision-first prompts, not technical specs
- Iterative approach works much better than one big prompt
- Glass transparency is hard to get right — always push for MORE transparent
- Annotation Mode is useful for visual tweaks
- Gemini tends toward opaque/solid surfaces — you need to explicitly push for frosted glass
- Reference images help but text descriptions are more reliable for layout
- The wallpaper drives everything — get it right first, then tune glass
