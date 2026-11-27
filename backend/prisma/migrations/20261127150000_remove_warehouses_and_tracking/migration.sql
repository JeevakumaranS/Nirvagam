ALTER TABLE "stock_balances"
  ADD COLUMN IF NOT EXISTS "branch_id" UUID;

UPDATE "stock_balances" AS balance
SET "branch_id" = warehouse."branch_id"
FROM "warehouses" AS warehouse
WHERE balance."warehouse_id" = warehouse."id"
  AND balance."branch_id" IS NULL;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "stock_balances"
    WHERE "branch_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot assign a branch to every stock balance';
  END IF;
END
$migration$;

CREATE TEMP TABLE "stock_balances_by_branch" ON COMMIT DROP AS
SELECT
  "branch_id",
  "variant_id",
  (ARRAY_AGG("id" ORDER BY "id"))[1] AS "keep_id",
  SUM("quantity") AS "quantity",
  CASE
    WHEN SUM("quantity") > 0
      THEN SUM("quantity" * "average_cost") / SUM("quantity")
    ELSE MAX("average_cost")
  END AS "average_cost"
FROM "stock_balances"
GROUP BY "branch_id", "variant_id";

UPDATE "stock_balances" AS balance
SET
  "quantity" = grouped."quantity",
  "average_cost" = grouped."average_cost"
FROM "stock_balances_by_branch" AS grouped
WHERE balance."id" = grouped."keep_id";

DELETE FROM "stock_balances" AS balance
USING "stock_balances_by_branch" AS grouped
WHERE balance."branch_id" = grouped."branch_id"
  AND balance."variant_id" = grouped."variant_id"
  AND balance."id" <> grouped."keep_id";

ALTER TABLE "stock_balances"
  ALTER COLUMN "branch_id" SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_balances_branch_id_fkey'
      AND conrelid = '"stock_balances"'::regclass
  ) THEN
    ALTER TABLE "stock_balances"
      ADD CONSTRAINT "stock_balances_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$migration$;

DROP INDEX IF EXISTS "stock_balances_warehouse_id_variant_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "stock_balances_branch_id_variant_id_key"
  ON "stock_balances" ("branch_id", "variant_id");

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "branch_id" UUID;

UPDATE "stock_movements" AS movement
SET "branch_id" = warehouse."branch_id"
FROM "warehouses" AS warehouse
WHERE movement."warehouse_id" = warehouse."id"
  AND movement."branch_id" IS NULL;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "stock_movements"
    WHERE "branch_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot assign a branch to every stock movement';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_movements_branch_id_fkey'
      AND conrelid = '"stock_movements"'::regclass
  ) THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$migration$;

ALTER TABLE "stock_movements"
  ALTER COLUMN "branch_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "stock_movements_branch_id_idx"
  ON "stock_movements" ("branch_id");

ALTER TABLE "purchase_orders"
  DROP COLUMN IF EXISTS "warehouse_id";
ALTER TABLE "grn"
  DROP COLUMN IF EXISTS "warehouse_id";
ALTER TABLE "purchase_invoices"
  DROP COLUMN IF EXISTS "warehouse_id";
ALTER TABLE "purchase_returns"
  DROP COLUMN IF EXISTS "warehouse_id";

ALTER TABLE "stock_balances"
  DROP CONSTRAINT IF EXISTS "stock_balances_warehouse_id_fkey",
  DROP COLUMN IF EXISTS "warehouse_id";
ALTER TABLE "stock_movements"
  DROP CONSTRAINT IF EXISTS "stock_movements_warehouse_id_fkey",
  DROP COLUMN IF EXISTS "warehouse_id";

DROP TABLE IF EXISTS "warehouses";

DROP TABLE IF EXISTS "stock_tracking_balances";
ALTER TABLE "products"
  DROP COLUMN IF EXISTS "tracking_mode";
ALTER TABLE "stock_movements"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date",
  DROP COLUMN IF EXISTS "serial_number";
ALTER TABLE "grn_items"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date",
  DROP COLUMN IF EXISTS "serial_number";
ALTER TABLE "purchase_invoice_items"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date",
  DROP COLUMN IF EXISTS "serial_number";

DO $migration$
DECLARE
  target record;
BEGIN
  IF to_regclass('custom_fields') IS NOT NULL THEN
    DELETE FROM "custom_fields"
    WHERE "field_key" IN ('cf_batch_number', 'cf_expiry_date', 'cf_serial_number');
  END IF;

  FOR target IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
      AND t.table_name = c.table_name
    WHERE c.table_schema = current_schema()
      AND c.column_name IN ('cf_batch_number', 'cf_expiry_date', 'cf_serial_number')
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I', target.table_name, target.column_name);
  END LOOP;

  FOR target IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
      AND t.table_name = c.table_name
    WHERE c.table_schema = current_schema()
      AND c.column_name = 'custom_data'
      AND c.data_type = 'jsonb'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'UPDATE %I SET custom_data = custom_data - %L - %L - %L WHERE custom_data ? %L OR custom_data ? %L OR custom_data ? %L',
      target.table_name,
      'cf_batch_number',
      'cf_expiry_date',
      'cf_serial_number',
      'cf_batch_number',
      'cf_expiry_date',
      'cf_serial_number'
    );
  END LOOP;
END
$migration$;
