ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "wholesale_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "retail_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reorder_level" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "image_url" TEXT,
  ADD COLUMN IF NOT EXISTS "tracking_mode" TEXT NOT NULL DEFAULT 'NONE';

ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'MANUAL_IN';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'MANUAL_OUT';

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "performed_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "batch_number" TEXT,
  ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "serial_number" TEXT;

CREATE INDEX IF NOT EXISTS "stock_movements_created_at_idx" ON "stock_movements" ("created_at");
CREATE INDEX IF NOT EXISTS "stock_movements_variant_id_idx" ON "stock_movements" ("variant_id");
