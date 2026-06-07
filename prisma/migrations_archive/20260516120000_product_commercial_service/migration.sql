-- Optional commercial-line tag per product (null = shared across lines).

ALTER TABLE "Product" ADD COLUMN "commercialServiceId" TEXT;

CREATE INDEX "Product_commercialServiceId_idx" ON "Product"("commercialServiceId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
