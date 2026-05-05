-- Rename consignee (customer-facing) to consigner (staff at sales point) and add designation.
ALTER TABLE "VehicleConsignmentNote" RENAME COLUMN "consigneeName" TO "consignerName";

ALTER TABLE "VehicleConsignmentNote" ADD COLUMN "consignerDesignation" TEXT NOT NULL DEFAULT '';

ALTER TABLE "VehicleConsignmentNote" ALTER COLUMN "consignerDesignation" DROP DEFAULT;
