ALTER TABLE "products"
  DROP COLUMN IF EXISTS "category_id",
  DROP COLUMN IF EXISTS "brand_id";

DROP TABLE IF EXISTS "categories";
DROP TABLE IF EXISTS "brands";
