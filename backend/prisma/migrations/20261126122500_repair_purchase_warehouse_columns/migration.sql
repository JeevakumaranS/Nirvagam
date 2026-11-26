ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;

ALTER TABLE "grn"
  ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;

ALTER TABLE "purchase_invoices"
  ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;

ALTER TABLE "purchase_returns"
  ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;

UPDATE "purchase_orders" po
SET "warehouse_id" = COALESCE(
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = po."branch_id" AND w."is_default" = true
    ORDER BY w."created_at"
    LIMIT 1
  ),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = po."branch_id"
    ORDER BY w."created_at"
    LIMIT 1
  )
)
WHERE po."warehouse_id" IS NULL;

UPDATE "grn" g
SET "warehouse_id" = COALESCE(
  (SELECT po."warehouse_id" FROM "purchase_orders" po WHERE po."id" = g."purchase_order_id"),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = g."branch_id" AND w."is_default" = true
    ORDER BY w."created_at"
    LIMIT 1
  ),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = g."branch_id"
    ORDER BY w."created_at"
    LIMIT 1
  )
)
WHERE g."warehouse_id" IS NULL;

UPDATE "purchase_invoices" pi
SET "warehouse_id" = COALESCE(
  (SELECT po."warehouse_id" FROM "purchase_orders" po WHERE po."id" = pi."purchase_order_id"),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = pi."branch_id" AND w."is_default" = true
    ORDER BY w."created_at"
    LIMIT 1
  ),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = pi."branch_id"
    ORDER BY w."created_at"
    LIMIT 1
  )
)
WHERE pi."warehouse_id" IS NULL;

UPDATE "purchase_returns" pr
SET "warehouse_id" = COALESCE(
  (SELECT pi."warehouse_id" FROM "purchase_invoices" pi WHERE pi."id" = pr."purchase_invoice_id"),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = pr."branch_id" AND w."is_default" = true
    ORDER BY w."created_at"
    LIMIT 1
  ),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = pr."branch_id"
    ORDER BY w."created_at"
    LIMIT 1
  )
)
WHERE pr."warehouse_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "purchase_orders" WHERE "warehouse_id" IS NULL) THEN
    RAISE EXCEPTION 'Unable to map every purchase order to a warehouse';
  END IF;
  IF EXISTS (SELECT 1 FROM "grn" WHERE "warehouse_id" IS NULL) THEN
    RAISE EXCEPTION 'Unable to map every GRN to a warehouse';
  END IF;
  IF EXISTS (SELECT 1 FROM "purchase_returns" WHERE "warehouse_id" IS NULL) THEN
    RAISE EXCEPTION 'Unable to map every purchase return to a warehouse';
  END IF;
END $$;

ALTER TABLE "purchase_orders"
  ALTER COLUMN "warehouse_id" SET NOT NULL;

ALTER TABLE "grn"
  ALTER COLUMN "warehouse_id" SET NOT NULL;

ALTER TABLE "purchase_returns"
  ALTER COLUMN "warehouse_id" SET NOT NULL;
