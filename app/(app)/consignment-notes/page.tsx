import {
  deleteConsignmentNote,
  loadConsignmentByVcnNo,
  loadSaleForConsignmentByInvoice,
  saveConsignmentNote,
  validateConsignmentNote,
} from "./actions";
import { ConsignmentNotesClient } from "./ConsignmentNotesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ConsignmentNotesPage() {
  return (
    <ConsignmentNotesClient
      loadSaleForConsignmentByInvoice={loadSaleForConsignmentByInvoice}
      loadConsignmentByVcnNo={loadConsignmentByVcnNo}
      saveConsignmentNote={saveConsignmentNote}
      deleteConsignmentNote={deleteConsignmentNote}
      validateConsignmentNote={validateConsignmentNote}
    />
  );
}
