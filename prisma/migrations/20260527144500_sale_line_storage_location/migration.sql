ALTER TABLE "SaleLine"
ADD COLUMN IF NOT EXISTS "storageLocationId" INTEGER;

ALTER TABLE "SaleLine"
ADD CONSTRAINT "SaleLine_storageLocationId_fkey"
FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SaleLine_storageLocationId_idx" ON "SaleLine"("storageLocationId");

