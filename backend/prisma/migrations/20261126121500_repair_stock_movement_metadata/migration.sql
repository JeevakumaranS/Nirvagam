ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "performed_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "reference_document_type" TEXT,
  ADD COLUMN IF NOT EXISTS "batch_number" TEXT,
  ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "serial_number" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_idempotency_key"
  ON "stock_movements" ("idempotency_key");
