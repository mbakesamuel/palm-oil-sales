import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportSignatory } from "@/components/ReportSignatory";
import { buildReportUrl } from "@/lib/build-report-url";
import { getServerSession } from "@/lib/auth-server";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  GrandCustomerSummaryTable,
  ProductCustomerSummaryTable,
} from "../ProductCustomerSummaryTable";
import {
  loadSalesSummaryByCustomer,
  SALES_SUMMARY_INTERVAL_LABELS,
} from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SalesSummaryByCustomerPrintPage(props: {
  searchParams: Promise<{ interval?: string; date?: string; week?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const [data, settings] = await Promise.all([
    loadSalesSummaryByCustomer(session, searchParams),
    getOrInitCompanySettings(),
  ]);

  const backHref = buildReportUrl("/reports/sales-summary-by-customer", {
    interval: data.interval,
    ...(data.interval === "daily" && searchParams.date
      ? { date: searchParams.date }
      : {}),
    ...(data.interval === "weekly" && searchParams.week
      ? { week: searchParams.week }
      : data.interval === "weekly" && data.selectedIsoWeek
        ? { week: data.selectedIsoWeek }
        : {}),
  });

  if (data.scopedToSalesPoint && data.assignedSalesPointId == null) {
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
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department ?? null}
          logoSrc={settings.logoUrl}
          title="Sales summary by customer"
        />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm">
          Your role is tied to a sales point, but no sales point is assigned.
        </div>
        <ReportFooter signatory />
      </div>
    );
  }

  const intervalLabel = SALES_SUMMARY_INTERVAL_LABELS[data.interval];

  return (
    <div
      className="space-y-6 print:text-black"
      data-print-page="sales-summary-by-customer"
    >
      <AutoPrint />
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← Back to report
        </Link>
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoSrc={settings.logoUrl}
        title={`Sales summary by customer (${intervalLabel})`}
      />

      {data.periodLabel ? (
        <p className="text-sm opacity-80 tabular-nums">
          Period: <span className="font-medium">{data.periodLabel}</span>
          {data.scopedToSalesPoint && data.assignedSalesPointName
            ? ` · ${data.assignedSalesPointName}`
            : " · All collection points"}
        </p>
      ) : null}

      {data.products.length === 0 ? (
        <p className="text-sm opacity-75">No validated sales for this period.</p>
      ) : (
        <div className="space-y-5">
          {data.products.map((block) => (
            <ProductCustomerSummaryTable
              key={block.productId}
              block={block}
              customerTypeOptions={data.customerTypeOptions}
              compact
            />
          ))}
          {data.products.length > 1 ? (
            <GrandCustomerSummaryTable
              grandByType={data.grandByType}
              grandTotal={data.grandTotal}
              customerTypeOptions={data.customerTypeOptions}
              grandBudgetVsActual={data.grandBudgetVsActual}
            />
          ) : null}
        </div>
      )}

      <ReportSignatory />
      <ReportFooter signatory />
    </div>
  );
}
