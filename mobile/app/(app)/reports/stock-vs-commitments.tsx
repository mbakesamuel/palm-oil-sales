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
import { fmtKg, formatIsoDate } from "@/utils/format";

type StockVsCommitmentsData = {
  scopeLabel: string;
  overallStockKg: string;
  overallCommitmentKg: string;
  uncommittedKg: string;
  commitmentOrderCount: number;
  stockByLocation: Array<{
    salesPointName: string;
    storageLocationName: string;
    qtyKg: string;
  }>;
  commitmentByCustomer: Array<{
    salesPointName: string;
    customerName: string;
    qtyKg: string;
  }>;
  scopedToSalesPoint: boolean;
  selectedSalesPointId: string;
};

export default function StockVsCommitmentsScreen() {
  const { data, error, loading, refreshing, refresh } =
    useReportLoad<StockVsCommitmentsData>(
      "/api/mobile/v1/reports/stock-vs-commitments",
    );

  if (loading && !data && !error) return <ReportLoader />;

  const showSalesPoint =
    !data?.scopedToSalesPoint && !data?.selectedSalesPointId;

  return (
    <ReportScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        <>
          <MetaText>Summary — {data.scopeLabel}</MetaText>
          <SummaryCard label="Overall stock" value={fmtKg(data.overallStockKg)} />
          <SummaryCard
            label="Overall commitment"
            value={fmtKg(data.overallCommitmentKg)}
          />
          <SummaryCard
            label="Uncommitted balance"
            value={fmtKg(data.uncommittedKg)}
            highlight={Number(data.uncommittedKg) < 0}
          />
          <MetaText>
            {data.commitmentOrderCount} DO(s) with outstanding commitment
          </MetaText>

          <SectionTitle>Stock by storage location</SectionTitle>
          <DataTable
            columns={[
              ...(showSalesPoint
                ? [{ key: "salesPoint", label: "Sales point" }]
                : []),
              { key: "location", label: "Location" },
              { key: "qty", label: "Qty", align: "right" as const },
            ]}
            rows={data.stockByLocation.map((r) => ({
              ...(showSalesPoint ? { salesPoint: r.salesPointName } : {}),
              location: r.storageLocationName,
              qty: fmtKg(r.qtyKg),
            }))}
            emptyMessage="No stock balances in scope."
          />

          <SectionTitle>Commitment by customer</SectionTitle>
          <DataTable
            columns={[
              ...(showSalesPoint
                ? [{ key: "salesPoint", label: "Sales point" }]
                : []),
              { key: "customer", label: "Customer" },
              { key: "qty", label: "Qty", align: "right" as const },
            ]}
            rows={data.commitmentByCustomer.map((r) => ({
              ...(showSalesPoint ? { salesPoint: r.salesPointName } : {}),
              customer: r.customerName,
              qty: fmtKg(r.qtyKg),
            }))}
            emptyMessage="No outstanding commitments in scope."
          />
        </>
      ) : null}
    </ReportScroll>
  );
}
