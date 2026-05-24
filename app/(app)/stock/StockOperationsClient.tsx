"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseStockOperationMode,
  policyHintForMode,
  type StockOperationMode,
} from "@/lib/stock-operating-rules";
import type { StockOperationsPageData } from "@/lib/load-stock-operations-page";
import { StockActivityFeed } from "./StockActivityFeed";
import { StockReceiptsClient } from "./receipts/StockReceiptsClient";
import { BottledReceiptsPanel } from "./receipts/BottledReceiptsPanel";
import { StockMovementsClient } from "./movements/StockMovementsClient";
import { StockIssuesClient } from "./issues/StockIssuesClient";
import {
  botaValidateBpoConsignment,
  createBpoConsignmentVoucher,
  rejectBpoConsignment,
  senderValidateBpoConsignment,
} from "./movements/actions";
import { createStockIssue } from "./issues/actions";

type OkData = Extract<StockOperationsPageData, { ok: true }>;

const MODES: Array<{ id: StockOperationMode; label: string; permKey: keyof OkData["permissions"] }> = [
  { id: "receive", label: "Receive", permKey: "receive" },
  { id: "transfer", label: "Transfer", permKey: "transfer" },
  { id: "issue", label: "Issue", permKey: "issue" },
];

function setModeInUrl(mode: StockOperationMode) {
  const params = new URLSearchParams(window.location.search);
  params.set("mode", mode);
  const q = params.toString();
  return q ? `/stock?${q}` : "/stock";
}

export function StockOperationsClient(props: { data: OkData }) {
  const { data } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = parseStockOperationMode(searchParams.get("mode"));

  const allowedModes = MODES.filter((m) => data.permissions[m.permKey]);
  const activeMode = allowedModes.some((m) => m.id === requestedMode)
    ? requestedMode
    : (allowedModes[0]?.id ?? "receive");

  React.useEffect(() => {
    if (requestedMode !== activeMode && allowedModes.length > 0) {
      router.replace(setModeInUrl(activeMode));
    }
  }, [requestedMode, activeMode, allowedModes.length, router]);

  const policyHint = policyHintForMode(activeMode, {
    isBotaUser: data.isBotaUser,
    hubConfigured: data.hubSalesPointId != null,
  });

  if (allowedModes.length === 0) {
    return (
      <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm">
        You do not have permission for stock receipts, transfers, or issues.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock operations</h1>
          <p className="mt-1 max-w-2xl text-sm opacity-80">
            Receive, transfer, and issue inventory on one ledger. Rules depend on product form and
            sales point (Bota is the hub for bottled retail).
          </p>
        </div>
        <Link
          href="/storage-locations"
          className="text-sm underline underline-offset-4 opacity-80 shrink-0"
        >
          Storage locations
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Stock operation mode"
        className="inline-flex flex-wrap gap-1 rounded-lg border border-border p-1 bg-foreground/[0.03]"
      >
        {allowedModes.map((m) => {
          const selected = m.id === activeMode;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => router.push(setModeInUrl(m.id))}
              className={
                selected
                  ? "rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium shadow-sm"
                  : "rounded-md px-4 py-2 text-sm font-medium hover:bg-accent/30"
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-foreground/[0.02] px-4 py-3 text-sm leading-relaxed">
        {policyHint}
        {activeMode === "issue" ? (
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <Link href="/pos" className="underline underline-offset-4 font-medium">
              Loose sales (POS)
            </Link>
            <Link href="/bpo-sales" className="underline underline-offset-4 font-medium">
              Bottled Palm Oil sales (Bota)
            </Link>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border p-4 sm:p-6 bg-background shadow-sm">
        {activeMode === "receive" && data.permissions.receive ? (
          <div className="space-y-10">
            <section className="space-y-4">
              <h2 className="text-lg font-medium">Loose products (kg)</h2>
              <StockReceiptsClient
                embedded
                hideRecentList
                salesPoints={data.receipts.salesPoints}
                products={data.receipts.looseProducts}
                storageLocations={data.receipts.storageLocations}
                recentReceipts={data.receipts.looseReceipts}
                defaultSalesPointId={data.assignedSalesPointId}
                salesPointLocked={data.salesPointLocked}
              />
            </section>
            <section className="space-y-4 border-t border-border pt-8">
              <h2 className="text-lg font-medium">Bottled products (units)</h2>
              {data.hubSalesPointId == null ? (
                <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm">
                  Configure a hub sales point named Bota to separate direct receipts from hub
                  transfers.
                </div>
              ) : null}
              <BottledReceiptsPanel
                embedded
                hideRecentList
                salesPoints={data.receipts.bottledSalesPoints}
                products={data.receipts.bottledProducts}
                recentReceipts={data.receipts.bottledReceipts}
                defaultSalesPointId={data.assignedSalesPointId}
                salesPointLocked={data.salesPointLocked}
                canEditReceiptRows={data.receipts.canEditBottledReceiptRows}
              />
            </section>
          </div>
        ) : null}

        {activeMode === "transfer" && data.permissions.transfer ? (
          <StockMovementsClient
            embedded
            salesPoints={data.transfers.salesPoints}
            bottledProducts={data.transfers.bottledProducts}
            availability={data.transfers.availability}
            movements={data.transfers.movements}
            botaSalesPointId={data.hubSalesPointId}
            defaultSourceSalesPointId={data.assignedSalesPointId}
            salesPointLocked={data.salesPointLocked}
            canCreateVoucher={data.transfers.canCreateVoucher}
            canPrintCreatedVoucher={data.transfers.canPrintCreatedVoucher}
            createAction={createBpoConsignmentVoucher}
            senderValidateAction={senderValidateBpoConsignment}
            botaValidateAction={botaValidateBpoConsignment}
            rejectAction={rejectBpoConsignment}
          />
        ) : null}

        {activeMode === "issue" && data.permissions.issue ? (
          <StockIssuesClient
            embedded
            hideRecentList
            bottledProducts={data.issues.bottledProducts}
            movements={data.issues.movements}
            canPost={data.issues.canPost}
            botaAvailable={data.issues.botaAvailable}
            createAction={createStockIssue}
          />
        ) : null}
      </div>

      <StockActivityFeed items={data.activity} />
    </div>
  );
}
