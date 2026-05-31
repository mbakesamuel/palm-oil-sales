# POS Mobile (Expo)

React Native monitoring app for supervisors, managers, and leadership. Uses the same Next.js backend as the web app (`/api/mobile/v1` on Vercel or local dev).

## Local development

1. Start the Next.js backend from the repo root:

```bash
npm run dev
```

2. Install and run the mobile app:

```bash
cd mobile
npm install
npm start
```

3. On a **physical device**, point the app at your PC (optional if auto-detect works):

Create `mobile/.env` (see `.env.example`):

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```

Use the **Network** URL from `npm run dev` (not `localhost`). Phone and PC must be on the same Wi‑Fi.

## Auth

Bearer tokens via `/api/mobile/v1/auth/login` (not web cookies). Tokens are stored in Expo SecureStore.

## API

Endpoints: `/api/mobile/v1/*`. Shared types: `packages/shared/src/mobile-api.ts`.

---

## Internal Android testing (production / Vercel)

Use this to give a few testers an **installable APK** that talks to your **deployed** Vercel app (no dev laptop required).

### Prerequisites

- [Expo account](https://expo.dev) and EAS CLI: `npm i -g eas-cli`
- Mobile API routes deployed on Vercel (`app/api/mobile/v1`, `lib/mobile`)
- Vercel env: `AUTH_SECRET`, `DATABASE_URL`, migrations applied (`MobileRefreshToken`)
- Production test users with mobile-allowed roles

### One-time setup

```bash
cd mobile
npm install
eas login
eas init
```

`eas init` links the project and adds `extra.eas.projectId` to `app.json`.

Set the production API URL in EAS (replace with your Vercel domain):

```bash
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR_APP.vercel.app --environment preview
```

Verify login on Vercel:

```bash
curl -X POST https://YOUR_APP.vercel.app/api/mobile/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"YOUR_USER\",\"password\":\"YOUR_PASSWORD\"}"
```

Expect JSON with `tokens` and `session`, not HTML.

### Build APK for testers

```bash
cd mobile
eas build --platform android --profile preview
```

When the build finishes, open the build in the [Expo dashboard](https://expo.dev) and share the **install link** or QR code.

**Testers:**

1. Open the link on Android and install (may need “Install unknown apps” for the browser/installer).
2. Open **POS Monitor** and sign in with **production** credentials.
3. The login screen shows which API URL the build uses.

### New tester round

Bump version in `app.json`:

- `expo.version` (e.g. `1.0.1`)
- `expo.android.versionCode` (integer, must increase)

Then run `eas build` again.

### Optional: over-the-air JS updates

After the first APK:

```bash
eas update --branch preview --message "Fix description"
```

Native API URL stays whatever was set at build time.

### Android package

Application ID: `com.posapp.monitor` (change in `app.json` → `expo.android.package` before your first store build if needed).

### iOS

Not configured in this phase. Use Android internal APK until TestFlight is needed.
