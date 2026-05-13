# Getting started

## Prerequisites

- **Node.js**: current Active LTS or newer.
- **PostgreSQL**: version compatible with Prisma 7 and your hosting provider.
- **Git** (to clone the repository).

This project is developed on Windows, macOS, and Linux; paths in examples use POSIX style unless noted.

## 1. Install dependencies

From the repository root:

```bash
npm install
```

You can use `pnpm` or `yarn` if your team standardizes on them; ensure lockfiles are respected per team policy.

## 2. Environment file

Copy the template and edit values:

```bash
cp .env.example .env
```

At minimum, set **`DATABASE_URL`** to a valid PostgreSQL connection string.

### Default connection string in development

[`prisma.config.ts`](../prisma.config.ts) falls back to a local URL if `DATABASE_URL` is unset:

`postgresql://postgres:postgres@localhost:5432/palm_oil_pos?schema=public`

That fallback is a **convenience for local development only**. In production and CI, always set **`DATABASE_URL` explicitly**—do not rely on the fallback.

## 3. Database migrations

Apply the schema to your database:

**Local development** (creates/applies migrations interactively):

```bash
npx prisma migrate dev
```

**Production / CI**: run `prisma migrate deploy` (or your platform’s equivalent) against the target database with `DATABASE_URL` set.

After schema changes, regenerate the client if needed:

```bash
npm run prisma:generate
```

(`npm run build` and `postinstall` also run `prisma generate`.)

## 4. Seeding (optional)

Seed scripts populate reference or demo data via [`prisma/seed.ts`](../prisma/seed.ts):

```bash
npm run db:seed
```

Run this when your team’s onboarding process expects seeded data. It is not strictly required if you only need an empty database plus migrations.

## 5. Run the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are directed to `/login`.

## First login and setup

1. **Company settings** live under **Setup** (`/setup`) after you sign in. The app initializes default company settings on first access where applicable.

2. **Default users**: If there are **no users yet**, saving company settings on the Setup page creates default accounts **`admin` / `admin`** and **`clerk` / `clerk`** (the clerk is tied to the first sales point if one exists). This matches the in-app copy on the Setup page.

3. Use **[Users](http://localhost:3000/users)** (`/users`) to manage accounts, roles, sales points, and optional per-user **service** labels.

4. **[Access control](http://localhost:3000/setup/permissions)** configures which roles can reach which routes.

## Common failures

| Symptom | What to check |
| --- | --- |
| Prisma cannot connect | `DATABASE_URL` in `.env`, PostgreSQL running, network/firewall, SSL mode if required by host |
| “Migration failed” / schema drift | Run `prisma migrate dev` locally or `migrate deploy` in CI; avoid editing production DB by hand |
| Stale types or missing columns after pull | `npm run prisma:generate`, restart dev server |
| Auth errors in production | Set **`AUTH_SECRET`** or **`NEXTAUTH_SECRET`**; see [configuration.md](configuration.md) |

## Further reading

- [architecture.md](architecture.md) — how routing and auth fit together.
- [configuration.md](configuration.md) — full list of environment variables.
