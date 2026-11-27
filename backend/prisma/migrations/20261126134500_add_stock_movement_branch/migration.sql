ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "branch_id" UUID;

UPDATE "stock_movements" AS movement
SET "branch_id" = warehouse."branch_id"
FROM "warehouses" AS warehouse
WHERE movement."warehouse_id" = warehouse."id"
  AND movement."branch_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "stock_movements"
    WHERE "branch_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot assign a branch to every stock movement';
  END IF;
END $$;

ALTER TABLE "stock_movements"
  ALTER COLUMN "branch_id" SET NOT NULL;

DO $$
BEGIN
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
END $$;

CREATE INDEX IF NOT EXISTS "stock_movements_branch_id_idx"
  ON "stock_movements"("branch_id");
