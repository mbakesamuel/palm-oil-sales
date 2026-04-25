/*
  Warnings:

  - You are about to drop the column `gradeId` on the `SaleLine` table. All the data in the column will be lost.
  - Added the required column `productId` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `SaleLine` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SaleLine" DROP CONSTRAINT "SaleLine_gradeId_fkey";

-- DropIndex
DROP INDEX "SaleLine_gradeId_idx";

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "productId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SaleLine" DROP COLUMN "gradeId",
ADD COLUMN     "productId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "PRODUCT" (
    "productId" SERIAL NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT,
    "productCatId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRODUCT_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "PRODUCT_CAT" (
    "productCatId" SERIAL NOT NULL,
    "productCat" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRODUCT_CAT_pkey" PRIMARY KEY ("productCatId")
);

-- CreateIndex
CREATE INDEX "Batch_productId_receivedAt_idx" ON "Batch"("productId", "receivedAt");

-- CreateIndex
CREATE INDEX "SaleLine_productId_idx" ON "SaleLine"("productId");

-- AddForeignKey
ALTER TABLE "PRODUCT" ADD CONSTRAINT "PRODUCT_productCatId_fkey" FOREIGN KEY ("productCatId") REFERENCES "PRODUCT_CAT"("productCatId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRODUCT"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRODUCT"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;
