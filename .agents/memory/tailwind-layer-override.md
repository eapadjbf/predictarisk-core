---
name: Tailwind v4 layer override
description: How to override Tailwind utility classes (especially on hover) in this repo's CSS.
---

# Overriding Tailwind v4 utilities with plain CSS

In Tailwind v4, utility classes like `border-border` live in `@layer utilities`,
which wins over anything you write in `@layer base` regardless of source order
(layer precedence beats specificity/source order).

**Why:** A hover rule for card borders placed in `@layer base` silently lost to the
`border-border` utility, so the hover color never applied.

**How to apply:** Put the override rule *outside* any `@layer` block (unlayered CSS
has higher priority than all layered rules). Example in
`artifacts/cyber-analyzer/src/index.css`: an unlayered `.bg-card:hover { border-color: … }`
correctly overrides the layered `border-border` utility.
