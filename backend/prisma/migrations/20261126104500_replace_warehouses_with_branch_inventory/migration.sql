ALTER TABLE "stock_balances"
  ADD COLUMN "branch_id" UUID;

UPDATE "stock_balances" AS balance
SET "branch_id" = warehouse."branch_id"
FROM "warehouses" AS warehouse
WHERE balance."warehouse_id" = warehouse."id";

WITH branch_balances AS (
  SELECT
    "branch_id",
    "variant_id",
    MIN("id"::text)::uuid AS "keeper_id",
    SUM("quantity") AS "quantity",
    CASE
      WHEN SUM("quantity") = 0 THEN AVG("average_cost")
      ELSE SUM("quantity" * "average_cost") / SUM("quantity")
    END AS "average_cost",
    MAX("updated_at") AS "updated_at"
  FROM "stock_balances"
  GROUP BY "branch_id", "variant_id"
)
UPDATE "stock_balances" AS balance
SET
  "quantity" = branch_balances."quantity",
  "average_cost" = branch_balances."average_cost",
  "updated_at" = branch_balances."updated_at"
FROM branch_balances
WHERE balance."id" = branch_balances."keeper_id";

WITH duplicate_balances AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "branch_id", "variant_id"
      ORDER BY "id"
    ) AS "duplicate_rank"
  FROM "stock_balances"
)
DELETE FROM "stock_balances" AS balance
USING duplicate_balances
WHERE balance."id" = duplicate_balances."id"
  AND duplicate_balances."duplicate_rank" > 1;

ALTER TABLE "stock_balances"
  ALTER COLUMN "branch_id" SET NOT NULL,
  DROP CONSTRAINT "stock_balances_warehouse_id_fkey";

DROP INDEX "stock_balances_warehouse_id_variant_id_key";
ALTER TABLE "stock_balances"
  DROP COLUMN "warehouse_id";

CREATE UNIQUE INDEX "stock_balances_branch_id_variant_id_key"
  ON "stock_balances"("branch_id", "variant_id");
ALTER TABLE "stock_balances"
  ADD CONSTRAINT "stock_balances_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD COLUMN "branch_id" UUID;

UPDATE "stock_movements" AS movement
SET "branch_id" = warehouse."branch_id"
FROM "warehouses" AS warehouse
WHERE movement."warehouse_id" = warehouse."id";

ALTER TABLE "stock_movements"
  ALTER COLUMN "branch_id" SET NOT NULL,
  DROP CONSTRAINT "stock_movements_warehouse_id_fkey";

ALTER TABLE "stock_movements"
  DROP COLUMN "warehouse_id",
  ADD CONSTRAINT "stock_movements_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "stock_movements_branch_id_idx"
  ON "stock_movements"("branch_id");

DROP TABLE "warehouses";

DELETE FROM "permissions"
WHERE "resource" = 'warehouse';
