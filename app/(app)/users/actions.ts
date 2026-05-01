"use server";

import { getPrismaClient } from "@/lib/prisma";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function assertActorIsAdmin() {
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  if (session.role !== UserRole.ADMIN) {
    throw new Error("Only administrators can manage user accounts.");
  }
}

function normalizeUsername(raw: string) {
  return String(raw ?? "").trim().toLowerCase();
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

export async function saveUser(formData: FormData) {
  const prisma = getPrismaClient();
  await assertActorIsAdmin();

  const id = String(formData.get("id") ?? "").trim() || null;
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(String(formData.get("role") ?? ""));
  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null;

  if (!username) throw new Error("Username is required.");
  if (!name) throw new Error("Display name is required.");
  if (!role) throw new Error("Role is required.");
  if (roleRequiresSalesPoint(role)) {
    if (!salesPointId || !Number.isFinite(salesPointId)) {
      throw new Error("Sales point is required for this role.");
    }
    const sp = await prisma.salesPoint.findUnique({ where: { id: salesPointId } });
    if (!sp) throw new Error("Sales point not found.");
  }

  if (id) {
    const clash = await prisma.user.findFirst({
      where: { username, id: { not: id } },
      select: { id: true },
    });
    if (clash) throw new Error("That username is already taken.");

    if (!password) {
      await prisma.user.update({
        where: { id },
        data: {
          username,
          name,
          role,
          salesPointId: roleRequiresSalesPoint(role) ? salesPointId : null,
        },
      });
    } else {
      await prisma.user.update({
        where: { id },
        data: {
          username,
          name,
          passwordPlain: password,
          role,
          salesPointId: roleRequiresSalesPoint(role) ? salesPointId : null,
        },
      });
    }
  } else {
    if (!password) throw new Error("Password is required for new users.");
    const exists = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (exists) throw new Error("That username is already taken.");
    await prisma.user.create({
      data: {
        username,
        name,
        passwordPlain: password,
        role,
        salesPointId: roleRequiresSalesPoint(role) ? salesPointId : null,
      },
    });
  }

  revalidatePath("/users");
  revalidatePath("/login");
  revalidatePath("/setup");
}

export async function setUserActive(formData: FormData) {
  const prisma = getPrismaClient();
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  await assertActorIsAdmin();

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
