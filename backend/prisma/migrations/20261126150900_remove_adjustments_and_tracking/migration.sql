DELETE FROM "stock_movements"
WHERE "type"::TEXT LIKE 'ADJUSTMENT_%';

DROP TABLE IF EXISTS "stock_tracking_balances";

ALTER TABLE IF EXISTS "products"
  DROP COLUMN IF EXISTS "tracking_mode";

ALTER TABLE IF EXISTS "stock_movements"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date",
  DROP COLUMN IF EXISTS "serial_number";

ALTER TABLE IF EXISTS "grn_items"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date",
  DROP COLUMN IF EXISTS "serial_number";

ALTER TABLE IF EXISTS "purchase_invoice_items"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date",
  DROP COLUMN IF EXISTS "serial_number";

DO $migration$
DECLARE
  enum_values TEXT;
BEGIN
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder)
  INTO enum_values
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = current_schema()
    AND t.typname = 'StockMovementType'
    AND e.enumlabel NOT LIKE 'ADJUSTMENT_%';

  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema()
      AND t.typname = 'StockMovementType'
      AND e.enumlabel LIKE 'ADJUSTMENT_%'
  ) THEN
    ALTER TYPE "StockMovementType" RENAME TO "StockMovementType_old";
    EXECUTE 'CREATE TYPE "StockMovementType" AS ENUM (' || enum_values || ')';
    ALTER TABLE "stock_movements"
      ALTER COLUMN "type" TYPE "StockMovementType"
      USING "type"::TEXT::"StockMovementType";
    DROP TYPE "StockMovementType_old";
  END IF;
END
$migration$;
