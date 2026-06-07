import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import {
  customerWhereForScope,
  resolveServiceScope,
  taxRegimeWhereForCommercialLine,
} from "@/lib/service-scope";
import { getEffectiveRatesSummary, decimalToPercentLabel } from "@/lib/tax/schedules";
import { listCustomerTypeDefinitions } from "@/lib/customer-types/catalog";
import { CustomersClient } from "./CustomersClient";
import { deleteCustomer, saveCustomer } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CustomersPage() {
  const prisma = getPrismaClient();
  const session = await getServerSession();
  const scope = session ? resolveServiceScope(session) : { mode: "all" as const };

  const customerWhere = customerWhereForScope(scope) ?? {};
  const regimeWhere =
    scope.mode === "single"
      ? taxRegimeWhereForCommercialLine(scope.commercialServiceId)
      : undefined;

  const [commercialServices, taxRegimes, customers, rateSummary, customerTypeOptions] =
    await Promise.all([
    prisma.commercialService.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    prisma.taxRegime.findMany({
      where: regimeWhere,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        kind: true,
        vatApplies: true,
        commercialServiceId: true,
      },
    }),
    prisma.customer.findMany({
      where: customerWhere,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        customerTypeId: true,
        customerTypeDefinition: { select: { id: true, code: true, name: true } },
        residency: true,
        taxpayerId: true,
        commercialServiceId: true,
        commercialService: { select: { id: true, name: true } },
        taxRegime: { select: { id: true, name: true, vatApplies: true } },
        createdAt: true,
      },
      take: 200,
    }),
    getEffectiveRatesSummary(),
    listCustomerTypeDefinitions({ activeOnly: true }),
  ]);

  const vatPct = decimalToPercentLabel(rateSummary.vatRate);
  const satRealPct = decimalToPercentLabel(rateSummary.satRates.REAL ?? null);
  const satSimplifiedPct = decimalToPercentLabel(rateSummary.satRates.SIMPLIFIED ?? null);
  const satNoTpnPct = decimalToPercentLabel(rateSummary.satRates.NO_TAXPAYER_ID ?? null);

  const defaultLineId =
    scope.mode === "single"
      ? scope.commercialServiceId
      : commercialServices[0]?.id ?? "";

  return (
    <CustomersClient
      scopeMode={scope.mode}
      defaultCommercialServiceId={defaultLineId}
      commercialServices={commercialServices}
      taxRegimes={taxRegimes}
      customerTypeOptions={customerTypeOptions}
      rateHints={{
        vatPct,
        satRealPct,
        satSimplifiedPct,
        satNoTpnPct,
      }}
      customers={customers.map((c) => ({
        ...c,
        createdAtIso: c.createdAt.toISOString(),
      }))}
      saveCustomerAction={saveCustomer}
      deleteCustomerAction={deleteCustomer}
    />
  );
}
