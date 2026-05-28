import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { getPrismaClient } from "@/lib/prisma";
import { getPermissionsForSession } from "@/lib/access-control";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { StockDocStatus } from "@prisma/client";

function formatIsoDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.length > 10 ? iso.slice(0, 10) : iso;
}

export async function DashboardIncomingTransfers() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const perms = await getPermissionsForSession(session);
  if (!perms["route:/stock"]) return null;

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const scopedSalesPointId =
    scopedToSalesPoint && assignedSalesPointId != null ? assignedSalesPointId : null;

  const prisma = await getPrismaClient();
  const transfers = await prisma.stockTransfer.findMany({
    where: {
      status: StockDocStatus.DISPATCHED,
      ...(scopedSalesPointId != null ? { toSalesPointId: scopedSalesPointId } : {}),
    },
    orderBy: [{ dispatchedAt: "desc" }, { createdAt: "desc" }],
    take: 10,
    select: {
      id: true,
      transferNo: true,
      dispatchedAt: true,
      createdAt: true,
      fromSalesPoint: { select: { name: true } },
      toSalesPoint: { select: { name: true } },
      lines: { select: { qty: true } },
    },
  });

  const label = scopedSalesPointId != null ? session.salesPoint?.name ?? "Sales point" : "All sales points";
  const hasIncoming = transfers.length > 0;

  return (
    <div
      className={[
        "rounded-lg border border-border p-4",
        hasIncoming ? "bg-amber-500/5 border-amber-600/30" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Incoming stock transfers</div>
          <div className="text-xs opacity-75">{label}</div>
        </div>
        <Link
          href="/stock?tab=transfers"
          className="text-xs underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          View all
        </Link>
      </div>

      <div className="mt-3 overflow-x-auto">
        {transfers.length === 0 ? (
          <div className="text-sm opacity-70">No transfers awaiting receipt.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left bg-accent/15">
                <th className="p-2 font-medium">Transfer</th>
                <th className="p-2 font-medium">From</th>
                {scopedSalesPointId == null ? (
                  <th className="p-2 font-medium">To</th>
                ) : null}
                <th className="p-2 font-medium">Dispatched</th>
                <th className="p-2 font-medium text-right">Lines</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-b-0">
                  <td className="p-2 font-medium">{t.transferNo}</td>
                  <td className="p-2 opacity-80">{t.fromSalesPoint.name}</td>
                  {scopedSalesPointId == null ? (
                    <td className="p-2 opacity-80">{t.toSalesPoint.name}</td>
                  ) : null}
                  <td className="p-2 opacity-80">
                    {formatIsoDate((t.dispatchedAt ?? t.createdAt).toISOString())}
                  </td>
                  <td className="p-2 text-right tabular-nums opacity-80">
                    {t.lines.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

