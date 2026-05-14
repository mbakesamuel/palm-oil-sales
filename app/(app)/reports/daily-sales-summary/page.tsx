import { redirect } from "next/navigation";
import {
  CustomerType,
  Prisma,
  ValidationStatus,
} from "@prisma/client";
import { PrintButton } from "@/components/PrintButton";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  firstDayOfCalendarMonth,
  lastDayOfCalendarMonth,
  normalizeIsoDateInput,
  utcIsoDateToday,
} from "@/lib/posting-calendar";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  [CustomerType.INDUSTRY]: "Industry",
  [CustomerType.WHOLE_SALE]: "Whole sale",
  [CustomerType.RETAIL]: "Retail",
  [CustomerType.WORKER]: "Worker",
};

function fmtKg(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d: Date) {
  return d.toLocaleString("en-GB", {
    dateStyle: "medium",
  });
}

function utcDayRange(iso: string): { gte: Date; lt: Date } {
  const gte = new Date(`${iso}T00:00:00.000Z`);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

function invoicedKgByProductFromSales(
  validatedSales: Array<{
    lines: Array<{ productId: number; qtyKg: Prisma.Decimal }>;
  }>,
): Map<number, Prisma.Decimal> {
  const map = new Map<number, Prisma.Decimal>();
  for (const s of validatedSales) {
    for (const l of s.lines) {
      map.set(l.productId, (map.get(l.productId) ?? z).add(l.qtyKg));
    }
  }
  return map;
}

function doBalanceKgTotal(
  details: Array<{ productId: number; orderQty: number }>,
  invoicedKgByProduct: Map<number, Prisma.Decimal>,
): Prisma.Decimal {
  let acc = z;
  for (const d of details) {
    const inv = invoicedKgByProduct.get(d.productId) ?? z;
    acc = acc.add(new Prisma.Decimal(d.orderQty).sub(inv));
  }
  return acc;
}

export default async function DailySalesSummaryPage(props: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl px-3 sm:px-8 lg:px-12">
        <h1 className="text-2xl font-semibold">Report · Daily sales summary</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but no sales point is assigned to
          your account. Ask an administrator to assign one before you can view
          this report.
        </div>
        <div className="hidden print:block">
          <ReportSignatory />
        </div>
      </div>
    );
  }

  const { date: dateRaw } = await props.searchParams;
  const requestedIso = normalizeIsoDateInput(String(dateRaw ?? ""));

  const [{ monthFilter, hasOpenFy }, settings, prisma] = await Promise.all([
    resolveReportWorkingMonthFilter(),
    getOrInitCompanySettings(),
    getPrismaClient(),
  ]);

  let selectedIso: string | null = null;
  let dateInvalid = false;

  if (monthFilter) {
    const monthFirst = firstDayOfCalendarMonth(
      monthFilter.postingCalendarYear,
      monthFilter.financialMonth,
    );
    const monthLast = lastDayOfCalendarMonth(
      monthFilter.postingCalendarYear,
      monthFilter.financialMonth,
    );
    if (requestedIso) {
      if (requestedIso >= monthFirst && requestedIso <= monthLast) {
        selectedIso = requestedIso;
      } else {
        dateInvalid = true;
      }
    } else {
      const today = utcIsoDateToday();
      selectedIso =
        today >= monthFirst && today <= monthLast ? today : monthFirst;
    }
  } else if (requestedIso) {
    dateInvalid = true;
  }

  const saleScope: Prisma.SaleWhereInput =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {};

  const monthWhere: Prisma.SaleWhereInput = monthFilter
    ? {
        financialYear: monthFilter.financialYear,
        postingCalendarYear: monthFilter.postingCalendarYear,
        financialMonth: monthFilter.financialMonth,
      }
    : {};

  let sales: Array<{
    id: string;
    invoiceNo: string;
    soldAt: Date;
    dateIssued: Date;
    vehicleNumber: string;
    deliveryOrderNo: string | null;
    customerNameSnapshot: string;
    customer: { customerType: CustomerType; name: string } | null;
    lines: Array<{ qtyKg: Prisma.Decimal }>;
  }> = [];

  let doMetaByNo = new Map<
    string,
    { dateIssued: Date; balanceKg: Prisma.Decimal }
  >();

  if (selectedIso) {
    const { gte, lt } = utcDayRange(selectedIso);
    sales = await prismaRetry(() =>
      prisma.sale.findMany({
        where: {
          ...saleScope,
          ...monthWhere,
          status: ValidationStatus.VALIDATED,
          soldAt: { gte, lt },
        },
        orderBy: [{ soldAt: "asc" }, { invoiceNo: "asc" }],
        select: {
          id: true,
          invoiceNo: true,
          soldAt: true,
          dateIssued: true,
          vehicleNumber: true,
          deliveryOrderNo: true,
          customerNameSnapshot: true,
          customer: { select: { customerType: true, name: true } },
          lines: { select: { qtyKg: true } },
        },
      }),
    );

    const doNos = [
      ...new Set(
        sales.map((s) => s.deliveryOrderNo).filter((n): n is string => Boolean(n)),
      ),
    ];

    if (doNos.length > 0) {
      const [orders, validatedSalesForDos] = await Promise.all([
        prismaRetry(() =>
          prisma.deliveryOrder.findMany({
            where: { deliveryOrderNo: { in: doNos } },
            select: {
              deliveryOrderNo: true,
              dateIssued: true,
              details: { select: { productId: true, orderQty: true } },
            },
          }),
        ),
        prismaRetry(() =>
          prisma.sale.findMany({
            where: {
              deliveryOrderNo: { in: doNos },
              status: ValidationStatus.VALIDATED,
              ...saleScope,
            },
            select: {
              deliveryOrderNo: true,
              lines: { select: { productId: true, qtyKg: true } },
            },
          }),
        ),
      ]);

      const validatedByDo = new Map<string, typeof validatedSalesForDos>();
      for (const s of validatedSalesForDos) {
        const k = s.deliveryOrderNo ?? "";
        if (!k) continue;
        const arr = validatedByDo.get(k) ?? [];
        arr.push(s);
        validatedByDo.set(k, arr);
      }

      doMetaByNo = new Map();
      for (const o of orders) {
        const invMap = invoicedKgByProductFromSales(
          validatedByDo.get(o.deliveryOrderNo) ?? [],
        );
        const balanceKg = doBalanceKgTotal(o.details, invMap);
        doMetaByNo.set(o.deliveryOrderNo, {
          dateIssued: o.dateIssued,
          balanceKg,
        });
      }
    }
  }

  const rows = sales.map((s) => ({
    ...s,
    qtyKg: s.lines.reduce((a, l) => a.add(l.qtyKg), z),
    customerType: s.customer?.customerType ?? CustomerType.INDUSTRY,
  }));

  const totalsByType = new Map<CustomerType, Prisma.Decimal>();
  for (const r of rows) {
    totalsByType.set(
      r.customerType,
      (totalsByType.get(r.customerType) ?? z).add(r.qtyKg),
    );
  }
  const grandQty = rows.reduce((a, r) => a.add(r.qtyKg), z);

  const typeOrder: CustomerType[] = [
    CustomerType.INDUSTRY,
    CustomerType.WHOLE_SALE,
    CustomerType.RETAIL,
    CustomerType.WORKER,
  ];

  const generated = new Date();

  return (
    <div className="space-y-6 w-full min-w-0 max-w-none px-1 py-2 sm:px-2 sm:py-4 lg:px-3 lg:py-6 print:px-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h1 className="text-2xl font-semibold">Daily sales summary</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          <p className="text-sm opacity-75 mt-1">
            {scopedToSalesPoint && assignedSalesPointName
              ? `Sales at ${assignedSalesPointName} only.`
              : "All collection points (consolidated)."}
          </p>
          <p className="text-sm opacity-75 mt-1">
            {monthFilter ? (
              <>
                <span className="font-medium">Working month</span>:{" "}
                {monthFilter.label} (FY {monthFilter.financialYear}). Pick a
                calendar day inside this month; rows are sales whose{" "}
                <span className="font-medium">sold-at</span> timestamp falls on
                that day (UTC), <span className="font-medium">validated</span>{" "}
                only.
              </>
            ) : hasOpenFy ? (
              <>
                No working calendar month could be applied. Choose a date once a
                working month is available from the banner.
              </>
            ) : (
              <>
                No financial year is open. Open a year under Financial years to
                use this report.
              </>
            )}
          </p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {selectedIso ? (
              <>
                {" "}
                · Day <span className="font-medium">{selectedIso}</span> (
                {rows.length} validated sale{rows.length === 1 ? "" : "s"})
              </>
            ) : null}
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton label="Print report" />
        </div>
      </div>

      <form
        method="GET"
        className="flex flex-col sm:flex-row gap-2 sm:items-end max-w-xl print:hidden"
      >
        <div className="grid gap-1 flex-1">
          <label htmlFor="date" className="text-sm font-medium">
            Report date (within working month)
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={selectedIso ?? ""}
            disabled={!monthFilter}
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!monthFilter}
          className="rounded-md border border-border bg-foreground/[0.08] px-4 py-2 text-sm font-medium hover:bg-accent/35 disabled:opacity-50"
        >
          Apply
        </button>
      </form>

      {dateInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          The requested date is outside the current working calendar month. Pick
          a day between the first and last day of that month.
        </div>
      ) : null}

      <div className="w-full min-w-0 rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-208 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">DO no.</th>
              <th className="px-2 py-2 font-medium">DO issued</th>
              <th className="px-2 py-2 font-medium">Vehicle no.</th>
              <th className="px-2 py-2 font-medium">Sale issued</th>
              <th className="px-2 py-2 font-medium text-right">Qty (kg)</th>
              <th className="px-2 py-2 font-medium text-right">
                DO balance (kg)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const doNo = s.deliveryOrderNo?.trim() ?? "";
              const meta = doNo ? doMetaByNo.get(doNo) : undefined;
              return (
                <tr
                  key={s.id}
                  className="border-b border-border odd:bg-foreground/[0.04]"
                >
                  <td className="px-2 py-2 max-w-56 truncate" title={s.customerNameSnapshot}>
                    {s.customerNameSnapshot}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">
                    {doNo || "—"}
                  </td>
                  <td className="px-2 py-2 tabular-nums whitespace-nowrap">
                    {meta ? fmtDate(meta.dateIssued) : "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">
                    {s.vehicleNumber || "—"}
                  </td>
                  <td className="px-2 py-2 tabular-nums whitespace-nowrap">
                    {fmtDate(s.dateIssued)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {fmtKg(s.qtyKg)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {meta ? fmtKg(meta.balanceKg) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && selectedIso && !dateInvalid ? (
        <p className="text-sm opacity-75">
          No validated sales for {selectedIso} in this scope and working month.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">
            Summary by customer type (validated sales, day)
          </h2>
          <div className="w-full max-w-md rounded-lg border border-border overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-foreground/[0.06]">
                  <th className="px-3 py-2 font-medium">Customer type</th>
                  <th className="px-3 py-2 font-medium text-right">Qty (kg)</th>
                </tr>
              </thead>
              <tbody>
                {typeOrder.map((t) => {
                  const q = totalsByType.get(t);
                  if (!q || q.equals(z)) return null;
                  return (
                    <tr
                      key={t}
                      className="border-b border-border"
                    >
                      <td className="px-3 py-2">{CUSTOMER_TYPE_LABELS[t]}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtKg(q)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-medium border-t-2 border-border">
                  <td className="px-3 py-2">Grand total</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtKg(grandQty)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs opacity-70 max-w-prose">
            <span className="font-medium">DO balance (kg)</span> is the sum over
            delivery order lines of (ordered qty − validated invoiced qty by
            product), matching the delivery order monitor. It is the same for
            every sale row sharing that DO number.
          </p>
        </div>
      ) : null}

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
