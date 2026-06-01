import "server-only";

import bcrypt from "bcryptjs";
import type { AuthSession } from "@/lib/auth-session";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { loadAuthSessionByUserId, loadAuthSessionByUsername } from "@/lib/load-auth-session";
import { canUseMobileApp } from "@/lib/mobile/access";
import {
  generateRefreshTokenRaw,
  hashMobileToken,
  mobileAccessExpiresInSec,
  mobileRefreshExpiresAt,
  signMobileAccessToken,
} from "@/lib/mobile/tokens";

export type MobileAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export async function authenticateMobileUser(
  username: string,
  password: string,
  deviceLabel?: string | null,
): Promise<
  | { ok: true; session: AuthSession; tokens: MobileAuthTokens }
  | { ok: false; error: string }
> {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) {
    return { ok: false, error: "Username and password are required." };
  }

  const prisma = getPrismaClient();
  const user = await prismaRetry(() =>
    prisma.user.findUnique({
      where: { username: normalized },
      select: {
        id: true,
        passwordHash: true,
        passwordPlain: true,
        isActive: true,
      },
    }),
  );

  if (!user?.isActive) {
    return { ok: false, error: "Invalid username or password." };
  }

  const hasHash =
    typeof user.passwordHash === "string" && user.passwordHash.length > 0;
  let valid = false;
  if (hasHash) {
    valid = await bcrypt.compare(password, user.passwordHash as string);
  } else if (user.passwordPlain && user.passwordPlain === password) {
    valid = true;
    const nextHash = await bcrypt.hash(password, 10);
    await prismaRetry(() =>
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: nextHash },
      }),
    );
  }

  if (!valid) {
    return { ok: false, error: "Invalid username or password." };
  }

  const session = await prismaRetry(() => loadAuthSessionByUsername(normalized));
  if (!session) {
    return { ok: false, error: "Account is inactive or misconfigured." };
  }
  if (!(await canUseMobileApp(session))) {
    return {
      ok: false,
      error: "Your role is not enabled for the mobile monitoring app.",
    };
  }

  const tokens = await issueMobileTokens(session.userId, deviceLabel);
  return { ok: true, session, tokens };
}

export async function issueMobileTokens(
  userId: string,
  deviceLabel?: string | null,
): Promise<MobileAuthTokens> {
  const prisma = getPrismaClient();
  const refreshRaw = generateRefreshTokenRaw();
  const accessToken = await signMobileAccessToken(userId);

  await prismaRetry(() =>
    prisma.mobileRefreshToken.create({
      data: {
        userId,
        tokenHash: hashMobileToken(refreshRaw),
        deviceLabel: deviceLabel?.trim() || null,
        expiresAt: mobileRefreshExpiresAt(),
      },
    }),
  );

  return {
    accessToken,
    refreshToken: refreshRaw,
    expiresIn: mobileAccessExpiresInSec(),
  };
}

export async function refreshMobileTokens(
  refreshToken: string,
): Promise<
  | { ok: true; session: AuthSession; tokens: MobileAuthTokens }
  | { ok: false; error: string }
> {
  const raw = refreshToken.trim();
  if (!raw) return { ok: false, error: "Refresh token is required." };

  const prisma = getPrismaClient();
  const tokenHash = hashMobileToken(raw);
  const row = await prismaRetry(() =>
    prisma.mobileRefreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true },
    }),
  );

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) {
      await prismaRetry(() =>
        prisma.mobileRefreshToken.delete({ where: { id: row.id } }),
      );
    }
    return { ok: false, error: "Refresh token is invalid or expired." };
  }

  const session = await loadAuthSessionByUserId(row.userId);
  if (!session || !(await canUseMobileApp(session))) {
    await prismaRetry(() =>
      prisma.mobileRefreshToken.delete({ where: { id: row.id } }),
    );
    return { ok: false, error: "Account is no longer allowed on mobile." };
  }

  await prismaRetry(() =>
    prisma.mobileRefreshToken.delete({ where: { id: row.id } }),
  );

  const tokens = await issueMobileTokens(session.userId);
  return { ok: true, session, tokens };
}

export async function revokeMobileRefreshToken(
  refreshToken: string,
): Promise<void> {
  const raw = refreshToken.trim();
  if (!raw) return;
  const prisma = getPrismaClient();
  await prismaRetry(() =>
    prisma.mobileRefreshToken.deleteMany({
      where: { tokenHash: hashMobileToken(raw) },
    }),
  );
}
