"use client";

import { DocumentStatusStamp } from "@/components/DocumentStatusStamp";
import type { ConsignmentNotePrintModel } from "@/lib/consignment-note-types";
import { ValidationStatus } from "@/lib/domain";
import { printStampLabelForValidationStatus } from "@/lib/print-document-stamp";
import { ReportHeader } from "@/components/ReportHeader";

function formatDisplayDate(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

export function ConsignmentNotePrint(props: {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  logoSrc: string;
  note: ConsignmentNotePrintModel;
}) {
  const { companyName, department, companyPhone, companyAddress, logoSrc, note } = props;
  const { doContext } = note;
  const stampLabel = printStampLabelForValidationStatus(note.status);

  return (
    <article
      data-print-fit-page
      className="relative text-black bg-white max-w-3xl mx-auto print:max-w-none print:mx-0"
    >
      {stampLabel ? <DocumentStatusStamp label={stampLabel} /> : null}
      <header className="border-b border-black/20 pb-4 mb-6">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoSrc}
          title="Vehicle consignment note"
        />
        {(companyAddress || companyPhone) ? (
          <div className="mt-2 text-center text-sm opacity-90 space-y-0.5">
            {companyAddress ? <p>{companyAddress}</p> : null}
            {companyPhone ? <p>Tel: {companyPhone}</p> : null}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm mt-1">
            <span className="opacity-70">VCN no.</span>{" "}
            <span className="font-semibold tabular-nums">{note.consignmentNoteNo}</span>
          </p>
          <p className="text-xs mt-1 opacity-80">
            Status: <span className="font-medium">{note.status}</span>
            {note.status === ValidationStatus.VALIDATED && note.validatedByName ? (
              <span className="opacity-80">
                {" "}
                · Validated by {note.validatedByName}
                {note.validatedAtIso
                  ? ` (${formatDisplayDate(note.validatedAtIso)})`
                  : null}
              </span>
            ) : null}
          </p>
        </div>
        <div className="text-sm text-right space-y-0.5">
          <p>
            <span className="opacity-70">Related sale</span>{" "}
            <span className="font-medium tabular-nums">{note.invoiceNo}</span>
          </p>
          <p>
            <span className="opacity-70">Customer</span>{" "}
            <span className="font-medium">{note.customerName}</span>
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-black/15 p-4 mb-4 text-sm space-y-2">
        <div className="font-semibold text-xs uppercase tracking-wide opacity-80">Route</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs opacity-70">From (collection / sales point)</div>
            <div className="font-medium">{note.fromSalesPointName}</div>
          </div>
          <div>
            <div className="text-xs opacity-70">To (destination)</div>
            <div className="font-medium whitespace-pre-wrap">{note.destination}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-black/15 p-4 mb-4 text-sm space-y-2">
        <div className="font-semibold text-xs uppercase tracking-wide opacity-80">
          Delivery order context (qty kg)
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs opacity-70">Lifting delivery order no.</div>
            <div className="font-medium tabular-nums">{note.deliveryOrderNo ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs opacity-70">Qty lifted (this sale)</div>
            <div className="font-medium tabular-nums">{note.thisSaleLiftedQtyKg} kg</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm pt-2 border-t border-black/10">
          <div>
            <div className="opacity-70">Paid for (DO)</div>
            <div className="font-medium tabular-nums">{doContext.paidQtyKg}</div>
          </div>
          <div>
            <div className="opacity-70">Lifted (validated sales)</div>
            <div className="font-medium tabular-nums">{doContext.liftedQtyKg}</div>
          </div>
          <div>
            <div className="opacity-70">Balance</div>
            <div className="font-medium tabular-nums">{doContext.balanceQtyKg}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-black/15 p-4 mb-4 text-sm grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs opacity-70">Date of lifting</div>
          <div className="font-medium">{formatDisplayDate(note.dateOfLiftingIso)}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Vehicle no.</div>
          <div className="font-medium">{note.vehicleNumber}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-xs opacity-70">Consigner (staff at sales point)</div>
          <div className="font-medium">{note.consignerName}</div>
          <div className="text-xs opacity-80 mt-0.5">Designation: {note.consignerDesignation}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Date of consignment</div>
          <div className="font-medium">{formatDisplayDate(note.dateOfConsignmentIso)}</div>
        </div>
      </section>

      <section className="rounded-lg border border-black/15 p-4 mb-4 text-sm space-y-3">
        <div className="font-semibold text-xs uppercase tracking-wide opacity-80">Receiver</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs opacity-70">Name</div>
            <div className="font-medium">{note.receiverName}</div>
          </div>
          <div>
            <div className="text-xs opacity-70">NIC no.</div>
            <div className="font-medium tabular-nums">{note.receiverNicNo}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs opacity-70">Place of issue (NIC)</div>
            <div className="font-medium">{note.receiverNicPlaceOfIssue}</div>
          </div>
          <div>
            <div className="text-xs opacity-70">Received date</div>
            <div className="font-medium">
              {note.receivedDateIso ? formatDisplayDate(note.receivedDateIso) : "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="text-sm font-semibold mb-2">Products (this lifting)</h3>
        <div className="rounded-lg border border-black/15 overflow-hidden text-sm">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 bg-black/3">
            <div className="col-span-1">#</div>
            <div className="col-span-8">Product</div>
            <div className="col-span-3 text-right">Qty (kg)</div>
          </div>
          {note.lines.map((l) => (
            <div
              key={l.lineNo}
              className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-black/5 last:border-b-0"
            >
              <div className="col-span-1 tabular-nums opacity-80">{l.lineNo}</div>
              <div className="col-span-8">{l.productName}</div>
              <div className="col-span-3 text-right tabular-nums font-medium">{l.qtyKg}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-black/15 pt-6 text-xs text-black/60 print:mt-8">
        <p>This document accompanies oil consigned from the collection point to the stated destination.</p>
      </footer>
    </article>
  );
}
