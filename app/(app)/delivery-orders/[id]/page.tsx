import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { DeliveryOrderPrint } from "@/components/DeliveryOrderPrint";
import { loadDeliveryOrderPrintById } from "../actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DeliveryOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await props.params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const session = await getServerSession();
  if (!session) redirect("/login");

  const payload = await loadDeliveryOrderPrintById(id);
  if (!payload.ok) notFound();

  const { data } = payload;
  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center gap-3">
        <Link
          href="/delivery-orders"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← All delivery orders
        </Link>
        <PrintButton />
      </div>

      <DeliveryOrderPrint
        companyName={data.companyName}
        department={data.department}
        companyPhone={data.companyPhone}
        companyAddress={data.companyAddress}
        logoSrc={data.logoSrc}
        order={data.order}
      />
    </div>
  );
}
