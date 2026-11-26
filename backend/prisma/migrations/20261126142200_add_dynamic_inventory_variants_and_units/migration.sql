ALTER TABLE "units"
  ADD COLUMN IF NOT EXISTS "is_standard" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "quantity_type" TEXT NOT NULL DEFAULT 'WHOLE',
  ADD COLUMN IF NOT EXISTS "uqc_code" TEXT;

UPDATE "units"
SET "is_standard" = TRUE
WHERE "symbol" IN (
  'PCS', 'NOS', 'UNT', 'PRS', 'DOZ', 'SET', 'KGS', 'GMS', 'MGS',
  'LTR', 'MLT', 'MTR', 'CMS', 'FT', 'SQM', 'SQF', 'BOX', 'PAC',
  'CTN', 'BAG', 'BTL', 'ROL', 'BDL', 'TBZ'
);

INSERT INTO "units" (
  "business_id", "name", "symbol", "decimal_places", "is_default",
  "is_standard", "quantity_type", "uqc_code", "created_at", "updated_at"
)
SELECT b."id", u."name", u."symbol", u."decimal_places", u."symbol" = 'PCS',
       TRUE, u."quantity_type", u."uqc_code", NOW(), NOW()
FROM "businesses" b
CROSS JOIN (VALUES
  ('Pieces', 'PCS', 0, 'WHOLE', 'PCS'),
  ('Numbers', 'NOS', 0, 'WHOLE', 'NOS'),
  ('Units', 'UNT', 0, 'WHOLE', 'UNT'),
  ('Pairs', 'PRS', 0, 'WHOLE', 'PRS'),
  ('Dozen', 'DOZ', 0, 'WHOLE', 'DOZ'),
  ('Sets', 'SET', 0, 'WHOLE', 'SET'),
  ('Kilograms', 'KGS', 3, 'DECIMAL', 'KGS'),
  ('Grams', 'GMS', 3, 'DECIMAL', 'GMS'),
  ('Milligrams', 'MGS', 3, 'DECIMAL', 'MGS'),
  ('Litres', 'LTR', 3, 'DECIMAL', 'LTR'),
  ('Millilitres', 'MLT', 3, 'DECIMAL', 'MLT'),
  ('Metres', 'MTR', 3, 'DECIMAL', 'MTR'),
  ('Centimetres', 'CMS', 3, 'DECIMAL', 'CMS'),
  ('Feet', 'FT', 3, 'DECIMAL', 'FT'),
  ('Square metres', 'SQM', 3, 'DECIMAL', 'SQM'),
  ('Square feet', 'SQF', 3, 'DECIMAL', 'SQF'),
  ('Boxes', 'BOX', 0, 'WHOLE', 'BOX'),
  ('Packs', 'PAC', 0, 'WHOLE', 'PAC'),
  ('Cartons', 'CTN', 0, 'WHOLE', 'CTN'),
  ('Bags', 'BAG', 0, 'WHOLE', 'BAG'),
  ('Bottles', 'BTL', 0, 'WHOLE', 'BTL'),
  ('Rolls', 'ROL', 0, 'WHOLE', 'ROL'),
  ('Bundles', 'BDL', 0, 'WHOLE', 'BDL'),
  ('Tablets', 'TBZ', 0, 'WHOLE', 'TBZ')
) AS u("name", "symbol", "decimal_places", "quantity_type", "uqc_code")
ON CONFLICT ("business_id", "symbol") DO NOTHING;

UPDATE "units" SET "is_standard" = TRUE
WHERE "symbol" IN (
  'PCS', 'NOS', 'UNT', 'PRS', 'DOZ', 'SET', 'KGS', 'GMS', 'MGS',
  'LTR', 'MLT', 'MTR', 'CMS', 'FT', 'SQM', 'SQF', 'BOX', 'PAC',
  'CTN', 'BAG', 'BTL', 'ROL', 'BDL', 'TBZ'
);
UPDATE "units"
SET "quantity_type" = CASE
      WHEN "symbol" IN ('KGS', 'GMS', 'MGS', 'LTR', 'MLT', 'MTR', 'CMS', 'FT', 'SQM', 'SQF') THEN 'DECIMAL'
      ELSE 'WHOLE'
    END,
    "decimal_places" = CASE
      WHEN "symbol" IN ('KGS', 'GMS', 'MGS', 'LTR', 'MLT', 'MTR', 'CMS', 'FT', 'SQM', 'SQF') THEN 3
      ELSE 0
    END,
    "uqc_code" = COALESCE("uqc_code", "symbol")
WHERE "is_standard" = TRUE;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "has_variants" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "tracking_mode" TEXT NOT NULL DEFAULT 'NONE';

ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "attributes" JSONB,
  ADD COLUMN IF NOT EXISTS "attribute_search" TEXT,
  ADD COLUMN IF NOT EXISTS "combination_key" TEXT,
  ADD COLUMN IF NOT EXISTS "retail_price" DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "min_stock_level" DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "image_url" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_product_id_combination_key_key"
  ON "product_variants" ("product_id", "combination_key");
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_barcode_key"
  ON "product_variants" ("barcode");
CREATE INDEX IF NOT EXISTS "product_variants_attribute_search_idx"
  ON "product_variants" USING GIN (to_tsvector('simple', COALESCE("attribute_search", '')));

ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_IN';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_OUT';

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "batch_number" TEXT,
  ADD COLUMN IF NOT EXISTS "expiry_date" DATE,
  ADD COLUMN IF NOT EXISTS "serial_number" TEXT;

CREATE TABLE IF NOT EXISTS "stock_tracking_balances" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "branch_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "tracking_key" TEXT NOT NULL,
  "batch_number" TEXT,
  "expiry_date" DATE,
  "serial_number" TEXT,
  "quantity" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_tracking_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_tracking_balances_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_tracking_balances_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_tracking_balances_branch_id_variant_id_tracking_key_key"
  ON "stock_tracking_balances"("branch_id", "variant_id", "tracking_key");
CREATE INDEX IF NOT EXISTS "stock_tracking_balances_variant_id_batch_number_idx"
  ON "stock_tracking_balances"("variant_id", "batch_number");
CREATE INDEX IF NOT EXISTS "stock_tracking_balances_variant_id_expiry_date_idx"
  ON "stock_tracking_balances"("variant_id", "expiry_date");
CREATE INDEX IF NOT EXISTS "stock_tracking_balances_variant_id_serial_number_idx"
  ON "stock_tracking_balances"("variant_id", "serial_number");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_tracking_balances_active_serial_key"
  ON "stock_tracking_balances"("variant_id", LOWER("serial_number"))
  WHERE "serial_number" IS NOT NULL AND "quantity" > 0;
