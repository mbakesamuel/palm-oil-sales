import Link from "next/link";
import { redirect } from "next/navigation";
import { listSalesForOperations } from "./actions";
import { getServerSession } from "@/lib/auth-server";
import { assertPermissionKeysOrRedirect } from "@/lib/access-control";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SalesListPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await assertPermissionKeysOrRedirect("route:/pos", "route:/pos/list");

  const session = await getServerSession();
  if (!session?.userId) redirect("/login");

  const sp = (await props.searchParams) ?? {};
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const periodRaw = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period =
    periodRaw === "month" || periodRaw === "year" || periodRaw === "all"
      ? periodRaw
      : "month";

  const data = await listSalesForOperations({
    filters: { q: qRaw ?? "", period },
    take: 300,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales invoices</h1>
          <p className="text-sm opacity-75">
            Filter by invoice number, or view all within the current financial
            month or year.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pos"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent/25"
          >
            Open sales screen
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <form className="flex flex-wrap items-end gap-3" action="/pos/list">
          <div className="min-w-[220px]">
            <div className="text-xs font-medium opacity-70">Invoice number</div>
            <input
              name="q"
              defaultValue={qRaw ?? ""}
              placeholder="e.g. INV-2026-000014"
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="w-[220px]">
            <div className="text-xs font-medium opacity-70">Period</div>
            <select
              name="period"
              defaultValue={period}
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="month">Current financial month</option>
              <option value="year">Current financial year</option>
              <option value="all">All time</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
          >
            Apply
          </button>

          <div className="ml-auto text-xs opacity-70 pt-1">
            {data.periodLabel}
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left">Invoice No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Sales point</th>
                <th className="px-3 py-2 text-left">DO No</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center opacity-70" colSpan={10}>
                    No sales invoices match these filters.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {r.invoiceNo}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.soldAtIso}</td>
                    <td className="px-3 py-2">{r.salesPointName}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {r.deliveryOrderNo ? (
                        <Link
                          href={`/delivery-orders?no=${encodeURIComponent(r.deliveryOrderNo)}`}
                          className="hover:underline underline-offset-2"
                        >
                          {r.deliveryOrderNo}
                        </Link>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="px-3 py-2">{r.customerName}</td>
                    <td className="px-3 py-2 text-xs">{r.productSummary}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.totalQtyLabel}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.totalAmountXaf}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/pos?no=${encodeURIComponent(r.invoiceNo)}`}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/25"
                          title="View"
                        >
                          View
                        </Link>
                        <Link
                          href={`/sales/${r.id}`}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/25"
                          title="Print"
                        >
                          Print
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-foreground/2">
                <td className="px-3 py-2 text-xs font-medium opacity-70" colSpan={7}>
                  Totals ({data.periodLabel})
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {data.totals.totalQtyLabel}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {data.totals.totalAmountXaf}
                </td>
                <td className="px-3 py-2 text-right text-xs opacity-70">
                  {data.totals.count} invoices
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
          <div className="text-xs opacity-70">
            Print options: use per-row Print, or print this list.
          </div>
          <div className="flex items-center gap-2">
            <PrintButton label="Print list" />
          </div>
        </div>
      </div>
    </div>
  );
}
