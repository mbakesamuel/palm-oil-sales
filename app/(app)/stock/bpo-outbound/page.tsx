import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getBotaSalesPointId } from "@/lib/bpo";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { createBpoOutboundMovement } from "./actions";
import { BpoOutboundClient } from "./BpoOutboundClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BpoOutboundPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const prisma = getPrismaClient();
  const botaSalesPointId = await getBotaSalesPointId(prisma);
  const scoped = roleRequiresSalesPoint(session.role);
  const canPost = botaSalesPointId != null && (!scoped || session.salesPoint?.id === botaSalesPointId);

  const [variants, movements] = await Promise.all([
    prismaRetry(() =>
      prisma.productVariant.findMany({
        where: { isActive: true, product: { isBottledPalmOil: true } },
        orderBy: [{ product: { productName: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, product: { select: { productName: true } } },
      }),
    ),
    prismaRetry(() =>
      prisma.bpoStockMovement.findMany({
        where: {
          movementType: { in: ["GIFT", "OTHER_OUT"] },
          ...(botaSalesPointId != null ? { sourceSalesPointId: botaSalesPointId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          lines: {
            include: {
              productVariant: {
                select: { name: true, product: { select: { productName: true } } },
              },
            },
          },
        },
      }),
    ),
  ]);

  return (
    <BpoOutboundClient
      variants={variants.map((v) => ({
        id: v.id,
        label: `${v.product.productName} - ${v.name}`,
      }))}
      movements={movements.map((m) => ({
        voucherNo: m.voucherNo,
        movementDateIso: m.movementDate.toISOString().slice(0, 10),
        reason: m.reason,
        note: m.note,
        lines: m.lines.map((l) => ({
          variantLabel: `${l.productVariant.product.productName} - ${l.productVariant.name}`,
          qtyUnits: (l.postedQtyUnits ?? l.actualQtyUnits ?? l.voucherQtyUnits).toString(),
        })),
      }))}
      canPost={canPost}
      botaAvailable={botaSalesPointId != null}
      createAction={createBpoOutboundMovement}
    />
  );
}
