import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";
import { buildReportUrl } from "@/lib/build-report-url";
import { StockVsCommitmentsDetailTables } from "../StockVsCommitmentsDetailTables";
import { StockVsCommitmentsSummaryCards } from "../StockVsCommitmentsSummaryCards";
import {
  loadStockVsCommitmentsReport,
  STOCK_VS_COMMITMENTS_CONDITION_LABELS,
} from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockVsCommitmentsPrintPage(props: {
  searchParams: Promise<{
    productId?: string;
    salesPointId?: string;
    condition?: string;
  }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const data = await loadStockVsCommitmentsReport(session, searchParams);
  const backHref = buildReportUrl("/reports/stock-vs-commitments", {
    productId: searchParams.productId,
    salesPointId: searchParams.salesPointId,
    condition: searchParams.condition,
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
        <ReportHeader companyName="Stock" title="Stock vs commitments" />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
      </div>
    );
  }

  const filterParts: string[] = ["Live stock"];
  if (data.selectedProductId) {
    const p = data.productOptions.find((o) => o.value === data.selectedProductId);
    filterParts.push(`Product: ${p?.label ?? data.selectedProductId}`);
  }
  if (!data.scopedToSalesPoint && data.selectedSalesPointId) {
    const sp = data.salesPointOptions.find(
      (o) => o.value === data.selectedSalesPointId,
    );
    filterParts.push(`Sales point: ${sp?.label ?? data.selectedSalesPointId}`);
  }
  if (data.selectedCondition !== "all") {
    filterParts.push(STOCK_VS_COMMITMENTS_CONDITION_LABELS[data.selectedCondition]);
  }

  const showSalesPointColumn =
    !data.scopedToSalesPoint && !data.selectedSalesPointId;

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
        title="Stock vs commitments"
      />

      <p className="text-xs opacity-80">
        {data.scopedToSalesPoint && data.assignedSalesPointName
          ? `Scoped to ${data.assignedSalesPointName}.`
          : "All sales points (consolidated)."}{" "}
        {filterParts.join(" · ")}. {data.commitmentOrderCount} DO
        {data.commitmentOrderCount === 1 ? "" : "s"} with outstanding commitment.
      </p>

      <StockVsCommitmentsSummaryCards
        scopeLabel={data.scopeLabel}
        overallStockKg={data.overallStockKg}
        overallCommitmentKg={data.overallCommitmentKg}
        uncommittedKg={data.uncommittedKg}
        print
      />

      <StockVsCommitmentsDetailTables
        scopedToSalesPoint={data.scopedToSalesPoint}
        showSalesPointColumn={showSalesPointColumn}
        stockByLocation={data.stockByLocation}
        commitmentByCustomer={data.commitmentByCustomer}
        print
      />

      <ReportSignatory />
      <AutoPrint closeOnFinish={false} />
    </div>
  );
}
