"use server";

import { getPrismaClient } from "@/lib/prisma";
import {
  PERMISSION_KEYS,
  assertActorIsAdmin,
  assertPermissionKey,
  defaultPermissionsForRole,
  getPermissionsForRole,
  type PermissionKey,
} from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getRolePermissionsAction(role: UserRole) {
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  if (role !== session.role) {
    await assertPermissionKey("route:/setup/permissions");
  }
  return getPermissionsForRole(role);
}

function parseRole(raw: string): UserRole | null {
  const r = String(raw ?? "").trim() as UserRole;
  if (
    r === UserRole.ADMIN ||
    r === UserRole.DIRECTOR ||
    r === UserRole.MANAGER ||
    r === UserRole.SENIOR_SUPERVISOR ||
    r === UserRole.SUPERVISOR ||
    r === UserRole.CLERK
  ) {
    return r;
  }
  return null;
}

function parsePermissionKey(raw: string): PermissionKey | null {
  const k = String(raw ?? "").trim();
  return (PERMISSION_KEYS as readonly string[]).includes(k) ? (k as PermissionKey) : null;
}

export async function setRolePermission(formData: FormData) {
  const prisma = getPrismaClient();
  await assertPermissionKey("route:/setup/permissions");
  await assertActorIsAdmin();

  const role = parseRole(String(formData.get("role") ?? ""));
  const key = parsePermissionKey(String(formData.get("key") ?? ""));
  const allowed = String(formData.get("allowed") ?? "") === "1";
  if (!role) throw new Error("Invalid role.");
  if (!key) throw new Error("Invalid permission key.");

  await prisma.rolePermission.upsert({
    where: { role_key: { role, key } },
    create: { role, key, allowed },
    update: { allowed },
  });

  revalidatePath("/setup/permissions");
}

export async function resetRolePermissions(formData: FormData) {
  const prisma = getPrismaClient();
  await assertPermissionKey("route:/setup/permissions");
  await assertActorIsAdmin();

  const role = parseRole(String(formData.get("role") ?? ""));
  if (!role) throw new Error("Invalid role.");

  const defaults = defaultPermissionsForRole(role);
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { role } });
    await tx.rolePermission.createMany({
      data: PERMISSION_KEYS.map((key) => ({
        role,
        key,
        allowed: defaults[key],
      })),
    });
  });

  revalidatePath("/setup/permissions");
}

