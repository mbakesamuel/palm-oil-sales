/**
 * Typed errors raised by the stock posting layer so server actions can
 * translate them into user-friendly banners instead of bubbling raw text.
 */

export class InsufficientStockError extends Error {
  readonly salesPointId: number;
  readonly productId: number;
  readonly productLabel: string;
  readonly salesPointLabel: string;
  readonly storageLocationLabel: string | null;
  readonly condition: string | null;
  readonly requested: string;
  readonly available: string;

  constructor(args: {
    salesPointId: number;
    productId: number;
    productLabel: string;
    salesPointLabel: string;
    storageLocationLabel?: string | null;
    condition?: string | null;
    requested: string;
    available: string;
  }) {
    const locationPart = args.storageLocationLabel
      ? ` at "${args.storageLocationLabel}"`
      : "";
    const conditionPart = args.condition ? ` (${args.condition.toLowerCase()})` : "";
    super(
      `Insufficient stock for "${args.productLabel}" at "${args.salesPointLabel}"${locationPart}${conditionPart}. ` +
        `Requested ${args.requested}, available ${args.available}.`,
    );
    this.name = "InsufficientStockError";
    this.salesPointId = args.salesPointId;
    this.productId = args.productId;
    this.productLabel = args.productLabel;
    this.salesPointLabel = args.salesPointLabel;
    this.storageLocationLabel = args.storageLocationLabel ?? null;
    this.condition = args.condition ?? null;
    this.requested = args.requested;
    this.available = args.available;
  }
}

export function isInsufficientStockError(e: unknown): e is InsufficientStockError {
  return e instanceof InsufficientStockError;
}
