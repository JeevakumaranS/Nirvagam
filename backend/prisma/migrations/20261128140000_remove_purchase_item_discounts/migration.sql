ALTER TABLE IF EXISTS "purchase_order_items"
  DROP COLUMN IF EXISTS "discount_type",
  DROP COLUMN IF EXISTS "discount_value",
  DROP COLUMN IF EXISTS "discount_amount";

ALTER TABLE IF EXISTS "purchase_invoice_items"
  DROP COLUMN IF EXISTS "discount_amount";

ALTER TABLE IF EXISTS "purchase_return_items"
  DROP COLUMN IF EXISTS "discount_amount";
