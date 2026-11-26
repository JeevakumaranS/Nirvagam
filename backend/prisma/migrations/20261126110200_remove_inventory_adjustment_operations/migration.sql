UPDATE "stock_movements"
SET "type" = 'MANUAL_IN'
WHERE "type" = 'ADJUSTMENT_ADD';

UPDATE "stock_movements"
SET "type" = 'MANUAL_OUT'
WHERE "type" = 'ADJUSTMENT_SUB';

CREATE TYPE "StockMovementType_new" AS ENUM (
  'MANUAL_IN',
  'MANUAL_OUT',
  'IN_PURCHASE',
  'OUT_SALE',
  'IN_TRANSFER',
  'OUT_TRANSFER',
  'RETURN_IN_CREDIT_NOTE',
  'RETURN_OUT_DEBIT_NOTE'
);

ALTER TABLE "stock_movements"
  ALTER COLUMN "type" TYPE "StockMovementType_new"
  USING ("type"::text::"StockMovementType_new");

DROP TYPE "StockMovementType";
ALTER TYPE "StockMovementType_new" RENAME TO "StockMovementType";

DELETE FROM "permissions"
WHERE "resource" = 'stock_adjustment';
