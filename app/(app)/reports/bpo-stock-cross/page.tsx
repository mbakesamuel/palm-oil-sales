import { redirect } from "next/navigation";
import {
  BpoMovementStatus,
  BpoMovementType,
  Prisma,
  UserRole,
  ValidationStatus,
} from "@prisma/client";
import { PrintButton } from "@/components/PrintButton";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import { ReportHeader } from "@/components/ReportHeader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);
const consolidatedRoles = new Set<UserRole>([
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.SENIOR_SUPERVISOR,
  UserRole.CLERK_IN_CHARGE_BPO,
]);
const kgPerLitre = new Prisma.Decimal("0.85");
const litresPerVariantCode: Record<string, Prisma.Decimal> = {
  "1x20": new Prisma.Decimal(20),
  "1x15": new Prisma.Decimal(15),
  "3x5": new Prisma.Decimal(15),
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function parseAsOf(raw: string | undefined) {
  const trimmed = String(raw ?? "").trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : isoToday();
  return {
    iso,
    start: new Date(`${iso}T00:00:00.000Z`),
    end: new Date(`${iso}T23:59:59.999Z`),
  };
}

function fmtUnits(value: Prisma.Decimal) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(Number(value.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP)));
}

function litresPerUnit(variantName: string) {
  const normalized = variantName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/litres?|l$/g, "");
  const configured = litresPerVariantCode[normalized];
  if (configured) return configured;
  const match = normalized.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (!match) return z;
  return new Prisma.Decimal(match[1]!).mul(match[2]!);
}

function addToCell(
  map: Map<string, Prisma.Decimal>,
  salesPointId: number | null,
  productVariantId: string,
  delta: Prisma.Decimal,
) {
  if (salesPointId == null) return;
  const key = `${salesPointId}:${productVariantId}`;
  map.set(key, (map.get(key) ?? z).add(delta));
}

export default async function BpoStockCrossReportPage(props: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!consolidatedRoles.has(session.role as UserRole)) redirect("/forbidden");

  const { asOf: asOfRaw } = await props.searchParams;
  const asOf = parseAsOf(asOfRaw);
  const prisma = getPrismaClient();

  const [
    settings,
    salesPoints,
    variants,
    directReceipts,
    movements,
    saleLines,
  ] = await Promise.all([
    getOrInitCompanySettings(),
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
    prismaRetry(() =>
      prisma.productVariant.findMany({
        where: { product: { isBottledPalmOil: true } },
        orderBy: [{ product: { productName: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          product: { select: { productName: true } },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.bpoStockBatch.findMany({
        where: {
          sourceMovementLineId: null,
          receivedAt: { lte: asOf.end },
        },
        select: {
          salesPointId: true,
          productVariantId: true,
          qtyReceivedUnits: true,
        },
      }),
    ),
    prismaRetry(() =>
      prisma.bpoStockMovement.findMany({
        where: {
          status: BpoMovementStatus.VALIDATED,
          movementDate: { lte: asOf.end },
          movementType: {
            in: [
              BpoMovementType.CONSIGNMENT_TRANSFER,
              BpoMovementType.GIFT,
              BpoMovementType.OTHER_OUT,
            ],
          },
        },
        select: {
          movementType: true,
          sourceSalesPointId: true,
          destinationSalesPointId: true,
          lines: {
            select: {
              productVariantId: true,
              postedQtyUnits: true,
              actualQtyUnits: true,
              voucherQtyUnits: true,
            },
          },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.saleLine.findMany({
        where: {
          product: { isBottledPalmOil: true },
          sale: {
            status: ValidationStatus.VALIDATED,
            soldAt: { lte: asOf.end },
          },
        },
        select: {
          productVariantId: true,
          qtyUnits: true,
          sale: { select: { salesPointId: true } },
        },
      }),
    ),
  ]);

  const qtyBySpVariant = new Map<string, Prisma.Decimal>();

  for (const receipt of directReceipts) {
    addToCell(
      qtyBySpVariant,
      receipt.salesPointId,
      receipt.productVariantId,
      receipt.qtyReceivedUnits,
    );
  }

  for (const movement of movements) {
    for (const line of movement.lines) {
      const qty =
        line.postedQtyUnits ?? line.actualQtyUnits ?? line.voucherQtyUnits;
      if (movement.movementType === BpoMovementType.CONSIGNMENT_TRANSFER) {
        addToCell(
          qtyBySpVariant,
          movement.sourceSalesPointId,
          line.productVariantId,
          qty.neg(),
        );
        addToCell(
          qtyBySpVariant,
          movement.destinationSalesPointId,
          line.productVariantId,
          qty,
        );
      } else {
        addToCell(
          qtyBySpVariant,
          movement.sourceSalesPointId,
          line.productVariantId,
          qty.neg(),
        );
      }
    }
  }

  for (const saleLine of saleLines) {
    if (!saleLine.productVariantId || !saleLine.qtyUnits) continue;
    addToCell(
      qtyBySpVariant,
      saleLine.sale.salesPointId,
      saleLine.productVariantId,
      saleLine.qtyUnits.neg(),
    );
  }

  const variantColumns = variants.map((variant) => ({
    id: variant.id,
    label: `${variant.name}`,
    kgPerUnit: litresPerUnit(variant.name).mul(kgPerLitre),
  }));

  const columnTotals = variantColumns.map(() => new Prisma.Decimal(0));
  const rows = salesPoints.map((salesPoint) => {
    let rowTotal = new Prisma.Decimal(0);
    const cells = variantColumns.map((variant, index) => {
      const qty = qtyBySpVariant.get(`${salesPoint.id}:${variant.id}`) ?? z;
      rowTotal = rowTotal.add(qty);
      columnTotals[index] = columnTotals[index].add(qty);
      return qty;
    });
    return { salesPoint, cells, rowTotal };
  });
  const grandTotal = columnTotals.reduce(
    (sum, qty) => sum.add(qty),
    new Prisma.Decimal(0),
  );
  const kgColumnTotals = variantColumns.map(() => new Prisma.Decimal(0));
  const kgRows = rows.map((row) => {
    let rowTotal = new Prisma.Decimal(0);
    const cells = row.cells.map((qty, index) => {
      const kgQty = qty.mul(variantColumns[index]?.kgPerUnit ?? z);
      rowTotal = rowTotal.add(kgQty);
      kgColumnTotals[index] = kgColumnTotals[index].add(kgQty);
      return kgQty;
    });
    return { salesPoint: row.salesPoint, cells, rowTotal };
  });
  const kgGrandTotal = kgColumnTotals.reduce(
    (sum, qty) => sum.add(qty),
    new Prisma.Decimal(0),
  );
  const generated = new Date();

  return (
    <div className="space-y-8">
      <div className="justify-between gap-4 hidden print:block">
        <div>
          {/*  <h1 className="text-sm opacity-80 mt-1">{settings.companyName}</h1>
          <h1 className="text-2xl font-semibold">BOTTLED PALM OIL STOCKS</h1> */}
          <ReportHeader
            companyName={settings.companyName}
            department={settings.department}
            logoSrc={settings.logoUrl}
            title="Bottled Palm Oil Stocks"
          />

          <p className="text-xs opacity-70 mt-1">
            Stock as at {asOf.iso} · Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        {/*  <div className="print:hidden">
          <PrintButton label="Print Report" />
        </div> */}
      </div>

      <form
        method="GET"
        className="print:hidden flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      >
        <div className="flex flex-row justify-between w-full items-end gap-3">
          <div className="flex justify-between items-end gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">As at date</span>
              <input
                type="date"
                name="asOf"
                defaultValue={asOf.iso}
                className="rounded-md border border-border bg-transparent px-3 py-2"
              />
            </label>
            <button className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium">
              View report
            </button>
          </div>
          <div className="print:hidden">
            <PrintButton label="Print Report" />
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="w-[18%] text-left px-2 py-2">Sales point</th>
              {variantColumns.map((variant) => (
                <th
                  key={variant.id}
                  className="text-right px-1.5 py-2 leading-tight wrap-break-word"
                >
                  {variant.label}
                </th>
              ))}
              <th className="w-[10%] text-right px-2 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.salesPoint.id}
                className="border-b border-border"
              >
                <td className="px-2 py-2 font-medium leading-tight wrap-break-word">
                  {row.salesPoint.name}
                </td>
                {row.cells.map((qty, idx) => (
                  <td
                    key={variantColumns[idx]?.id ?? idx}
                    className="px-1.5 py-2 text-right tabular-nums"
                  >
                    {qty.isZero() ? "—" : fmtUnits(qty)}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-medium tabular-nums">
                  {row.rowTotal.isZero() ? "—" : fmtUnits(row.rowTotal)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-foreground/25 font-semibold">
              <td className="px-2 py-2">Total</td>
              {columnTotals.map((qty, idx) => (
                <td
                  key={variantColumns[idx]?.id ?? idx}
                  className="px-1.5 py-2 text-right tabular-nums"
                >
                  {qty.isZero() ? "—" : fmtUnits(qty)}
                </td>
              ))}
              <td className="px-2 py-2 text-right tabular-nums">
                {grandTotal.isZero() ? "—" : fmtUnits(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">
            BPO stocks converted to kilograms
          </h2>
          <p className="text-xs opacity-70">
            Conversion basis: 1 litre = 0.85 kg; 1x20 = 20 litres, 1x15 = 15
            litres, 3x5 = 15 litres.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full table-fixed text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="w-[18%] text-left px-2 py-2">Sales point</th>
                {variantColumns.map((variant) => (
                  <th
                    key={variant.id}
                    className="text-right px-1.5 py-2 leading-tight wrap-break-word"
                  >
                    {variant.label}
                  </th>
                ))}
                <th className="w-[10%] text-right px-2 py-2">Total kg</th>
              </tr>
            </thead>
            <tbody>
              {kgRows.map((row) => (
                <tr
                  key={row.salesPoint.id}
                  className="border-b border-border"
                >
                  <td className="px-2 py-2 font-medium leading-tight wrap-break-word">
                    {row.salesPoint.name}
                  </td>
                  {row.cells.map((qty, idx) => (
                    <td
                      key={variantColumns[idx]?.id ?? idx}
                      className="px-1.5 py-2 text-right tabular-nums"
                    >
                      {qty.isZero() ? "—" : fmtUnits(qty)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-medium tabular-nums">
                    {row.rowTotal.isZero() ? "—" : fmtUnits(row.rowTotal)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-foreground/25 font-semibold">
                <td className="px-2 py-2">Total kg</td>
                {kgColumnTotals.map((qty, idx) => (
                  <td
                    key={variantColumns[idx]?.id ?? idx}
                    className="px-1.5 py-2 text-right tabular-nums"
                  >
                    {qty.isZero() ? "—" : fmtUnits(qty)}
                  </td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums">
                  {kgGrandTotal.isZero() ? "—" : fmtUnits(kgGrandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs opacity-70 print:hidden">
        The report reconstructs BPO stock up to the selected date from direct
        BPO receipts, validated consignments, Bota outbound movements, and
        validated BPO sales.
      </p>

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
