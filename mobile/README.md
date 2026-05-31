# POS Mobile (Expo)

React Native monitoring app for supervisors, managers, and leadership.

## Setup

1. Start the Next.js backend (`npm run dev` in the repo root).
2. Install mobile dependencies:

```bash
cd mobile
npm install
```

3. For a physical device, set your machine IP in `mobile/app.json`:

```json
"extra": {
  "apiBaseUrl": "http://192.168.x.x:3000"
}
```

4. Run the app:

```bash
npm start
```

## Auth

Uses Bearer tokens via `/api/mobile/v1/auth/login` (not web session cookies). Tokens are stored in Expo SecureStore.

## API

All endpoints live under `/api/mobile/v1/` on the same backend as the web app. See `packages/shared/src/mobile-api.ts` for shared types.
