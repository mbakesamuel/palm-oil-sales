"use server";

import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { describeDatabaseError } from "@/lib/describe-database-error";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

function rethrowAsFriendlyDbError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const { title, description } = describeDatabaseError(e);
    throw new Error(`${title} — ${description}`);
  }
  throw e;
}

async function requireActor(prisma: ReturnType<typeof getPrismaClient>) {
  const session = await getServerSession();
  if (!session?.userId) {
    throw new Error("Login required.");
  }
  const actor = await prismaRetry(() =>
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, salesPointId: true, isActive: true },
    }),
  );
  if (!actor?.isActive) {
    throw new Error("Login required.");
  }
  return actor;
}

export async function saveStorageLocation(formData: FormData) {
  try {
    const prisma = getPrismaClient();
    const actor = await requireActor(prisma);

    const idRaw = String(formData.get("id") ?? "").trim();
    const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const submittedSalesPointId = salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null;

    const spErr = salesPointErrorForSubmitted(actor, submittedSalesPointId);
    if (spErr) throw new Error(spErr);

    const salesPointId =
      submittedSalesPointId != null && Number.isFinite(submittedSalesPointId)
        ? submittedSalesPointId
        : null;
    if (salesPointId == null) throw new Error("Sales point is required.");
    if (!name) throw new Error("Location name is required.");

    if (idRaw) {
      const id = Number.parseInt(idRaw, 10);
      if (!Number.isFinite(id)) throw new Error("Invalid location.");
      const existing = await prismaRetry(() =>
        prisma.storageLocation.findUnique({
          where: { id },
          select: { salesPointId: true },
        }),
      );
      if (!existing) throw new Error("Location not found.");
      const resErr = salesPointErrorForResource(actor, existing.salesPointId);
      if (resErr) throw new Error(resErr);
      await prismaRetry(() =>
        prisma.storageLocation.update({
          where: { id },
          data: { salesPointId, name },
        }),
      );
    } else {
      await prismaRetry(() =>
        prisma.storageLocation.create({
          data: { salesPointId, name },
        }),
      );
    }

    revalidatePath("/storage-locations");
    revalidatePath("/stock/receive");
    revalidatePath("/reports/stock-on-hand");
    revalidatePath("/reports/stock-vs-commitments");
  } catch (e) {
    rethrowAsFriendlyDbError(e);
  }
}

export async function deleteStorageLocation(formData: FormData) {
  try {
    const prisma = getPrismaClient();
    const actor = await requireActor(prisma);

    const idRaw = String(formData.get("id") ?? "").trim();
    const id = Number.parseInt(idRaw, 10);
    if (!Number.isFinite(id)) throw new Error("Invalid location.");

    const existing = await prismaRetry(() =>
      prisma.storageLocation.findUnique({
        where: { id },
        select: { salesPointId: true },
      }),
    );
    if (!existing) throw new Error("Location not found.");
    const resErr = salesPointErrorForResource(actor, existing.salesPointId);
    if (resErr) throw new Error(resErr);

    try {
      await prismaRetry(() => prisma.storageLocation.delete({ where: { id } }));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new Error(
          "This location cannot be deleted while batches or stock still reference it.",
        );
      }
      throw e;
    }

    revalidatePath("/storage-locations");
    revalidatePath("/stock/receive");
    revalidatePath("/reports/stock-on-hand");
    revalidatePath("/reports/stock-vs-commitments");
  } catch (e) {
    rethrowAsFriendlyDbError(e);
  }
}
