import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  MobileCreateSaleRequest,
  MobilePosConfig,
  MobilePosLineInput,
  MobilePosPaymentInput,
} from "@pos/shared";
import { apiFetch } from "@/api/client";

export type PosSaleProductMode = "LOOSE" | "BOTTLE";
export type PosSaleDisposition = "NORMAL" | "RATION" | "PUBLIC_RELATION";

export type PosDraft = {
  saleProductMode: PosSaleProductMode;
  saleDisposition: PosSaleDisposition;
  customerId: string;
  customerName: string;
  useWalkInCustomer: boolean;
  walkInCustomerName: string;
  typedCustomerName: string;
  referenceNumber: string;
  vehicleNumber: string;
  deliveryOrderNo: string;
  transactionDate: string;
  lines: MobilePosLineInput[];
  payments: MobilePosPaymentInput[];
};

const defaultDraft = (): PosDraft => ({
  saleProductMode: "LOOSE",
  saleDisposition: "NORMAL",
  customerId: "",
  customerName: "",
  useWalkInCustomer: false,
  walkInCustomerName: "",
  typedCustomerName: "",
  referenceNumber: "",
  vehicleNumber: "",
  deliveryOrderNo: "",
  transactionDate: "",
  lines: [],
  payments: [],
});

type PosDraftContextValue = {
  config: MobilePosConfig | null;
  configError: string | null;
  loadingConfig: boolean;
  draft: PosDraft;
  setDraft: (patch: Partial<PosDraft>) => void;
  resetDraft: () => void;
  toCreateRequest: () => MobileCreateSaleRequest;
  reloadConfig: () => Promise<void>;
};

const PosDraftContext = createContext<PosDraftContextValue | null>(null);

export function PosDraftProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<MobilePosConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [draft, setDraftState] = useState<PosDraft>(defaultDraft);

  const reloadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const res = await apiFetch<{ config: MobilePosConfig }>(
        "/api/mobile/v1/pos/config",
      );
      setConfig(res.config);
      setDraftState((prev) => ({
        ...defaultDraft(),
        transactionDate:
          res.config.transactionDateMaxIso ??
          res.config.transactionDateMinIso ??
          "",
        saleProductMode: "LOOSE",
      }));
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Could not load POS config.");
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  const setDraft = useCallback((patch: Partial<PosDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraftState((prev) => ({
      ...defaultDraft(),
      transactionDate: prev.transactionDate,
      saleProductMode: "LOOSE",
    }));
  }, []);

  const toCreateRequest = useCallback((): MobileCreateSaleRequest => {
    return {
      customerId: draft.customerId || undefined,
      useWalkInCustomer: draft.useWalkInCustomer,
      walkInCustomerName: draft.walkInCustomerName || undefined,
      typedCustomerName: draft.typedCustomerName || undefined,
      referenceNumber: draft.referenceNumber || undefined,
      salesPointId: config?.effectiveSalesPointId ?? null,
      saleProductMode: draft.saleProductMode,
      saleDisposition: draft.saleDisposition,
      vehicleNumber: draft.vehicleNumber || undefined,
      deliveryOrderNo: draft.deliveryOrderNo || undefined,
      transactionDate: draft.transactionDate || undefined,
      lines: draft.lines,
      payments: draft.payments,
    };
  }, [config?.effectiveSalesPointId, draft]);

  const value = useMemo(
    () => ({
      config,
      configError,
      loadingConfig,
      draft,
      setDraft,
      resetDraft,
      toCreateRequest,
      reloadConfig,
    }),
    [
      config,
      configError,
      draft,
      loadingConfig,
      reloadConfig,
      resetDraft,
      setDraft,
      toCreateRequest,
    ],
  );

  return (
    <PosDraftContext.Provider value={value}>{children}</PosDraftContext.Provider>
  );
}

export function usePosDraft() {
  const ctx = useContext(PosDraftContext);
  if (!ctx) throw new Error("usePosDraft must be used within PosDraftProvider");
  return ctx;
}

export function isBottleMode(mode: PosSaleProductMode) {
  return mode === "BOTTLE";
}

export function isNoDeliveryOrderDisposition(disposition: PosSaleDisposition) {
  return disposition === "RATION" || disposition === "PUBLIC_RELATION";
}

export function isNonPaymentDisposition(disposition: PosSaleDisposition) {
  return disposition === "RATION" || disposition === "PUBLIC_RELATION";
}

export function usesTypedCustomerName(disposition: PosSaleDisposition) {
  return disposition === "RATION" || disposition === "PUBLIC_RELATION";
}

export function skipDeliveryOrder(
  mode: PosSaleProductMode,
  disposition: PosSaleDisposition,
) {
  return isBottleMode(mode) || isNoDeliveryOrderDisposition(disposition);
}

export function skipPayments(disposition: PosSaleDisposition) {
  return isNonPaymentDisposition(disposition);
}
