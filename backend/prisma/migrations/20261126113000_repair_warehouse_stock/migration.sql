-- Repair branch-based stock layouts into the warehouse-based schema.
-- Existing tenant data is preserved by mapping each branch stock row to the
-- branch default warehouse, creating one when it is missing.
CREATE TABLE IF NOT EXISTS "warehouses" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "branch_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "warehouses_branch_id_code_key" UNIQUE ("branch_id","code")
);

INSERT INTO "warehouses" ("id","branch_id","name","code","is_default","created_at","updated_at")
SELECT
  uuidv7(),
  b."id",
  'Default Warehouse',
  'DEFAULT',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "branches" b
WHERE NOT EXISTS (
  SELECT 1 FROM "warehouses" w WHERE w."branch_id" = b."id"
);

ALTER TABLE "stock_balances"
  ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;

UPDATE "stock_balances" sb
SET "warehouse_id" = COALESCE(
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = sb."branch_id"
      AND w."is_default" = true
    ORDER BY w."created_at"
    LIMIT 1
  ),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = sb."branch_id"
    ORDER BY w."created_at"
    LIMIT 1
  )
)
WHERE sb."warehouse_id" IS NULL;

DELETE FROM "stock_balances"
WHERE "warehouse_id" IS NULL;

ALTER TABLE "stock_balances"
  ALTER COLUMN "warehouse_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "stock_balances_warehouse_id_variant_id_key"
  ON "stock_balances" ("warehouse_id","variant_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_balances_warehouse_id_fkey'
  ) THEN
    ALTER TABLE "stock_balances"
      ADD CONSTRAINT "stock_balances_warehouse_id_fkey"
      FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;

UPDATE "stock_movements" sm
SET "warehouse_id" = COALESCE(
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = sm."branch_id"
      AND w."is_default" = true
    ORDER BY w."created_at"
    LIMIT 1
  ),
  (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."branch_id" = sm."branch_id"
    ORDER BY w."created_at"
    LIMIT 1
  )
)
WHERE sm."warehouse_id" IS NULL;

ALTER TABLE "stock_movements"
  ALTER COLUMN "warehouse_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_movements_warehouse_id_fkey'
  ) THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_warehouse_id_fkey"
      FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
