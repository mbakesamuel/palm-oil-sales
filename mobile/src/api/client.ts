import Constants from "expo-constants";
import { Platform } from "react-native";

const API_PORT = 3000;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function hostFromUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const withoutScheme = uri.replace(/^[a-z+]+:\/\//i, "");
  const hostPort = withoutScheme.split(/[/?#]/)[0] ?? "";
  const host = hostPort.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

/** Derive the dev PC LAN address from the Expo / Metro connection. */
function inferDevApiHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0]?.trim();
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  }

  for (const uri of [Constants.linkingUri, Constants.experienceUrl]) {
    const host = hostFromUri(uri);
    if (host) return host;
  }

  return null;
}

/**
 * Base URL for the Next.js backend (web + /api/mobile/v1).
 *
 * Priority:
 * - app.json `extra.apiBaseUrl` (explicit override)
 * - In dev: same host as Expo / Metro (matches the QR code URL)
 * - `EXPO_PUBLIC_API_BASE_URL` (manual fallback when auto-detect fails)
 * - Release builds: env / extra only
 */
export function getApiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  if (extra?.apiBaseUrl?.trim()) {
    return trimTrailingSlash(extra.apiBaseUrl.trim());
  }

  if (__DEV__) {
    const inferred = inferDevApiHost();
    if (inferred) {
      return `http://${inferred}:${API_PORT}`;
    }
    const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    if (fromEnv) {
      return trimTrailingSlash(fromEnv);
    }
    // Android emulator: localhost on the device is not your PC.
    if (Platform.OS === "android") {
      return `http://10.0.2.2:${API_PORT}`;
    }
    return `http://localhost:${API_PORT}`;
  }

  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    return trimTrailingSlash(fromEnv);
  }

  return "";
}

export function describeApiConnection(): string {
  const base = getApiBaseUrl();
  if (!base) return "API URL is not configured.";
  return `Using API at ${base}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /network request failed|failed to fetch|network error/i.test(error.message)
  );
}

export function networkErrorMessage(): string {
  const base = getApiBaseUrl() || "(not configured)";
  if (__DEV__) {
    return (
      `Cannot reach the server at ${base}. ` +
      "Start the backend with npm run dev in the pos-app folder. " +
      "On a physical phone, PC and phone must be on the same Wi‑Fi, and Windows Firewall must allow port 3000."
    );
  }
  return (
    `Cannot reach the server at ${base}. ` +
    "Check mobile data or Wi‑Fi, and confirm the app was built with the correct production API URL."
  );
}

export function missingApiBaseUrlMessage(): string {
  if (__DEV__) {
    return (
      "API base URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in mobile/.env " +
      "or extra.apiBaseUrl in app.json, then restart Expo."
    );
  }
  return (
    "API base URL is not configured in this build. " +
    "Rebuild the APK with EXPO_PUBLIC_API_BASE_URL set to your Vercel URL (see mobile/README.md)."
  );
}

export async function parseJsonResponse<T>(
  res: Response,
): Promise<T & { error?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    throw new ApiError(
      res.ok
        ? "Empty response from server."
        : `Server error (${res.status}). Check the backend terminal logs.`,
      res.status,
    );
  }
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    const snippet = text.trimStart().slice(0, 40).toLowerCase();
    if (snippet.startsWith("<!doctype") || snippet.startsWith("<html")) {
      throw new ApiError(
        res.status === 404
          ? __DEV__
            ? `API not found (${res.status}). Restart the backend with npm run dev in the pos-app folder.`
            : `API not found (${res.status}). Confirm the mobile API is deployed on Vercel and the app points to the correct URL.`
          : `Server returned HTML instead of JSON (${res.status}).`,
        res.status,
      );
    }
    throw new ApiError(
      `Invalid response from server (${res.status}).`,
      res.status,
    );
  }
}

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

let tokens: TokenPair | null = null;
let onTokensUpdated: ((t: TokenPair | null) => void) | null = null;

export function setApiTokens(next: TokenPair | null) {
  tokens = next;
  onTokensUpdated?.(next);
}

export function subscribeApiTokens(cb: (t: TokenPair | null) => void) {
  onTokensUpdated = cb;
  return () => {
    if (onTokensUpdated === cb) onTokensUpdated = null;
  };
}

async function refreshAccessToken(): Promise<boolean> {
  if (!tokens?.refreshToken) return false;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/mobile/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) return false;
    const data = await parseJsonResponse<{ tokens: TokenPair }>(res);
    setApiTokens(data.tokens);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError(missingApiBaseUrlMessage(), 0);
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch (e) {
    if (isNetworkError(e)) {
      throw new ApiError(networkErrorMessage(), 0);
    }
    throw e;
  }

  if (res.status === 401 && tokens?.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed && tokens?.accessToken) {
      headers.set("Authorization", `Bearer ${tokens.accessToken}`);
      try {
        res = await fetch(`${base}${path}`, { ...init, headers });
      } catch (e) {
        if (isNetworkError(e)) {
          throw new ApiError(networkErrorMessage(), 0);
        }
        throw e;
      }
    }
  }

  const json = await parseJsonResponse<T>(res);
  if (!res.ok) {
    throw new ApiError(json.error ?? res.statusText, res.status);
  }
  return json;
}
