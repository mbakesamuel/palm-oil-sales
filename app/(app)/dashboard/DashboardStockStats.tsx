import Link from "next/link";
import { redirect } from "next/navigation";
import { StockDocStatus } from "@prisma/client";
import { getPermissionsForSession } from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import { getPrismaClient } from "@/lib/prisma";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";

export async function DashboardStockStats() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const perms = await getPermissionsForSession(session);
  if (!perms["route:/stock"]) return null;

  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const scopedSalesPointId =
    scopedToSalesPoint && session.salesPoint?.id != null ? session.salesPoint.id : null;

  const prisma = await getPrismaClient();

  const receiptWhere = {
    status: StockDocStatus.DRAFT,
    ...(scopedSalesPointId != null ? { salesPointId: scopedSalesPointId } : {}),
  };

  const incomingTransferWhere = {
    status: StockDocStatus.DISPATCHED,
    ...(scopedSalesPointId != null ? { toSalesPointId: scopedSalesPointId } : {}),
  };

  const outboundDraftTransferWhere = {
    status: StockDocStatus.DRAFT,
    ...(scopedSalesPointId != null ? { fromSalesPointId: scopedSalesPointId } : {}),
  };

  const [pendingReceiptCount, incomingTransferCount, outboundDraftTransferCount] =
    await Promise.all([
      prisma.stockReceipt.count({ where: receiptWhere }),
      prisma.stockTransfer.count({ where: incomingTransferWhere }),
      prisma.stockTransfer.count({ where: outboundDraftTransferWhere }),
    ]);

  const pendingTransferCount = incomingTransferCount + outboundDraftTransferCount;

  const scopeHint =
    scopedSalesPointId != null
      ? session.salesPoint?.name ?? "Your sales point"
      : "All sales points";

  return (
    <div className="space-y-2">
      <div className="text-xs opacity-70">{scopeHint} · stock workflow</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/stock?tab=receipts"
          className="rounded-xl border border-border bg-background p-4 shadow-sm transition-all hover:border-brand/35 hover:bg-brand/5 hover:shadow-md"
        >
          <div className="text-2xl font-semibold tabular-nums">{pendingReceiptCount}</div>
          <div className="mt-1 text-sm font-medium">Pending receipts</div>
          <div className="mt-0.5 text-xs opacity-75">Draft receipts awaiting post</div>
        </Link>
        <Link
          href="/stock?tab=transfers"
          className="rounded-xl border border-amber-600/35 bg-amber-500/8 p-4 shadow-sm transition-all hover:border-amber-600/50 hover:bg-amber-500/12 hover:shadow-md"
        >
          <div className="text-2xl font-semibold tabular-nums text-amber-950 dark:text-amber-100">
            {pendingTransferCount}
          </div>
          <div className="mt-1 text-sm font-medium text-amber-950 dark:text-amber-100">
            Pending transfers
          </div>
          <div className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/85">
            {incomingTransferCount > 0 && outboundDraftTransferCount > 0
              ? `${incomingTransferCount} to receive · ${outboundDraftTransferCount} to dispatch`
              : incomingTransferCount > 0
                ? "Awaiting receipt at destination"
                : outboundDraftTransferCount > 0
                  ? "Draft — awaiting dispatch"
                  : "No transfers awaiting action"}
          </div>
        </Link>
      </div>
    </div>
  );
}
