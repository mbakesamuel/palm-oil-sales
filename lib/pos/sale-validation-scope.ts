import type { UserRole } from "@/lib/domain";

export type SaleValidatorContext = {
  role: UserRole;
  commercialServiceRoleCode?: string | null;
};

export function isSeniorSupervisorValidator(ctx: SaleValidatorContext): boolean {
  if (ctx.role === "SENIOR_SUPERVISOR") return true;
  const c = (ctx.commercialServiceRoleCode ?? "").toLowerCase();
  return c.includes("senior") && c.includes("supervisor") && !c.includes("manager");
}

export function isPlainSupervisorValidator(ctx: SaleValidatorContext): boolean {
  if (ctx.role === "SUPERVISOR") return true;
  const c = (ctx.commercialServiceRoleCode ?? "").toLowerCase();
  return (
    c.includes("supervisor") &&
    !c.includes("senior") &&
    !c.includes("manager")
  );
}

/** Whether this validator role is limited to Bota vs non-Bota sales points. */
export function saleValidatorUsesBotaSplit(ctx: SaleValidatorContext): boolean {
  return (
    isSeniorSupervisorValidator(ctx) || isPlainSupervisorValidator(ctx)
  );
}

/**
 * Returns an error when the actor may not validate this sales point
 * (senior supervisor → all sales at Bota; sales supervisor → all sales at other points).
 */
export function saleValidationScopeError(
  salesPointId: number | null,
  botaSalesPointId: number | null,
  ctx: SaleValidatorContext,
): string | null {
  if (!saleValidatorUsesBotaSplit(ctx)) return null;

  if (salesPointId == null) {
    return "Sales point is missing on this invoice.";
  }

  const atBota =
    botaSalesPointId != null && salesPointId === botaSalesPointId;

  if (isSeniorSupervisorValidator(ctx)) {
    if (botaSalesPointId == null) {
      return "Bota sales point is not configured. Senior supervisors cannot validate sales until it is set up.";
    }
    if (!atBota) {
      return "Senior supervisors validate sales invoices at Bota only. Other sales points are handled by the line sales supervisor.";
    }
    return null;
  }

  if (atBota) {
    return "Sales at Bota are validated by the senior supervisor, not the line sales supervisor.";
  }
  return null;
}

/** Prisma `where.salesPointId` filter for pending-invoice queues. */
export function pendingSalesPointFilter(
  botaSalesPointId: number | null,
  ctx: SaleValidatorContext,
  actorSalesPointId: number | null,
  actorRequiresFixedSite: boolean,
): { salesPointId?: number | { not: number } } {
  if (isSeniorSupervisorValidator(ctx)) {
    if (botaSalesPointId == null) return { salesPointId: -1 };
    return { salesPointId: botaSalesPointId };
  }

  if (isPlainSupervisorValidator(ctx)) {
    if (actorRequiresFixedSite && actorSalesPointId != null) {
      if (botaSalesPointId != null && actorSalesPointId === botaSalesPointId) {
        return { salesPointId: -1 };
      }
      return { salesPointId: actorSalesPointId };
    }
    if (botaSalesPointId != null) {
      return { salesPointId: { not: botaSalesPointId } };
    }
    return {};
  }

  if (actorRequiresFixedSite && actorSalesPointId != null) {
    return { salesPointId: actorSalesPointId };
  }
  return {};
}

export function pendingSalesValidationHint(ctx: SaleValidatorContext): string {
  if (isSeniorSupervisorValidator(ctx)) {
    return "Senior supervisor: validate all pending sales invoices at Bota.";
  }
  if (isPlainSupervisorValidator(ctx)) {
    return "Sales supervisor: validate all pending sales invoices at your sales point (not Bota).";
  }
  return "Open each item to review lines and totals before validating.";
}
