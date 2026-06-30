import { useMemo, useState } from "react";
import {
  ErrorBanner,
  ListCard,
  MetaText,
  ReportLoader,
  ReportScroll,
  SectionTitle,
  SummaryCard,
} from "@/components/report-ui";
import { ReportMonthField } from "@/components/ReportMonthField";
import { useReportLoad } from "@/hooks/useReportLoad";
import { fmtKg, formatIsoDate } from "@/utils/format";

type CustomerTypeOption = {
  id: string;
  code: string;
  name: string;
};

type MonthSnapshot = {
  year: number;
  month: number;
  label: string;
};

type DailySalesData = {
  dateFromIso: string | null;
  dateToIso: string | null;
  dateInvalid: boolean;
  rangeInvalid: boolean;
  hasOpenFy: boolean;
  monthLabel: string | null;
  selectedYear: number | null;
  selectedMonth: number | null;
  monthFirstIso: string | null;
  monthLastIso: string | null;
  monthInvalid: boolean;
  selectableMonths: Array<{ year: number; month: number; label: string }>;
  workingMonth: MonthSnapshot | null;
  grandQty: string;
  rowCount?: number;
  scopedToSalesPoint: boolean;
  assignedSalesPointName: string | null;
  customerTypeOptions: CustomerTypeOption[];
  totalsByType: Record<string, string>;
  rows: Array<{
    invoiceNo: string;
    soldAt: string;
    customerNameSnapshot: string;
    customerTypeId: string;
    customerTypeCode: string;
    customerTypeName: string;
    qtyKg: string;
    deliveryOrderNo: string | null;
  }>;
};

function customerTypeLabel(
  options: CustomerTypeOption[],
  id: string,
  fallbackName?: string,
): string {
  return options.find((o) => o.id === id)?.name ?? fallbackName ?? id;
}

function isWorkingMonth(data: DailySalesData): boolean {
  if (!data.workingMonth || data.selectedYear == null || data.selectedMonth == null) {
    return false;
  }
  return (
    data.workingMonth.year === data.selectedYear &&
    data.workingMonth.month === data.selectedMonth
  );
}

export default function DailySalesSummaryScreen() {
  const [monthOverride, setMonthOverride] = useState<{
    year: number;
    month: number;
  } | null>(null);

  const path = useMemo(() => {
    const base = "/api/mobile/v1/reports/daily-sales-summary";
    if (!monthOverride) return base;
    const params = new URLSearchParams({
      year: String(monthOverride.year),
      month: String(monthOverride.month),
    });
    return `${base}?${params.toString()}`;
  }, [monthOverride]);

  const { data, error, loading, refreshing, refresh } =
    useReportLoad<DailySalesData>(path);

  if (loading && !data && !error) return <ReportLoader />;

  const dateLabel =
    data?.dateFromIso && data.dateToIso
      ? data.dateFromIso === data.dateToIso
        ? formatIsoDate(data.dateFromIso)
        : `${formatIsoDate(data.dateFromIso)} – ${formatIsoDate(data.dateToIso)}`
      : null;

  function onMonthChange(year: number, month: number) {
    if (
      data?.workingMonth &&
      data.workingMonth.year === year &&
      data.workingMonth.month === month
    ) {
      setMonthOverride(null);
      return;
    }
    setMonthOverride({ year, month });
  }

  return (
    <ReportScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        <>
          <ReportMonthField
            label="Month"
            year={data.selectedYear}
            month={data.selectedMonth}
            selectableMonths={data.selectableMonths}
            disabled={!data.hasOpenFy || data.selectableMonths.length === 0}
            hint={
              data.monthFirstIso && data.monthLastIso
                ? `Open FY: ${data.selectableMonths[0]?.label ?? ""} – ${data.selectableMonths[data.selectableMonths.length - 1]?.label ?? ""}`
                : undefined
            }
            onChange={onMonthChange}
          />

          {!data.hasOpenFy ? (
            <ErrorBanner message="No financial year is open. Open a year under Financial years to use this report." />
          ) : null}

          {data.monthInvalid ? (
            <ErrorBanner message="Selected month is outside the open financial year." />
          ) : null}

          <MetaText>
            {data.scopedToSalesPoint && data.assignedSalesPointName
              ? `${data.assignedSalesPointName} · `
              : ""}
            {data.monthLabel ?? "No month selected"}
            {isWorkingMonth(data) ? " · Working month" : ""}
            {dateLabel ? ` · ${dateLabel}` : ""}
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
              {Object.entries(data.totalsByType).map(([typeId, qty]) => (
                <ListCard
                  key={typeId}
                  title={customerTypeLabel(data.customerTypeOptions, typeId)}
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
                  r.customerTypeName ||
                    customerTypeLabel(data.customerTypeOptions, r.customerTypeId),
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
