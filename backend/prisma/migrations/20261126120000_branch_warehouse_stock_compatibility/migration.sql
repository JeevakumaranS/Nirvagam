ALTER TABLE "stock_balances"
  ALTER COLUMN "warehouse_id" DROP NOT NULL;

ALTER TABLE "stock_movements"
  ALTER COLUMN "warehouse_id" DROP NOT NULL;

ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_SUB';

ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "sales_price" DECIMAL(15,2) NOT NULL DEFAULT 0;
