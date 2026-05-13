# POS app

Internal **point-of-sale and operations** web application: sales, delivery orders, stock (including bottled palm oil flows), reporting, and company setup. Built with **Next.js** (App Router), **React 19**, **Prisma** + **PostgreSQL**, and **Auth.js** (credentials sign-in, JWT sessions).

This repository is **private** (`private: true` in `package.json`). There is no public license statement unless your organization adds one.

## Requirements

- **Node.js**: current Active LTS or newer (same major as local development tools).
- **PostgreSQL**: accessible via a connection string (`DATABASE_URL`).
- **npm**, **pnpm**, or **yarn** for installs (examples below use `npm`).

## Quick start

1. Clone the repository and enter the project directory.
2. Copy the environment template: `cp .env.example .env` (Windows: `copy .env.example .env`).
3. Set **`DATABASE_URL`** in `.env` to your PostgreSQL URL.
4. Install dependencies: `npm install`.
5. Apply the schema to your database: `npx prisma migrate dev` (development) or deploy migrations in your pipeline for production.
6. Optionally seed demo/reference data: `npm run db:seed`.
7. Start the dev server: `npm run dev`, then open [http://localhost:3000](http://localhost:3000).

For database defaults, troubleshooting, and first sign-in, see **[docs/getting-started.md](docs/getting-started.md)**.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` | Production build (`prisma generate` then `next build`) |
| `npm run start` | Run production server after build |
| `npm run lint` | ESLint |
| `npm run prisma:generate` | Regenerate Prisma Client |
| `npm run prisma:migrate` | Prisma Migrate (alias for `prisma migrate dev`) |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run db:seed` | Run `prisma/seed.ts` |

## Documentation

| Doc | Audience |
| --- | --- |
| [docs/README.md](docs/README.md) | Index of all guides |
| [docs/getting-started.md](docs/getting-started.md) | Install, DB, migrations, seed, first login |
| [docs/architecture.md](docs/architecture.md) | Stack, routing, auth, domain areas |
| [docs/configuration.md](docs/configuration.md) | Environment variables vs company settings |

## Security

- Set **`AUTH_SECRET`** or **`NEXTAUTH_SECRET`** in production. Auth.js uses this to sign session tokens. In development, a fallback secret may be used if neither is set—see [`auth.config.ts`](auth.config.ts).
- Never commit real secrets. `.env` is gitignored; use [`.env.example`](.env.example) as the template only.

## Deploy notes

- Production builds expect `DATABASE_URL` and a strong auth secret in the environment (e.g. Vercel project settings).
- The build runs `prisma generate`; apply migrations against the target database as part of your release process.
