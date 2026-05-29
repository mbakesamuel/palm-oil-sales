import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import { profileFromCommercialService } from "@/lib/commercial-profile";
import type { CommercialProfile } from "@/lib/commercial-profile";
import {
  canAccessExecutiveDashboard,
  canAccessLineDashboard,
  normalizeServiceCodeParam,
} from "@/lib/dashboard-routing";
import { getPrismaClient } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

export async function loadActiveCommercialServiceByCode(
  serviceCodeRaw: string,
): Promise<{
  id: string;
  code: string;
  name: string;
  profile: CommercialProfile;
}> {
  const code = normalizeServiceCodeParam(serviceCodeRaw);
  if (!code) notFound();

  const row = await getPrismaClient().commercialService.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      siteKind: true,
      enabledModules: true,
    },
  });
  if (!row) notFound();

  const profile = profileFromCommercialService(row);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    profile,
  };
}

export async function assertLineDashboardAccess(
  session: AuthSession,
  serviceCodeRaw: string,
): Promise<{ id: string; code: string; name: string; profile: CommercialProfile }> {
  const service = await loadActiveCommercialServiceByCode(serviceCodeRaw);
  if (!canAccessLineDashboard(session, service.code)) {
    redirect("/forbidden");
  }
  return service;
}

export function assertExecutiveDashboardAccess(session: AuthSession): void {
  if (!canAccessExecutiveDashboard(session)) {
    redirect("/forbidden");
  }
}
