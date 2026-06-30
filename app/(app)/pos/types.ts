import type { SalePrintModel } from "@/components/SalePrint";
import type { PaymentMethodKind } from "@/lib/payment-methods/types";
import type {
  AvailableDeliveryOrderRow,
  PosLineStockPreview,
  PosTaxPreviewRow,
  SaveSaleResult,
} from "@/lib/services/pos-sales";
import type {
  PosSaleDisposition,
  PosSaleProductMode,
  ValidationStatus,
} from "@prisma/client";

export type {
  AvailableDeliveryOrderRow,
  PosLineStockPreview,
  PosTaxPreviewRow,
  SaveSaleResult,
};

export type SaleMutationResult = { ok: true } | { ok: false; error: string };

export type LoadedSaleView = {
  id: string;
  invoiceNo: string;
  soldAtIso: string;
  referenceNumber: string | null;
  salesPointId: number | null;
  salesPointName: string | null;
  customerId: string;
  customerName: string;
  taxpayerId: string | null;
  vatApplies: boolean;
  createdByUserId: string;
  createdByName: string;
  status: ValidationStatus;
  validatedAtIso: string | null;
  validatedByUserId: string | null;
  validatedByName: string | null;
  financialYear: number | null;
  financialMonth: number | null;
  postingCalendarYear: number | null;
  vehicleNumber: string;
  dateIssuedIso: string;
  deliveryOrderNo: string | null;
  saleProductMode: PosSaleProductMode | null;
  saleDisposition: PosSaleDisposition | null;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  lines: Array<{
    productId: number;
    productName: string;
    productCat: string;
    storageLocationId: number | null;
    qtyKg: string;
    qtyUnits: string | null;
    unitPricePerKg: string;
    unitPricePerUnit: string | null;
    lineNet: string;
    lineVat: string;
    lineGross: string;
  }>;
  payments: Array<{
    paymentMethodId: string;
    methodCode: string;
    methodName: string;
    kind: PaymentMethodKind;
    amount: string;
    chequeNo: string | null;
    bank: string | null;
    traiteNo: string | null;
    traiteIssuedOn: string | null;
    traiteMaturityOn: string | null;
    paidAtIso: string;
  }>;
  appliedTaxes: Array<{
    code: string;
    label: string;
    rate: string;
    amount: string;
  }>;
};

export type PendingSaleRow = {
  invoiceNo: string;
  soldAtIso: string;
  customerName: string;
  totalLabel: string;
  salesPointName: string | null;
};

export type SalePrintPayload = {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  logoSrc: string;
  sale: SalePrintModel;
};
