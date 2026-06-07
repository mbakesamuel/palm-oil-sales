/*
  Warnings:

  - You are about to drop the column `customerTaxpayerIdSnapshot` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `costPerKgSnapshot` on the `SaleLine` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "customerTaxpayerIdSnapshot";

-- AlterTable
ALTER TABLE "SaleLine" DROP COLUMN "costPerKgSnapshot";
