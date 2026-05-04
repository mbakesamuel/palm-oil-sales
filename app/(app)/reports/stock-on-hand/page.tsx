import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
import { PrintButton } from "@/components/PrintButton";
import { ReportSignatory } from "@/components/ReportSignatory";
import { Prisma } from "@prisma/client";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

function fmtKg(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

type ProductCol = { productId: number; productName: string };

export default async function StockOnHandReportPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    const settings = await getOrInitCompanySettings();
    const logoSrc =
      settings.logoUrl && settings.logoUrl.trim() !== ""
        ? settings.logoUrl.trim()
        : "/cdc-logo-svg.svg";
    return (
      <div className="space-y-6 max-w-xl">
        <div className="space-y-3 print:block">
          <div className="w-full">
            <div className="relative flex min-h-8 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- settings may point to arbitrary http(s) URLs */}
              <img
                src={logoSrc}
                alt=""
                className="absolute left-0 top-1/2 h-8 max-h-8 w-auto max-w-[72px] -translate-y-1/2 object-contain"
              />
              <h1 className="w-full px-22 text-center text-2xl font-semibold leading-tight sm:px-24">
                {settings.companyName}
              </h1>
            </div>
            <p className="mt-1 text-center text-sm opacity-80">{settings.department}</p>
            <p className="mt-1 text-center text-sm opacity-80">Stock on hand</p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an administrator.
        </div>
        <div className="hidden print:block">
          <ReportSignatory />
        </div>
      </div>
    );
  }

  const prisma = getPrismaClient();
  const spWhereBatch =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {};
  const spWhereLocation =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {};

  const [settings, salesPointsList, allLocations, batchRows] = await Promise.all([
    getOrInitCompanySettings(),
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        where:
          scopedToSalesPoint && assignedSalesPointId != null
            ? { id: assignedSalesPointId }
            : {},
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
    prismaRetry(() =>
      prisma.storageLocation.findMany({
        where: spWhereLocation,
        orderBy: [{ salesPoint: { name: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, salesPointId: true },
      }),
    ),
    prismaRetry(() =>
      prisma.batch.findMany({
        where: {
          ...spWhereBatch,
          qtyRemainingKg: { gt: 0 },
        },
        select: {
          salesPointId: true,
          storageLocationId: true,
          productId: true,
          qtyRemainingKg: true,
        },
      }),
    ),
  ]);

  const locationsBySp = new Map<number, { id: number; name: string }[]>();
  for (const loc of allLocations) {
    const arr = locationsBySp.get(loc.salesPointId) ?? [];
    arr.push({ id: loc.id, name: loc.name });
    locationsBySp.set(loc.salesPointId, arr);
  }

  const sumBySpLocProd = new Map<string, Prisma.Decimal>();
  for (const b of batchRows) {
    const k = `${b.salesPointId}:${b.storageLocationId}:${b.productId}`;
    sumBySpLocProd.set(k, (sumBySpLocProd.get(k) ?? z).add(b.qtyRemainingKg));
  }

  const productIdsInScope = [...new Set(batchRows.map((b) => b.productId))];
  const productsCatalog = productIdsInScope.length
    ? await prismaRetry(() =>
        prisma.product.findMany({
          where: { productId: { in: productIdsInScope } },
          select: { productId: true, productName: true },
        }),
      )
    : [];
  const productNameById = new Map(productsCatalog.map((p) => [p.productId, p.productName]));

  function productColumnsForSp(salesPointId: number): ProductCol[] {
    const ids = [
      ...new Set(batchRows.filter((b) => b.salesPointId === salesPointId).map((b) => b.productId)),
    ];
    return ids
      .map((productId) => ({
        productId,
        productName: productNameById.get(productId) ?? `Product ${productId}`,
      }))
      .sort((a, b) =>
        a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }),
      );
  }

  function cellQty(salesPointId: number, storageLocationId: number, productId: number): Prisma.Decimal {
    return sumBySpLocProd.get(`${salesPointId}:${storageLocationId}:${productId}`) ?? z;
  }

  const generated = new Date();

  const sections = salesPointsList.map((sp) => {
    const locations = locationsBySp.get(sp.id) ?? [];
    const productCols = productColumnsForSp(sp.id);
    const colTotals = productCols.map(() => new Prisma.Decimal(0));
    let sectionGrand = new Prisma.Decimal(0);

    const bodyRows = locations.map((loc) => {
      let rowSum = new Prisma.Decimal(0);
      const cells = productCols.map((pc, colIdx) => {
        const q = cellQty(sp.id, loc.id, pc.productId);
        rowSum = rowSum.add(q);
        colTotals[colIdx] = colTotals[colIdx].add(q);
        return q;
      });
      sectionGrand = sectionGrand.add(rowSum);
      return { loc, cells, rowSum };
    });

    const footerColTotals = colTotals;

    return {
      sp,
      locations,
      productCols,
      bodyRows,
      footerColTotals,
      sectionGrand,
    };
  });

  const hasAnySection = sections.some((s) => s.locations.length > 0);

  const summaryByGrade =
    !scopedToSalesPoint && batchRows.length > 0
      ? (() => {
          const byProduct = new Map<number, Prisma.Decimal>();
          for (const b of batchRows) {
            byProduct.set(b.productId, (byProduct.get(b.productId) ?? z).add(b.qtyRemainingKg));
          }
          const rows = [...byProduct.entries()]
            .map(([productId, qtyKg]) => ({
              productId,
              gradeLabel: productNameById.get(productId) ?? `Product ${productId}`,
              qtyKg,
            }))
            .sort((a, b) =>
              a.gradeLabel.localeCompare(b.gradeLabel, undefined, { sensitivity: "base" }),
            );
          const total = rows.reduce((acc, r) => acc.add(r.qtyKg), new Prisma.Decimal(0));
          return { rows, total };
        })()
      : null;

  const logoSrc =
    settings.logoUrl && settings.logoUrl.trim() !== ""
      ? settings.logoUrl.trim()
      : "/cdc-logo-svg.svg";

  return (
    <div className="space-y-8">
      <div className="space-y-3 print:block">
        <div className="w-full">
          <div className="relative flex min-h-8 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- settings may point to arbitrary http(s) URLs */}
            <img
              src={logoSrc}
              alt=""
              className="absolute left-0 top-1/2 h-8 max-h-8 w-auto max-w-[72px] -translate-y-1/2 object-contain"
            />
            <h1 className="w-full px-22 text-center text-2xl font-semibold leading-tight sm:px-24">
              {settings.companyName}
            </h1>
          </div>
          <p className="mt-1 text-center text-sm opacity-80">{settings.department}</p>
          <p className="mt-1 text-center text-sm opacity-80">
            {scopedToSalesPoint && assignedSalesPointName
              ? `Stock on hand at ${assignedSalesPointName}`
              : "Stock on Hand All Sales Points"}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {scopedToSalesPoint ? (
              <p className="text-sm opacity-80">
                <span className="font-medium">Clerk / supervisor view</span> — remaining kg by
                storage location and product at{" "}
                <span className="font-medium">{assignedSalesPointName}</span>.
              </p>
            ) : (
              <p className="text-sm opacity-80">
                <span className="font-medium">Consolidated view</span> — one crosstab per collection
                point. Rows are storage locations; columns are products; values are{" "}
                <span className="font-medium">remaining kg</span>.
              </p>
            )}
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <div className="print:hidden">
            <PrintButton label="Print" />
          </div>
        </div>
      </div>

      {!hasAnySection ? (
        <p className="text-sm opacity-75">
          No storage locations in scope. Define locations under Settings → Storage locations.
        </p>
      ) : (
        sections.map((sec) => {
          if (sec.locations.length === 0) {
            return (
              <section key={sec.sp.id} className="space-y-2 print:break-inside-avoid">
                <h2 className="text-lg font-semibold">{sec.sp.name}</h2>
                <p className="text-sm opacity-75">No storage locations configured for this collection point.</p>
              </section>
            );
          }

          if (sec.productCols.length === 0) {
            return (
              <section key={sec.sp.id} className="space-y-2 print:break-inside-avoid">
                <h2 className="text-lg font-semibold">{sec.sp.name}</h2>
                <p className="text-sm opacity-75">No remaining stock at this collection point.</p>
              </section>
            );
          }

          return (
            <section key={sec.sp.id} className="space-y-2 print:break-inside-avoid">
              {!scopedToSalesPoint ? (
                <h2 className="text-lg font-semibold">{sec.sp.name}</h2>
              ) : null}
              <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-left">
                      <th className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-neutral-950 z-10 border-r border-black/10 dark:border-white/10">
                        Storage location
                      </th>
                      {sec.productCols.map((pc) => (
                        <th
                          key={pc.productId}
                          className="px-3 py-2 font-medium text-right whitespace-nowrap"
                        >
                          {pc.productName}
                          <span className="block text-[10px] font-normal opacity-60">kg</span>
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap border-l border-black/10 dark:border-white/10">
                        Row total
                        <span className="block text-[10px] font-normal opacity-60">kg</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.bodyRows.map(({ loc, cells, rowSum }) => (
                      <tr
                        key={loc.id}
                        className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2"
                      >
                        <td className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-neutral-950 z-10 border-r border-black/5 dark:border-white/5">
                          {loc.name}
                        </td>
                        {cells.map((q, i) => (
                          <td key={i} className="px-3 py-2 text-right tabular-nums">
                            {q.gt(0) ? fmtKg(q) : "—"}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right tabular-nums font-medium border-l border-black/5 dark:border-white/5">
                          {rowSum.gt(0) ? fmtKg(rowSum) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-black/15 font-medium dark:border-white/15">
                      <td className="px-3 py-2 sticky left-0 bg-white dark:bg-neutral-950 z-10 border-r border-black/10 dark:border-white/10">
                        Column total
                      </td>
                      {sec.footerColTotals.map((t, i) => (
                        <td key={i} className="px-3 py-2 text-right tabular-nums">
                          {t.gt(0) ? fmtKg(t) : "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums border-l border-black/15 dark:border-white/15">
                        {fmtKg(sec.sectionGrand)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })
      )}

      {summaryByGrade && summaryByGrade.rows.length > 0 ? (
        <section className="space-y-2 print:break-inside-avoid max-w-xl">
          <h2 className="text-lg font-semibold">Summary by grade (all sales points)</h2>
          <p className="text-sm opacity-75">
            Total remaining kg by product grade across every collection point in scope.
          </p>
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-left">
                  <th className="px-3 py-2 font-medium">Grade</th>
                  <th className="px-3 py-2 font-medium text-right">Remaining (kg)</th>
                </tr>
              </thead>
              <tbody>
                {summaryByGrade.rows.map((r) => (
                  <tr
                    key={r.productId}
                    className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2"
                  >
                    <td className="px-3 py-2">{r.gradeLabel}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtKg(r.qtyKg)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black/15 font-medium dark:border-white/15">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtKg(summaryByGrade.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
