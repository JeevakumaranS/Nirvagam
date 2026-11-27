ALTER TABLE IF EXISTS "products"
  DROP COLUMN IF EXISTS "tracking_mode";

ALTER TABLE IF EXISTS "stock_movements"
  DROP COLUMN IF EXISTS "serial_number";

ALTER TABLE IF EXISTS "grn_items"
  DROP COLUMN IF EXISTS "serial_number";

ALTER TABLE IF EXISTS "purchase_invoice_items"
  DROP COLUMN IF EXISTS "serial_number";
