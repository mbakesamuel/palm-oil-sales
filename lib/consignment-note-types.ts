import type { ValidationStatus } from "@/lib/domain";

export type DoContextDto = {
  deliveryOrderNo: string | null;
  paidQtyKg: string;
  liftedQtyKg: string;
  balanceQtyKg: string;
};

export type ConsignmentNotePrintModel = {
  consignmentNoteNo: string;
  status: ValidationStatus;
  validatedAtIso: string | null;
  validatedByName: string | null;
  invoiceNo: string;
  fromSalesPointName: string;
  destination: string;
  dateOfLiftingIso: string;
  vehicleNumber: string;
  deliveryOrderNo: string | null;
  doContext: DoContextDto;
  thisSaleLiftedQtyKg: string;
  consignerName: string;
  consignerDesignation: string;
  dateOfConsignmentIso: string;
  receiverName: string;
  receiverNicNo: string;
  receiverNicPlaceOfIssue: string;
  receivedDateIso: string | null;
  customerName: string;
  lines: Array<{ lineNo: number; productName: string; qtyKg: string }>;
};
