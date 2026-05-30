import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";
import { buildReportUrl } from "@/lib/build-report-url";
import { StockInquirySummaryCards } from "../StockInquirySummaryCards";
import { StockInquiryTable } from "../StockInquiryTable";
import {
  formatAsAtLabel,
  loadStockInquiryReport,
  STOCK_INQUIRY_CONDITION_LABELS,
} from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockInquiryPrintPage(props: {
  searchParams: Promise<{
    productId?: string;
    locationId?: string;
    salesPointId?: string;
    condition?: string;
    asAt?: string;
  }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const data = await loadStockInquiryReport(session, searchParams);
  const backHref = buildReportUrl("/reports/stock-inquiry", {
    productId: searchParams.productId,
    locationId: searchParams.locationId,
    salesPointId: searchParams.salesPointId,
    condition: searchParams.condition,
    asAt: searchParams.asAt,
  });

  if ("type" in data) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
          >
            ← Back to report
          </Link>
          <PrintButton label="Print" />
        </div>
        <ReportHeader companyName="Stock" title="Stock inquiry" />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
      </div>
    );
  }

  const filterParts: string[] = [];
  if (data.selectedAsAt && !data.asAtInvalid) {
    filterParts.push(
      `As at ${formatAsAtLabel(data.selectedAsAt)}${data.isLiveStock ? " (live)" : ""}`,
    );
  } else {
    filterParts.push("Live stock");
  }
  if (data.selectedProductId) {
    const p = data.productOptions.find((o) => o.value === data.selectedProductId);
    filterParts.push(`Product: ${p?.label ?? data.selectedProductId}`);
  }
  if (data.scopedToSalesPoint && data.selectedLocationId) {
    const l = data.locationOptions.find((o) => o.value === data.selectedLocationId);
    filterParts.push(`Location: ${l?.label ?? data.selectedLocationId}`);
  }
  if (!data.scopedToSalesPoint && data.selectedSalesPointId) {
    const sp = data.salesPointOptions.find(
      (o) => o.value === data.selectedSalesPointId,
    );
    filterParts.push(`Sales point: ${sp?.label ?? data.selectedSalesPointId}`);
  }
  if (data.selectedCondition !== "all") {
    filterParts.push(STOCK_INQUIRY_CONDITION_LABELS[data.selectedCondition]);
  }

  return (
    <div className="space-y-4 w-full min-w-0 max-w-none">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← Back
        </Link>
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={data.settings.companyName}
        department={data.settings.department ?? null}
        logoSrc={data.settings.logoUrl}
        title="Stock inquiry"
      />

      <p className="text-xs opacity-80">
        {data.scopedToSalesPoint && data.assignedSalesPointName
          ? `Scoped to ${data.assignedSalesPointName}.`
          : "All sales points (consolidated)."}{" "}
        {filterParts.join(" · ")}. {data.rowCount} row
        {data.rowCount === 1 ? "" : "s"}.
      </p>

      <StockInquirySummaryCards
        productSummaries={data.productSummaries}
        conditionSummaries={data.conditionSummaries}
        print
      />

      <StockInquiryTable
        scopedToSalesPoint={data.scopedToSalesPoint}
        sections={data.sections}
        print
      />

      <ReportSignatory />
      <AutoPrint closeOnFinish={false} />
    </div>
  );
}
