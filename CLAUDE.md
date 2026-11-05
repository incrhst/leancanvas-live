<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Design rules

- **No one-side coloured borders.** Don't put a coloured accent stripe on one edge of a card, note, panel, banner or callout (e.g. `border-l-4 border-l-rose-500`, `border-t-4 border-accent`). We see it as generic AI-styled UI ("slop") and don't want it. To show a state or category, use a full border, a tinted background, an icon and a label. Plain neutral divider lines between sections (e.g. `border-b border-line`) are fine.
