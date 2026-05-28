import "server-only";

import { auth } from "@/auth";
import type {
  AuthSession as ClientSession,
  AuthCommercialService,
  AuthCommercialServiceRole,
  AuthGlobalRole,
  AuthFactory,
  AuthSalesPoint,
} from "@/lib/auth-session";
import type { CommercialModuleKey } from "@/lib/commercial-modules";
import type { CommercialSiteKind } from "@/lib/domain-commercial";

function parseCommercialService(cs: unknown): AuthCommercialService | null {
  if (!cs || typeof cs !== "object") return null;
  const r = cs as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.name !== "string" ||
    typeof r.invoicePrefix !== "string"
  ) {
    return null;
  }
  const siteKind: CommercialSiteKind =
    r.siteKind === "FACTORY" || r.siteKind === "SALES_POINT" ? r.siteKind : "SALES_POINT";
  const enabledModules = Array.isArray(r.enabledModules)
    ? (r.enabledModules.filter((x) => typeof x === "string") as CommercialModuleKey[])
    : [];
  return {
    id: r.id.trim(),
    code: typeof r.code === "string" && r.code.trim() !== "" ? r.code.trim() : "",
    name: r.name.trim(),
    invoicePrefix: r.invoicePrefix.trim(),
    siteKind,
    enabledModules,
  };
}

function parseGlobalRole(gr: unknown): AuthGlobalRole | null {
  if (!gr || typeof gr !== "object") return null;
  const g = gr as Record<string, unknown>;
  if (
    typeof g.id !== "string" ||
    typeof g.code !== "string" ||
    typeof g.displayName !== "string"
  ) {
    return null;
  }
  return { id: g.id.trim(), code: g.code.trim(), displayName: g.displayName.trim() };
}

function parseServiceRole(csr: unknown): AuthCommercialServiceRole | null {
  if (!csr || typeof csr !== "object") return null;
  const c = csr as Record<string, unknown>;
  if (typeof c.id !== "string" || typeof c.code !== "string" || typeof c.name !== "string") {
    return null;
  }
  return { id: c.id.trim(), code: c.code.trim(), name: c.name.trim() };
}

export async function getServerSession(): Promise<ClientSession | null> {
  const session = await auth();
  if (!session?.userId) return null;

  const salesPoint = session.salesPoint as AuthSalesPoint | null | undefined;
  const factoryRaw = session.factory as AuthFactory | null | undefined;
  const serviceRaw = session.service;
  const service =
    typeof serviceRaw === "string" && serviceRaw.trim() !== "" ? serviceRaw.trim() : null;

  const commercialService = parseCommercialService(session.commercialService);
  const commercialServiceRole = parseServiceRole(session.commercialServiceRole);
  const globalRole = parseGlobalRole(session.globalRole);

  return {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    role: session.role,
    globalRole,
    salesPoint: salesPoint ?? null,
    factory: factoryRaw ?? null,
    service,
    commercialService,
    commercialServiceRole,
  };
}
