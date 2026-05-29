import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Bump when a migration changes the DB shape so dev hot-reload drops a stale Prisma singleton. */
const PRISMA_CLIENT_CACHE_KEY = "20260526120000_drop_product_form_use_category_bottled";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  /** Bumps when `prisma generate` changes model fields so we drop a stale singleton. */
  prismaSchemaTag?: string;
  prismaCacheKey?: string;
};

/** Fingerprint of all model fields from the loaded generated client (invalidates cache after `prisma generate`). */
function prismaDatamodelFieldTag(): string {
  try {
    return Prisma.dmmf.datamodel.models
      .map(
        (m) =>
          `${m.name}:${m.fields
            .map((f) => f.name)
            .sort()
            .join(",")}`,
      )
      .sort()
      .join("|");
  } catch {
    return "";
  }
}

/* function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Create a .env file (or use .env.example) with your Postgres connection string.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
} */

function resolveDatabaseUrl(): string | undefined {
  const dev = process.env.DATABASE_URL?.trim();
  const prod = process.env.DATABASE_URL_PROD?.trim();
  if (process.env.NODE_ENV === "production") {
    return prod || dev;
  }
  return dev || prod;
}

function createPrismaClient() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Create a .env file (or use .env.example) with your Postgres connection string.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Detects a dev-global PrismaClient from before `prisma generate` added newer models. */
function clientHasFinancialYearPeriod(client: PrismaClient): boolean {
  return (
    "financialYearPeriod" in client &&
    typeof (
      client as unknown as { financialYearPeriod?: { findFirst?: unknown } }
    ).financialYearPeriod?.findFirst === "function"
  );
}

function clientHasProductSalesBudgetMonthPhaseProfile(
  client: PrismaClient,
): boolean {
  return (
    "productSalesBudgetMonthPhaseProfile" in client &&
    typeof (
      client as unknown as {
        productSalesBudgetMonthPhaseProfile?: { findUnique?: unknown };
      }
    ).productSalesBudgetMonthPhaseProfile?.findUnique === "function"
  );
}

function clientHasProductSalesBudget(client: PrismaClient): boolean {
  return (
    "productSalesBudget" in client &&
    typeof (
      client as unknown as { productSalesBudget?: { findMany?: unknown } }
    ).productSalesBudget?.findMany === "function"
  );
}

function clientHasProductUnitPriceSchedule(client: PrismaClient): boolean {
  return (
    "productUnitPriceSchedule" in client &&
    typeof (
      client as unknown as { productUnitPriceSchedule?: { findMany?: unknown } }
    ).productUnitPriceSchedule?.findMany === "function"
  );
}

/**
 * Detects whether the loaded Prisma Client matches the current product model.
 * `Product.form` was dropped in `20260526120000_drop_product_form_use_category_bottled`;
 * the bottled-product signal now lives on `ProductCat.isBottled`. Stale dev
 * clients would still try to read the removed column, so we refuse to use them.
 */
function clientMatchesCurrentProductModel(): boolean {
  const product = Prisma.dmmf.datamodel.models.find((m) => m.name === "Product");
  const productCat = Prisma.dmmf.datamodel.models.find(
    (m) => m.name === "ProductCat",
  );
  if (!product || !productCat) return false;
  const productNames = new Set(product.fields.map((f) => f.name));
  const productCatNames = new Set(productCat.fields.map((f) => f.name));
  return (
    !productNames.has("form") &&
    !productNames.has("isBottledPalmOil") &&
    !productNames.has("stockTracking") &&
    !productNames.has("variants") &&
    productCatNames.has("isBottled")
  );
}

export function getPrismaClient() {
  const schemaTag = prismaDatamodelFieldTag();

  // Lazy init so `next build` can run without DATABASE_URL.
  if (globalForPrisma.prisma) {
    const tagMatches = globalForPrisma.prismaSchemaTag === schemaTag;
    const cacheKeyMatches = globalForPrisma.prismaCacheKey === PRISMA_CLIENT_CACHE_KEY;
    if (
      tagMatches &&
      cacheKeyMatches &&
      clientMatchesCurrentProductModel() &&
      clientHasFinancialYearPeriod(globalForPrisma.prisma) &&
      clientHasProductSalesBudgetMonthPhaseProfile(globalForPrisma.prisma) &&
      clientHasProductSalesBudget(globalForPrisma.prisma) &&
      clientHasProductUnitPriceSchedule(globalForPrisma.prisma)
    ) {
      return globalForPrisma.prisma;
    }
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaSchemaTag = undefined;
    globalForPrisma.prismaCacheKey = undefined;
  }
  const client = createPrismaClient();
  if (!clientMatchesCurrentProductModel()) {
    throw new Error(
      "Prisma Client is out of date (Product.form dropped; ProductCat.isBottled added). Run: npx prisma generate, then restart the dev server.",
    );
  }
  if (!clientHasFinancialYearPeriod(client)) {
    throw new Error(
      "Prisma Client is out of date (missing FinancialYearPeriod). Run: npx prisma generate",
    );
  }
  if (!clientHasProductSalesBudgetMonthPhaseProfile(client)) {
    throw new Error(
      "Prisma Client is out of date (missing ProductSalesBudgetMonthPhaseProfile). Run: npx prisma generate",
    );
  }
  if (!clientHasProductSalesBudget(client)) {
    throw new Error(
      "Prisma Client is out of date (missing ProductSalesBudget). Run: npx prisma generate",
    );
  }
  if (!clientHasProductUnitPriceSchedule(client)) {
    throw new Error(
      "Prisma Client is out of date (missing ProductUnitPriceSchedule). Run: npx prisma generate",
    );
  }
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSchemaTag = schemaTag;
    globalForPrisma.prismaCacheKey = PRISMA_CLIENT_CACHE_KEY;
  }
  return client;
}
