-- Storage locations per sales point; batches store where stock sits at receipt.

CREATE TABLE "StorageLocation" (
    "id" SERIAL NOT NULL,
    "salesPointId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageLocation_salesPointId_name_key" ON "StorageLocation"("salesPointId", "name");
CREATE INDEX "StorageLocation_salesPointId_idx" ON "StorageLocation"("salesPointId");

ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StorageLocation" ("salesPointId", "name", "updatedAt")
SELECT id, 'Production tank 1', CURRENT_TIMESTAMP FROM "SalesPoint";

INSERT INTO "StorageLocation" ("salesPointId", "name", "updatedAt")
SELECT id, 'Production tank 2', CURRENT_TIMESTAMP FROM "SalesPoint";

ALTER TABLE "Batch" ADD COLUMN "storageLocationId" INTEGER;

UPDATE "Batch" b
SET "storageLocationId" = (
    SELECT sl.id
    FROM "StorageLocation" sl
    WHERE sl."salesPointId" = b."salesPointId"
      AND sl.name = 'Production tank 1'
    LIMIT 1
);

ALTER TABLE "Batch" ALTER COLUMN "storageLocationId" SET NOT NULL;

ALTER TABLE "Batch" ADD CONSTRAINT "Batch_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Batch_salesPointId_storageLocationId_productId_receivedAt_idx" ON "Batch"("salesPointId", "storageLocationId", "productId", "receivedAt");
