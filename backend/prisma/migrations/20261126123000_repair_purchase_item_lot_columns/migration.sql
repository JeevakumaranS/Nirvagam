ALTER TABLE "grn_items"
  ADD COLUMN IF NOT EXISTS "batch_number" TEXT,
  ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMP(3);

ALTER TABLE "purchase_invoice_items"
  ADD COLUMN IF NOT EXISTS "batch_number" TEXT,
  ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMP(3);
