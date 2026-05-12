---
name: POS Traite payments
overview: Add a `TRAITE` payment method for POS sales with persisted Traite number, bank, issue date, and maturity date on `Payment`, then expose and validate these fields in `SalesClient` and `createSale`, and show them on the printed invoice and sales reports.
todos:
  - id: schema-migrate
    content: Add PaymentMethod.TRAITE + Payment traiteNo, traiteIssuedOn, traiteMaturityOn + migration
    status: completed
  - id: pos-actions
    content: PosPaymentInput, createSale validation/create, LoadedSaleView + loadSaleByInvoiceNo + sale print payload
    status: completed
  - id: sales-client-ui
    content: SalesClient Payment type, TRAITE option, conditional fields, applyLoaded/defaults
    status: completed
  - id: print-reports
    content: SalePrint payment details; sales report formatPaymentMethods; pos page blurb
    status: completed
  - id: verify
    content: prisma generate, eslint on changed files, quick manual save/load
    status: completed
isProject: false
---

# POS Traite (bank bill) payment tracking

## Goal

At lifting, payment is not cash but a **traite** issued by the bank. Track per payment line:

- Traite No
- Bank
- Date issued
- Maturity date

## Data model

Prisma today ([`prisma/schema.prisma`](c:\Users\user\Desktop\sales-project\pos-app\prisma\schema.prisma)):

- `PaymentMethod` enum: `CASH`, `CHEQUE`, `CREDIT`
- `Payment`: `method`, `amount`, `chequeNo?`, `bank?`, `paidAt`

**Changes**

1. Add `TRAITE` to enum `PaymentMethod`.
2. On `Payment`, add nullable fields (used when `method === TRAITE`):
   - `traiteNo String?`
   - `traiteIssuedOn DateTime? @db.Date`
   - `traiteMaturityOn DateTime? @db.Date`

Reuse existing `bank` for drawee/issuing bank (same as cheque). Keep `chequeNo` null for traite lines so cheque-specific logic stays clear.

Add a migration under `prisma/migrations/` (enum value + three columns).

## Server: POS create + load + print

[`app/(app)/pos/actions.ts`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\pos\actions.ts>)

- Extend `PosPaymentInput` with optional `traiteNo`, `traiteIssuedOn`, `traiteMaturityOn` (ISO `yyyy-mm-dd` strings from the client).
- In the payment preparation loop (today maps only `CASH` / `CHEQUE`):
  - Parse `method === "TRAITE"` to `PaymentMethod.TRAITE`.
  - **TRAITE**: require non-empty `traiteNo`, `bank`, `traiteIssuedOn`, `traiteMaturityOn`; parse dates (reuse [`normalizeIsoDateInput`](c:\Users\user\Desktop\sales-project\pos-app\lib\posting-calendar.ts) or noon UTC from date-only); optional rule: maturity date not before issue date.
  - **CHEQUE**: unchanged (cheque # + bank).
  - **CASH**: unchanged.
  - `payments.create`: pass `traiteNo`, `traiteIssuedOn`, `traiteMaturityOn` for new rows (null for non-traite).

- **`LoadedSaleView["payments"]`**: add `traiteNo`, `traiteIssuedOn`, `traiteMaturityOn` as optional strings (ISO dates) alongside existing fields.
- **`loadSaleByInvoiceNo`**: include new columns in the payment select/map.

- **`buildSalePrintPayload` / `SalePrintModel`**: extend payment objects with the same fields; no Prisma change needed beyond schema.

## Client: [`SalesClient.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\pos\SalesClient.tsx>)

- Extend local `Payment` type: `method: "CASH" | "CHEQUE" | "TRAITE"` plus optional `traiteNo`, `traiteIssuedOn`, `traiteMaturityOn` (string dates for `<input type="date">`).
- Payments section:
  - Add `<option value="TRAITE">Traite</option>`.
  - When `TRAITE`: show inputs for Traite no, Bank, Date issued, Maturity (and keep Amount). Disable cheque-specific fields.
  - When `CHEQUE` / `CASH`: hide traite-only fields (or leave blank).
- **`applyLoaded` / `resetNew` / “Add payment line”**: default new lines consistently (e.g. default method remains `CASH` or your preferred default).
- Page copy: update [`app/(app)/pos/page.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\pos\page.tsx>) line “Payments allowed: cash, cheque” to mention traite if you keep that blurb.

## Print + reports

- [`components/SalePrint.tsx`](c:\Users\user\Desktop\sales-project\pos-app\components\SalePrint.tsx): extend `SalePrintModel["payments"]` and the “Details” cell to show traite no, bank, issued, maturity when `method` is `TRAITE` (human-readable labels, e.g. `Traite: … · Issued: … · Matures: …`).
- [`app/(app)/reports/sales/page.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\reports\sales\page.tsx>): extend `formatPaymentMethods` to label `TRAITE` as “Traite” (and ensure `CREDIT` remains handled if present).

## Optional / low priority

- [`app/(app)/pos/PosForm.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\pos\PosForm.tsx>) appears unused outside its file; update only if you still rely on it for demos/tests.
- [`lib/domain.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\domain.ts) `PaymentMethod` constant is Prisma-free and incomplete vs DB; add `TRAITE` only if something client-side imports it—otherwise `SalesClient` string union is enough.

## Verification

- `npx prisma migrate dev` (or generate migration SQL) then `npx prisma generate`.
- `npx eslint` on touched files.
- Manual: create sale with one `TRAITE` line (full fields), save, reload by invoice, print preview, confirm report label.
