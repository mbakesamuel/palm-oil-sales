import "server-only";

import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const ACCESS_TOKEN_TTL_SEC = 45 * 60;
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;

/** Same secret resolution as Auth.js (`auth.config.ts`). */
function resolveAuthSecret(): string {
  const fromEnv = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (fromEnv && fromEnv.trim() !== "") return fromEnv.trim();
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-insecure-secret-set-AUTH_SECRET-in-production";
  }
  throw new Error(
    "Missing AUTH_SECRET (or NEXTAUTH_SECRET). Set it in environment variables.",
  );
}

function mobileJwtSecret(): Uint8Array {
  return new TextEncoder().encode(resolveAuthSecret());
}

export function hashMobileToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshTokenRaw(): string {
  return randomBytes(32).toString("base64url");
}

export async function signMobileAccessToken(userId: string): Promise<string> {
  return new SignJWT({ typ: "mobile_access" })
    .setSubject(userId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SEC}s`)
    .sign(mobileJwtSecret());
}

export async function verifyMobileAccessToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, mobileJwtSecret(), {
      algorithms: ["HS256"],
    });
    const userId = payload.sub?.trim();
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

export function mobileRefreshExpiresAt(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000);
}

export function mobileAccessExpiresInSec(): number {
  return ACCESS_TOKEN_TTL_SEC;
}
