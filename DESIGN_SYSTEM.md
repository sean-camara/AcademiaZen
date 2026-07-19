# AcademiaZen design system

## Direction

Calm, intelligent, focused, and youthful without novelty UI. The current near-black/teal identity is retained but expanded for clear hierarchy, daylight use, accessible states, and academic content density.

## Token contract

- Color: neutral canvas/surface/elevated; ink strong/muted/subtle; action teal with hover/pressed; semantic success/warning/danger/info; focus ring distinct from action color. All text/background pairs meet WCAG 2.2 AA.
- Type: system-first or self-hosted variable sans; 12/14/16/20/24/32/48 scale; body line-height at least 1.5; never use tracking alone to convey hierarchy.
- Space: 4 px base; 4/8/12/16/24/32/48/64. Dense controls still use at least 44x44 px touch targets.
- Radius: 8 controls, 12 cards, 16 dialogs; pills only for statuses/tags.
- Border/shadow: borders establish most hierarchy; shadows only for overlays and true elevation.
- Motion: 120/180/240 ms; opacity/transform only; no required motion; disable nonessential transitions under `prefers-reduced-motion`.
- Layout: content widths 640/960/1200/1440; breakpoints driven by content at roughly 640/768/1024/1280.
- Z-index: base 0, sticky 10, dropdown 30, drawer 40, dialog 50, toast 60.

## Required primitives

Button, icon button, form field, input, textarea, select, checkbox, radio, switch, dialog, drawer, dropdown, tooltip, toast, tabs, card, badge, skeleton, empty state, error state, page header, and data-visualization shell.

Every primitive must expose a name/label, keyboard behavior, visible focus, disabled/loading semantics, target size, high-contrast appearance, and reduced-motion behavior. Dialog/drawer primitives trap and restore focus; toasts use appropriate live regions but never contain the only recovery action.

## Content rules

Use direct student language: action + object (`Create task`, `Start focus session`). Explain AI limits and failures honestly. Avoid fake urgency, fake metrics, generic purple gradients, excessive glass, ambiguous icon-only actions, and hidden destructive actions.
