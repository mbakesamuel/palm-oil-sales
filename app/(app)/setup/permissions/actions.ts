"use server";

import { getPrismaClient } from "@/lib/prisma";
import {
  PERMISSION_KEYS,
  assertActorIsAdmin,
  assertPermissionKey,
  defaultPermissionsForGlobalRoleCode,
  defaultPermissionsForRole,
  defaultPermissionsForServiceRoleCode,
  getPermissionsForGlobalRoleDefinition,
  getPermissionsForRole,
  getPermissionsForServiceRole,
  getPermissionsForSession,
  type PermissionKey,
} from "@/lib/access-control";
import { defaultRequiresFixedPostingSiteForRoleCode } from "@/lib/sales-point-assignment";
import { parseEnabledModulesJson } from "@/lib/commercial-modules";
import { ensureGlobalRoleDefinitions, isRetiredGlobalLegacyRole } from "@/lib/global-role-definitions";
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

/** Effective permissions for the signed-in user (global role or line role + module filter). */
export async function getPermissionsForSessionAction() {
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  return getPermissionsForSession(session);
}

function parseRole(raw: string): UserRole | null {
  const r = String(raw ?? "").trim() as UserRole;
  if (
    r === UserRole.ADMIN ||
    r === UserRole.DIRECTOR ||
    r === UserRole.MANAGER ||
    r === UserRole.OFFICER ||
    r === UserRole.SENIOR_SUPERVISOR ||
    r === UserRole.SUPERVISOR ||
    r === UserRole.CLERK
  ) {
    return r;
  }
  return null;
}

function normalizeGlobalRoleCode(raw: string): string | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.length ? s : null;
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

export type GlobalRoleRow = {
  id: string;
  code: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  userCount: number;
  legacyRole: UserRole | null;
};

export type GlobalRolesCatalog = {
  roles: GlobalRoleRow[];
};

async function assertCanManageGlobalRoles() {
  await assertPermissionKey("route:/setup/permissions");
  await assertActorIsAdmin();
}

export async function getGlobalRolesCatalogAction(): Promise<GlobalRolesCatalog> {
  await assertCanManageGlobalRoles();
  await ensureGlobalRoleDefinitions();
  const prisma = getPrismaClient();

  const [definitions, userCounts] = await Promise.all([
    prisma.globalRoleDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
      select: {
        id: true,
        code: true,
        displayName: true,
        sortOrder: true,
        isActive: true,
        legacyRole: true,
        _count: { select: { users: true } },
      },
    }),
    prisma.user.groupBy({
      by: ["globalRoleDefinitionId"],
      where: { globalRoleDefinitionId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countById = new Map(
    userCounts.map((u) => [u.globalRoleDefinitionId, u._count._all]),
  );

  return {
    roles: definitions
      .filter((d) => !isRetiredGlobalLegacyRole(d.legacyRole))
      .map((d) => ({
      id: d.id,
      code: d.code,
      displayName: d.displayName,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      legacyRole: d.legacyRole,
      userCount: countById.get(d.id) ?? d._count.users,
    })),
  };
}

export async function saveGlobalRoleDefinition(formData: FormData) {
  const prisma = getPrismaClient();
  await assertCanManageGlobalRoles();

  const id = String(formData.get("id") ?? "").trim() || null;
  const codeInput = normalizeGlobalRoleCode(String(formData.get("code") ?? ""));
  const displayName = String(formData.get("displayName") ?? "").trim();
  const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "10"), 10);

  if (!codeInput) throw new Error("Role code is required (letters, numbers, underscores).");
  if (!displayName) throw new Error("Display name is required.");

  if (id) {
    const existing = await prisma.globalRoleDefinition.findUnique({
      where: { id },
      select: { id: true, legacyRole: true, code: true },
    });
    if (!existing) throw new Error("Global role not found.");

    const codeClash = await prisma.globalRoleDefinition.findFirst({
      where: { code: codeInput, id: { not: id } },
      select: { id: true },
    });
    if (codeClash) throw new Error("Another global role already uses this code.");

    await prisma.globalRoleDefinition.update({
      where: { id },
      data: {
        code: existing.legacyRole ? existing.code : codeInput,
        displayName,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 10,
      },
    });
  } else {
    const codeClash = await prisma.globalRoleDefinition.findUnique({
      where: { code: codeInput },
      select: { id: true },
    });
    if (codeClash) throw new Error("A global role with this code already exists.");

    const created = await prisma.globalRoleDefinition.create({
      data: {
        code: codeInput,
        displayName,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 10,
        isActive: true,
      },
    });

    const defaults = defaultPermissionsForGlobalRoleCode(created.code, null);
    await prisma.globalRolePermission.createMany({
      data: PERMISSION_KEYS.map((key) => ({
        globalRoleDefinitionId: created.id,
        key,
        allowed: defaults[key],
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/setup/permissions");
  revalidatePath("/users");
}

export async function setGlobalRoleDefinitionActive(formData: FormData) {
  const prisma = getPrismaClient();
  await assertCanManageGlobalRoles();

  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.getAll("isActive").includes("1");
  if (!id) throw new Error("Global role is required.");

  const role = await prisma.globalRoleDefinition.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      legacyRole: true,
      _count: { select: { users: true } },
    },
  });
  if (!role) throw new Error("Global role not found.");

  if (!isActive) {
    if (role.legacyRole === UserRole.ADMIN) {
      throw new Error("The Admin role cannot be deactivated.");
    }
    if (role._count.users > 0) {
      throw new Error(
        `Cannot deactivate “${role.displayName}”: ${role._count.users} user(s) still assigned. Reassign them first.`,
      );
    }
  }

  await prisma.globalRoleDefinition.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/setup/permissions");
  revalidatePath("/users");
}

export async function getGlobalRolePermissionsAction(globalRoleId: string) {
  await assertCanManageGlobalRoles();
  const prisma = getPrismaClient();
  const role = await prisma.globalRoleDefinition.findUnique({
    where: { id: globalRoleId },
    select: { id: true },
  });
  if (!role) throw new Error("Global role not found.");
  return getPermissionsForGlobalRoleDefinition(globalRoleId);
}

export async function setGlobalRolePermission(formData: FormData) {
  const prisma = getPrismaClient();
  await assertCanManageGlobalRoles();

  const globalRoleId = String(formData.get("globalRoleId") ?? "").trim();
  const key = parsePermissionKey(String(formData.get("key") ?? ""));
  const allowed = String(formData.get("allowed") ?? "") === "1";
  if (!globalRoleId) throw new Error("Global role is required.");
  if (!key) throw new Error("Invalid permission key.");

  const role = await prisma.globalRoleDefinition.findUnique({
    where: { id: globalRoleId },
    select: { id: true },
  });
  if (!role) throw new Error("Global role not found.");

  await prisma.globalRolePermission.upsert({
    where: {
      globalRoleDefinitionId_key: { globalRoleDefinitionId: globalRoleId, key },
    },
    create: { globalRoleDefinitionId: globalRoleId, key, allowed },
    update: { allowed },
  });

  revalidatePath("/setup/permissions");
}

export async function resetGlobalRolePermissions(formData: FormData) {
  const prisma = getPrismaClient();
  await assertCanManageGlobalRoles();

  const globalRoleId = String(formData.get("globalRoleId") ?? "").trim();
  if (!globalRoleId) throw new Error("Global role is required.");

  const role = await prisma.globalRoleDefinition.findUnique({
    where: { id: globalRoleId },
    select: { id: true, code: true, legacyRole: true },
  });
  if (!role) throw new Error("Global role not found.");

  const defaults = defaultPermissionsForGlobalRoleCode(
    role.code,
    role.legacyRole,
  );
  await prisma.$transaction(async (tx) => {
    await tx.globalRolePermission.deleteMany({
      where: { globalRoleDefinitionId: globalRoleId },
    });
    await tx.globalRolePermission.createMany({
      data: PERMISSION_KEYS.map((key) => ({
        globalRoleDefinitionId: globalRoleId,
        key,
        allowed: defaults[key],
      })),
    });
  });

  revalidatePath("/setup/permissions");
}

export type LineRoleRow = {
  id: string;
  code: string;
  name: string;
  commercialServiceId: string;
  sortOrder: number;
  isActive: boolean;
  requiresFixedPostingSite: boolean;
  userCount: number;
};

export type LinePermissionsCatalog = {
  services: Array<{
    id: string;
    name: string;
    code: string;
    siteKind: "SALES_POINT" | "FACTORY";
    enabledModules: string[];
  }>;
  roles: LineRoleRow[];
};

function normalizeRoleCode(raw: string): string | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.length ? s : null;
}

async function assertCanManageLineRoles() {
  await assertPermissionKey("route:/setup/permissions");
  await assertActorIsAdmin();
}

export async function getLinePermissionsCatalogAction(): Promise<LinePermissionsCatalog> {
  await assertCanManageLineRoles();
  const prisma = getPrismaClient();
  const [services, roles] = await Promise.all([
    prisma.commercialService.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, siteKind: true, enabledModules: true },
    }),
    prisma.commercialServiceRole.findMany({
      orderBy: [{ commercialServiceId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        commercialServiceId: true,
        sortOrder: true,
        isActive: true,
        requiresFixedPostingSite: true,
        _count: { select: { users: true } },
      },
    }),
  ]);
  return {
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      siteKind: s.siteKind,
      enabledModules: parseEnabledModulesJson(s.enabledModules),
    })),
    roles: roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      commercialServiceId: r.commercialServiceId,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      requiresFixedPostingSite: r.requiresFixedPostingSite,
      userCount: r._count.users,
    })),
  };
}

export async function saveCommercialServiceRole(formData: FormData) {
  const prisma = getPrismaClient();
  await assertCanManageLineRoles();

  const id = String(formData.get("id") ?? "").trim() || null;
  const commercialServiceId = String(formData.get("commercialServiceId") ?? "").trim();
  const codeInput = normalizeRoleCode(String(formData.get("code") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number.parseInt(String(formData.get("sortOrder") ?? "10"), 10);
  const requiresFixedPostingSite = !formData.getAll("requiresFixedPostingSite").includes("0");

  if (!commercialServiceId) throw new Error("Commercial line is required.");
  if (!codeInput) throw new Error("Role code is required (letters, numbers, underscores).");
  if (!name) throw new Error("Display name is required.");

  const line = await prisma.commercialService.findUnique({
    where: { id: commercialServiceId },
    select: { id: true, isActive: true },
  });
  if (!line) throw new Error("Commercial line not found.");
  if (!line.isActive) throw new Error("Cannot add roles to an inactive commercial line.");

  if (id) {
    const existing = await prisma.commercialServiceRole.findUnique({
      where: { id },
      select: { id: true, commercialServiceId: true, code: true },
    });
    if (!existing) throw new Error("Line role not found.");
    if (existing.commercialServiceId !== commercialServiceId) {
      throw new Error("Role does not belong to the selected commercial line.");
    }

    const codeClash = await prisma.commercialServiceRole.findFirst({
      where: {
        commercialServiceId,
        code: codeInput,
        id: { not: id },
      },
      select: { id: true },
    });
    if (codeClash) throw new Error("That role code is already in use on this line.");

    await prisma.commercialServiceRole.update({
      where: { id },
      data: {
        code: codeInput,
        name,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 10,
        requiresFixedPostingSite,
      },
    });
  } else {
    const codeClash = await prisma.commercialServiceRole.findFirst({
      where: { commercialServiceId, code: codeInput },
      select: { id: true },
    });
    if (codeClash) throw new Error("That role code is already in use on this line.");

    const created = await prisma.commercialServiceRole.create({
      data: {
        commercialServiceId,
        code: codeInput,
        name,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 10,
        isActive: true,
        requiresFixedPostingSite:
          formData.getAll("requiresFixedPostingSite").length > 0
            ? requiresFixedPostingSite
            : defaultRequiresFixedPostingSiteForRoleCode(codeInput),
      },
    });

    const defaults = defaultPermissionsForServiceRoleCode(created.code);
    await prisma.commercialServiceRolePermission.createMany({
      data: PERMISSION_KEYS.map((key) => ({
        commercialServiceRoleId: created.id,
        key,
        allowed: defaults[key],
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/setup/permissions");
  revalidatePath("/users");
}

export async function setCommercialServiceRoleActive(formData: FormData) {
  const prisma = getPrismaClient();
  await assertCanManageLineRoles();

  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.getAll("isActive").includes("1");
  if (!id) throw new Error("Line role is required.");

  const role = await prisma.commercialServiceRole.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { users: true } },
    },
  });
  if (!role) throw new Error("Line role not found.");

  if (!isActive && role._count.users > 0) {
    throw new Error(
      `Cannot deactivate “${role.name}”: ${role._count.users} user(s) still assigned. Reassign them first.`,
    );
  }

  await prisma.commercialServiceRole.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/setup/permissions");
  revalidatePath("/users");
}

export async function getServiceRolePermissionsAction(serviceRoleId: string) {
  await assertPermissionKey("route:/setup/permissions");
  await assertActorIsAdmin();
  const prisma = getPrismaClient();
  const role = await prisma.commercialServiceRole.findUnique({
    where: { id: serviceRoleId },
    select: { id: true, code: true },
  });
  if (!role) throw new Error("Line role not found.");
  return getPermissionsForServiceRole(role.id, role.code);
}

export async function setServiceRolePermission(formData: FormData) {
  const prisma = getPrismaClient();
  await assertPermissionKey("route:/setup/permissions");
  await assertActorIsAdmin();

  const serviceRoleId = String(formData.get("serviceRoleId") ?? "").trim();
  const key = parsePermissionKey(String(formData.get("key") ?? ""));
  const allowed = String(formData.get("allowed") ?? "") === "1";
  if (!serviceRoleId) throw new Error("Line role is required.");
  if (!key) throw new Error("Invalid permission key.");

  const role = await prisma.commercialServiceRole.findUnique({
    where: { id: serviceRoleId },
    select: { id: true },
  });
  if (!role) throw new Error("Line role not found.");

  await prisma.commercialServiceRolePermission.upsert({
    where: {
      commercialServiceRoleId_key: { commercialServiceRoleId: serviceRoleId, key },
    },
    create: { commercialServiceRoleId: serviceRoleId, key, allowed },
    update: { allowed },
  });

  revalidatePath("/setup/permissions");
}

export async function resetServiceRolePermissions(formData: FormData) {
  const prisma = getPrismaClient();
  await assertPermissionKey("route:/setup/permissions");
  await assertActorIsAdmin();

  const serviceRoleId = String(formData.get("serviceRoleId") ?? "").trim();
  if (!serviceRoleId) throw new Error("Line role is required.");

  const role = await prisma.commercialServiceRole.findUnique({
    where: { id: serviceRoleId },
    select: { id: true, code: true },
  });
  if (!role) throw new Error("Line role not found.");

  const defaults = defaultPermissionsForServiceRoleCode(role.code);
  await prisma.$transaction(async (tx) => {
    await tx.commercialServiceRolePermission.deleteMany({
      where: { commercialServiceRoleId: serviceRoleId },
    });
    await tx.commercialServiceRolePermission.createMany({
      data: PERMISSION_KEYS.map((key) => ({
        commercialServiceRoleId: serviceRoleId,
        key,
        allowed: defaults[key],
      })),
    });
  });

  revalidatePath("/setup/permissions");
}
