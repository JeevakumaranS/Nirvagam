ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "warehouse_id";
ALTER TABLE "grn" DROP COLUMN IF EXISTS "warehouse_id";
ALTER TABLE "purchase_invoices" DROP COLUMN IF EXISTS "warehouse_id";
ALTER TABLE "purchase_returns" DROP COLUMN IF EXISTS "warehouse_id";
