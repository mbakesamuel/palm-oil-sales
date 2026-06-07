-- CreateEnum
CREATE TYPE "PosSaleDisposition" AS ENUM ('NORMAL', 'RATION', 'PUBLIC_RELATION');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "saleDisposition" "PosSaleDisposition" DEFAULT 'NORMAL';
