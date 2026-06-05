import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import { getPermissionsForSession } from "@/lib/access-control";
import { customerWhereForScope, resolveServiceScope } from "@/lib/service-scope";
import { listPaymentMethodDefinitions } from "@/lib/payment-methods/catalog";
import { loadPosPageConfig } from "@/lib/pos/load-pos-page-config";
import {
  createSale,
  deleteSale,
  listAvailableDeliveryOrdersForSale,
  listPendingSales,
  loadSaleByInvoiceNo,
  lookupDeliveryOrderForSale,
  previewPosLineStock,
  previewPosTaxes,
  validateSale,
} from "./actions";
import { previewBottledUnitPrice, previewProductUnitPrice } from "@/lib/pricing/preview-action";
import { SalesClient } from "./SalesClient";
import { ReportHeader } from "@/components/ReportHeader";
import Link from "next/link";
import { canPickPendingPosSales, effectiveSessionRole } from "@/lib/auth-roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PosPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const settings = await getOrInitCompanySettings();
  const prisma = getPrismaClient();
  const session = await getServerSession();
  const sp = (await props.searchParams) ?? {};
  const lookupNoRaw = Array.isArray(sp.no) ? sp.no[0] : sp.no;
  const initialLookupNo = typeof lookupNoRaw === "string" ? lookupNoRaw : "";
  const scope = session
    ? resolveServiceScope(session)
    : { mode: "all" as const };
  const canValidateDocuments =
    session != null
      ? (await getPermissionsForSession(session))["ui:validate-documents"]
      : false;
  const workflowRole = session != null ? effectiveSessionRole(session) : null;
  const canPickPendingSales =
    session != null && workflowRole != null
      ? canPickPendingPosSales({
          validateDocuments: canValidateDocuments,
          role: workflowRole,
          commercialServiceRoleCode: session.commercialServiceRole?.code,
        })
      : false;
  const customerWhere = customerWhereForScope(scope) ?? {};

  const [customers, salesPoints, storageLocations, posConfig, paymentMethods] =
    await Promise.all([
    prismaRetry(() =>
      prisma.customer.findMany({
        where: customerWhere,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          taxRegime: { select: { name: true, vatApplies: true } },
          taxRegimeId: true,
        },
        take: 200,
      }),
    ),
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 200,
      }),
    ),
    prismaRetry(() =>
      prisma.storageLocation.findMany({
        orderBy: [{ salesPointId: "asc" }, { name: "asc" }],
        select: { id: true, salesPointId: true, name: true, isDefault: true },
        take: 1000,
      }),
    ),
    session ? loadPosPageConfig(session, scope) : Promise.resolve({
      botaSalesPointId: null,
      bottleOilStoreLocationId: null,
      walkInCustomerId: "",
      looseProducts: [] as Array<{ productId: number; productName: string }>,
      bottledProducts: [] as Array<{ productId: number; productName: string }>,
    }),
    listPaymentMethodDefinitions({
      activeOnly: true,
      kinds: ["SIMPLE", "CHEQUE", "TRAITE"],
    }),
  ]);

  const hasProducts =
    posConfig.looseProducts.length > 0 || posConfig.bottledProducts.length > 0;

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="Sales"
        />
      </div>
      <div className="print:hidden text-2xl font-bold">Sales Invoce</div>

      <p className="text-sm opacity-75">
        Payments: {paymentMethods.map((m) => m.name).join(", ") || "configure methods in Settings"} (no credit sales).
      </p>

      {customers.length === 0 || !hasProducts ? (
        <div className="rounded-lg border border-border p-4 text-sm">
          <div className="font-medium">Setup required</div>
          <ul className="list-disc pl-5 opacity-80 mt-2 space-y-1">
            {customers.length === 0 ? (
              <li>Add at least one customer.</li>
            ) : null}
            {!hasProducts ? <li>Add at least one product.</li> : null}
          </ul>
          <div className="mt-3 flex gap-3">
            <Link className="underline underline-offset-4" href="/customers">
              Customers
            </Link>
            <Link className="underline underline-offset-4" href="/products">
              Products
            </Link>
            <Link className="underline underline-offset-4" href="/setup">
              Setup
            </Link>
          </div>
        </div>
      ) : (
        <SalesClient
          initialLookupNo={initialLookupNo}
          paymentMethods={paymentMethods}
          customers={customers}
          looseProducts={posConfig.looseProducts}
          bottledProducts={posConfig.bottledProducts}
          botaSalesPointId={posConfig.botaSalesPointId}
          bottleOilStoreLocationId={posConfig.bottleOilStoreLocationId}
          walkInCustomerId={posConfig.walkInCustomerId}
          salesPoints={salesPoints}
          storageLocations={storageLocations}
          previewPosTaxesAction={previewPosTaxes}
          previewPosLineStockAction={previewPosLineStock}
          saveSaleAction={createSale}
          loadSaleByInvoiceNo={loadSaleByInvoiceNo}
          lookupDeliveryOrderAction={lookupDeliveryOrderForSale}
          listAvailableDeliveryOrdersAction={listAvailableDeliveryOrdersForSale}
          validateSaleAction={validateSale}
          deleteSaleAction={deleteSale}
          previewProductUnitPriceAction={previewProductUnitPrice}
          previewBottledUnitPriceAction={previewBottledUnitPrice}
          canValidateDocuments={canValidateDocuments}
          canPickPendingSales={canPickPendingSales}
          listPendingSalesAction={listPendingSales}
        />
      )}
    </div>
  );
}
