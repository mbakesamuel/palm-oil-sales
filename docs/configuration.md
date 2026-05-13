# Configuration

This document distinguishes **environment variables** (process env), **code defaults** used when initializing data, and **company settings** persisted in PostgreSQL.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** in production/CI | PostgreSQL connection string for Prisma. If unset locally, [`prisma.config.ts`](../prisma.config.ts) may use a dev-only fallback—see [getting-started.md](getting-started.md). |
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | **Yes** in production | Secret for signing Auth.js session tokens. Use either name. |
| `NODE_ENV` | Automatic | `development` vs `production`; affects logging and Auth secret fallback behavior in [`auth.config.ts`](../auth.config.ts). |
| `DEFAULT_CURRENCY` | No | Default currency code when initializing defaults (see [`lib/env.ts`](../lib/env.ts)); defaults to `XAF`. |
| `DEFAULT_VAT_RATE` | No | Decimal rate string for VAT when seeding defaults (e.g. `0.1925` for 19.25%). |
| `DEFAULT_INVOICE_PREFIX` | No | Invoice prefix used when creating initial company settings from env defaults (default `PO`). |

Scripts under `scripts/` that connect to the database also expect `DATABASE_URL`; run them with `.env` loaded (or export variables in your shell).

### Template file

Copy [`.env.example`](../.env.example) to `.env` and edit—never commit `.env`.

## Code defaults vs company settings

[`lib/env.ts`](../lib/env.ts) exposes **`DEFAULT_CURRENCY`**, **`DEFAULT_VAT_RATE`**, and **`DEFAULT_INVOICE_PREFIX`**. These feed **first-time initialization** (for example when [`getOrInitCompanySettings()`](../lib/settings.ts) creates the default `CompanySettings` row).

Most **ongoing** business values—company name, logo URL, **department** (company-wide), VAT rate shown on invoices, invoice prefix, fiscal year start month, phone, address—are stored in **`CompanySettings`** and edited in the app under **Setup** (`/setup`), not in `.env`. After the first row exists, operators should change those fields in the UI.

## Per-user and company fields (clarification)

- **Department** (optional): company-wide label on **Setup**; same for all users.
- **Service** (optional): per-user free text (e.g. counter or desk name), edited under **Users** (`/users`); can appear in the signed-in session and shell.

## Auth session

Session tokens include role, display name, sales point (when applicable), and optional **service** as set on the user record. Changing a user in the database does not automatically refresh an existing JWT until the user signs in again.

## Further reading

- [getting-started.md](getting-started.md) — how to set `DATABASE_URL` and run migrations.
- [architecture.md](architecture.md) — where auth and access control run in the stack.
