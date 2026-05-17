import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import type { UserRole } from "@/lib/domain";
import { getPrismaClient } from "@/lib/prisma";

const userSessionInclude = {
  salesPoint: { select: { id: true, name: true } },
  commercialService: {
    select: { id: true, name: true, invoicePrefix: true, isActive: true },
  },
} as const;

function mapUserToAuthSession(user: {
  id: string;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  service: string | null;
  salesPoint: { id: number; name: string } | null;
  commercialService: {
    id: string;
    name: string;
    invoicePrefix: string;
    isActive: boolean;
  } | null;
}): AuthSession | null {
  if (!user.isActive) return null;
  const salesPoint =
    user.salesPoint != null ? { id: user.salesPoint.id, name: user.salesPoint.name } : null;
  const service =
    typeof user.service === "string" && user.service.trim() !== "" ? user.service.trim() : null;
  const commercialService =
    user.commercialService?.isActive === true
      ? {
          id: user.commercialService.id,
          name: user.commercialService.name,
          invoicePrefix: user.commercialService.invoicePrefix,
        }
      : null;
  return {
    userId: user.id,
    username: user.username,
    displayName: user.name,
    role: user.role as UserRole,
    salesPoint,
    service,
    commercialService,
  };
}

export function mapAuthSessionToToken(session: AuthSession) {
  return {
    sub: session.userId,
    userId: session.userId,
    role: session.role,
    username: session.username,
    displayName: session.displayName,
    salesPoint: session.salesPoint,
    service: session.service ?? null,
    commercialService: session.commercialService ?? null,
  };
}

export async function loadAuthSessionByUserId(
  userId: string,
): Promise<AuthSession | null> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userSessionInclude,
  });
  if (!user) return null;
  return mapUserToAuthSession(user);
}

export async function loadAuthSessionByUsername(
  username: string,
): Promise<AuthSession | null> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { username },
    include: userSessionInclude,
  });
  if (!user) return null;
  return mapUserToAuthSession(user);
}
