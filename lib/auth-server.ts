import "server-only";

import { auth } from "@/auth";
import type { AuthSession as ClientSession, AuthSalesPoint } from "@/lib/auth-session";

export async function getServerSession(): Promise<ClientSession | null> {
  const session = await auth();
  if (!session?.userId) return null;

  const salesPoint = session.salesPoint as AuthSalesPoint | null;
  return {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    role: session.role,
    salesPoint,
  };
}
