---
name: API customers mobile
overview: Add a JSON `GET` handler at [`app/api/customers/route.ts`](c:\Users\user\Desktop\sales-project\pos-app\app\api\customers\route.ts) that reuses the same Prisma `select` as the customers page, enforces `route:/customers` (session + permission), and maps `/api/customers` in [`lib/resolve-route-permission.ts`](c:\Users\user\Desktop\sales-project\pos-app\lib\resolve-route-permission.ts) so [`proxy.ts`](c:\Users\user\Desktop\sales-project\pos-app\proxy.ts) applies the same access rules as the web UI. Document that the mobile client must send the Auth.js session cookie (or later a dedicated token scheme).
todos:
  - id: resolve-api-customers
    content: Map /api/customers to route:/customers in lib/resolve-route-permission.ts
    status: pending
  - id: api-customers-route
    content: Add app/api/customers/route.ts GET with session, assertPermissionKey, Prisma select, JSON
    status: pending
isProject: false
---

# Expose `GET /api/customers` for mobile clients

## URL vs file location

- Public path: `**/api/customers**` (what the mobile app calls).
- Implement as `**[app/api/customers/route.ts](c:\Users\user\Desktop\sales-project\pos-app\app\api\customers\route.ts)**` (App Router route handler). Do **not** place this underdf `[app/(app)/customers/](c:\Users\user\Desktop\sales-project\pos-app\app(app)`\customers: the `(app)` segment is a layout group and does not appear in the URL; `route.ts` next to `page.tsx` would **not** register as `/api/customers`.

## Auth and middleware (important)

- Today `[resolveRoutePermissionKey](c:\Users\user\Desktop\sales-project\pos-app\lib\resolve-route-permission.ts)` does **not** map `/api/customers` to `route:/customers`, so `[isRouteAllowedForPath](c:\Users\user\Desktop\sales-project\pos-app\lib\access-control.ts)` treats that pathname as **no matching key** and returns **allow** for any authenticated user.
- **Change:** add an explicit branch (before the generic loop) so `normalized === "/api/customers"` or `normalized.startsWith("/api/customers/")` resolves to `**route:/customers`**. Then the existing `[proxy.ts](c:\Users\user\Desktop\sales-project\pos-app\proxy.ts)` authorize probe enforces the **same** role rules as the customers page.
- **Handler:** use `[getServerSession](c:\Users\user\Desktop\sales-project\pos-app\lib\auth-server.ts)` (or `auth()`); if no session return **401** JSON. Call `[assertPermissionKey("route:/customers")](c:\Users\user\Desktop\sales-project\pos-app\lib\access-control.ts)` in a try/catch and map failure to **403** JSON (clearer than a thrown 500).

## Handler behavior

- `**export const runtime = "nodejs"`** and `**dynamic = "force-dynamic"**` (match other API routes).
- `**GET`:** `getPrismaClient().customer.findMany` with the same `**select`** as `[app/(app)/customers/page.tsx](c:\Users\user\Desktop\sales-project\pos-app\app(app)`\customers\page.tsx) (lines 16–30): `id`, `name`, `phone`, `email`, `address`, `customerType`, `residency`, `hasTaxpayerId`, `taxpayerId`, `taxRegime`, `createdAt`).
- **Pagination (optional but useful for mobile):** support `limit` (capped, e.g. max 200, default 50) and optional `cursor` (e.g. `createdAt` + `id` tuple) to match or exceed current `take: 50` behavior; return `{ customers, nextCursor }` or a simple `{ customers }` if you keep a fixed limit only.
- **Response:** `NextResponse.json(..., { headers: { "Cache-Control": "no-store" } })`.
- **Errors:** consistent JSON body e.g. `{ error: string }` with appropriate status codes.

## Mobile client note (no code unless you want CORS now)

- This app uses **Auth.js session cookies**. A native app must either use a **WebView/cookie jar** against your site origin, a **reverse proxy** that attaches cookies, or you add a **future** Bearer/API-key flow (out of scope unless requested).
- If the mobile app is a **browser PWA** on the same origin, cookies work as today.
- **CORS:** only needed if the app calls from another **browser** origin; native apps are not subject to browser CORS. Add optional env-driven CORS later if required.

## Files to add/change


| File                                                                                                             | Action                                                    |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `[app/api/customers/route.ts](c:\Users\user\Desktop\sales-project\pos-app\app\api\customers\route.ts)`           | **New** — `GET`, session + permission, Prisma query, JSON |
| `[lib/resolve-route-permission.ts](c:\Users\user\Desktop\sales-project\pos-app\lib\resolve-route-permission.ts)` | Map `/api/customers` → `route:/customers`                 |


## Verification

- Authenticated role **with** `route:/customers`: `GET /api/customers` returns 200 and JSON array.
- Authenticated role **without** permission: **403** (and middleware/probe behavior consistent).
- No session: **401** from authorize redirect path / handler as applicable.

