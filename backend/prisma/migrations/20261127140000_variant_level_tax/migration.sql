ALTER TABLE "product_variants"
  ADD COLUMN "tax_rate_id" UUID,
  ADD COLUMN "is_tax_inclusive" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "product_variants" AS variant
SET "tax_rate_id" = product."tax_rate_id",
    "is_tax_inclusive" = product."is_tax_inclusive",
    "retail_price" = COALESCE(variant."retail_price", product."retail_price")
FROM "products" AS product
WHERE variant."product_id" = product."id";

ALTER TABLE "product_variants"
  ALTER COLUMN "tax_rate_id" SET NOT NULL,
  ADD CONSTRAINT "product_variants_tax_rate_id_fkey"
    FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
