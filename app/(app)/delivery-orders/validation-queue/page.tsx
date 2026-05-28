import Link from "next/link";
import { redirect } from "next/navigation";
import { ValidationQueueClient } from "./ValidationQueueClient";
import {
  listPendingDeliveryOrdersForValidation,
  markDeliveryOrdersReviewed,
  validateReviewedDeliveryOrders,
} from "./actions";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@/lib/domain";
import { assertPermissionKey } from "@/lib/access-control";

export default async function DeliveryOrderValidationQueuePage() {
  await assertPermissionKey("route:/delivery-orders");
  await assertPermissionKey("route:/delivery-orders/validation-queue");

  const session = await getServerSession();
  if (!session?.userId) redirect("/login");
  if (session.role !== UserRole.MANAGER) redirect("/forbidden");

  const initialPage = await listPendingDeliveryOrdersForValidation({ pageSize: 50 });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Delivery Order validation queue</div>
          <div className="text-sm text-muted-foreground">
            Two-step flow: mark reviewed, then validate reviewed.
          </div>
        </div>
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href="/delivery-orders"
        >
          Back to Delivery Orders
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <ValidationQueueClient
          initialPage={initialPage}
          listAction={listPendingDeliveryOrdersForValidation}
          markReviewedAction={markDeliveryOrdersReviewed}
          validateReviewedAction={validateReviewedDeliveryOrders}
        />
      </div>
    </div>
  );
}

