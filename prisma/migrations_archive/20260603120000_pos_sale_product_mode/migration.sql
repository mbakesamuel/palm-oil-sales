-- CreateEnum
CREATE TYPE "PosSaleProductMode" AS ENUM ('LOOSE', 'BOTTLE');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "saleProductMode" "PosSaleProductMode";
