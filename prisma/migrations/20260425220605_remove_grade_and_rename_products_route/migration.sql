/*
  Warnings:

  - You are about to drop the column `gradeId` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the `Grade` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_gradeId_fkey";

-- DropIndex
DROP INDEX "Batch_gradeId_receivedAt_idx";

-- AlterTable
ALTER TABLE "Batch" DROP COLUMN "gradeId";

-- DropTable
DROP TABLE "Grade";
