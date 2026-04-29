import { getPrismaClient } from "@/lib/prisma";
import { Prisma, ValidationStatus } from "@prisma/client";

function dec(value: string | number) {
  return new Prisma.Decimal(value);
}

export type DeliveryOrderLookupDto = {
  deliveryOrderNo: string;
  dateIssuedIso: string;
  customerId: string;
  customerName: string;
  totalOrderedKg: string;
  totalInvoicedKg: string;
  totalBalanceKg: string;
  perProduct: Array<{
    productId: number;
    productName: string;
    orderedKg: string;
    invoicedKg: string;
    balanceKg: string;
  }>;
};

type ControlMaps = {
  orderedByProduct: Map<number, Prisma.Decimal>;
  invoicedByProduct: Map<number, Prisma.Decimal>;
};

export type DeliveryOrderControlLoaded = DeliveryOrderLookupDto & ControlMaps;

/**
 * Loads delivery order totals, per-product ordered / invoiced / balance, and maps for validation.
 * Invoiced qty excludes REJECTED sales only.
 */
export async function loadDeliveryOrderControl(
  rawNo: string,
): Promise<DeliveryOrderControlLoaded | null> {
  const prisma = getPrismaClient();
  const deliveryOrderNo = String(rawNo ?? "").trim();
  if (!deliveryOrderNo) return null;

  const order = await prisma.deliveryOrder.findUnique({
    where: { deliveryOrderNo },
    include: {
      customer: { select: { id: true, name: true } },
      details: {
        include: {
          product: { select: { productId: true, productName: true } },
        },
      },
    },
  });
  if (!order) return null;

  const orderedByProduct = new Map<number, Prisma.Decimal>();
  const productNameById = new Map<number, string>();
  for (const d of order.details) {
    const q = dec(d.orderQty);
    orderedByProduct.set(
      d.productId,
      (orderedByProduct.get(d.productId) ?? dec(0)).add(q),
    );
    productNameById.set(d.productId, d.product.productName);
  }

  const invoicedRows = await prisma.saleLine.groupBy({
    by: ["productId"],
    where: {
      sale: {
        deliveryOrderNo,
        status: { not: ValidationStatus.REJECTED },
      },
    },
    _sum: { qtyKg: true },
  });

  const invoicedByProduct = new Map<number, Prisma.Decimal>();
  for (const r of invoicedRows) {
    invoicedByProduct.set(r.productId, r._sum.qtyKg ?? dec(0));
  }

  let totalOrdered = dec(0);
  let totalInvoiced = dec(0);
  const perProduct: DeliveryOrderLookupDto["perProduct"] = [];

  for (const [productId, ordered] of orderedByProduct) {
    totalOrdered = totalOrdered.add(ordered);
    const invoiced = invoicedByProduct.get(productId) ?? dec(0);
    totalInvoiced = totalInvoiced.add(invoiced);
    const balance = ordered.sub(invoiced);
    perProduct.push({
      productId,
      productName: productNameById.get(productId) ?? `Product ${productId}`,
      orderedKg: ordered.toString(),
      invoicedKg: invoiced.toString(),
      balanceKg: balance.toString(),
    });
  }

  perProduct.sort((a, b) => a.productId - b.productId);

  const totalBalance = totalOrdered.sub(totalInvoiced);

  return {
    deliveryOrderNo,
    dateIssuedIso: order.dateIssued.toISOString(),
    customerId: order.customerId,
    customerName: order.customer.name,
    totalOrderedKg: totalOrdered.toString(),
    totalInvoicedKg: totalInvoiced.toString(),
    totalBalanceKg: totalBalance.toString(),
    perProduct,
    orderedByProduct,
    invoicedByProduct,
  };
}

export function toDeliveryOrderLookupDto(
  row: DeliveryOrderControlLoaded,
): DeliveryOrderLookupDto {
  const {
    deliveryOrderNo,
    dateIssuedIso,
    customerId,
    customerName,
    totalOrderedKg,
    totalInvoicedKg,
    totalBalanceKg,
    perProduct,
  } = row;
  return {
    deliveryOrderNo,
    dateIssuedIso,
    customerId,
    customerName,
    totalOrderedKg,
    totalInvoicedKg,
    totalBalanceKg,
    perProduct,
  };
}

export async function validateSaleAgainstDeliveryOrder(opts: {
  deliveryOrderNo: string;
  customerId: string;
  lines: Array<{
    productId: number;
    productName: string;
    qtyKg: Prisma.Decimal;
  }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await loadDeliveryOrderControl(opts.deliveryOrderNo);
  if (!ctx) {
    return { ok: false, error: "Delivery order not found." };
  }
  if (ctx.customerId !== opts.customerId) {
    return {
      ok: false,
      error: "The selected customer must match the delivery order customer.",
    };
  }

  const saleQtyByProduct = new Map<number, Prisma.Decimal>();
  const nameByProduct = new Map<number, string>();
  for (const line of opts.lines) {
    saleQtyByProduct.set(
      line.productId,
      (saleQtyByProduct.get(line.productId) ?? dec(0)).add(line.qtyKg),
    );
    nameByProduct.set(line.productId, line.productName);
  }

  for (const [productId, saleQty] of saleQtyByProduct) {
    const ordered = ctx.orderedByProduct.get(productId);
    const label = nameByProduct.get(productId) ?? `Product ${productId}`;
    if (ordered == null || ordered.lte(0)) {
      return {
        ok: false,
        error: `${label} is not listed on delivery order ${ctx.deliveryOrderNo}.`,
      };
    }
    const invoiced = ctx.invoicedByProduct.get(productId) ?? dec(0);
    const balance = ordered.sub(invoiced);
    if (saleQty.gt(balance)) {
      return {
        ok: false,
        error: `Total quantity for ${label} on this invoice (${saleQty.toString()} kg) is above the remaining balance for this delivery order (${balance.toString()} kg).`,
      };
    }
  }

  return { ok: true };
}
