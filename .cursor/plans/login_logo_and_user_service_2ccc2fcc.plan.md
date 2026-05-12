---
name: Login logo and user service
overview: Use `CompanySettings.logoUrl` on the login screen (with the same public-path/URL rules and fallback as reports). Add optional `service` on `User`, editable under Users and shown in session + sidebar; extend Setup with copy and a user list column—not a second global “service” on `CompanySettings`, since services differ by user within a department.
todos:
  - id: logo-login
    content: resolveCompanyLogoSrc helper (optional) + login page use settings.logoUrl
    status: completed
  - id: schema-user-service
    content: Prisma User.service + migration
    status: completed
  - id: users-crud
    content: users/actions saveUser + page select + UsersClient form/list
    status: completed
  - id: auth-session
    content: auth.ts, auth.config.ts, next-auth.d.ts, auth-session, auth-server, session route, login/actions
    status: completed
  - id: setup-sidebar
    content: setup page user list + copy; Sidebar session.service line
    status: completed
  - id: verify
    content: prisma generate, eslint, quick manual login + user edit
    status: completed
isProject: false
---

# Login logo + per-user service

## 1. Login: use configured logo URL

[`app/login/page.tsx`](c:\Users\user\Desktop\sales-project\pos-app\app\login\page.tsx) already calls `getOrInitCompanySettings()`. Replace the hardcoded `logoSrc="/cdc-logo-svg.svg"` with the same resolution logic as [`components/ReportHeader.tsx`](c:\Users\user\Desktop\sales-project\pos-app\components\ReportHeader.tsx) (non-empty trimmed `logoUrl` else `/cdc-logo-svg.svg`).

**Optional small DRY step:** add [`lib/company-logo.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\company-logo.ts) exporting `resolveCompanyLogoSrc(logoUrl: string | null | undefined): string`, use it from `login/page.tsx` and refactor `ReportHeader` to import it (keeps one rule for allowed URL shapes if you ever tighten validation).

## 2. Data model: `User.service` (not `CompanySettings`)

Department stays on [`CompanySettings.department`](c:\Users\user\Desktop\sales-project\pos-app\prisma\schema.prisma). **Services differ by user**, so add:

- `User.service String?` — free text (e.g. “Retail counter”, “Wholesale desk”).

New Prisma migration under `prisma/migrations/`.

## 3. Users: create/update + list

- [`app/(app)/users/actions.ts`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\users\actions.ts>): read `service` from `FormData`, `trim()` → `null` if empty; include in `prisma.user.create` / `update` `data`.
- [`app/(app)/users/page.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\users\page.tsx>): include `service` in the `select` passed to `UsersClient`.
- [`app/(app)/users/UsersClient.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\users\UsersClient.tsx>): extend `UserRow`; add optional “Service (optional)” text input in create/edit form; wire `startEdit` / `reset` / hidden or controlled field in the existing save form.

## 4. Auth session: so the signed-in user “sees” their service

Thread `service` through the same path as `salesPoint`:

| Location                                                                                                               | Change                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`auth.ts`](c:\Users\user\Desktop\sales-project\pos-app\auth.ts) `authorize` return object                             | Add `service` from `user.service`                                                      |
| [`auth.config.ts`](c:\Users\user\Desktop\sales-project\pos-app\auth.config.ts) `jwt` / `session`                       | Set/read `token.service`, `session.service`                                            |
| [`types/next-auth.d.ts`](c:\Users\user\Desktop\sales-project\pos-app\types\next-auth.d.ts)                             | `Session` + `JWT`: optional `service?: string \| null`                                 |
| [`lib/auth-session.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\auth-session.ts)                               | Add `service` to `AuthSession`; extend `parseAuthSession` for backward-compatible JSON |
| [`lib/auth-server.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\auth-server.ts)                                 | Pass `service` on returned session object                                              |
| [`app/api/auth/session/route.ts`](c:\Users\user\Desktop\sales-project\pos-app\app\api\auth\session\route.ts)           | Include `service` in JSON                                                              |
| [`app/login/actions.ts`](c:\Users\user\Desktop\sales-project\pos-app\app\login\actions.ts) `loadAuthSessionByUsername` | Select `service`, return on `AuthSession`                                              |

**JWT refresh:** after an admin changes a user’s `service`, that user’s JWT updates on **next sign-in** (same as other profile fields). No DB round-trip on every request unless you add that later.

## 5. Setup page (“company settings setup”)

[`app/(app)/setup/page.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\setup\page.tsx>):

- Extend the `prisma.user.findMany` `select` with `service`.
- In the “User accounts” list, show `service` when set (e.g. after name or role).
- Add a short note under **Department** (or under the user list): department is company-wide; **service is per user** and is edited under **Users** (link `/users`).

No new field on the company settings **form** itself (avoids duplicating a single global “service” that conflicts with multiple services per department).

## 6. Sidebar (optional but useful)

[`app/(app)/Sidebar.tsx`](<c:\Users\user\Desktop\sales-project\pos-app\app(app)\Sidebar.tsx>): in the footer block under display name, if `session.service` is non-empty, show one line (truncated + `title`).

## Verification

- `npx prisma migrate dev` (or apply migration) + `npx prisma generate`.
- `npx eslint` on touched files.
- Manual: set logo URL in Setup → open `/login` and confirm image; set a user’s service on `/users` → sign in as that user → sidebar (and `/api/auth/session`) show service.
