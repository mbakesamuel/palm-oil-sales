import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Bump when a migration changes the DB shape so dev hot-reload drops a stale Prisma singleton. */
const PRISMA_CLIENT_CACHE_KEY = "20260525060000_add_stock_management";

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

function createPrismaClient() {
  const connectionString =
    process.env.NODE_ENV === "production"
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL;
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

/** Product.form replaced isBottledPalmOil/stockTracking — stale clients still query dropped columns. */
function clientMatchesCurrentProductModel(): boolean {
  const product = Prisma.dmmf.datamodel.models.find((m) => m.name === "Product");
  if (!product) return false;
  const names = new Set(product.fields.map((f) => f.name));
  return (
    names.has("form") &&
    !names.has("isBottledPalmOil") &&
    !names.has("stockTracking") &&
    !names.has("variants")
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
      "Prisma Client is out of date (Product.form). Run: npx prisma generate, then restart the dev server.",
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
