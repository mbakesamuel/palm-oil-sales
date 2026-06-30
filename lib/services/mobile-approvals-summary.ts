import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import type { getPermissionsForSession } from "@/lib/access-control";
import { listPendingConsignmentNotesForSession } from "@/lib/services/mobile-consignment-notes";
import { listPendingDeliveryOrdersForSession } from "@/lib/services/do-validation-queue";
import { listPendingSalesForSession } from "@/lib/services/mobile-pending-sales";
import {
  listDraftReceiptsForSession,
  listTransfersForSession,
} from "@/lib/services/mobile-stock";

export type MobileApprovalsSummary = {
  total: number;
  validation: {
    sales: number;
    consignmentNotes: number;
    deliveryOrders: number;
  };
  stock: {
    receipts: number;
    transferDispatch: number;
    transferReceive: number;
  };
};

async function safeCount(load: () => Promise<number>): Promise<number> {
  try {
    return await load();
  } catch {
    return 0;
  }
}

export async function getPendingApprovalsSummaryForSession(
  session: AuthSession,
  permissions: Awaited<ReturnType<typeof getPermissionsForSession>>,
): Promise<MobileApprovalsSummary> {
  const [sales, consignmentNotes, deliveryOrders, receipts, transferDispatch, transferReceive] =
    await Promise.all([
      permissions["ui:validate-documents"]
        ? safeCount(async () => (await listPendingSalesForSession(session)).length)
        : Promise.resolve(0),
      permissions["ui:validate-documents"]
        ? safeCount(
            async () => (await listPendingConsignmentNotesForSession(session)).length,
          )
        : Promise.resolve(0),
      permissions["ui:validate-delivery-orders"]
        ? safeCount(async () => {
            const data = await listPendingDeliveryOrdersForSession(session, {
              pageSize: 1,
              filters: { reviewed: "all" },
            });
            return data.totalPending;
          })
        : Promise.resolve(0),
      permissions["route:/stock"] && permissions["ui:post-stock-receipt"]
        ? safeCount(async () => (await listDraftReceiptsForSession(session)).length)
        : Promise.resolve(0),
      permissions["ui:dispatch-stock-transfer"]
        ? safeCount(async () => (await listTransfersForSession(session, "dispatch")).length)
        : Promise.resolve(0),
      permissions["ui:receive-stock-transfer"]
        ? safeCount(async () => (await listTransfersForSession(session, "receive")).length)
        : Promise.resolve(0),
    ]);

  const validation = { sales, consignmentNotes, deliveryOrders };
  const stock = { receipts, transferDispatch, transferReceive };
  const total =
    sales +
    consignmentNotes +
    deliveryOrders +
    receipts +
    transferDispatch +
    transferReceive;

  return { total, validation, stock };
}
