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
  console.log(payload);
  if (!payload.ok) notFound();

  const { data } = payload;
  return (
    <div className="bg-white text-black -m-4 sm:-m-6 p-4 sm:p-6 rounded-2xl min-h-full space-y-6 print:m-0 print:p-0 print:rounded-none print:min-h-0">
      <div className="print:hidden flex flex-wrap justify-between items-center gap-3">
        <Link
          href="/delivery-orders"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← Back
        </Link>
        <PrintButton />
      </div>

      <DeliveryOrderPrint
        companyName={data.companyName}
        department={data.department}
        logoSrc={data.logoSrc}
        order={data.order}
      />
    </div>
  );
}
