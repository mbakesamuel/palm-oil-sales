import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/auth-server";
import { PrintButton } from "@/components/PrintButton";
import {
  StockTransferVoucher,
  type StockTransferVoucherModel,
} from "@/components/StockTransferVoucher";
import { getOrInitCompanySettings } from "@/lib/settings";
import { loadTransferDetail } from "../../../loaders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockTransferPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!id) notFound();
  const session = await getServerSession();
  if (!session) redirect("/login");

  const [detail, settings] = await Promise.all([
    loadTransferDetail(id),
    getOrInitCompanySettings(),
  ]);
  if (!detail) notFound();

  const transfer: StockTransferVoucherModel = {
    transferNo: detail.transferNo,
    status: detail.status,
    fromSalesPointName: detail.fromSalesPointName,
    toSalesPointName: detail.toSalesPointName,
    dispatchedAtIso: detail.dispatchedAtIso,
    receivedAtIso: detail.receivedAtIso,
    notes: detail.notes,
    createdByName: detail.createdByName,
    createdAtIso: detail.createdAtIso,
    dispatchedByName: detail.dispatchedByName,
    receivedByName: detail.receivedByName,
    lines: detail.lines.map((l, idx) => ({
      lineNo: idx + 1,
      productName: l.productName,
      fromStorageLocationName: l.fromStorageLocationName,
      toStorageLocationName: l.toStorageLocationName,
      uom: l.uom,
      qty: l.qty,
    })),
  };

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg">
      <div className="print:hidden flex items-center justify-between gap-3">
        <Link
          href="/stock?tab=transfers"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          Back to stock
        </Link>
        <PrintButton label="Print voucher" />
      </div>

      <StockTransferVoucher
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoSrc={settings.logoUrl ?? null}
        transfer={transfer}
      />
    </div>
  );
}
