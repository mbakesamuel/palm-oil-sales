---
name: Agro theme consistency
overview: The agro green/yellow look is already wired globally via `html[data-ui-theme="agro"]` and CSS variables in [`app/globals.css`](c:/Users/user/Desktop/sales-project/pos-app/app/globals.css), but dozens of components use fixed grayscale Tailwind classes. Replacing those with the existing semantic tokens (`bg-brand`, `bg-background`, `border-border`, `text-foreground`, `bg-accent`, etc.) makes the agro preset apply consistently across screens while preserving the default theme and print layouts.
todos:
  - id: shared-components
    content: Retheme ConfirmDialog, PrintButton, WorkingPeriodBanner (and any other small shared widgets) to semantic tokens
    status: pending
  - id: major-clients
    content: Replace black/white/zinc patterns in large *Client.tsx (POS, delivery orders, consignment notes, customers, users, stock flows)
    status: pending
  - id: dashboard-reports
    content: "Update dashboard links/cards and reports pages (tables, filters, sticky cells) with same token vocabulary; keep print: overrides"
    status: pending
  - id: verify-themes
    content: "Lint + manual smoke: default vs agro, light vs dark, one modal + one report + POS"
    status: pending
isProject: false
---

# Apply agro theme across all pages

## Root cause

- [`app/layout.tsx`](c:/Users/user/Desktop/sales-project/pos-app/app/layout.tsx) sets `data-ui-theme` from `getOrInitCompanySettings()` → [`lib/ui-theme.ts`](c:/Users/user/Desktop/sales-project/pos-app/lib/ui-theme.ts) (`agro` vs `default`). This applies to **every** route (login, app shell, forbidden) that renders under the root layout.
- [`app/globals.css`](c:/Users/user/Desktop/sales-project/pos-app/app/globals.css) maps `html[data-ui-theme="agro"]` to green/yellow-tinted `--background`, `--brand`, `--accent`, `--sidebar`, etc., exposed to Tailwind v4 via `@theme inline` as `bg-background`, `bg-brand`, `text-foreground`, `border-border`, `bg-accent`, and so on.

Many TSX files still use **palette-independent** utilities such as:

- Primary actions: `bg-black text-white dark:bg-white dark:text-black`
- Surfaces: `bg-white dark:bg-zinc-950`
- Borders/hover/zebra rows: `border-black/10`, `hover:bg-black/5`, `odd:bg-black/2`, `dark:border-white/10`, …
- Typography: `text-zinc-500`, `text-zinc-900`, …
- Sticky table cells: `bg-white dark:bg-neutral-950`

Those never read the agro variables, so large parts of the UI stay neutral regardless of the selected appearance.

```47:58:c:/Users/user/Desktop/sales-project/pos-app/app/globals.css
html[data-ui-theme="agro"] {
  --background: #f4f8f5;
  --foreground: #142018;
  --brand: #1b5e34;
  --brand-foreground: #f6fcf7;
  --accent: #e8c547;
  --accent-foreground: #2a2204;
  /* ... */
}
```

## Approach (no new “theme engine”)

Use the **existing** semantic colors everywhere UI should follow company appearance. Prefer **single** classes without redundant `dark:` pairs when the token already tracks light/dark via CSS variables.

### Practical class mapping (repeat across the codebase)

| Current intent                                                                                                                             | Replace with (examples)                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Primary button (old black/white invert)                                                                                                    | `bg-brand text-brand-foreground hover:opacity-90` (or subtle `hover:brightness-95`)               |
| Default outline / ghost                                                                                                                    | `border border-border hover:bg-accent/30` or `hover:bg-foreground/5`                              |
| Card / modal panel                                                                                                                         | `bg-background text-foreground border border-border` (plus existing shadow/ring as needed)        |
| Muted label text                                                                                                                           | `text-foreground/60` or `text-foreground/70`                                                      |
| Body / titles in dialogs                                                                                                                   | `text-foreground`, `font-semibold text-foreground`                                                |
| Neutral confirm (non-danger) in [`components/ConfirmDialog.tsx`](c:/Users/user/Desktop/sales-project/pos-app/components/ConfirmDialog.tsx) | `bg-brand text-brand-foreground` instead of `bg-zinc-900` / zinc flip                             |
| Sticky first column in tables                                                                                                              | `bg-background` (and keep `print:bg-white print:text-black` where print fidelity matters)         |
| Zebra rows                                                                                                                                 | `odd:bg-foreground/[0.04]` or light `odd:bg-brand/5` — pick one pattern and reuse for consistency |

**Keep as-is for print:** components such as [`components/SalePrint.tsx`](c:/Users/user/Desktop/sales-project/pos-app/components/SalePrint.tsx) and similar `print:bg-white print:text-black` article shells should stay optimized for paper unless you explicitly want tinted printouts.

**Backdrop scrim:** `bg-black/45` on overlays is acceptable (readability); optional later: `bg-foreground/60` only if it looks good in both themes.

### Optional small token addition (only if needed)

If some surfaces need a **slightly** different fill than `--background` (e.g. dense tables), add `--card` / `--muted` in `:root` and `html[data-ui-theme="agro"]` and map them in `@theme inline`. This is optional; most cases can use `bg-background` + border/shadow.

## Scope (~40+ TSX files with mixed patterns)

Grep hotspots (non-exhaustive): [`components/ConfirmDialog.tsx`](c:/Users/user/Desktop/sales-project/pos-app/components/ConfirmDialog.tsx), [`components/PrintButton.tsx`](c:/Users/user/Desktop/sales-project/pos-app/components/PrintButton.tsx), [`app/(app)/dashboard/page.tsx`](<c:/Users/user/Desktop/sales-project/pos-app/app/(app)/dashboard/page.tsx>), [`app/(app)/pos/SalesClient.tsx`](<c:/Users/user/Desktop/sales-project/pos-app/app/(app)/pos/SalesClient.tsx>), [`app/(app)/delivery-orders/DeliveryOrdersClient.tsx`](<c:/Users/user/Desktop/sales-project/pos-app/app/(app)/delivery-orders/DeliveryOrdersClient.tsx>), many `*Client.tsx` under setup/stock/users, and multiple [`app/(app)/reports/**`](<c:/Users/user/Desktop/sales-project/pos-app/app/(app)/reports>) pages with shared table/border patterns.

Suggested **implementation order**:

1. **Shared primitives** — `ConfirmDialog`, `PrintButton`, `WorkingPeriodBanner`, any other small shared UI used widely.
2. **Large clients** — POS, delivery orders, consignment notes, customers, users (high line counts, copy-paste patterns).
3. **Remaining app routes** — setup, stock, tax, products, financial years, etc.
4. **Reports** — batch replace repeated border/hover/sticky cell patterns; verify sticky headers match scroll area `bg-background`.

After edits: run `npm run lint`, spot-check **default** and **agro** presets (light + dark if you use system dark mode) on dashboard, one modal, one data-heavy report, and POS.

## What we are not changing

- **Database / settings model** — `uiThemePreset` and root `data-ui-theme` are already correct.
- **Print-specific white/black** — preserve unless product explicitly wants tinted prints.
