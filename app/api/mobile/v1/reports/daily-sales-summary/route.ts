import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import {
  fmtKg,
  loadDailySalesSummary,
} from "@/app/(app)/reports/(sales)/daily-sales-summary/loader";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(
    request,
    "route:/reports/daily-sales-summary",
    async ({ session }) => {
      const url = new URL(request.url);
      const data = await loadDailySalesSummary(session, {
        date: url.searchParams.get("date"),
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        year: url.searchParams.get("year"),
        month: url.searchParams.get("month"),
      });

      const z = new Prisma.Decimal(0);
      const totalsByType: Record<string, string> = {};
      for (const opt of data.customerTypeOptions) {
        const qty = data.totalsByType.get(opt.id) ?? z;
        if (!qty.eq(0)) totalsByType[opt.id] = fmtKg(qty);
      }

      return mobileJson({
        dateFromIso: data.dateFromIso,
        dateToIso: data.dateToIso,
        dateInvalid: data.dateInvalid,
        rangeInvalid: data.rangeInvalid,
        hasOpenFy: data.hasOpenFy,
        monthLabel: data.monthFilter?.label ?? null,
        selectedYear: data.monthFilter?.postingCalendarYear ?? null,
        selectedMonth: data.monthFilter?.financialMonth ?? null,
        monthFirstIso: data.monthFirstIso,
        monthLastIso: data.monthLastIso,
        monthInvalid: data.monthInvalid,
        selectableMonths: data.selectableMonths,
        workingMonth: data.workingMonth,
        grandQty: fmtKg(data.grandQty),
        rowCount: data.rows.length,
        scopedToSalesPoint: data.scopedToSalesPoint,
        assignedSalesPointName: data.assignedSalesPointName,
        customerTypeOptions: data.customerTypeOptions,
        totalsByType,
        rows: data.rows.map((r) => ({
          invoiceNo: r.invoiceNo,
          soldAt: r.soldAt.toISOString(),
          customerNameSnapshot: r.customerNameSnapshot,
          customerTypeId: r.customerTypeId,
          customerTypeCode: r.customerTypeCode,
          customerTypeName: r.customerTypeName,
          qtyKg: fmtKg(r.qtyKg),
          deliveryOrderNo: r.deliveryOrderNo,
        })),
      });
    },
  );
}
