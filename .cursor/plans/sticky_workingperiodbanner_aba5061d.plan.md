---
name: Sticky WorkingPeriodBanner
overview: Keep [`WorkingPeriodBanner`](c:/Users/user/Desktop/sales-project/pos-app/components/WorkingPeriodBanner.tsx) visible at the top of the main content column by restructuring [`app/(app)/layout.tsx`](c:/Users/user/Desktop/sales-project/pos-app/app/(app)/layout.tsx) so only the bordered page body scrolls, not the banner.
todos:
  - id: layout-scroll-split
    content: "Update app/(app)/layout.tsx: section flex-col min-h-0; banner shrink-0 wrapper; content div flex-1 min-h-0 overflow-y-auto + gap"
    status: pending
  - id: banner-spacing
    content: Remove mb-4 from WorkingPeriodBanner.tsx; rely on section gap
    status: pending
isProject: false
---

# Fix WorkingPeriodBanner at top of scrollable main column

## Current structure

In [`app/(app)/layout.tsx`](<c:/Users/user/Desktop/sales-project/pos-app/app/(app)/layout.tsx>), the main column is a single scroll container:

```127:132:c:/Users/user/Desktop/sales-project/pos-app/app/(app)/layout.tsx
            <section className="min-w-0 flex-1 overflow-y-auto print:w-full print:overflow-visible">
              <WorkingPeriodBanner />
              <div className="rounded-2xl border border-border p-4 sm:p-6 print:border-0 print:shadow-none print:p-0 print:rounded-none">
                {children}
              </div>
            </section>
```

`overflow-y-auto` on `<section>` means the banner and `{children}` scroll together, so the banner is not persistent.

## Recommended approach (layout split, no `position: fixed`)

Use a **column flex** on the section and move vertical scrolling to **only** the bordered content wrapper:

1. **`<section>`** — Change to something like: `min-w-0 flex-1 flex flex-col min-h-0 print:w-full print:overflow-visible`
   - Drop `overflow-y-auto` from the section (avoid double scroll).
   - `min-h-0` is required so the flex child can shrink inside the existing `h-screen` / `h-full` chain and the inner `overflow-y-auto` actually scrolls.

2. **Banner** — Wrap in a non-scrolling row, e.g. `<div className="shrink-0 print:hidden">` around `<WorkingPeriodBanner />` so it never participates in the scroll area.

3. **Content wrapper** — Add `flex-1 min-h-0 overflow-y-auto` to the existing `rounded-2xl border ...` div (keep current padding and `print:*` classes). Long pages scroll inside this box only; the banner stays pinned above it.

4. **[`components/WorkingPeriodBanner.tsx`](c:/Users/user/Desktop/sales-project/pos-app/components/WorkingPeriodBanner.tsx)** — Remove the outer `mb-4` on both banner variants; vertical spacing between banner and card comes from a small `gap-*` on the section’s flex column (e.g. `gap-3` on `<section>`) so spacing stays consistent without extra bottom margin on the banner.

## Print

Banner is already `print:hidden`. Ensure the scrollable content div keeps `print:overflow-visible` (and any existing print tweaks) so print layout is unchanged.

## Alternative (not recommended first)

`sticky top-0 bg-background z-*` on the banner inside the current scrolling `<section>` also works, but needs a solid/stacking background and is slightly more fragile with nested overflow. The flex split is simpler and matches “fixed at top of scrollable pages” for this shell.
