import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
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
}

/** Detects a dev-global PrismaClient from before `prisma generate` added newer models. */
function clientHasFinancialYearPeriod(client: PrismaClient): boolean {
  return (
    "financialYearPeriod" in client &&
    typeof (client as unknown as { financialYearPeriod?: { findFirst?: unknown } })
      .financialYearPeriod?.findFirst === "function"
  );
}

export function getPrismaClient() {
  // Lazy init so `next build` can run without DATABASE_URL.
  if (globalForPrisma.prisma) {
    if (clientHasFinancialYearPeriod(globalForPrisma.prisma)) {
      return globalForPrisma.prisma;
    }
    // Stale cached client — drop so the next line creates a fresh one from the current generator.
    globalForPrisma.prisma = undefined;
  }
  const client = createPrismaClient();
  if (!clientHasFinancialYearPeriod(client)) {
    throw new Error(
      "Prisma Client is out of date (missing FinancialYearPeriod). Run: npx prisma generate",
    );
  }
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}
