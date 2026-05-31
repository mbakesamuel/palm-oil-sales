import type { ReactNode } from "react";
import { Prisma } from "@prisma/client";
import { Boxes, Scale, Truck } from "lucide-react";
import { fmtKgQty } from "./loader";

type StockVsCommitmentsSummaryCardsProps = {
  scopeLabel: string;
  overallStockKg: Prisma.Decimal;
  overallCommitmentKg: Prisma.Decimal;
  uncommittedKg: Prisma.Decimal;
  print?: boolean;
};

export function StockVsCommitmentsSummaryCards(
  props: StockVsCommitmentsSummaryCardsProps,
) {
  const {
    scopeLabel,
    overallStockKg,
    overallCommitmentKg,
    uncommittedKg,
    print = false,
  } = props;

  const uncommittedNegative = uncommittedKg.lt(new Prisma.Decimal(0));

  return (
    <section>
      <h2
        className={[
          "mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider",
          print ? "text-foreground/80" : "text-brand",
        ].join(" ")}
      >
        <span
          className={[
            "h-1.5 w-1.5 shrink-0 rounded-full",
            print ? "bg-foreground/40" : "bg-accent",
          ].join(" ")}
          aria-hidden
        />
        Summary — {scopeLabel}
      </h2>
      <div
        className={
          print
            ? "grid grid-cols-3 gap-2"
            : "flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:gap-2"
        }
      >
        <SummaryCard
          label="Overall stock"
          value={fmtKgQty(overallStockKg)}
          hint="On hand (kg), all storage locations"
          icon={<Boxes className="size-3.5 shrink-0" aria-hidden />}
          variant="stock"
          print={print}
        />
        <SummaryCard
          label="Overall commitment"
          value={fmtKgQty(overallCommitmentKg)}
          hint="Outstanding DO qty not yet invoiced"
          icon={<Truck className="size-3.5 shrink-0" aria-hidden />}
          variant="commitment"
          print={print}
        />
        <SummaryCard
          label="Uncommitted balance"
          value={fmtKgQty(uncommittedKg)}
          hint="Stock minus commitment"
          icon={<Scale className="size-3.5 shrink-0" aria-hidden />}
          variant={uncommittedNegative ? "negative" : "balance"}
          print={print}
        />
      </div>
    </section>
  );
}

function SummaryCard(props: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  variant: "stock" | "commitment" | "balance" | "negative";
  print: boolean;
}) {
  const { label, value, hint, icon, variant, print } = props;

  const shell = cardShell(variant, print);
  const iconShell = cardIconShell(variant, print);

  return (
    <div className={shell}>
      <div className="flex items-start gap-2">
        <div className={iconShell}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className={cardLabel(print)}>{label}</p>
          <p className="mt-0.5 text-sm font-semibold leading-tight tabular-nums">
            {value}
          </p>
          <p className="mt-0.5 text-[10px] opacity-65">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function cardShell(
  variant: "stock" | "commitment" | "balance" | "negative",
  print: boolean,
) {
  const base =
    "w-full rounded-lg border p-2 shadow-sm sm:min-w-0 sm:flex-1 sm:shrink-0";
  if (print) {
    return `${base} border-black/20 bg-white print:shadow-none`;
  }
  switch (variant) {
    case "stock":
      return `${base} border-brand/25 bg-gradient-to-br from-brand/12 via-background to-brand/5 ring-1 ring-brand/10`;
    case "commitment":
      return `${base} border-accent/35 bg-gradient-to-br from-accent/30 via-background to-accent/10 ring-1 ring-accent/20`;
    case "negative":
      return `${base} border-red-500/35 bg-gradient-to-br from-red-500/10 via-background to-red-500/5 ring-1 ring-red-500/15`;
    default:
      return `${base} border-brand/20 bg-gradient-to-br from-background via-brand/6 to-accent/12 ring-1 ring-brand/8`;
  }
}

function cardIconShell(
  variant: "stock" | "commitment" | "balance" | "negative",
  print: boolean,
) {
  const base = "rounded-md p-1.5 shrink-0";
  if (print) return `${base} bg-black/5 text-foreground`;
  switch (variant) {
    case "stock":
      return `${base} bg-brand/15 text-brand`;
    case "commitment":
      return `${base} bg-accent/40 text-accent-foreground`;
    case "negative":
      return `${base} bg-red-500/15 text-red-700 dark:text-red-300`;
    default:
      return `${base} bg-brand/12 text-brand`;
  }
}

function cardLabel(print: boolean) {
  return [
    "text-[10px] font-semibold uppercase tracking-wide leading-snug",
    print ? "text-foreground/70" : "text-brand/75",
  ].join(" ");
}
