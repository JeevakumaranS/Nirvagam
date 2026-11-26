ALTER TABLE "products"
  DROP COLUMN IF EXISTS "sales_price";

ALTER TABLE "product_variants"
  DROP COLUMN IF EXISTS "sales_price";
