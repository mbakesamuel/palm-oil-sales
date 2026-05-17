import "server-only";

import { auth } from "@/auth";
import type { AuthSession as ClientSession, AuthCommercialService, AuthSalesPoint } from "@/lib/auth-session";

export async function getServerSession(): Promise<ClientSession | null> {
  const session = await auth();
  if (!session?.userId) return null;

  const salesPoint = session.salesPoint as AuthSalesPoint | null;
  const serviceRaw = session.service;
  const service =
    typeof serviceRaw === "string" && serviceRaw.trim() !== "" ? serviceRaw.trim() : null;

  let commercialService: AuthCommercialService | null = null;
  const cs = session.commercialService as AuthCommercialService | null | undefined;
  if (
    cs &&
    typeof cs.id === "string" &&
    typeof cs.name === "string" &&
    typeof cs.invoicePrefix === "string"
  ) {
    commercialService = {
      id: cs.id.trim(),
      name: cs.name.trim(),
      invoicePrefix: cs.invoicePrefix.trim(),
    };
  }

  return {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    role: session.role,
    salesPoint,
    service,
    commercialService,
  };
}
