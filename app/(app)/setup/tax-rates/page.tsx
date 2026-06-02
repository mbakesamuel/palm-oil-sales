import { TaxRateVariant } from "@prisma/client";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getPrismaClient } from "@/lib/prisma";
import {
  decimalToPercentLabel,
  findEffectiveRateRow,
  listScheduleRowsForTaxCode,
} from "@/lib/tax/schedules";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";
import { saveSalesTaxRate, saveVatRate } from "./actions";
import { TaxRatesClient } from "./TaxRatesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SALES_VARIANTS = [
  TaxRateVariant.REAL,
  TaxRateVariant.SIMPLIFIED,
  TaxRateVariant.NO_TAXPAYER_ID,
] as const;

export default async function TaxRatesPage() {
  await getOrInitCompanySettings();
  const prisma = getPrismaClient();
  const asOf = new Date();

  const [vatType, satType, vatHistory, satHistoryAll] = await Promise.all([
    prisma.taxType.findUnique({ where: { code: VAT_TAX_CODE }, select: { id: true } }),
    prisma.taxType.findUnique({ where: { code: SALES_TAX_CODE }, select: { id: true } }),
    listScheduleRowsForTaxCode(prisma, VAT_TAX_CODE, TaxRateVariant.DEFAULT),
    listScheduleRowsForTaxCode(prisma, SALES_TAX_CODE),
  ]);

  const vatRow = vatType
    ? await findEffectiveRateRow(prisma, vatType.id, TaxRateVariant.DEFAULT, asOf)
    : null;

  const salesTaxSections = await Promise.all(
    SALES_VARIANTS.map(async (variant) => {
      const row = satType
        ? await findEffectiveRateRow(prisma, satType.id, variant, asOf)
        : null;
      const history = satHistoryAll.filter((r) => r.variant === variant);
      return {
        variant,
        currentRatePercent: decimalToPercentLabel(row?.rate ?? null),
        history,
      };
    }),
  );

  return (
    <TaxRatesClient
      vatCurrentPercent={decimalToPercentLabel(vatRow?.rate ?? null)}
      vatHistory={vatHistory}
      salesTaxSections={salesTaxSections}
      saveVatRateAction={saveVatRate}
      saveSalesTaxRateAction={saveSalesTaxRate}
    />
  );
}
