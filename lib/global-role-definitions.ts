import { UserRole } from "@/lib/domain";
import { getPrismaClient } from "@/lib/prisma";
import { roleLabel } from "@/lib/auth-display";

/** Built-in org-wide roles seeded on first run (also have `legacyRole`). */
export const GLOBAL_USER_ROLES = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.OFFICER,
] as const;

export type GlobalUserRole = (typeof GLOBAL_USER_ROLES)[number];

const BUILTIN_SORT: Record<GlobalUserRole, number> = {
  [UserRole.ADMIN]: 10,
  [UserRole.DIRECTOR]: 20,
  [UserRole.MANAGER]: 30,
  [UserRole.OFFICER]: 35,
};

/** Insert missing built-in global roles (idempotent). */
export async function ensureGlobalRoleDefinitions() {
  const prisma = getPrismaClient();
  const existing = await prisma.globalRoleDefinition.findMany({
    where: { legacyRole: { in: [...GLOBAL_USER_ROLES] } },
    select: { legacyRole: true },
  });
  const have = new Set(existing.map((r) => r.legacyRole));
  const missing = GLOBAL_USER_ROLES.filter((role) => !have.has(role));
  if (missing.length === 0) return;

  for (const legacyRole of missing) {
    const code = legacyRole.toLowerCase();
    await prisma.globalRoleDefinition.create({
      data: {
        code,
        displayName: roleLabel(legacyRole),
        sortOrder: BUILTIN_SORT[legacyRole],
        isActive: true,
        legacyRole,
      },
    });
  }
}
