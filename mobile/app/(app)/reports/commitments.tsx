import { View } from "react-native";
import {
  ErrorBanner,
  ListCard,
  MetaText,
  ReportLoader,
  ReportScroll,
  SummaryCard,
} from "@/components/report-ui";
import { useReportLoad } from "@/hooks/useReportLoad";
import { fmtKg } from "@/utils/format";

type CommitmentsData = {
  ordersCount: number;
  grandTotal: string;
  scopedToSalesPoint: boolean;
  assignedSalesPointName: string | null;
  products: Array<{
    productId: number;
    productName: string;
    total: string;
    customerIds: string[];
    customerNameById: Record<string, string>;
    rowTotals: Record<string, string>;
  }>;
};

export default function CommitmentsReportScreen() {
  const { data, error, loading, refreshing, refresh } =
    useReportLoad<CommitmentsData>("/api/mobile/v1/reports/commitments");

  if (loading && !data && !error) return <ReportLoader />;

  return (
    <ReportScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        <>
          <MetaText>
            {data.scopedToSalesPoint && data.assignedSalesPointName
              ? `Scoped to ${data.assignedSalesPointName}. `
              : "All sales points. "}
            Outstanding DO qty not yet invoiced (validated DOs only).
          </MetaText>

          <SummaryCard
            label="Grand total commitment"
            value={fmtKg(data.grandTotal)}
            hint={`${data.ordersCount} DO${data.ordersCount === 1 ? "" : "s"} with outstanding balance`}
          />

          {data.products.length === 0 ? (
            <MetaText>No outstanding commitments (all balances are 0).</MetaText>
          ) : (
            data.products.map((product) => {
              const customerIds = product.customerIds.length
                ? product.customerIds
                : Object.keys(product.rowTotals);

              const rows = customerIds
                .map((cid) => ({
                  cid,
                  name:
                    product.customerNameById[cid] ??
                    product.customerNameById[String(cid)] ??
                    cid,
                  qty: product.rowTotals[cid] ?? product.rowTotals[String(cid)],
                }))
                .filter((c) => c.qty && Number(c.qty) !== 0)
                .sort((a, b) => a.name.localeCompare(b.name));

              return (
                <View key={product.productId} style={{ gap: 8 }}>
                  <SummaryCard
                    label={product.productName}
                    value={fmtKg(product.total)}
                    hint={`${rows.length} customer${rows.length === 1 ? "" : "s"} with balance`}
                  />
                  {rows.map((c) => (
                    <ListCard
                      key={`${product.productId}-${c.cid}`}
                      title={c.name}
                      subtitle={product.productName}
                      right={fmtKg(c.qty)}
                    />
                  ))}
                </View>
              );
            })
          )}
        </>
      ) : null}
    </ReportScroll>
  );
}
