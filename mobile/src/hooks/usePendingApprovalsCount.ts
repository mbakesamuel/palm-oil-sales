import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { MobileApprovalsSummary } from "@pos/shared";
import { apiFetch } from "@/api/client";

export function usePendingApprovalsCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const res = await apiFetch<MobileApprovalsSummary>(
        "/api/mobile/v1/approvals/summary",
      );
      setCount(res.total);
    } catch {
      // Keep last count on transient errors.
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return count;
}
