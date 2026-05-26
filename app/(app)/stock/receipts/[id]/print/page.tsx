import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/auth-server";
import { PrintButton } from "@/components/PrintButton";
import {
  StockReceiptVoucher,
  type StockReceiptVoucherModel,
} from "@/components/StockReceiptVoucher";
import { getOrInitCompanySettings } from "@/lib/settings";
import { loadReceiptDetail } from "../../../loaders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockReceiptPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!id) notFound();
  const session = await getServerSession();
  if (!session) redirect("/login");

  const [detail, settings] = await Promise.all([
    loadReceiptDetail(id),
    getOrInitCompanySettings(),
  ]);
  if (!detail) notFound();

  const receipt: StockReceiptVoucherModel = {
    receiptNo: detail.receiptNo,
    status: detail.status,
    salesPointName: detail.salesPointName,
    receivedAtIso: detail.receivedAtIso,
    supplierLabel: detail.supplierLabel,
    notes: detail.notes,
    createdByName: detail.createdByName,
    createdAtIso: detail.createdAtIso,
    postedByName: detail.postedByName,
    postedAtIso: detail.postedAtIso,
    lines: detail.lines.map((l, idx) => ({
      lineNo: idx + 1,
      productName: l.productName,
      uom: l.uom,
      qty: l.qty,
    })),
  };

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg">
      <div className="print:hidden flex items-center justify-between gap-3">
        <Link
          href="/stock?tab=receipts"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          Back to stock
        </Link>
        <PrintButton label="Print voucher" />
      </div>

      <StockReceiptVoucher
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoSrc={settings.logoUrl ?? null}
        receipt={receipt}
      />
    </div>
  );
}
