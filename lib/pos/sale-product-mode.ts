import type { PosSaleProductMode, Prisma } from "@prisma/client";
import { productWhereBottled, productWhereNotBottled } from "@/lib/product-form";

export type SaleProductMode = PosSaleProductMode;

export const BOTA_SALES_POINT_NAME = "Bota";
export const BOTTLE_OIL_STORE_LOCATION_NAME = "Bottle Oil Store";
export const WALK_IN_CUSTOMER_NAME = "Walk-in (POS)";
export const BOTTLE_VEHICLE_PLACEHOLDER = "-";

export type PrismaDb = {
  salesPoint: {
    findFirst: (args: {
      where: { id?: number; name?: { equals: string; mode: "insensitive" } };
      select: { id: true; name: true };
    }) => Promise<{ id: number; name: string } | null>;
  };
  storageLocation: {
    findFirst: (args: {
      where: {
        salesPointId: number;
        name: { equals: string; mode: "insensitive" };
      };
      select: { id: true; name: true };
    }) => Promise<{ id: number; name: string } | null>;
  };
  customer: {
    findFirst: (args: {
      where: { name: string; commercialServiceId: string };
      select: { id: true; name: true };
    }) => Promise<{ id: string; name: string } | null>;
    create: (args: {
      data: {
        commercialServiceId: string;
        name: string;
        customerType: "RETAIL";
        hasTaxpayerId: boolean;
      };
      select: { id: true; name: true };
    }) => Promise<{ id: string; name: string }>;
  };
};

export function parseSaleProductMode(raw: string | null | undefined): SaleProductMode {
  const v = String(raw ?? "").trim().toUpperCase();
  return v === "BOTTLE" ? "BOTTLE" : "LOOSE";
}

export function isBottleSaleMode(mode: SaleProductMode): boolean {
  return mode === "BOTTLE";
}

export function isLooseSaleMode(mode: SaleProductMode): boolean {
  return mode === "LOOSE";
}

/** Legacy sales without saleProductMode are treated as loose. */
export function effectiveSaleProductMode(
  stored: PosSaleProductMode | null | undefined,
): SaleProductMode {
  return stored ?? "LOOSE";
}

export function assertSaleModeForSalesPoint(
  mode: SaleProductMode,
  salesPointId: number,
  botaSalesPointId: number | null,
): string | null {
  if (isBottleSaleMode(mode)) {
    if (botaSalesPointId == null) {
      return "Bota sales point is not configured. Bottled palm oil sales cannot be posted.";
    }
    if (salesPointId !== botaSalesPointId) {
      return "Bottled palm oil sales are only allowed at the Bota sales point.";
    }
  }
  return null;
}

export function normalizeSaleModeForSalesPoint(
  mode: SaleProductMode,
  salesPointId: number,
  botaSalesPointId: number | null,
): SaleProductMode {
  if (botaSalesPointId == null || salesPointId !== botaSalesPointId) {
    return "LOOSE";
  }
  return mode;
}

export async function resolveBotaSalesPointId(
  db: PrismaDb,
): Promise<number | null> {
  const envRaw = process.env.BOTA_SALES_POINT_ID?.trim();
  if (envRaw) {
    const id = Number.parseInt(envRaw, 10);
    if (Number.isFinite(id) && id > 0) {
      const row = await db.salesPoint.findFirst({
        where: { id },
        select: { id: true, name: true },
      });
      return row?.id ?? null;
    }
  }
  const row = await db.salesPoint.findFirst({
    where: { name: { equals: BOTA_SALES_POINT_NAME, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  return row?.id ?? null;
}

export async function resolveBottleOilStoreLocationId(
  db: PrismaDb,
  botaSalesPointId: number,
): Promise<number | null> {
  const row = await db.storageLocation.findFirst({
    where: {
      salesPointId: botaSalesPointId,
      name: { equals: BOTTLE_OIL_STORE_LOCATION_NAME, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  return row?.id ?? null;
}

export async function getOrCreateWalkInCustomer(
  db: PrismaDb,
  commercialServiceId: string,
): Promise<{ id: string; name: string }> {
  const existing = await db.customer.findFirst({
    where: { name: WALK_IN_CUSTOMER_NAME, commercialServiceId },
    select: { id: true, name: true },
  });
  if (existing) return existing;
  return db.customer.create({
    data: {
      commercialServiceId,
      name: WALK_IN_CUSTOMER_NAME,
      customerType: "RETAIL",
      hasTaxpayerId: false,
    },
    select: { id: true, name: true },
  });
}

export function productWhereForSaleMode(mode: SaleProductMode): Prisma.ProductWhereInput {
  return isBottleSaleMode(mode) ? productWhereBottled() : productWhereNotBottled();
}
