import "dotenv/config";
import {
  CustomerType,
  PaymentMethod,
  Prisma,
  PrismaClient,
  TaxRateVariant,
  TaxRegimeKind,
  ValidationStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";

const SEED_REF_PREFIX = "SEED-DEMO";

type ResolvedTax = {
  taxTypeId: string;
  code: string;
  label: string;
  rate: Prisma.Decimal;
};

function d(value: number | string) {
  return new Prisma.Decimal(value);
}

function money2(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function pad(num: number, len: number) {
  return String(num).padStart(len, "0");
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function allocateInvoiceNo(
  prisma: PrismaClient,
  commercialServiceId: string,
  soldAt: Date,
): Promise<string> {
  const year = soldAt.getFullYear();
  const cs = await prisma.commercialService.findUniqueOrThrow({
    where: { id: commercialServiceId },
    select: { invoicePrefix: true },
  });
  const seq = await prisma.commercialInvoiceSequence.upsert({
    where: {
      commercialServiceId_calendarYear: { commercialServiceId, calendarYear: year },
    },
    create: { commercialServiceId, calendarYear: year, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  return `${cs.invoicePrefix}-${year}-${pad(seq.nextNumber - 1, 6)}`;
}

async function resolveTaxesForCustomer(
  prisma: PrismaClient,
  customerId: string,
  soldAt: Date,
): Promise<{ ok: true; taxes: ResolvedTax[] } | { ok: false; error: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      residency: true,
      customerType: true,
      hasTaxpayerId: true,
      taxRegimeId: true,
      taxRegime: { select: { kind: true } },
    },
  });
  if (!customer?.taxRegimeId || !customer.taxRegime) {
    return { ok: false, error: "Customer has no tax regime." };
  }

  const day = iso(soldAt);
  const asOfStartUtc = new Date(`${day}T00:00:00.000Z`);
  const links = await prisma.taxRegimeTax.findMany({
    where: { taxRegimeId: customer.taxRegimeId },
    include: { taxType: { select: { id: true, code: true, name: true, sortOrder: true } } },
  });

  const ordered = [...links].sort((a, b) => {
    const so = a.taxType.sortOrder - b.taxType.sortOrder;
    if (so !== 0) return so;
    return a.taxType.code.localeCompare(b.taxType.code);
  });

  const taxes: ResolvedTax[] = [];
  for (const link of ordered) {
    if (link.taxType.code === VAT_TAX_CODE && customer.residency !== "LOCAL") continue;

    if (link.taxType.code === SALES_TAX_CODE) {
      if (customer.residency !== "LOCAL") continue;
      if (customer.customerType === CustomerType.INDUSTRY) continue;

      const variant = !customer.hasTaxpayerId
        ? TaxRateVariant.NO_TAXPAYER_ID
        : customer.taxRegime.kind === TaxRegimeKind.REAL
          ? TaxRateVariant.REAL
          : TaxRateVariant.SIMPLIFIED;

      const row = await prisma.taxRateSchedule.findFirst({
        where: {
          taxTypeId: link.taxType.id,
          variant,
          effectiveFrom: { lte: asOfStartUtc },
        },
        orderBy: { effectiveFrom: "desc" },
      });
      if (!row) {
        return { ok: false, error: `Missing ${SALES_TAX_CODE}(${variant}) on ${day}` };
      }
      taxes.push({
        taxTypeId: link.taxType.id,
        code: link.taxType.code,
        label: link.taxType.name,
        rate: row.rate,
      });
      continue;
    }

    const row = await prisma.taxRateSchedule.findFirst({
      where: {
        taxTypeId: link.taxType.id,
        variant: TaxRateVariant.DEFAULT,
        effectiveFrom: { lte: asOfStartUtc },
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!row) {
      return { ok: false, error: `Missing ${link.taxType.code} on ${day}` };
    }
    taxes.push({
      taxTypeId: link.taxType.id,
      code: link.taxType.code,
      label: link.taxType.name,
      rate: row.rate,
    });
  }

  return { ok: true, taxes };
}

const DEMO_CUSTOMERS: Array<{
  customerType: CustomerType;
  name: string;
  refKey: string;
  qtyKg: number;
  unitPrice: number;
  status: ValidationStatus;
  vehicleNumber: string;
}> = [
  {
    customerType: CustomerType.INDUSTRY,
    name: "[DEMO] Industry Customer",
    refKey: "INDUSTRY",
    qtyKg: 1200,
    unitPrice: 2750,
    status: ValidationStatus.VALIDATED,
    vehicleNumber: "DEMO-IND-01",
  },
  {
    customerType: CustomerType.WHOLE_SALE,
    name: "[DEMO] Wholesale Customer",
    refKey: "WHOLE_SALE",
    qtyKg: 800,
    unitPrice: 2680,
    status: ValidationStatus.VALIDATED,
    vehicleNumber: "DEMO-WHL-01",
  },
  {
    customerType: CustomerType.RETAIL,
    name: "[DEMO] Retail Customer",
    refKey: "RETAIL",
    qtyKg: 350,
    unitPrice: 2850,
    status: ValidationStatus.PENDING,
    vehicleNumber: "DEMO-RTL-01",
  },
  {
    customerType: CustomerType.WORKER,
    name: "[DEMO] Worker Customer",
    refKey: "WORKER",
    qtyKg: 200,
    unitPrice: 2600,
    status: ValidationStatus.PENDING,
    vehicleNumber: "DEMO-WRK-01",
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const service = await prisma.commercialService.findFirst({
      where: { isActive: true, siteKind: "SALES_POINT" },
      select: { id: true, name: true, phone: true, address: true },
    });
    if (!service) throw new Error("No active palm-oil commercial service found.");

    const openFy = await prisma.financialYearPeriod.findFirst({
      where: { status: "OPEN" },
      orderBy: { financialYear: "desc" },
    });
    if (!openFy) throw new Error("No open financial year. Open one under Financial years first.");

    const creator = await prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { username: "asc" },
      select: { id: true, username: true },
    });
    if (!creator) throw new Error("No active user found.");

    const validator = await prisma.user.findFirst({
      where: { isActive: true, role: { in: ["SUPERVISOR", "ADMIN", "DIRECTOR"] } },
      select: { id: true },
    });

    const salesPoint = await prisma.salesPoint.findFirst({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    if (!salesPoint) throw new Error("No sales point found.");

    const storageLocation = await prisma.storageLocation.findFirst({
      where: { salesPointId: salesPoint.id, isDefault: true },
      select: { id: true, name: true },
    });
    if (!storageLocation) throw new Error(`No default storage location at ${salesPoint.name}.`);

    const product = await prisma.product.findFirst({
      where: {
        productCat: { isBottled: false },
        OR: [{ commercialServiceId: service.id }, { commercialServiceId: null }],
      },
      orderBy: { productName: "asc" },
      select: { productId: true, productName: true },
    });
    if (!product) throw new Error("No non-bottled product found.");

    const templateCustomer = await prisma.customer.findFirst({
      where: { commercialServiceId: service.id, taxRegimeId: { not: null } },
      select: { taxRegimeId: true },
    });
    if (!templateCustomer?.taxRegimeId) {
      throw new Error("No customer with a tax regime to copy for demo customers.");
    }

    const soldAt = new Date("2026-05-15T12:00:00.000Z");
    const financialYear = openFy.financialYear;
    const financialMonth = 5;
    const postingCalendarYear = 2026;

    const existing = await prisma.sale.findMany({
      where: { referenceNumber: { startsWith: SEED_REF_PREFIX } },
      select: { referenceNumber: true, invoiceNo: true },
    });
    const existingRefs = new Set(existing.map((s) => s.referenceNumber));

    console.log(`Seeding demo sales for FY ${financialYear}, month ${financialMonth}…`);
    console.log(`Sales point: ${salesPoint.name} · Product: ${product.productName}`);

    for (const demo of DEMO_CUSTOMERS) {
      const referenceNumber = `${SEED_REF_PREFIX}-${demo.refKey}`;
      if (existingRefs.has(referenceNumber)) {
        const row = existing.find((s) => s.referenceNumber === referenceNumber);
        console.log(`  skip ${demo.refKey}: already seeded as ${row?.invoiceNo ?? referenceNumber}`);
        continue;
      }

      let customer = await prisma.customer.findFirst({
        where: {
          commercialServiceId: service.id,
          customerType: demo.customerType,
          name: demo.name,
        },
        select: { id: true, name: true, taxRegimeId: true },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            commercialServiceId: service.id,
            name: demo.name,
            customerType: demo.customerType,
            residency: "LOCAL",
            taxRegimeId: templateCustomer.taxRegimeId,
            hasTaxpayerId: demo.customerType === CustomerType.INDUSTRY,
          },
          select: { id: true, name: true, taxRegimeId: true },
        });
        console.log(`  created customer: ${customer.name} (${demo.customerType})`);
      }

      const taxesResolved = await resolveTaxesForCustomer(prisma, customer.id, soldAt);
      if (!taxesResolved.ok) {
        throw new Error(`${demo.refKey}: ${taxesResolved.error}`);
      }

      const qtyKg = d(demo.qtyKg);
      const unitPrice = d(demo.unitPrice);
      const net = money2(qtyKg.mul(unitPrice));

      const appliedTaxCreates = taxesResolved.taxes.map((t) => ({
        taxTypeId: t.taxTypeId,
        codeSnapshot: t.code,
        labelSnapshot: t.label,
        rateSnapshot: t.rate,
        amount: money2(net.mul(t.rate)),
      }));

      const totalTax = appliedTaxCreates.reduce((acc, row) => acc.add(row.amount), d(0));
      const vatAmount = appliedTaxCreates
        .filter((r) => r.codeSnapshot === VAT_TAX_CODE)
        .reduce((acc, r) => acc.add(r.amount), d(0));
      const vatRateSnapshot =
        taxesResolved.taxes.find((t) => t.code === VAT_TAX_CODE)?.rate ?? d(0);
      const gross = money2(net.add(totalTax));
      const lineVat = totalTax;
      const lineGross = gross;

      const invoiceNo = await allocateInvoiceNo(prisma, service.id, soldAt);
      const now = new Date();
      const isValidated = demo.status === ValidationStatus.VALIDATED;

      const sale = await prisma.sale.create({
        data: {
          invoiceNo,
          soldAt,
          dateIssued: soldAt,
          referenceNumber,
          customerId: customer.id,
          createdByUserId: creator.id,
          salesPointId: salesPoint.id,
          vehicleNumber: demo.vehicleNumber,
          status: demo.status,
          validatedAt: isValidated ? now : null,
          validatedByUserId: isValidated && validator ? validator.id : null,
          customerNameSnapshot: customer.name,
          taxRegimeId: customer.taxRegimeId,
          vatRateSnapshot,
          netAmount: net,
          vatAmount,
          grossAmount: gross,
          financialYear,
          financialMonth,
          postingCalendarYear,
          commercialServiceId: service.id,
          issuerPhoneSnapshot: service.phone,
          issuerAddressSnapshot: service.address,
          commercialServiceNameSnapshot: service.name,
          appliedTaxes: { create: appliedTaxCreates },
          lines: {
            create: [
              {
                productId: product.productId,
                storageLocationId: storageLocation.id,
                qtyKg,
                unitPricePerKg: unitPrice,
                lineNet: net,
                lineVat,
                lineGross,
              },
            ],
          },
          payments: {
            create: [
              {
                method: PaymentMethod.CASH,
                amount: gross,
                paidAt: soldAt,
              },
            ],
          },
        },
        select: { id: true, invoiceNo: true, grossAmount: true },
      });

      const taxSummary = appliedTaxCreates
        .map((t) => `${t.codeSnapshot} ${money2(t.rateSnapshot.mul(100)).toString()}%`)
        .join(", ");

      console.log(
        `  created ${demo.customerType}: ${sale.invoiceNo} · ${customer.name} · ${demo.qtyKg} kg · gross ${sale.grossAmount.toString()} XAF · ${demo.status} · taxes: ${taxSummary || "none"}`,
      );
    }

    console.log("\nDone. Open /pos/list (current financial month) to review the demo invoices.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
