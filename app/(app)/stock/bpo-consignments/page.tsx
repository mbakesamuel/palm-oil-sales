import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getBotaSalesPointId } from "@/lib/bpo";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { BpoMovementStatus, Prisma, UserRole } from "@prisma/client";
import {
  botaValidateBpoConsignment,
  createBpoConsignmentVoucher,
  rejectBpoConsignment,
  senderValidateBpoConsignment,
} from "./actions";
import { BpoConsignmentsClient } from "./BpoConsignmentsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BpoConsignmentsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const prisma = getPrismaClient();
  const scoped = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const botaSalesPointId = await getBotaSalesPointId(prisma);
  const isBotaBpoClerk =
    session.role === UserRole.CLERK_IN_CHARGE_BPO &&
    assignedSalesPointId != null &&
    assignedSalesPointId === botaSalesPointId;
  const movementStatusFilter = isBotaBpoClerk
    ? BpoMovementStatus.SENDER_VALIDATED
    : { not: BpoMovementStatus.REJECTED };

  const stockScope =
    scoped && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : botaSalesPointId != null
        ? { salesPointId: { not: botaSalesPointId } }
        : {};

  const [salesPoints, variants, movements, stockRows, openReservations] = await Promise.all([
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
    prismaRetry(() =>
      prisma.productVariant.findMany({
        where: { isActive: true, product: { isBottledPalmOil: true } },
        orderBy: [{ product: { productName: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, product: { select: { productName: true } } },
      }),
    ),
    prismaRetry(() =>
      prisma.bpoStockMovement.findMany({
        where: scoped && assignedSalesPointId != null
          ? {
              status: movementStatusFilter,
              OR: [
                { sourceSalesPointId: assignedSalesPointId },
                { destinationSalesPointId: assignedSalesPointId },
              ],
            }
          : { status: movementStatusFilter },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
        include: {
          sourceSalesPoint: { select: { name: true } },
          destinationSalesPoint: { select: { name: true } },
          lines: {
            include: {
              productVariant: {
                select: { name: true, product: { select: { productName: true } } },
              },
            },
            orderBy: { id: "asc" },
          },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.bpoStockBatch.findMany({
        where: { ...stockScope, qtyRemainingUnits: { gt: 0 } },
        select: {
          salesPointId: true,
          productVariantId: true,
          qtyRemainingUnits: true,
        },
      }),
    ),
    prismaRetry(() =>
      prisma.bpoStockMovement.findMany({
        where:
          scoped && assignedSalesPointId != null
            ? {
                sourceSalesPointId: assignedSalesPointId,
                status: { in: [BpoMovementStatus.DRAFT, BpoMovementStatus.SENDER_VALIDATED] },
              }
            : {
                status: { in: [BpoMovementStatus.DRAFT, BpoMovementStatus.SENDER_VALIDATED] },
                ...(botaSalesPointId != null
                  ? { sourceSalesPointId: { not: botaSalesPointId } }
                  : {}),
              },
        select: {
          sourceSalesPointId: true,
          lines: { select: { productVariantId: true, voucherQtyUnits: true } },
        },
      }),
    ),
  ]);

  const physicalBySpVariant = new Map<string, Prisma.Decimal>();
  for (const row of stockRows) {
    const key = `${row.salesPointId}:${row.productVariantId}`;
    physicalBySpVariant.set(
      key,
      (physicalBySpVariant.get(key) ?? new Prisma.Decimal(0)).add(row.qtyRemainingUnits),
    );
  }
  const reservedBySpVariant = new Map<string, Prisma.Decimal>();
  for (const movement of openReservations) {
    if (movement.sourceSalesPointId == null) continue;
    for (const line of movement.lines) {
      const key = `${movement.sourceSalesPointId}:${line.productVariantId}`;
      reservedBySpVariant.set(
        key,
        (reservedBySpVariant.get(key) ?? new Prisma.Decimal(0)).add(line.voucherQtyUnits),
      );
    }
  }
  const availability = [...physicalBySpVariant.entries()].map(([key, physical]) => {
    const [salesPointIdRaw, productVariantId] = key.split(":");
    const available = physical.sub(reservedBySpVariant.get(key) ?? new Prisma.Decimal(0));
    return {
      salesPointId: Number.parseInt(salesPointIdRaw, 10),
      productVariantId,
      availableQtyUnits: (available.gt(0) ? available : new Prisma.Decimal(0)).toString(),
    };
  });

  return (
    <BpoConsignmentsClient
      salesPoints={salesPoints}
      variants={variants.map((v) => ({
        id: v.id,
        label: `${v.product.productName} - ${v.name}`,
      }))}
      availability={availability}
      movements={movements.map((m) => ({
        id: m.id,
        voucherNo: m.voucherNo,
        status: m.status,
        sourceSalesPointName: m.sourceSalesPoint?.name ?? "—",
        destinationSalesPointName: m.destinationSalesPoint?.name ?? "—",
        movementDateIso: m.movementDate.toISOString().slice(0, 10),
        note: m.note,
        discrepancyNote: m.discrepancyNote,
        canSenderValidate:
          m.status === "DRAFT" &&
          session.role === UserRole.SUPERVISOR &&
          (!scoped || m.sourceSalesPointId === assignedSalesPointId),
        canBotaValidate:
          m.status === "SENDER_VALIDATED" &&
          botaSalesPointId != null &&
          (session.role === UserRole.SENIOR_SUPERVISOR ||
            session.role === UserRole.MANAGER ||
            session.role === UserRole.ADMIN) &&
          (!scoped || assignedSalesPointId === botaSalesPointId),
        canReject:
          m.status !== BpoMovementStatus.VALIDATED &&
          m.status !== BpoMovementStatus.REJECTED &&
          ((session.role === UserRole.SUPERVISOR &&
            botaSalesPointId != null &&
            assignedSalesPointId !== botaSalesPointId &&
            (!scoped || m.sourceSalesPointId === assignedSalesPointId)) ||
            (session.role === UserRole.CLERK_IN_CHARGE_BPO &&
              botaSalesPointId != null &&
              assignedSalesPointId === botaSalesPointId &&
              m.destinationSalesPointId === botaSalesPointId)),
        canPrintReceiptVoucher:
          m.status === BpoMovementStatus.SENDER_VALIDATED &&
          session.role === UserRole.CLERK_IN_CHARGE_BPO &&
          botaSalesPointId != null &&
          assignedSalesPointId === botaSalesPointId &&
          m.destinationSalesPointId === botaSalesPointId,
        lines: m.lines.map((l) => ({
          id: l.id,
          productVariantId: l.productVariantId,
          variantLabel: `${l.productVariant.product.productName} - ${l.productVariant.name}`,
          voucherQtyUnits: l.voucherQtyUnits.toString(),
          actualQtyUnits: l.actualQtyUnits?.toString() ?? null,
        })),
      }))}
      botaSalesPointId={botaSalesPointId}
      defaultSourceSalesPointId={assignedSalesPointId}
      salesPointLocked={scoped}
      canCreateVoucher={
        session.role !== UserRole.SENIOR_SUPERVISOR &&
        session.role !== UserRole.MANAGER
      }
      canPrintCreatedVoucher={
        session.role === UserRole.CLERK &&
        assignedSalesPointId != null &&
        assignedSalesPointId !== botaSalesPointId
      }
      createAction={createBpoConsignmentVoucher}
      senderValidateAction={senderValidateBpoConsignment}
      botaValidateAction={botaValidateBpoConsignment}
      rejectAction={rejectBpoConsignment}
    />
  );
}
