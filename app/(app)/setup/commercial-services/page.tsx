import Link from "next/link";
import { getPrismaClient } from "@/lib/prisma";
import { saveCommercialService } from "@/app/(app)/setup/commercial-services/actions";
import { DEFAULT_COMMERCIAL_SERVICE_CODE } from "@/lib/commercial-service";
import {
  CommercialServicesClient,
  type CommercialServiceRow,
} from "@/app/(app)/setup/commercial-services/CommercialServicesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CommercialServicesSetupPage() {
  const prisma = getPrismaClient();

  const services = await prisma.commercialService.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const rows: CommercialServiceRow[] = services.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    invoicePrefix: s.invoicePrefix,
    phone: s.phone,
    address: s.address,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm opacity-75">
          <Link href="/setup" className="underline underline-offset-4">
            ← Company Parameters
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="text-sm opacity-75 max-w-2xl">
          Each line (e.g. Palm Oil Sales, Rubber Sales) has its own invoice prefix, letterhead phone and
          address, and independent invoice numbering per calendar year. Assign users to a line under{" "}
          <Link href="/users" className="underline underline-offset-4">
            Users
          </Link>
          .
        </p>
      </div>

      <CommercialServicesClient
        services={rows}
        defaultServiceCode={DEFAULT_COMMERCIAL_SERVICE_CODE}
        saveCommercialService={saveCommercialService}
      />
    </div>
  );
}
