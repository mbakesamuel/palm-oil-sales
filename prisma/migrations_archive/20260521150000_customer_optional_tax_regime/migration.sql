-- Allow customers without a tax regime; sales may snapshot null regime at posting time.

ALTER TABLE "Customer" ALTER COLUMN "taxRegimeId" DROP NOT NULL;

ALTER TABLE "Sale" ALTER COLUMN "taxRegimeId" DROP NOT NULL;
