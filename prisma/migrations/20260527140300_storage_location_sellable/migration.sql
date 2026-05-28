ALTER TABLE "StorageLocation"
ADD COLUMN "isSellable" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "StorageLocation" SET "isSellable" = TRUE WHERE "isSellable" IS NULL;

