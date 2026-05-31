import {
  ErrorBanner,
  ListCard,
  MetaText,
  ReportLoader,
  ReportScroll,
  SectionTitle,
  SummaryCard,
} from "@/components/report-ui";
import { useReportLoad } from "@/hooks/useReportLoad";
import { fmtKg, formatIsoDate } from "@/utils/format";

type DailySalesData = {
  dateFromIso: string | null;
  dateToIso: string | null;
  dateInvalid: boolean;
  rangeInvalid: boolean;
  hasOpenFy: boolean;
  grandQty: string;
  rowCount?: number;
  scopedToSalesPoint: boolean;
  assignedSalesPointName: string | null;
  totalsByType: Record<string, string>;
  rows: Array<{
    invoiceNo: string;
    soldAt: string;
    customerNameSnapshot: string;
    customerType: string;
    qtyKg: string;
    deliveryOrderNo: string | null;
  }>;
};

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  INDUSTRY: "Industry",
  WHOLE_SALE: "Whole sale",
  RETAIL: "Retail",
  WORKER: "Worker",
};

export default function DailySalesSummaryScreen() {
  const { data, error, loading, refreshing, refresh } =
    useReportLoad<DailySalesData>("/api/mobile/v1/reports/daily-sales-summary");

  if (loading && !data && !error) return <ReportLoader />;

  const dateLabel =
    data?.dateFromIso && data.dateToIso
      ? data.dateFromIso === data.dateToIso
        ? formatIsoDate(data.dateFromIso)
        : `${formatIsoDate(data.dateFromIso)} – ${formatIsoDate(data.dateToIso)}`
      : "Working month (default)";

  return (
    <ReportScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        <>
          <MetaText>
            {data.scopedToSalesPoint && data.assignedSalesPointName
              ? `${data.assignedSalesPointName} · `
              : ""}
            {dateLabel}
            {data.dateInvalid || data.rangeInvalid ? " · Invalid date range" : ""}
          </MetaText>

          <SummaryCard label="Total quantity" value={fmtKg(data.grandQty)} />
          <SummaryCard
            label="Validated sales"
            value={`${data.rows.length} invoice${data.rows.length === 1 ? "" : "s"}`}
          />

          {Object.keys(data.totalsByType).length > 0 ? (
            <>
              <SectionTitle>By customer type</SectionTitle>
              {Object.entries(data.totalsByType).map(([type, qty]) => (
                <ListCard
                  key={type}
                  title={CUSTOMER_TYPE_LABELS[type] ?? type}
                  right={fmtKg(qty)}
                />
              ))}
            </>
          ) : null}

          <SectionTitle>Sales lines</SectionTitle>
          {data.rows.length === 0 ? (
            <MetaText>No validated sales for this period.</MetaText>
          ) : (
            data.rows.map((r) => (
              <ListCard
                key={r.invoiceNo}
                title={r.invoiceNo}
                subtitle={r.customerNameSnapshot}
                meta={[
                  CUSTOMER_TYPE_LABELS[r.customerType] ?? r.customerType,
                  r.deliveryOrderNo ? `DO ${r.deliveryOrderNo}` : null,
                  formatIsoDate(r.soldAt.slice(0, 10)),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                right={fmtKg(r.qtyKg)}
              />
            ))
          )}
        </>
      ) : null}
    </ReportScroll>
  );
}
