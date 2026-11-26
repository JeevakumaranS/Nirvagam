ALTER TABLE "stock_movements"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date";

ALTER TABLE "grn_items"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date";

ALTER TABLE "purchase_invoice_items"
  DROP COLUMN IF EXISTS "batch_number",
  DROP COLUMN IF EXISTS "expiry_date";

UPDATE "products"
SET "tracking_mode" = 'NONE'
WHERE "tracking_mode" IN ('BATCH', 'EXPIRY');

DO $migration$
DECLARE
  target record;
BEGIN
  IF to_regclass('custom_fields') IS NOT NULL THEN
    DELETE FROM "custom_fields"
    WHERE "field_key" IN ('cf_batch_number', 'cf_expiry_date');
  END IF;

  FOR target IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
      AND t.table_name = c.table_name
    WHERE c.table_schema = current_schema()
      AND c.column_name IN ('cf_batch_number', 'cf_expiry_date')
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
      'UPDATE %I SET custom_data = custom_data - %L - %L WHERE custom_data ? %L OR custom_data ? %L',
      target.table_name,
      'cf_batch_number',
      'cf_expiry_date',
      'cf_batch_number',
      'cf_expiry_date'
    );
  END LOOP;
END
$migration$;
