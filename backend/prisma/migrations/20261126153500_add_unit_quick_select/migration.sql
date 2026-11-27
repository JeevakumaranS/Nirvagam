ALTER TABLE "units"
  ADD COLUMN IF NOT EXISTS "is_quick_select" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "units"
SET "is_quick_select" = TRUE
WHERE "is_standard" = TRUE
  AND "symbol" IN ('BDL', 'DOZ', 'MTR', 'KGS', 'LTR', 'PCS', 'UNT');
