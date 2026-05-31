import {
  DataTable,
  ErrorBanner,
  MetaText,
  ReportLoader,
  ReportScroll,
  SectionTitle,
  SummaryCard,
} from "@/components/report-ui";
import { useReportLoad } from "@/hooks/useReportLoad";
import { fmtKg, fmtQtyList, formatIsoDate } from "@/utils/format";

type StockInquiryData = {
  rowCount: number;
  isLiveStock: boolean;
  selectedAsAt: string;
  scopedToSalesPoint: boolean;
  assignedSalesPointName: string | null;
  conditionSummaries: Array<{
    label: string;
    totalsByUom: Array<{ uom: string; qty: string }>;
    lineCount: number;
  }>;
  productSummaries: Array<{
    productName: string;
    uom: string;
    qty: string;
    lineCount: number;
  }>;
  sections: Array<{
    salesPointName: string;
    rows: Array<{
      storageLocationName: string;
      productName: string;
      condition: string;
      qty: string;
      uom: string;
    }>;
  }>;
};

function conditionLabel(c: string): string {
  return c === "UNSELLABLE" ? "Unsellable" : "Sellable";
}

export default function StockInquiryScreen() {
  const { data, error, loading, refreshing, refresh } =
    useReportLoad<StockInquiryData>("/api/mobile/v1/reports/stock-inquiry");

  if (loading && !data && !error) return <ReportLoader />;

  const allRows = data?.sections.flatMap((s) =>
    s.rows.map((r) => ({
      ...r,
      salesPointName: s.salesPointName,
    })),
  ) ?? [];

  const showSalesPoint =
    data && !data.scopedToSalesPoint && data.sections.length > 1;

  return (
    <ReportScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        <>
          <MetaText>
            {data.scopedToSalesPoint && data.assignedSalesPointName
              ? `Scoped to ${data.assignedSalesPointName}. `
              : "All sales points. "}
            {data.isLiveStock
              ? "Live stock"
              : data.selectedAsAt
                ? `As at ${formatIsoDate(data.selectedAsAt)}`
                : "Live stock"}
            {" · "}
            {data.rowCount} row{data.rowCount === 1 ? "" : "s"}
          </MetaText>

          <SectionTitle>By condition</SectionTitle>
          {data.conditionSummaries.map((c) => (
            <SummaryCard
              key={c.label}
              label={c.label}
              value={fmtQtyList(c.totalsByUom)}
              hint={`${c.lineCount} balance${c.lineCount === 1 ? "" : "s"}`}
            />
          ))}

          {data.productSummaries.length > 0 ? (
            <>
              <SectionTitle>By product</SectionTitle>
              {data.productSummaries.map((p) => (
                <SummaryCard
                  key={p.productName}
                  label={p.productName}
                  value={`${Number(p.qty).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${p.uom}`}
                  hint={`${p.lineCount} balance${p.lineCount === 1 ? "" : "s"}`}
                />
              ))}
            </>
          ) : null}

          <SectionTitle>Detail</SectionTitle>
          <DataTable
            columns={[
              ...(showSalesPoint
                ? [{ key: "salesPoint", label: "Sales point" }]
                : []),
              { key: "location", label: "Location" },
              { key: "product", label: "Product" },
              { key: "condition", label: "Cond." },
              { key: "qty", label: "Qty", align: "right" as const },
            ]}
            rows={allRows.map((r) => ({
              ...(showSalesPoint ? { salesPoint: r.salesPointName } : {}),
              location: r.storageLocationName,
              product: r.productName,
              condition: conditionLabel(r.condition),
              qty: `${fmtKg(r.qty).replace(" Kg", "")} ${r.uom}`,
            }))}
            emptyMessage="No stock balances match the current filters."
          />
        </>
      ) : null}
    </ReportScroll>
  );
}
