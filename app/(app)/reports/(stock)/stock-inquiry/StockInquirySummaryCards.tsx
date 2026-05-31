import type { ReactNode } from "react";
import { StockCondition } from "@prisma/client";
import { AlertTriangle, Package, Sprout } from "lucide-react";
import {
  fmtStockQty,
  type StockInquiryConditionSummary,
  type StockInquiryProductSummary,
} from "./loader";

type StockInquirySummaryCardsProps = {
  productSummaries: StockInquiryProductSummary[];
  conditionSummaries: StockInquiryConditionSummary[];
  print?: boolean;
};

export function StockInquirySummaryCards(props: StockInquirySummaryCardsProps) {
  const { productSummaries, conditionSummaries, print = false } = props;

  return (
    <div className={print ? "space-y-3 print:break-inside-avoid" : "space-y-4"}>
      <SummaryGroup
        title="By condition"
        print={print}
        cards={
          <>
            {conditionSummaries.map((c) => (
              <ConditionSummaryCard key={c.condition} summary={c} print={print} />
            ))}
          </>
        }
      />
      <SummaryGroup
        title="By product"
        print={print}
        cards={
          productSummaries.length > 0 ? (
            productSummaries.map((p) => (
              <ProductSummaryCard key={p.productId} summary={p} print={print} />
            ))
          ) : (
            <EmptySummaryCard
              label="No products in scope"
              print={print}
            />
          )
        }
      />
    </div>
  );
}

function SummaryGroup(props: {
  title: string;
  cards: ReactNode;
  print: boolean;
}) {
  const { title, cards, print } = props;

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
        {title}
      </h2>
      <div
        className={
          print
            ? "flex flex-wrap gap-2"
            : "flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:gap-2 sm:overflow-x-auto"
        }
      >
        {cards}
      </div>
    </section>
  );
}

function ConditionSummaryCard(props: {
  summary: StockInquiryConditionSummary;
  print: boolean;
}) {
  const { summary, print } = props;
  const sellable = summary.condition === StockCondition.SELLABLE;
  const shell = sellable ? agroShellSellable(print) : agroShellUnsellable(print);

  return (
    <div className={shell}>
      <div className="flex items-start gap-2">
        <div className={sellable ? agroIconSellable(print) : agroIconUnsellable(print)}>
          {sellable ? (
            <Sprout className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={agroLabel(print)}>{summary.label}</p>
          <div className="mt-0.5 space-y-0.5">
            {summary.totalsByUom.length > 0 ? (
              summary.totalsByUom.map((t) => (
                <p
                  key={t.uom}
                  className="text-sm font-semibold leading-tight tabular-nums"
                >
                  {fmtStockQty(t.qty, t.uom)}
                </p>
              ))
            ) : (
              <p className="text-sm font-semibold tabular-nums opacity-50">—</p>
            )}
          </div>
          <p className="mt-0.5 text-[10px] opacity-65">
            {summary.lineCount} balance{summary.lineCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductSummaryCard(props: {
  summary: StockInquiryProductSummary;
  print: boolean;
}) {
  const { summary, print } = props;

  return (
    <div className={agroShellProduct(print)}>
      <div className="flex items-start gap-2">
        <div className={agroIconProduct(print)}>
          <Package className="size-3.5 shrink-0" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className={agroLabel(print)} title={summary.productName}>
            <span className="line-clamp-2">{summary.productName}</span>
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight tabular-nums">
            {fmtStockQty(summary.qty, summary.uom)}
          </p>
          <p className="mt-0.5 text-[10px] opacity-65">
            {summary.lineCount} balance{summary.lineCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptySummaryCard(props: { label: string; print: boolean }) {
  const { label, print } = props;

  return (
    <div
      className={[
        "w-full rounded-lg border border-dashed px-2.5 py-2 text-xs opacity-60 sm:min-w-[6.5rem] sm:flex-1 sm:shrink-0",
        print ? "border-black/20" : "border-brand/25",
      ].join(" ")}
    >
      {label}
    </div>
  );
}

function agroShellSellable(print: boolean) {
  return [
    "w-full rounded-lg border p-2 shadow-sm sm:min-w-[6.5rem] sm:flex-1 sm:shrink-0",
    print
      ? "border-black/20 bg-white print:shadow-none"
      : "border-brand/25 bg-gradient-to-br from-brand/12 via-background to-brand/5 ring-1 ring-brand/10",
  ].join(" ");
}

function agroShellUnsellable(print: boolean) {
  return [
    "w-full rounded-lg border p-2 shadow-sm sm:min-w-[6.5rem] sm:flex-1 sm:shrink-0",
    print
      ? "border-black/20 bg-white print:shadow-none"
      : "border-accent/35 bg-gradient-to-br from-accent/30 via-background to-accent/10 ring-1 ring-accent/20",
  ].join(" ");
}

function agroShellProduct(print: boolean) {
  return [
    "w-full rounded-lg border p-2 shadow-sm sm:min-w-[6.5rem] sm:flex-1 sm:shrink-0",
    print
      ? "border-black/20 bg-white print:shadow-none"
      : "border-brand/20 bg-gradient-to-br from-background via-brand/6 to-accent/12 ring-1 ring-brand/8",
  ].join(" ");
}

function agroIconSellable(print: boolean) {
  return [
    "rounded-md p-1.5 shrink-0",
    print ? "bg-black/5 text-foreground" : "bg-brand/15 text-brand",
  ].join(" ");
}

function agroIconUnsellable(print: boolean) {
  return [
    "rounded-md p-1.5 shrink-0",
    print ? "bg-black/5 text-foreground" : "bg-accent/40 text-accent-foreground",
  ].join(" ");
}

function agroIconProduct(print: boolean) {
  return [
    "rounded-md p-1.5 shrink-0",
    print ? "bg-black/5 text-foreground" : "bg-brand/12 text-brand",
  ].join(" ");
}

function agroLabel(print: boolean) {
  return [
    "text-[10px] font-semibold uppercase tracking-wide leading-snug",
    print ? "text-foreground/70" : "text-brand/75",
  ].join(" ");
}
