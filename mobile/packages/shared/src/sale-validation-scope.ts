/** Client-safe sale validation scope (mirrors lib/pos/sale-validation-scope.ts). */

export type SaleValidatorRoleContext = {
  role: string;
  commercialServiceRoleCode?: string | null;
};

export function isSeniorSupervisorValidator(
  ctx: SaleValidatorRoleContext,
): boolean {
  if (ctx.role === "SENIOR_SUPERVISOR") return true;
  const c = (ctx.commercialServiceRoleCode ?? "").toLowerCase();
  return c.includes("senior") && c.includes("supervisor") && !c.includes("manager");
}

export function isPlainSupervisorValidator(
  ctx: SaleValidatorRoleContext,
): boolean {
  if (ctx.role === "SUPERVISOR") return true;
  const c = (ctx.commercialServiceRoleCode ?? "").toLowerCase();
  return (
    c.includes("supervisor") &&
    !c.includes("senior") &&
    !c.includes("manager")
  );
}

/** Sales supervisors and senior supervisors validate vehicle consignment (Bota split on server). */
export function canValidateConsignmentNoteValidator(
  ctx: SaleValidatorRoleContext,
): boolean {
  if (ctx.role === "ADMIN") return true;
  return (
    isPlainSupervisorValidator(ctx) || isSeniorSupervisorValidator(ctx)
  );
}

export function pendingSalesValidationHint(ctx: SaleValidatorRoleContext): string {
  if (isSeniorSupervisorValidator(ctx)) {
    return "Senior supervisor: validate all pending sales invoices at Bota.";
  }
  if (isPlainSupervisorValidator(ctx)) {
    return "Sales supervisor: validate all pending sales invoices at your sales point (not Bota).";
  }
  return "Open each item to review lines and totals before validating.";
}

export function pendingConsignmentValidationHint(
  ctx: SaleValidatorRoleContext,
): string {
  if (isSeniorSupervisorValidator(ctx)) {
    return "Senior supervisor: validate vehicle consignment notes at Bota.";
  }
  if (isPlainSupervisorValidator(ctx)) {
    return "Sales supervisor: validate vehicle consignment notes at your sales point (not Bota).";
  }
  return "Supervisor: validate vehicle consignment notes at your sales point.";
}
