---
name: BPO Sales Crosstab
overview: Add a BPO sales report that shows monthly and financial-year-to-date sales by BPO variant, with separate crosstab sections for quantity units and gross XAF.
todos:
  - id: access-bpo-sales-crosstab
    content: Add route permission/default access and sidebar link for the BPO sales crosstab report.
    status: completed
  - id: build-bpo-sales-crosstab
    content: Create the BPO sales crosstab report page with financial year selector, quantity section, and gross XAF section.
    status: completed
  - id: verify-bpo-sales-crosstab
    content: Run focused lint/type checks and note manual verification points.
    status: completed
isProject: false
---

# BPO Sales Crosstab Report

## Scope

Create a new report route at `[app/(app)/reports/bpo-sales-crosstab/page.tsx](app/(app)/reports/bpo-sales-crosstab/page.tsx)` and add it to the Reports sidebar. The report will show validated Bottled Palm Oil sales only, grouped by BPO variant.

The report will have two crosstab sections:

- Quantity units
- Gross sales amount (XAF)

Each section will use the same structure:

- Rows: BPO variants, e.g. `Bottled Palm Oil - 1x20`
- Columns: financial-year months in order
- For each month: two sub-columns
  - `Month`: sales inside that month
  - `To date`: cumulative sales from the first month of the financial year through that month
- Ending total columns
  - `Total`: financial-year total
  - `To date`: same cumulative final value, included to match the requested layout

## Access

Add a new permission key:

- `[lib/access-control-keys.ts](lib/access-control-keys.ts)` → `route:/reports/bpo-sales-crosstab`

Grant it by default to the same BPO/consolidated roles currently involved in BPO reporting:

- `ADMIN`
- `DIRECTOR`
- `MANAGER`
- `SENIOR_SUPERVISOR`
- `CLERK_IN_CHARGE_BPO`

Update `[app/(app)/layout.tsx](app/(app)/layout.tsx)` to show the link in the Reports section, likely near `BPO monitor` and `BPO stock cross`.

## Data Logic

Use `[prisma/schema.prisma](prisma/schema.prisma)` existing sale data:

- `Sale.status = VALIDATED`
- `Sale.soldAt` inside selected financial year dates
- `SaleLine.product.isBottledPalmOil = true`
- group by `SaleLine.productVariantId`

Load:

- available financial years from `FinancialYearPeriod`
- BPO variants from `ProductVariant`
- validated BPO sale lines for the selected financial year

Use `[lib/fiscal.ts](lib/fiscal.ts)` helpers:

- `formatFinancialYearLabel(...)`
- `formatFiscalMonthCalendarLabel(...)`
- `calendarMonthForFiscalMonth(...)`

For each variant and financial month:

- monthly quantity = sum `SaleLine.qtyUnits`
- monthly gross = sum `SaleLine.lineGross`
- to-date quantity = running sum from month 1
- to-date gross = running sum from month 1

## UI

Follow existing report patterns from:

- `[app/(app)/reports/sales-budget-monthly-crosstab/page.tsx](app/(app)/reports/sales-budget-monthly-crosstab/page.tsx)`
- `[app/(app)/reports/bpo-stock-cross/page.tsx](app/(app)/reports/bpo-stock-cross/page.tsx)`

Use:

- `ReportHeader`
- `PrintButton`
- `ReportSignatory`
- financial year selector links
- compact `table-fixed`/small text styling to keep the crosstab readable

## Verification

Run focused checks:

- `npm run lint -- "app/(app)/reports/bpo-sales-crosstab/page.tsx" "app/(app)/layout.tsx" "lib/access-control.ts" "lib/access-control-keys.ts"`
- `npx tsc --noEmit --pretty false`

Manually verify:

- Sidebar shows `BPO sales crosstab`
- Report loads for allowed roles
- Each variant shows month and cumulative values
- Quantity and gross amount sections reconcile with validated BPO sales only
