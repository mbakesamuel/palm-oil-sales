---
name: BPO Outbound Sales
overview: Extend BPO outbound so it handles PRO/gift outflows plus BPO cash and employee credit sales, reusing the existing Sale ledger for sales while adding employee/ration scaffolding for credit control.
todos:
  - id: schema-bpo-credit
    content: Add Prisma schema support for credit payment and employee BPO credit sale metadata/ration scaffolding.
    status: completed
  - id: bpo-sale-action
    content: Add server action to post cash and employee credit BPO sales from Bota using the Sale ledger and BPO stock deduction.
    status: completed
  - id: bpo-outbound-ui
    content: Update the BPO outbound client/page to support PRO, cash sale, and employee credit sale modes.
    status: completed
  - id: report-credit-label
    content: Update sales reporting/payment formatting to display credit payments distinctly.
    status: completed
  - id: verify-bpo-outbound-sales
    content: Run migration/type/lint checks and note manual verification paths.
    status: completed
isProject: false
---

# BPO Outbound Sales

## Approach

Keep PRO/gift as BPO stock movements in `[app/(app)/stock/bpo-outbound/actions.ts](app/(app)/stock/bpo-outbound/actions.ts)`, because that path already posts non-sale stock out of Bota.

Add BPO sales into the same outbound screen, but create normal `Sale` records for CASH and CREDIT. The existing sale path already supports BPO variant pricing, Bota-only sales, and BPO stock deduction on validation:

```tsx
if (product.isBottledPalmOil) {
  if (botaSalesPointId == null || effectiveSalesPointId !== botaSalesPointId) {
    throw new Error(
      "Only Bota sales point is allowed to sell Bottled Palm Oil.",
    );
  }
  // variant price + qtyUnits
}
```

For the outbound sales workflow, create and validate the BPO sale in one server transaction because the operation is performed at Bota as an immediate outbound posting.

## Data Model Changes

Update `[prisma/schema.prisma](prisma/schema.prisma)` with:

- `PaymentMethod.CREDIT`, keeping existing `CASH` and `CHEQUE`.
- An `Employee` model with `matricule`, `name`, `estate`, active flag, and timestamps.
- A `BpoEmployeeCreditSale` model linked one-to-one to `Sale`, storing employee, collected category (`LOOSE_PALM_OIL` or `BOTTLED_PALM_OIL`), optional ration period fields, and ration-limit snapshot fields kept nullable until the limit policy is finalized.

This gives us persistent employee identity for future monthly ration control instead of only storing text snapshots.

## Server Actions

In `[app/(app)/stock/bpo-outbound/actions.ts](app/(app)/stock/bpo-outbound/actions.ts)`:

- Keep `createBpoOutboundMovement` for PRO/gift/other non-sale outflows.
- Add a new `createBpoOutboundSale` action for CASH and CREDIT BPO sales.
- Resolve the Bota sales point and reject non-Bota access.
- Resolve the BPO variant price with `resolveVariantUnitPriceExTax` as at the sale date.
- Create `Sale`, `SaleLine`, tax snapshots, and payment rows.
- For CASH, require payment amount to equal gross and create a `CASH` payment.
- For CREDIT, require employee matricule/name/estate, upsert or select the employee, create a `CREDIT` payment/credit marker, and create `BpoEmployeeCreditSale` metadata.
- Deduct BPO stock in the same transaction using `applyBpoStockDeduction` and mark the sale `VALIDATED` immediately.
- Add ration-control scaffolding: if an active ration limit exists later, calculate used quantity for the employee/period/category and reject quantities above the limit. Initially, nullable limit fields allow the workflow to run until the exact ration policy is supplied.

## UI Changes

In `[app/(app)/stock/bpo-outbound/BpoOutboundClient.tsx](app/(app)/stock/bpo-outbound/BpoOutboundClient.tsx)`:

- Rename the page from “BPO Gift / Out” to a broader BPO outbound/sales title.
- Add a mode selector: `PRO / Gift / Other out`, `Cash sale`, `Employee credit sale`.
- Keep the existing line picker for BPO variants and quantities.
- For CASH: show sale date, variant lines, and cash amount or auto-total from pricing.
- For CREDIT: show employee fields (`matricule`, `name`, `estate`) and collected category (`Loose Palm Oil` / `Bottled Palm Oil`), with BPO variant fields when category is BPO.
- Surface server-side ration-limit errors in the existing banner.

In `[app/(app)/stock/bpo-outbound/page.tsx](app/(app)/stock/bpo-outbound/page.tsx)`:

- Load the BPO product id, variants, recent BPO stock movements, and recent BPO sales/credit sales for display.
- Pass both outbound movement and outbound sale actions to the client.

## Reports and Compatibility

Update payment display helpers such as `[app/(app)/reports/sales/page.tsx](app/(app)/reports/sales/page.tsx)` so `PaymentMethod.CREDIT` displays as `Credit` instead of being formatted as cash.

Ensure existing BPO stock reports continue to work because validated BPO sale lines are already included through `SaleLine` and `BpoSaleLineBatchAllocation`.

## Verification

Run:

- `npx prisma migrate dev` for schema changes.
- `npm run lint -- "app/(app)/stock/bpo-outbound" "app/(app)/reports/sales/page.tsx"`
- `npx tsc --noEmit --pretty false`

Then manually verify:

- PRO/gift still posts as BPO movement.
- Cash BPO sale creates a validated sale and deducts Bota BPO stock.
- Employee credit BPO sale records employee metadata and deducts stock.
- Credit appears correctly in the sales report payment method column.
