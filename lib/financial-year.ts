import "server-only";

import { FinancialYearStatus } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";

export async function getOpenFinancialYearPeriod() {
  const prisma = getPrismaClient();
  return prisma.financialYearPeriod.findFirst({
    where: { status: FinancialYearStatus.OPEN },
    orderBy: { financialYear: "desc" },
  });
}

export function assertPostingPeriod(
  open: { financialYear: number } | null,
  postingFY: number,
  postingFM: number,
): void {
  if (!open) {
    throw new Error(
      "No financial year is open. An admin or manager must open a period under Financial years before posting.",
    );
  }
  if (open.financialYear !== postingFY) {
    throw new Error(
      "Your working financial year does not match the open period. Update it under Financial years.",
    );
  }
  if (!Number.isFinite(postingFM) || postingFM < 1 || postingFM > 12) {
    throw new Error("Working financial month must be between 1 and 12.");
  }
}
