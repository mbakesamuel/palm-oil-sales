import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import { CustomerType } from "@/lib/domain";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function labelCustomerType(ct: string | null) {
  if (!ct) return "—";
  switch (ct) {
    case CustomerType.INDUSTRY:
      return "Industry";
    case CustomerType.WHOLE_SALE:
      return "Wholesale";
    case CustomerType.RETAIL:
      return "Retail";
    case CustomerType.WORKER:
      return "Worker";
    default:
      return ct;
  }
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Row = {
  id: string;
  productId: number;
  productName: string;
  customerType: string | null;
  effectiveFromIso: string;
  unitPriceExTax: string;
};

function pickLatestRows(rows: Row[]): Row[] {
  const bestByKey = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.productId}:${r.customerType ?? ""}`;
    const prev = bestByKey.get(k);
    if (!prev || r.effectiveFromIso > prev.effectiveFromIso) bestByKey.set(k, r);
  }
  return [...bestByKey.values()];
}

function normalizeName(s: string) {
  return s.trim().toLowerCase();
}

function renderTable(rows: Row[], opts?: { includeCustomerType?: boolean }) {
  const includeCustomerType = opts?.includeCustomerType ?? true;
  if (rows.length === 0) return `<p class="muted">No rows.</p>`;
  return `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          ${includeCustomerType ? "<th>Customer type</th>" : ""}
          <th class="right">Unit price (ex tax)</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${esc(r.productName)}</td>
            ${includeCustomerType ? `<td>${esc(labelCustomerType(r.customerType))}</td>` : ""}
            <td class="right mono">${esc(r.unitPriceExTax)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const effectiveFromIso = (url.searchParams.get("effectiveFrom") ?? "").trim(); // optional

  const prisma = getPrismaClient();
  const [openFy, settings] = await Promise.all([
    getOpenFinancialYearPeriod(),
    getOrInitCompanySettings(),
  ]);

  const logoSrc =
    settings.logoUrl && settings.logoUrl.trim() !== ""
      ? settings.logoUrl.trim()
      : "/cdc-logo-svg.svg";

  if (!openFy) {
    const html = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Pricing report</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
          header { border-bottom: 1px solid rgba(0,0,0,0.2); padding-bottom: 10px; margin-bottom: 12px; }
          h1 { font-size: 18px; margin: 0; text-align: center; }
          .muted { opacity: 0.75; font-size: 12px; margin: 6px 0 0; text-align: center; }
        </style>
      </head>
      <body>
        <header>
          <h1>${esc(settings.companyName)}</h1>
          <div class="muted">Pricing report</div>
        </header>
        <p class="muted" style="text-align:left">
          No financial year is open. Open a period under Financial years, then print again.
        </p>
      </body>
    </html>`;
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const schedules = await prismaRetry(() =>
    prisma.productUnitPriceSchedule.findMany({
      where: {
        effectiveFrom: {
          gte: openFy.startDate,
          lte: openFy.endDate,
        },
      },
      orderBy: [{ productId: "asc" }, { effectiveFrom: "desc" }],
      include: { product: { select: { productName: true } } },
    }),
  );

  const all: Row[] = schedules.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.productName,
    customerType: r.customerType,
    effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
    unitPriceExTax: r.unitPriceExTax.toString(),
  }));

  const base =
    effectiveFromIso !== ""
      ? all.filter((r) => r.effectiveFromIso === effectiveFromIso)
      : pickLatestRows(all);

  base.sort((a, b) => {
    if (a.productName !== b.productName) {
      return a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });
    }
    const ca = labelCustomerType(a.customerType);
    const cb = labelCustomerType(b.customerType);
    if (ca !== cb) return ca.localeCompare(cb, undefined, { sensitivity: "base" });
    return b.unitPriceExTax.localeCompare(a.unitPriceExTax);
  });

  const LPO = "loose palm oil";
  const loose = base.filter((r) => normalizeName(r.productName) === LPO);
  const other = base.filter((r) => normalizeName(r.productName) !== LPO);

  const generated = new Date();
  const effectiveLabel = effectiveFromIso !== "" ? effectiveFromIso : "Latest";

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Pricing report</title>
      <style>
        @page { size: A4 portrait; margin: 8mm 10mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
        h1 { font-size: 18px; margin: 0; }
        h2 { font-size: 14px; margin: 18px 0 8px; }
        .muted { opacity: 0.75; font-size: 12px; margin: 6px 0 0; }
        .mono { font-variant-numeric: tabular-nums; }
        header { border-bottom: 1px solid rgba(0,0,0,0.2); padding-bottom: 10px; margin-bottom: 12px; }
        .brand { width: 100%; }
        .brandRow { position: relative; min-height: 32px; display: flex; align-items: center; justify-content: center; }
        .logo { position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: 32px; max-height: 32px; width: auto; max-width: 72px; object-fit: contain; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
        th, td { border: 1px solid rgba(0,0,0,0.2); padding: 6px; vertical-align: top; }
        th { text-align: left; background: rgba(0,0,0,0.03); }
        .right { text-align: right; white-space: nowrap; }
      </style>
    </head>
    <body>
      <header>
        <div class="brand">
          <div class="brandRow">
            <img class="logo" src="${esc(logoSrc)}" alt="" />
            <div class="center">
              <h1>${esc(settings.companyName)}</h1>
            </div>
          </div>
          ${settings.department ? `<div class="muted center">${esc(settings.department)}</div>` : ""}
          <div class="muted center">Pricing report</div>
          <div class="muted mono center">
            Generated ${esc(
              generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
            )} · Effective from <strong>${esc(effectiveLabel)}</strong>
          </div>
          <div class="muted center">
            Financial year <strong>${esc(String(openFy.financialYear))}</strong> (${esc(
              openFy.startDate.toISOString().slice(0, 10),
            )} to ${esc(openFy.endDate.toISOString().slice(0, 10))})
          </div>
        </div>
      </header>

      <h2>Loose Palm Oil</h2>
      ${renderTable(loose, { includeCustomerType: true })}

      <h2>Other products</h2>
      ${renderTable(other, { includeCustomerType: false })}

      <script>
        // Auto-print then close (best-effort; some browsers block close).
        setTimeout(() => { window.print(); }, 50);
        setTimeout(() => { window.close(); }, 500);
      </script>
    </body>
  </html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

