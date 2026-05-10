---
name: Reusable Report Header
overview: Create a reusable report header component for the company logo, company name, department, and report title, then replace the duplicated header markup in report pages that already use the same layout.
todos:
  - id: create-report-header
    content: Create reusable `components/ReportHeader.tsx` for logo/company/department/title header.
    status: completed
  - id: refactor-duplicate-headers
    content: Replace duplicated centered report header markup in the report pages that already use the same layout.
    status: completed
  - id: verify-report-header
    content: Run focused lint on the new component and refactored pages.
    status: completed
isProject: false
---

# Reusable Report Header

Add a server-compatible component at `[components/ReportHeader.tsx](components/ReportHeader.tsx)`. It will accept `companyName`, `department`, optional `logoSrc`, and `title`, derive the default logo as `/cdc-logo-svg.svg`, and render the same centered header layout from the provided snippet.

Use a plain React component without `"use client"`, so it can be imported directly by server report pages. Keep the existing `<img>` approach because settings may contain arbitrary `http(s)` logo URLs, preserving the existing ESLint exception inside the component.

Refactor the duplicated header blocks in these pages first:

- `[app/(app)/reports/do-commitment-crosstab/page.tsx](app/(app)/reports/do-commitment-crosstab/page.tsx)`
- `[app/(app)/reports/stock-on-hand/page.tsx](app/(app)/reports/stock-on-hand/page.tsx)`
- `[app/(app)/reports/stock-vs-commitments/page.tsx](app/(app)/reports/stock-vs-commitments/page.tsx)`
- `[app/(app)/reports/customer-delivery-monitor/page.tsx](app/(app)/reports/customer-delivery-monitor/page.tsx)`
- `[app/(app)/reports/sales-budget-monthly-crosstab/page.tsx](app/(app)/reports/sales-budget-monthly-crosstab/page.tsx)`

Where pages currently compute this repeatedly:

```tsx
const logoSrc =
  settings.logoUrl && settings.logoUrl.trim() !== ""
    ? settings.logoUrl.trim()
    : "/cdc-logo-svg.svg";
```

replace that local helper with:

```tsx
<ReportHeader
  companyName={settings.companyName}
  department={settings.department}
  logoSrc={settings.logoUrl}
  title="DO quantity commitments (crosstab)"
/>
```

After edits, run focused lint on the new component and touched report pages.
