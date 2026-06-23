"use client";

import * as React from "react";
import type {
  ValidationQueueFilters,
  ValidationQueuePage,
  ValidationQueueRow,
} from "./actions";

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function Checkbox(props: {
  checked: boolean;
  onChange: (next: boolean) => void;
  "aria-label"?: string;
}) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-primary"
      checked={props.checked}
      onChange={(e) => props.onChange(e.target.checked)}
      aria-label={props["aria-label"]}
    />
  );
}

export function ValidationQueueClient(props: {
  initialPage: ValidationQueuePage;
  listAction: (input?: {
    filters?: ValidationQueueFilters;
    cursor?: { id: number } | null;
    pageSize?: number;
  }) => Promise<ValidationQueuePage>;
  markReviewedAction: (input: { ids: number[] }) => Promise<
    { ok: true; updated: number } | { ok: false; error: string }
  >;
  validateReviewedAction: (input: { ids: number[] }) => Promise<
    | { ok: true; validated: number; skipped: number; errors: Array<{ id: number; error: string }> }
    | { ok: false; error: string }
  >;
}) {
  const inputClass =
    "h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm";
  const buttonPrimary =
    "rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50";
  const buttonSecondary =
    "rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/25 disabled:opacity-50";

  const [filters, setFilters] = React.useState<ValidationQueueFilters>(() => ({
    q: "",
    from: null,
    to: null,
    reviewed: "all",
  }));

  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState<ValidationQueuePage>(props.initialPage);
  const [rows, setRows] = React.useState<ValidationQueueRow[]>(props.initialPage.rows);
  const [cursor, setCursor] = React.useState<{ id: number } | null>(props.initialPage.nextCursor);
  const [selected, setSelected] = React.useState<Record<number, boolean>>({});
  const [message, setMessage] = React.useState<string | null>(null);

  const selectedIds = React.useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
    [selected],
  );

  const allChecked = rows.length > 0 && rows.every((r) => selected[r.id]);
  const someChecked = rows.some((r) => selected[r.id]);

  const refresh = React.useCallback(
    async (opts?: { reset?: boolean }) => {
      setLoading(true);
      setMessage(null);
      try {
        const p = await props.listAction({
          filters,
          cursor: opts?.reset ? null : null,
          pageSize: 50,
        });
        setPage(p);
        setRows(p.rows);
        setCursor(p.nextCursor);
        setSelected({});
      } finally {
        setLoading(false);
      }
    },
    [filters, props],
  );

  const loadMore = React.useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const p = await props.listAction({ filters, cursor, pageSize: 50 });
      setPage(p);
      setRows((prev) => [...prev, ...p.rows]);
      setCursor(p.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, filters, loading, props]);

  const bulkMarkReviewed = React.useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setMessage(null);
    try {
      const r = await props.markReviewedAction({ ids: selectedIds });
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      setMessage(`Marked reviewed: ${r.updated}`);
      await refresh({ reset: true });
    } finally {
      setLoading(false);
    }
  }, [props, refresh, selectedIds]);

  const bulkValidateReviewed = React.useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setMessage(null);
    try {
      const r = await props.validateReviewedAction({ ids: selectedIds });
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      const errCount = r.errors.length;
      const errPreview = r.errors.slice(0, 3).map((e) => `#${e.id}: ${e.error}`).join(" | ");
      setMessage(
        `Validated: ${r.validated}. Skipped: ${r.skipped}. Errors: ${errCount}${
          errCount ? ` (${errPreview}${errCount > 3 ? " …" : ""})` : ""
        }`,
      );
      await refresh({ reset: true });
    } finally {
      setLoading(false);
    }
  }, [props, refresh, selectedIds]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <div className="text-xs font-medium text-muted-foreground">Search</div>
          <input
            className={inputClass}
            value={filters.q ?? ""}
            placeholder="DO no or customer…"
            onChange={(e) => {
              const q = e.target.value;
              setFilters((f) => ({ ...f, q }));
            }}
          />
        </div>

        <div className="w-[150px]">
          <div className="text-xs font-medium text-muted-foreground">From</div>
          <input
            className={inputClass}
            type="date"
            value={filters.from ?? ""}
            max={filters.to ?? todayIso()}
            onChange={(e) => {
              const from = e.target.value || null;
              setFilters((f) => ({ ...f, from }));
            }}
          />
        </div>

        <div className="w-[150px]">
          <div className="text-xs font-medium text-muted-foreground">To</div>
          <input
            className={inputClass}
            type="date"
            value={filters.to ?? ""}
            min={filters.from ?? undefined}
            max={todayIso()}
            onChange={(e) => {
              const to = e.target.value || null;
              setFilters((f) => ({ ...f, to }));
            }}
          />
        </div>

        <div className="w-[180px]">
          <div className="text-xs font-medium text-muted-foreground">Reviewed</div>
          <select
            className={inputClass}
            value={filters.reviewed ?? "all"}
            onChange={(e) => {
              const reviewed = e.target.value as ValidationQueueFilters["reviewed"];
              setFilters((f) => ({ ...f, reviewed }));
            }}
          >
            <option value="all">All</option>
            <option value="exclude">Unreviewed only</option>
            <option value="only">Reviewed only</option>
          </select>
        </div>

        <button
          type="button"
          className={buttonPrimary}
          disabled={loading}
          onClick={() => void refresh({ reset: true })}
        >
          Apply filters
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Pending: <span className="font-medium text-foreground">{page.totalPending}</span> ·
            Reviewed:{" "}
            <span className="font-medium text-foreground">{page.totalReviewedPending}</span> ·
            Unreviewed:{" "}
            <span className="font-medium text-foreground">{page.totalUnreviewedPending}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonSecondary}
          disabled={loading || selectedIds.length === 0}
          onClick={() => void bulkMarkReviewed()}
        >
          Mark reviewed ({selectedIds.length})
        </button>
        <button
          type="button"
          className={buttonPrimary}
          disabled={loading || selectedIds.length === 0}
          onClick={() => void bulkValidateReviewed()}
        >
          Validate reviewed ({selectedIds.length})
        </button>

        {message ? (
          <div className="text-sm text-muted-foreground">{message}</div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Select rows, then mark reviewed, then validate.
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b">
                <th className="w-10 px-3 py-2 text-left">
                  <Checkbox
                    checked={allChecked}
                    onChange={(next) => {
                      if (!rows.length) return;
                      setSelected((prev) => {
                        const n = { ...prev };
                        for (const r of rows) n[r.id] = next;
                        return n;
                      });
                    }}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2 text-left">DO No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Sales point</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Reviewed</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                    No pending delivery orders match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const checked = !!selected[r.id];
                  return (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={checked}
                          onChange={(next) => setSelected((s) => ({ ...s, [r.id]: next }))}
                          aria-label={`Select ${r.deliveryOrderNo}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{r.deliveryOrderNo}</td>
                      <td className="px-3 py-2">{r.dateIssuedIso}</td>
                      <td className="px-3 py-2">{r.salesPointName}</td>
                      <td className="px-3 py-2">{r.customerName}</td>
                      <td className="px-3 py-2">
                        {r.reviewedAtIso ? (
                          <div className="text-xs">
                            <div className="font-medium">Yes</div>
                            <div className="text-muted-foreground">
                              {r.reviewedByName ? `By ${r.reviewedByName}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.totalAmountXaf || ""}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm">
          <div className="text-muted-foreground">
            {someChecked ? `${selectedIds.length} selected` : "No selection"}
          </div>
          <button
            type="button"
            className={buttonSecondary}
            disabled={loading || !cursor}
            onClick={() => void loadMore()}
          >
            {cursor ? "Load more" : "End"}
          </button>
        </div>
      </div>
    </div>
  );
}

