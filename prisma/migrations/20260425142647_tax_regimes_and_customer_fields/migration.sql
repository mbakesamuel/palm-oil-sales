/*
  Warnings:

  - You are about to drop the column `taxRegime` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `taxRegimeSnapshot` on the `Sale` table. All the data in the column will be lost.
  - Added the required column `taxRegimeId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taxRegimeId` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDUSTRY', 'WHOLE_SALE', 'RETAIL', 'WORKER');

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "taxRegime",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "customerType" "CustomerType" NOT NULL DEFAULT 'INDUSTRY',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "taxRegimeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "taxRegimeSnapshot",
ADD COLUMN     "taxRegimeId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "TaxRegime";

-- CreateTable
CREATE TABLE "TaxRegime" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vatApplies" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRegime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxRegime_name_key" ON "TaxRegime"("name");

-- CreateIndex
CREATE INDEX "Customer_taxRegimeId_idx" ON "Customer"("taxRegimeId");

-- CreateIndex
CREATE INDEX "Sale_taxRegimeId_soldAt_idx" ON "Sale"("taxRegimeId", "soldAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_taxRegimeId_fkey" FOREIGN KEY ("taxRegimeId") REFERENCES "TaxRegime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_taxRegimeId_fkey" FOREIGN KEY ("taxRegimeId") REFERENCES "TaxRegime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
