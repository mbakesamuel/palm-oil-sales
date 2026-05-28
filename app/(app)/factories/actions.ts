"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import { roleSeesAllCommercialServices } from "@/lib/service-scope";
import { revalidatePath } from "next/cache";

export async function saveFactory(formData: FormData) {
  await assertPermissionKey("route:/factories");
  const prisma = getPrismaClient();
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");

  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const commercialServiceRaw = String(formData.get("commercialServiceId") ?? "").trim();
  const isActive = formData.getAll("isActive").includes("1");

  if (!name) throw new Error("Factory name is required.");

  const commercialServiceId =
    commercialServiceRaw || session.commercialService?.id || null;
  if (!commercialServiceId) {
    throw new Error("Commercial line is required.");
  }

  const cs = await prisma.commercialService.findUnique({
    where: { id: commercialServiceId },
    select: { id: true, siteKind: true },
  });
  if (!cs) throw new Error("Commercial line not found.");
  if (cs.siteKind !== "FACTORY") {
    throw new Error("Factories can only be created for a factory-based commercial line.");
  }

  if (!roleSeesAllCommercialServices(session.role)) {
    if (session.commercialService?.id !== commercialServiceId) {
      throw new Error("You can only manage factories for your assigned commercial line.");
    }
  }

  if (id) {
    await prisma.factory.update({
      where: { id },
      data: { name, isActive },
    });
  } else {
    await prisma.factory.create({
      data: { name, commercialServiceId, isActive },
    });
  }

  revalidatePath("/factories");
  revalidatePath("/users");
}

export async function deleteFactory(formData: FormData) {
  await assertPermissionKey("route:/factories");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Invalid factory.");

  const users = await prisma.user.count({ where: { factoryId: id } });
  if (users > 0) {
    throw new Error("Cannot delete a factory while users are still assigned to it.");
  }

  await prisma.factory.delete({ where: { id } });
  revalidatePath("/factories");
  revalidatePath("/users");
}
