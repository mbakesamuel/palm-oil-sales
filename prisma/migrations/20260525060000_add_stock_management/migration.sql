-- Stock management per sales point.
-- Models: StockBalance, StockMovement, StockReceipt(+Line), StockTransfer(+Line),
-- StockAdjustment(+Line), and yearly sequence tables.

-- Enums
CREATE TYPE "StockMovementKind" AS ENUM (
  'RECEIPT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'SALE',
  'SALE_REVERSAL',
  'ADJUSTMENT'
);

CREATE TYPE "StockDocStatus" AS ENUM (
  'DRAFT',
  'POSTED',
  'DISPATCHED',
  'RECEIVED',
  'CANCELLED'
);

-- Sequences
CREATE TABLE "StockReceiptSequence" (
  "calendarYear" INTEGER NOT NULL,
  "nextNumber"   INTEGER NOT NULL DEFAULT 1,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockReceiptSequence_pkey" PRIMARY KEY ("calendarYear")
);

CREATE TABLE "StockTransferSequence" (
  "calendarYear" INTEGER NOT NULL,
  "nextNumber"   INTEGER NOT NULL DEFAULT 1,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockTransferSequence_pkey" PRIMARY KEY ("calendarYear")
);

CREATE TABLE "StockAdjustmentSequence" (
  "calendarYear" INTEGER NOT NULL,
  "nextNumber"   INTEGER NOT NULL DEFAULT 1,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockAdjustmentSequence_pkey" PRIMARY KEY ("calendarYear")
);

-- StockBalance (denormalized on-hand)
CREATE TABLE "StockBalance" (
  "salesPointId" INTEGER NOT NULL,
  "productId"    INTEGER NOT NULL,
  "qty"          DECIMAL(14,3) NOT NULL,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("salesPointId", "productId")
);

CREATE INDEX "StockBalance_productId_idx" ON "StockBalance"("productId");

ALTER TABLE "StockBalance"
  ADD CONSTRAINT "StockBalance_salesPointId_fkey"
  FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBalance"
  ADD CONSTRAINT "StockBalance_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE CASCADE ON UPDATE CASCADE;

-- StockMovement (immutable ledger)
CREATE TABLE "StockMovement" (
  "id"           TEXT NOT NULL,
  "salesPointId" INTEGER NOT NULL,
  "productId"    INTEGER NOT NULL,
  "kind"         "StockMovementKind" NOT NULL,
  "qty"          DECIMAL(14,3) NOT NULL,
  "occurredAt"   TIMESTAMP(3) NOT NULL,
  "userId"       TEXT NOT NULL,
  "sourceKind"   TEXT NOT NULL,
  "sourceId"     TEXT NOT NULL,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_salesPointId_productId_occurredAt_idx"
  ON "StockMovement"("salesPointId", "productId", "occurredAt");
CREATE INDEX "StockMovement_sourceKind_sourceId_idx"
  ON "StockMovement"("sourceKind", "sourceId");
CREATE INDEX "StockMovement_occurredAt_idx" ON "StockMovement"("occurredAt");
CREATE INDEX "StockMovement_userId_occurredAt_idx"
  ON "StockMovement"("userId", "occurredAt");

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_salesPointId_fkey"
  FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StockReceipt
CREATE TABLE "StockReceipt" (
  "id"              TEXT NOT NULL,
  "receiptNo"       TEXT NOT NULL,
  "salesPointId"    INTEGER NOT NULL,
  "receivedAt"      DATE NOT NULL,
  "supplierLabel"   TEXT NOT NULL,
  "status"          "StockDocStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"           TEXT,
  "createdByUserId" TEXT NOT NULL,
  "postedByUserId"  TEXT,
  "postedAt"        TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockReceipt_receiptNo_key" ON "StockReceipt"("receiptNo");
CREATE INDEX "StockReceipt_salesPointId_receivedAt_idx"
  ON "StockReceipt"("salesPointId", "receivedAt");
CREATE INDEX "StockReceipt_status_receivedAt_idx"
  ON "StockReceipt"("status", "receivedAt");

ALTER TABLE "StockReceipt"
  ADD CONSTRAINT "StockReceipt_salesPointId_fkey"
  FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReceipt"
  ADD CONSTRAINT "StockReceipt_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReceipt"
  ADD CONSTRAINT "StockReceipt_postedByUserId_fkey"
  FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StockReceiptLine" (
  "id"        TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "qty"       DECIMAL(14,3) NOT NULL,
  CONSTRAINT "StockReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockReceiptLine_receiptId_idx" ON "StockReceiptLine"("receiptId");
CREATE INDEX "StockReceiptLine_productId_idx" ON "StockReceiptLine"("productId");

ALTER TABLE "StockReceiptLine"
  ADD CONSTRAINT "StockReceiptLine_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReceiptLine"
  ADD CONSTRAINT "StockReceiptLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StockTransfer
CREATE TABLE "StockTransfer" (
  "id"                 TEXT NOT NULL,
  "transferNo"         TEXT NOT NULL,
  "fromSalesPointId"   INTEGER NOT NULL,
  "toSalesPointId"     INTEGER NOT NULL,
  "dispatchedAt"       DATE,
  "receivedAt"         DATE,
  "status"             "StockDocStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"              TEXT,
  "createdByUserId"    TEXT NOT NULL,
  "dispatchedByUserId" TEXT,
  "receivedByUserId"   TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockTransfer_transferNo_key" ON "StockTransfer"("transferNo");
CREATE INDEX "StockTransfer_fromSalesPointId_status_idx"
  ON "StockTransfer"("fromSalesPointId", "status");
CREATE INDEX "StockTransfer_toSalesPointId_status_idx"
  ON "StockTransfer"("toSalesPointId", "status");
CREATE INDEX "StockTransfer_status_dispatchedAt_idx"
  ON "StockTransfer"("status", "dispatchedAt");

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_fromSalesPointId_fkey"
  FOREIGN KEY ("fromSalesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_toSalesPointId_fkey"
  FOREIGN KEY ("toSalesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_dispatchedByUserId_fkey"
  FOREIGN KEY ("dispatchedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_receivedByUserId_fkey"
  FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StockTransferLine" (
  "id"         TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "productId"  INTEGER NOT NULL,
  "qty"        DECIMAL(14,3) NOT NULL,
  CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");
CREATE INDEX "StockTransferLine_productId_idx" ON "StockTransferLine"("productId");

ALTER TABLE "StockTransferLine"
  ADD CONSTRAINT "StockTransferLine_transferId_fkey"
  FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockTransferLine"
  ADD CONSTRAINT "StockTransferLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StockAdjustment
CREATE TABLE "StockAdjustment" (
  "id"              TEXT NOT NULL,
  "adjustmentNo"    TEXT NOT NULL,
  "salesPointId"    INTEGER NOT NULL,
  "occurredAt"      DATE NOT NULL,
  "reason"          TEXT NOT NULL,
  "status"          "StockDocStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "postedByUserId"  TEXT,
  "postedAt"        TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockAdjustment_adjustmentNo_key" ON "StockAdjustment"("adjustmentNo");
CREATE INDEX "StockAdjustment_salesPointId_occurredAt_idx"
  ON "StockAdjustment"("salesPointId", "occurredAt");
CREATE INDEX "StockAdjustment_status_occurredAt_idx"
  ON "StockAdjustment"("status", "occurredAt");

ALTER TABLE "StockAdjustment"
  ADD CONSTRAINT "StockAdjustment_salesPointId_fkey"
  FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment"
  ADD CONSTRAINT "StockAdjustment_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment"
  ADD CONSTRAINT "StockAdjustment_postedByUserId_fkey"
  FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StockAdjustmentLine" (
  "id"           TEXT NOT NULL,
  "adjustmentId" TEXT NOT NULL,
  "productId"    INTEGER NOT NULL,
  "deltaQty"     DECIMAL(14,3) NOT NULL,
  CONSTRAINT "StockAdjustmentLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockAdjustmentLine_adjustmentId_idx" ON "StockAdjustmentLine"("adjustmentId");
CREATE INDEX "StockAdjustmentLine_productId_idx" ON "StockAdjustmentLine"("productId");

ALTER TABLE "StockAdjustmentLine"
  ADD CONSTRAINT "StockAdjustmentLine_adjustmentId_fkey"
  FOREIGN KEY ("adjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAdjustmentLine"
  ADD CONSTRAINT "StockAdjustmentLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;
