import "server-only";

import { FinancialYearStatus } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";

/** Same tuning as company settings — Neon cold start / pooler blips. */
const OPEN_FY_DB_RETRY = { retries: 5, baseDelayMs: 400 } as const;
import {
  assertIsoDateWithinWorkingCalendarMonth,
  isCalendarMonthFullyInsideFy,
  prismaDateToIso,
  type IsoDate,
} from "@/lib/posting-calendar";

export type OpenFinancialYearForPosting = {
  financialYear: number;
  startDate: Date;
  endDate: Date;
};

export async function getOpenFinancialYearPeriod() {
  const prisma = getPrismaClient();
  return prismaRetry(
    () =>
      prisma.financialYearPeriod.findFirst({
        where: { status: FinancialYearStatus.OPEN },
        orderBy: { financialYear: "desc" },
      }),
    OPEN_FY_DB_RETRY,
  );
}

export function toOpenFinancialYearForPosting(row: {
  financialYear: number;
  startDate: Date;
  endDate: Date;
}): OpenFinancialYearForPosting {
  return {
    financialYear: row.financialYear,
    startDate: row.startDate,
    endDate: row.endDate,
  };
}

export function assertPostingPeriod(
  open: OpenFinancialYearForPosting | null,
  postingFY: number,
  postingCalendarYear: number,
  postingCalendarMonth: number,
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
  if (
    !Number.isFinite(postingCalendarYear) ||
    !Number.isFinite(postingCalendarMonth) ||
    postingCalendarMonth < 1 ||
    postingCalendarMonth > 12
  ) {
    throw new Error("Working calendar month is invalid.");
  }
  const fyStart = prismaDateToIso(open.startDate);
  const fyEnd = prismaDateToIso(open.endDate);
  if (!isCalendarMonthFullyInsideFy(postingCalendarYear, postingCalendarMonth, fyStart, fyEnd)) {
    throw new Error(
      "The working calendar month must lie fully inside the open financial year dates.",
    );
  }
}

export function assertTransactionDateInWorkingMonth(
  open: OpenFinancialYearForPosting,
  transactionDate: Date,
  postingCalendarYear: number,
  postingCalendarMonth: number,
): void {
  const fyStart = prismaDateToIso(open.startDate);
  const fyEnd = prismaDateToIso(open.endDate);
  const docIso = prismaDateToIso(transactionDate) as IsoDate;
  assertIsoDateWithinWorkingCalendarMonth(
    docIso,
    fyStart,
    fyEnd,
    postingCalendarYear,
    postingCalendarMonth,
  );
}
