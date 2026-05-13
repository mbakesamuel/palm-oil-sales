---
name: Agro green-yellow UI theme
overview: Define semantic brand tokens in `app/globals.css`, let admins pick a preset (default vs agro) stored on `CompanySettings` and edited on Setup, apply the choice on `<html>` via `data-ui-theme`, then use semantic Tailwind utilities in the shell and key surfaces. Optional dark-mode overrides per preset.
todos:
  - id: theme-tokens
    content: Add brand/accent/surface CSS variables, @theme inline mappings, and data-ui-theme scoped overrides in app/globals.css
    status: pending
  - id: admin-persist-theme
    content: Add CompanySettings.uiThemePreset (Prisma migration + lib/settings + saveCompanySettings + Setup form select)
    status: pending
  - id: layout-apply-theme
    content: Pass saved preset from getOrInitCompanySettings into root app/layout.tsx as html data-ui-theme (and login layout if separate)
    status: pending
  - id: shell-components
    content: Apply semantic utilities to app shell (layout, Sidebar, login) and primary buttons
    status: pending
  - id: dark-and-a11y
    content: Tune dark-mode token overrides per preset and verify contrast on primary/secondary text pairs
    status: pending
isProject: false
---

# Agro green / yellow UI (visually appealing, accessible)

## Design principles (why this works)

- **Green carries the brand**: navigation, headers, primary buttons, and focus rings feel “agricultural” without looking like a highlighter.
- **Yellow is an accent, not a wallpaper**: large yellow backgrounds fail contrast for text and tire the eye. Use yellow for highlights, badges, chart accents, and small fills (e.g. icon circles, “warning/info” chips).
- **Neutrals do the heavy lifting**: off-white / warm gray surfaces and near-black text keep the POS readable for long shifts. Reserve pure `#fff` / `#000` for print or rare emphasis.
- **Contrast**: WCAG AA needs roughly **4.5:1** for body text. Pair **dark green text on light green tint** or **white text on solid green**; avoid **yellow body text on white**.

## Admin toggle at UI level (yes)

Admins can switch the look **without redeploying**, by persisting a **theme preset** on the same singleton row you already use for company branding.

- **Persistence**: Add a field on [`CompanySettings`](c:\Users\user\Desktop\sales-project\pos-app\prisma\schema.prisma) (e.g. `uiThemePreset` with values like `default` | `agro`). Prisma migration + default `default` for existing rows.
- **Admin UI**: Extend the existing Setup form at [`app/(app)/setup/page.tsx`](c:\Users\user\Desktop\sales-project\pos-app\app\(app)\setup\page.tsx) with a labeled `<select name="uiThemePreset">` (or radio group). Reuse [`saveCompanySettings`](c:\Users\user\Desktop\sales-project\pos-app\app\(app)\setup\actions.ts) (already gated by `assertPermissionKey("route:/setup")`) to read, validate, and upsert the new field alongside company name / VAT / etc.
- **Apply globally**: In [`app/layout.tsx`](c:\Users\user\Desktop\sales-project\pos-app\app\layout.tsx), after `getOrInitCompanySettings()`, set on `<html>` something like `data-ui-theme={settings.uiThemePreset}` (fallback `default` if DB missing). No client-side-only toggle is required for org-wide branding; every navigation gets the correct attribute from the server.
- **CSS**: Keep **default** token values on `:root`. Override brand/accent (and optionally background tints) only under `:root[data-ui-theme="agro"]` { … } so toggling the setting flips palettes without duplicating component logic. Login already loads settings in [`app/login/page.tsx`](c:\Users\user\Desktop\sales-project\pos-app\app\login\page.tsx); ensure the **same** `data-ui-theme` is applied wherever `<html>` is rendered (typically only root layout—verify login uses root layout so one place is enough).

**Optional later**: per-user override (localStorage + client wrapper) if you want “my theme” vs “company theme”; the plan above is **company-wide**, which matches “organization official colors.”

## Where to implement in this repo

Your theme entry point is already [`app/globals.css`](c:\Users\user\Desktop\sales-project\pos-app\app\globals.css) (`@import "tailwindcss"`, `:root` variables, `@theme inline`). Extend that file rather than adding a second theme system; add **scoped overrides** for `data-ui-theme` as above.

Suggested token shape (example values—tune to your exact brand hex):

- **Semantic colors** (map to Tailwind via `@theme inline`):
  - `--color-brand` / `--color-brand-foreground` — primary green + text/icon on it
  - `--color-accent` / `--color-accent-foreground` — yellow accent + readable foreground (often a dark green or near-black on yellow chips)
  - Optional: `--color-brand-muted` (very light green page tint), `--color-accent-soft` (pale yellow for table row hover)
- **Surfaces**: keep or refine `--background` / `--foreground`; add `--card`, `--border`, `--muted` if you want sidebar/panels to diverge slightly from the main canvas.

Then use utilities in layout chrome (e.g. [`app/(app)/layout.tsx`](c:\Users\user\Desktop\sales-project\pos-app\app\(app)\layout.tsx) / [`Sidebar`](c:\Users\user\Desktop\sales-project\pos-app\app\(app)\Sidebar.tsx) if present): `bg-brand`, `text-brand-foreground`, `border-brand/20`, `ring-brand` for focus.

## Application patterns (POS-friendly)

1. **Shell**: dark or deep green sidebar + light content area; or light shell with a green top bar and yellow accent stripe (thin) under the bar.
2. **Primary actions**: solid `brand` button; hover slightly darker; disabled muted gray (not faded green).
3. **Secondary / ghost**: outline `brand` border, transparent fill.
4. **Status**: keep semantic red/green for success/error in forms; use **accent yellow** for “pending / attention” so it does not collide with brand green.
5. **Charts/reports**: green series + yellow series + neutral grays; limit saturation so print and projectors stay legible.

## Dark mode (optional)

Your [`app/globals.css`](c:\Users\user\Desktop\sales-project\pos-app\app\globals.css) already has `prefers-color-scheme: dark` for background/foreground. If you add brand tokens, define **dark variants** of `--color-brand` (often slightly lighter green + softer yellow) so contrast holds.

## What not to do

- Full-screen saturated yellow with dark text everywhere.
- Neon lime + bright yellow together at full saturation (vibrating/clashing).
- Relying only on color to convey state (pair with icons or labels).

## Implementation order (when you move out of plan-only mode)

1. Prisma + settings + Setup: add `uiThemePreset`, wire [`lib/settings.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\settings.ts), [`saveCompanySettings`](c:\Users\user\Desktop\sales-project\pos-app\app\(app)\setup\actions.ts), and the Setup form.
2. Root layout: set `data-ui-theme` on `<html>` from settings.
3. Add brand/accent CSS variables + `@theme inline` mappings and `data-ui-theme` overrides in [`app/globals.css`](c:\Users\user\Desktop\sales-project\pos-app\app\globals.css).
4. Update shell / login / primary buttons to use semantic utilities.
5. Dark-mode + contrast pass per preset; focus-visible rings.

No change to the attached JWT/session plan is required; theming is orthogonal.
