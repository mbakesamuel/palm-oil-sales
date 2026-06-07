-- DeliveryOrder correction workflow: cancel a previously validated DO (without deleting history).

ALTER TABLE "DeliveryOrder"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledByUserId" TEXT,
  ADD COLUMN "cancelReason" TEXT;

CREATE INDEX "DeliveryOrder_status_cancelledAt_idx"
  ON "DeliveryOrder" ("status", "cancelledAt");

ALTER TABLE "DeliveryOrder"
  ADD CONSTRAINT "DeliveryOrder_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

