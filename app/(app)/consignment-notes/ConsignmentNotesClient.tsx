"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  canCreateOrEditConsignmentNoteDraft,
  canValidateConsignmentNote,
} from "@/lib/auth-roles";
import { ValidationStatus } from "@/lib/domain";
import type {
  LoadedConsignmentFormView,
  MutationResult,
  SaveConsignmentNoteResult,
} from "./actions";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function ConsignmentNotesClient(props: {
  loadSaleForConsignmentByInvoice: (invoice: string) => Promise<LoadedConsignmentFormView | null>;
  loadConsignmentByVcnNo: (vcn: string) => Promise<LoadedConsignmentFormView | null>;
  saveConsignmentNote: (formData: FormData) => Promise<SaveConsignmentNoteResult>;
  deleteConsignmentNote: (formData: FormData) => Promise<MutationResult>;
  validateConsignmentNote: (formData: FormData) => Promise<MutationResult>;
}) {
  const {
    loadSaleForConsignmentByInvoice,
    loadConsignmentByVcnNo,
    saveConsignmentNote,
    deleteConsignmentNote,
    validateConsignmentNote,
  } = props;

  const { status: authStatus, session } = useAuth();
  const router = useRouter();

  const [saleId, setSaleId] = React.useState<string | null>(null);
  const [noteId, setNoteId] = React.useState<string | null>(null);
  const [consignmentNoteNo, setConsignmentNoteNo] = React.useState("");
  const [invoiceLookup, setInvoiceLookup] = React.useState("");
  const [vcnLookup, setVcnLookup] = React.useState("");

  const [invoiceNo, setInvoiceNo] = React.useState("");
  const [saleStatus, setSaleStatus] = React.useState<ValidationStatus | null>(null);
  const [fromName, setFromName] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");

  const [paidQty, setPaidQty] = React.useState("");
  const [liftedQty, setLiftedQty] = React.useState("");
  const [balanceQty, setBalanceQty] = React.useState("");
  const [doNo, setDoNo] = React.useState<string | null>(null);
  const [thisSaleLifted, setThisSaleLifted] = React.useState("");

  const [destination, setDestination] = React.useState("");
  const [dateOfLifting, setDateOfLifting] = React.useState(todayIsoDate());
  const [vehicleNumber, setVehicleNumber] = React.useState("");
  const [consignerName, setConsignerName] = React.useState("");
  const [consignerDesignation, setConsignerDesignation] = React.useState("");
  const [dateOfConsignment, setDateOfConsignment] = React.useState(todayIsoDate());
  const [receiverName, setReceiverName] = React.useState("");
  const [receiverNicNo, setReceiverNicNo] = React.useState("");
  const [receiverNicPlaceOfIssue, setReceiverNicPlaceOfIssue] = React.useState("");
  const [receivedDate, setReceivedDate] = React.useState("");

  const [noteStatus, setNoteStatus] = React.useState<ValidationStatus | null>(null);
  const [validatedByName, setValidatedByName] = React.useState("");
  const [validatedAtIso, setValidatedAtIso] = React.useState("");

  const [banner, setBanner] = React.useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  function applyLoaded(data: LoadedConsignmentFormView) {
    const { sale, note, doContext } = data;
    setSaleId(sale.id);
    setInvoiceNo(sale.invoiceNo);
    setSaleStatus(sale.status);
    setFromName(sale.salesPointName ?? "—");
    setCustomerName(sale.customerName);
    setDoNo(sale.deliveryOrderNo);
    setThisSaleLifted(sale.thisSaleLiftedQtyKg);
    setPaidQty(doContext.paidQtyKg);
    setLiftedQty(doContext.liftedQtyKg);
    setBalanceQty(doContext.balanceQtyKg);

    if (note) {
      setNoteId(note.id);
      setConsignmentNoteNo(note.consignmentNoteNo);
      setDestination(note.destination);
      setDateOfLifting(note.dateOfLifting);
      setVehicleNumber(note.vehicleNumber);
      setConsignerName(note.consignerName);
      setConsignerDesignation(note.consignerDesignation);
      setDateOfConsignment(note.dateOfConsignment);
      setReceiverName(note.receiverName);
      setReceiverNicNo(note.receiverNicNo);
      setReceiverNicPlaceOfIssue(note.receiverNicPlaceOfIssue);
      setReceivedDate(note.receivedDate ?? "");
      setNoteStatus(note.status);
      setValidatedByName(note.validatedByName ?? "");
      setValidatedAtIso(note.validatedAtIso ?? "");
    } else {
      setNoteId(null);
      setConsignmentNoteNo("");
      setDestination(sale.customerAddress?.trim() || "");
      setDateOfLifting(sale.soldAtIso.slice(0, 10));
      setVehicleNumber(sale.vehicleNumber);
      setConsignerName("");
      setConsignerDesignation("");
      setDateOfConsignment(todayIsoDate());
      setReceiverName("");
      setReceiverNicNo("");
      setReceiverNicPlaceOfIssue("");
      setReceivedDate("");
      setNoteStatus(null);
      setValidatedByName("");
      setValidatedAtIso("");
    }
    setBanner(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onLoadByInvoice() {
    setBusy("inv");
    setBanner(null);
    try {
      if (authStatus !== "ready" || !session?.userId) {
        setBanner({ type: "error", text: "Login required." });
        return;
      }
      const data = await loadSaleForConsignmentByInvoice(invoiceLookup);
      if (!data) {
        setBanner({
          type: "error",
          text: "No sale matches that invoice number, or you cannot access it.",
        });
        return;
      }
      applyLoaded(data);
      setBanner({ type: "ok", text: `Loaded sale ${data.sale.invoiceNo}.` });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onLoadByVcn() {
    setBusy("vcn");
    setBanner(null);
    try {
      if (authStatus !== "ready" || !session?.userId) {
        setBanner({ type: "error", text: "Login required." });
        return;
      }
      const data = await loadConsignmentByVcnNo(vcnLookup);
      if (!data) {
        setBanner({
          type: "error",
          text: "No consignment note matches that VCN number, or you cannot access it.",
        });
        return;
      }
      applyLoaded(data);
      setVcnLookup(data.note?.consignmentNoteNo ?? vcnLookup);
      setBanner({ type: "ok", text: `Loaded ${data.note?.consignmentNoteNo ?? "note"}.` });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    if (!saleId) return;
    if (authStatus !== "ready" || !session?.userId) {
      setBanner({ type: "error", text: "Login required." });
      return;
    }
    setBusy("save");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("saleId", saleId);
      if (noteId) fd.set("noteId", noteId);
      fd.set("destination", destination);
      fd.set("dateOfLifting", dateOfLifting);
      fd.set("vehicleNumber", vehicleNumber);
      fd.set("consignerName", consignerName);
      fd.set("consignerDesignation", consignerDesignation);
      fd.set("dateOfConsignment", dateOfConsignment);
      fd.set("receiverName", receiverName);
      fd.set("receiverNicNo", receiverNicNo);
      fd.set("receiverNicPlaceOfIssue", receiverNicPlaceOfIssue);
      fd.set("receivedDate", receivedDate.trim());
      const r = await saveConsignmentNote(fd);
      if (r.ok) {
        setNoteId(r.id);
        setConsignmentNoteNo(r.consignmentNoteNo);
        setNoteStatus(ValidationStatus.PENDING);
        setBanner({
          type: "ok",
          text: noteId ? "Consignment note updated." : `Created ${r.consignmentNoteNo}.`,
        });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!noteId) return;
    setBusy("del");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("id", noteId);
      const r = await deleteConsignmentNote(fd);
      if (r.ok) {
        setNoteId(null);
        setConsignmentNoteNo("");
        setNoteStatus(null);
        setBanner({ type: "ok", text: "Pending consignment note deleted." });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onValidate() {
    if (!noteId) return;
    setBusy("val");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("id", noteId);
      const r = await validateConsignmentNote(fd);
      if (r.ok) {
        setNoteStatus(ValidationStatus.VALIDATED);
        setBanner({ type: "ok", text: "Consignment note validated." });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  const canDraft =
    authStatus === "ready" && session ? canCreateOrEditConsignmentNoteDraft(session.role) : false;
  const canValidate =
    authStatus === "ready" && session ? canValidateConsignmentNote(session.role) : false;

  const noteValidated = noteStatus === ValidationStatus.VALIDATED;
  const draftLocked = noteValidated || !canDraft;
  const saleNotValidated = saleStatus !== ValidationStatus.VALIDATED;
  const saveDisabled =
    busy !== null || !saleId || saleNotValidated || draftLocked || !canDraft;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Vehicle consignment note</h1>
        <p className="text-sm opacity-75">
          Clerks prepare a note for a <span className="font-medium">validated</span> sale (lifting).
          Supervisors validate the note. Name the <span className="font-medium">consigner</span>{" "}
          (staff at the sales point) and their designation. Quantities come from the delivery order
          and validated sales.
        </p>
      </div>

      {banner ? (
        <div
          className={
            banner.type === "error"
              ? "rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm text-red-800 dark:text-red-300"
              : "rounded-lg border border-emerald-600/40 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <div className="rounded-lg border border-border p-4 sm:p-5 space-y-4">
        <div className="text-sm font-semibold">Open</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium opacity-70">Sale invoice no.</label>
            <div className="flex flex-wrap gap-2 items-end">
              <input
                className="flex-1 min-w-[10rem] rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={invoiceLookup}
                onChange={(e) => setInvoiceLookup(e.target.value)}
                placeholder="PO-…"
              />
              <button
                type="button"
                disabled={busy !== null || !invoiceLookup.trim()}
                onClick={() => void onLoadByInvoice()}
                className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy === "inv" ? "Loading…" : "Load sale"}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium opacity-70">VCN no.</label>
            <div className="flex flex-wrap gap-2 items-end">
              <input
                className="flex-1 min-w-[10rem] rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={vcnLookup}
                onChange={(e) => setVcnLookup(e.target.value)}
                placeholder="VCN-2026-000001"
              />
              <button
                type="button"
                disabled={busy !== null || !vcnLookup.trim()}
                onClick={() => void onLoadByVcn()}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/25 disabled:opacity-50"
              >
                {busy === "vcn" ? "Loading…" : "Load note"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {saleId ? (
        <section className="rounded-lg border border-border p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Sale & delivery order context</h2>
              <p className="text-xs opacity-75 mt-1">
                Invoice <span className="font-medium tabular-nums">{invoiceNo}</span>
                {consignmentNoteNo ? (
                  <>
                    {" "}
                    · VCN <span className="font-medium tabular-nums">{consignmentNoteNo}</span>
                  </>
                ) : null}
              </p>
            </div>
            {noteId ? (
              <Link
                href={`/consignment-notes/${noteId}`}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/25"
              >
                View / print
              </Link>
            ) : null}
          </div>

          {saleNotValidated ? (
            <p className="text-sm text-amber-800 dark:text-amber-200/90">
              This sale is not validated yet. Validate the sale under Sales (POS) before saving a
              consignment note.
            </p>
          ) : null}

          {noteStatus ? (
            <p className="text-xs opacity-75">
              Note status: <span className="font-medium">{noteStatus}</span>
              {noteValidated ? (
                <span className="opacity-70">
                  {" "}
                  · Validated by <span className="font-medium">{validatedByName || "—"}</span>
                  {validatedAtIso ? (
                    <span>
                      {" "}
                      (
                      {new Date(validatedAtIso).toISOString().slice(0, 16).replace("T", " ")})
                    </span>
                  ) : null}
                </span>
              ) : null}
            </p>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs opacity-70">From (sales point)</div>
              <div className="font-medium">{fromName}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">Customer</div>
              <div className="font-medium">{customerName}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">Lifting delivery order</div>
              <div className="font-medium tabular-nums">{doNo ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">Qty lifted (this sale)</div>
              <div className="font-medium tabular-nums">{thisSaleLifted} kg</div>
            </div>
          </div>

          <div className="rounded-md border border-border p-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
            <div>
              <div className="opacity-70">Paid (DO)</div>
              <div className="font-medium tabular-nums">{paidQty}</div>
            </div>
            <div>
              <div className="opacity-70">Lifted (validated)</div>
              <div className="font-medium tabular-nums">{liftedQty}</div>
            </div>
            <div>
              <div className="opacity-70">Balance</div>
              <div className="font-medium tabular-nums">{balanceQty}</div>
            </div>
          </div>

          <h3 className="text-base font-semibold pt-2">Consignment details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1 sm:col-span-2">
              <label className="text-sm font-medium">To (destination)</label>
              <textarea
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm min-h-[4rem]"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={draftLocked}
                placeholder="Customer destination address"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Date of lifting</label>
              <input
                type="date"
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={dateOfLifting}
                onChange={(e) => setDateOfLifting(e.target.value)}
                disabled={draftLocked}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Vehicle no.</label>
              <input
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                disabled={draftLocked}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Consigner (staff at sales point)</label>
              <input
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={consignerName}
                onChange={(e) => setConsignerName(e.target.value)}
                disabled={draftLocked}
                placeholder="Full name"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Consigner designation</label>
              <input
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={consignerDesignation}
                onChange={(e) => setConsignerDesignation(e.target.value)}
                disabled={draftLocked}
                placeholder="e.g. Sales clerk, Depot supervisor"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Date of consignment</label>
              <input
                type="date"
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={dateOfConsignment}
                onChange={(e) => setDateOfConsignment(e.target.value)}
                disabled={draftLocked}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Receiver name</label>
              <input
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                disabled={draftLocked}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Receiver NIC no.</label>
              <input
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={receiverNicNo}
                onChange={(e) => setReceiverNicNo(e.target.value)}
                disabled={draftLocked}
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <label className="text-sm font-medium">Place of issue (NIC)</label>
              <input
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={receiverNicPlaceOfIssue}
                onChange={(e) => setReceiverNicPlaceOfIssue(e.target.value)}
                disabled={draftLocked}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Received date (optional)</label>
              <input
                type="date"
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                disabled={draftLocked}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => void onSave()}
              className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : noteId ? "Save changes" : "Save (create note)"}
            </button>
            {noteId && noteStatus === ValidationStatus.PENDING && canDraft ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onDelete()}
                className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-600/10 disabled:opacity-50"
              >
                {busy === "del" ? "Deleting…" : "Delete draft"}
              </button>
            ) : null}
            {noteId && noteStatus === ValidationStatus.PENDING && canValidate ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onValidate()}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/25 disabled:opacity-50"
              >
                {busy === "val" ? "Validating…" : "Validate"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
