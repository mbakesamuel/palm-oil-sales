---
name: Product pricing schedules
overview: Introduce versioned, tax-exclusive unit price schedules keyed by product and effective date. For products in category `productCatId === 1` (“Main”), schedules also key off `Customer.customerType`; for other categories, schedules are single-column (no customer type). Admin-only UI to maintain schedules; delivery orders and POS stop trusting free-typed prices—server resolves and enforces the correct ex-tax unit price at save time.
todos:
  - id: schema-migration
    content: Add ProductUnitPriceSchedule model + partial unique indexes (raw SQL migration); add MAIN_PRODUCT_CATEGORY_ID constant
    status: completed
  - id: lib-resolve
    content: Implement lib/pricing/resolve.ts (and optional preview server action)
    status: completed
  - id: enforce-do-pos
    content: Wire resolver into delivery-orders/actions.ts and pos/actions.ts; strip or ignore client-submitted unit prices
    status: completed
  - id: admin-ui
    content: Add /setup/product-pricing (admin-only CRUD), PERMISSION_KEYS + nav + defaultPermissions
    status: completed
  - id: clients-readonly
    content: Update DeliveryOrdersClient and SalesClient to auto-fill read-only prices via preview action
    status: completed
isProject: false
---

# Product pricing (scheduled, ex-tax)

## Current state

- **Manual prices today**: [`DeliveryOrderDetails.unitPrice`](c:\Users\user\Desktop\sales-project\pos-app\prisma\schema.prisma) and [`SaleLine.unitPricePerKg`](c:\Users\user\Desktop\sales-project\pos-app\prisma\schema.prisma) are populated from the UI ([`DeliveryOrdersClient.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\delivery-orders\DeliveryOrdersClient.tsx>), [`SalesClient.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\pos\SalesClient.tsx>)); server actions accept those values ([`delivery-orders/actions.ts`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\delivery-orders\actions.ts>), [`pos/actions.ts`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\pos\actions.ts>)).
- **“Product type” in your domain**: implemented as **`Product.productCatId`**: you confirmed **`1` = Main**, **`2` = Sub** (other IDs follow the same rule as Sub: direct pricing). There is no separate `ProductType` model in Prisma today—[`ProductCat`](c:\Users\user\Desktop\sales-project\pos-app\prisma\schema.prisma) is the right hook.
- **Customer type**: already on [`Customer.customerType`](c:\Users\user\Desktop\sales-project\pos-app\prisma\schema.prisma) (`CustomerType` enum).
- **Tax**: schedules should store **exclusive** amounts; this matches existing DO comments (“Unit price excluding VAT”) and POS flow where tax is applied on top of net ([`resolveTaxesForCustomer`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\pos\actions.ts>) after line net).
- **Admin-only management**: reuse [`assertActorIsAdmin`](c:\Users\user\Desktop\sales-project\pos-app\lib\access-control.ts) (same pattern as permissions page).

## Data model

Add a **`ProductUnitPriceSchedule`** (name can vary) table:

- `productId` → `Product`
- `unitPriceExTax` `Decimal(14,2)` — ex-tax unit price (per kg for sales lines; same semantic as current `unitPrice` / `unitPricePerKg` fields)
- `effectiveFrom` `Date` (calendar day, same pattern as [`TaxRateSchedule.effectiveFrom`](c:\Users\user\Desktop\sales-project\pos-app\prisma\schema.prisma))
- `customerType` `CustomerType?`
  - **Main category** (`productCatId === 1`): **required** — one price per `(productId, customerType)` per effective date.
  - **Non-Main categories**: **must be null** — one price per `productId` per effective date.

**Uniqueness (PostgreSQL):** Prisma `@@unique` on nullable `customerType` is unsafe for the “non-Main” case (multiple `NULL`s). Use **two partial unique indexes** in a raw SQL migration:

- `WHERE "customerType" IS NOT NULL`: unique `(productId, customerType, effectiveFrom)`
- `WHERE "customerType" IS NULL`: unique `(productId, effectiveFrom)`

Add a small constant in code, e.g. [`lib/pricing/constants.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\pricing\constants.ts): `MAIN_PRODUCT_CATEGORY_ID = 1` (document that this matches your catalog convention; avoids scattering magic numbers).

## Resolution logic (mirror tax schedules)

New server-only helper, e.g. [`lib/pricing/resolve.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\pricing\resolve.ts), analogous to [`lib/tax/resolve.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\tax\resolve.ts):

- Inputs: `prisma`, `productId`, `customerType` (for Main only), `asOfDate` (use the same “start of UTC day” approach as tax: reuse [`prismaDateToIso`](c:\Users\user\Desktop\sales-project\pos-app\lib\posting-calendar.ts) / `asOfStartUtc` pattern).
- Load product with `productCatId`.
- If `productCatId === MAIN_PRODUCT_CATEGORY_ID`: `findFirst` where `customerType` matches and `effectiveFrom <= asOf`, `orderBy: { effectiveFrom: 'desc' }`.
- Else: same with `customerType: null`.
- Return clear errors when no row exists (same UX expectation as missing tax rates).

## Server enforcement (authoritative pricing)

**Do not rely on browser-submitted prices for business validation.**

- **Delivery orders** ([`saveDeliveryOrderDetails`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\delivery-orders\actions.ts>)): after parsing lines, for each line resolve `unitPrice` from schedule using **header `customerId` + line `productId` + `dateIssued`**. Reject save if resolution fails. Optionally ignore client `unitPrice` fields entirely to prevent tampering (or compare and error on mismatch—ignoring client is simpler).
- **Sales** ([`createSale`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\pos\actions.ts>) and any update path): resolve each line’s `unitPricePerKg` using **sale `customerId` + line `productId` + transaction date** (`soldAt` / `transactionDate`). Same failure behavior.

**Snapshots:** Keep persisting resolved values on `DeliveryOrderDetails` / `SaleLine` so historical documents stay stable if schedules change later (already the case).

**Optional business note (out of scope unless you want it):** invoices could intentionally use DO `dateIssued` instead of invoice date for price resolution when a DO is linked—today nothing ties invoice price to DO line price in [`delivery-order-sale-control.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\delivery-order-sale-control.ts) (qty only). Call that out only if you need strict “price frozen on DO” behavior later.

## Admin UI

- New setup route, e.g. **`/setup/product-pricing`**, listed in [`setupNav`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\layout.tsx>) and registered in [`PERMISSION_KEYS`](c:\Users\user\Desktop\sales-project\pos-app\lib\access-control-keys.ts) + [`defaultPermissionsForRole`](c:\Users\user\Desktop\sales-project\pos-app\lib\access-control.ts) (admin-only default).
- Page pattern: list/filter by product (and for Main category, filter or column for `customerType`); form to add or edit **effectiveFrom + unitPriceExTax**; delete with confirm.
- All mutations: `assertActorIsAdmin` (or `session.role === ADMIN` with the same error text).

## Operational UI (DO / POS)

- When **customer**, **date**, or **product** on a line changes, call a **server action** (e.g. `previewProductUnitPrice`) that wraps the resolver and returns a string for display.
- Replace free-text price inputs with **read-only** display of the resolved price (or disabled inputs) so clerks/supervisors don’t edit prices; errors if no schedule exists.
- Loading an existing DO/sale continues to show stored line prices from the DB (no need to re-resolve for display of saved docs).

## Migration / rollout

- Add table + indexes.
- **No automatic backfill** of prices from old rows (unless you write a one-off script); until admins enter schedules, saves will fail with the same class of message as missing tax rates—acceptable if you coordinate data entry before cutover.
- Consider a short **dev-only** or **env-guarded** fallback to submitted prices only if you need a gradual rollout; you did not ask for this—default is strict.

## Testing checklist

- Main product + each `CustomerType`: correct row picked by date; new `effectiveFrom` switches on boundary.
- Sub product: rows with `customerType` null only; uniqueness enforced.
- Non-admin cannot hit pricing mutations.
- DO and POS totals unchanged in formula (still ex-tax × qty → net, then taxes).
