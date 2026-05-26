"use server";

import bcrypt from "bcryptjs";
import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import {
  roleRequiresCommercialServiceAssignment,
  roleRequiresSalesPoint,
} from "@/lib/auth-roles";
import { userRoleFromLineRoleCode } from "@/lib/line-role-user-role";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Must match the cost factor used by the Credentials provider in `auth.ts` so
// that password verification stays consistent across the codebase.
const PASSWORD_HASH_ROUNDS = 10;

function normalizeUsername(raw: string) {
  return String(raw ?? "").trim().toLowerCase();
}

async function validateUserFields(
  prisma: ReturnType<typeof getPrismaClient>,
  role: UserRole,
  commercialServiceId: string | null,
  commercialServiceRoleId: string | null,
  salesPointId: number | null,
  factoryId: string | null,
) {
  if (roleRequiresCommercialServiceAssignment(role)) {
    if (!commercialServiceId) throw new Error("Commercial line is required for this role.");
    const cs = await prisma.commercialService.findUnique({
      where: { id: commercialServiceId },
      select: { id: true, isActive: true, siteKind: true },
    });
    if (!cs) throw new Error("Commercial line not found.");
    if (!cs.isActive) throw new Error("Selected commercial line is inactive.");

    if (!commercialServiceRoleId) {
      throw new Error("Role is required for this commercial line.");
    }
    const sr = await prisma.commercialServiceRole.findUnique({
      where: { id: commercialServiceRoleId },
      select: { commercialServiceId: true, isActive: true },
    });
    if (!sr) throw new Error("Commercial line role not found.");
    if (!sr.isActive) throw new Error("Selected line role is inactive.");
    if (sr.commercialServiceId !== commercialServiceId) {
      throw new Error("Role does not belong to the selected commercial line.");
    }

    if (cs.siteKind === "FACTORY") {
      if (!factoryId) throw new Error("Factory is required for this commercial line.");
      const factory = await prisma.factory.findFirst({
        where: { id: factoryId, commercialServiceId, isActive: true },
        select: { id: true },
      });
      if (!factory) throw new Error("Factory not found for this commercial line.");
      return { salesPointId: null, factoryId };
    }

    if (roleRequiresSalesPoint(role)) {
      if (!salesPointId || !Number.isFinite(salesPointId)) {
        throw new Error("Sales point is required for this role.");
      }
      const sp = await prisma.salesPoint.findUnique({ where: { id: salesPointId } });
      if (!sp) throw new Error("Sales point not found.");
    }
    return { salesPointId: roleRequiresSalesPoint(role) ? salesPointId : null, factoryId: null };
  }

  if (roleRequiresSalesPoint(role)) {
    if (!salesPointId || !Number.isFinite(salesPointId)) {
      throw new Error("Sales point is required for this role.");
    }
    const sp = await prisma.salesPoint.findUnique({ where: { id: salesPointId } });
    if (!sp) throw new Error("Sales point not found.");
  }

  return {
    salesPointId: roleRequiresSalesPoint(role) ? salesPointId : null,
    factoryId: null as string | null,
  };
}

export async function saveUser(formData: FormData) {
  await assertPermissionKey("route:/users");
  const prisma = getPrismaClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const globalRoleRaw = String(formData.get("globalRoleDefinitionId") ?? "").trim();
  const globalRoleDefinitionId = globalRoleRaw.length ? globalRoleRaw : null;
  const commercialServiceRaw = String(formData.get("commercialServiceId") ?? "").trim();
  const commercialServiceId = commercialServiceRaw.length ? commercialServiceRaw : null;
  const commercialServiceRoleRaw = String(formData.get("commercialServiceRoleId") ?? "").trim();
  const commercialServiceRoleId = commercialServiceRoleRaw.length
    ? commercialServiceRoleRaw
    : null;

  if (!username) throw new Error("Username is required.");
  if (!name) throw new Error("Display name is required.");

  if (globalRoleDefinitionId && commercialServiceRoleId) {
    throw new Error("Choose either an org-wide global role or a line role, not both.");
  }

  let role: UserRole;
  let resolvedGlobalRoleId: string | null = null;
  let resolvedCommercialServiceId: string | null = null;
  let resolvedLineRoleId: string | null = null;

  if (commercialServiceRoleId || commercialServiceId) {
    if (!commercialServiceRoleId) {
      throw new Error("Select a role for this commercial line.");
    }

    const lineRole = await prisma.commercialServiceRole.findUnique({
      where: { id: commercialServiceRoleId },
      select: {
        id: true,
        code: true,
        commercialServiceId: true,
        isActive: true,
      },
    });
    if (!lineRole) throw new Error("Line role not found.");
    if (!lineRole.isActive) throw new Error("Selected line role is inactive.");

    const lineId = commercialServiceId ?? lineRole.commercialServiceId;
    if (commercialServiceId && lineRole.commercialServiceId !== commercialServiceId) {
      throw new Error("Role does not belong to the selected commercial line.");
    }

    role = userRoleFromLineRoleCode(lineRole.code);
    resolvedCommercialServiceId = lineId;
    resolvedLineRoleId = lineRole.id;
    resolvedGlobalRoleId = null;
  } else if (globalRoleDefinitionId) {
    const globalDef = await prisma.globalRoleDefinition.findUnique({
      where: { id: globalRoleDefinitionId, isActive: true },
      select: { legacyRole: true },
    });
    if (!globalDef) throw new Error("Global role not found or inactive.");
    role = globalDef.legacyRole ?? UserRole.MANAGER;
    resolvedGlobalRoleId = globalRoleDefinitionId;
    resolvedCommercialServiceId = null;
    resolvedLineRoleId = null;
  } else {
    throw new Error("Role is required.");
  }

  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null;
  const factoryRaw = String(formData.get("factoryId") ?? "").trim();
  const factoryId = factoryRaw.length ? factoryRaw : null;

  const site = await validateUserFields(
    prisma,
    role,
    resolvedCommercialServiceId,
    resolvedLineRoleId,
    salesPointId,
    factoryId,
  );

  const current = await getServerSession();
  const selfUpdated = id != null && id === current?.userId;

  const data = {
    username,
    name,
    role,
    globalRoleDefinitionId: resolvedGlobalRoleId,
    service: null as string | null,
    commercialServiceId: resolvedCommercialServiceId,
    commercialServiceRoleId: resolvedLineRoleId,
    salesPointId: site.salesPointId,
    factoryId: site.factoryId,
  };

  if (id) {
    const clash = await prisma.user.findFirst({
      where: { username, id: { not: id } },
      select: { id: true },
    });
    if (clash) throw new Error("That username is already taken.");

    if (!password) {
      await prisma.user.update({ where: { id }, data });
    } else {
      if (password !== confirmPassword) {
        throw new Error("Password and confirmation do not match.");
      }
      // Write the bcrypt hash directly (the Credentials provider in `auth.ts`
      // compares against `passwordHash` first and falls back to `passwordPlain`
      // only when no hash exists). Forgetting to refresh `passwordHash` here
      // would leave the previous password active because the stale hash still
      // wins over `passwordPlain` at sign-in. We also clear `passwordPlain` so
      // dev-seeded plaintext can't override the new password later.
      const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
      await prisma.user.update({
        where: { id },
        data: { ...data, passwordHash, passwordPlain: null },
      });
    }
  } else {
    if (!password) throw new Error("Password is required for new users.");
    if (password !== confirmPassword) {
      throw new Error("Password and confirmation do not match.");
    }
    const exists = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (exists) throw new Error("That username is already taken.");
    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
    await prisma.user.create({
      data: { ...data, passwordHash, passwordPlain: null },
    });
  }

  revalidatePath("/users");
  revalidatePath("/login");
  revalidatePath("/setup");
  revalidatePath("/setup/commercial-services");
  revalidatePath("/setup/permissions");
  if (selfUpdated) {
    revalidatePath("/");
    revalidatePath("/dashboard");
  }
}

export async function setUserActive(formData: FormData) {
  await assertPermissionKey("route:/users");
  const prisma = getPrismaClient();
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");

  const id = String(formData.get("id") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "1";
  if (!id) throw new Error("Invalid user.");
  if (id === session.userId && !active) {
    throw new Error("You cannot deactivate your own account while signed in.");
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: active },
  });

  revalidatePath("/users");
  revalidatePath("/login");
}
